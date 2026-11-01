const http = require('http');
const net = require('net');
const url = require('url');
const { SocksProxyAgent } = require('socks-proxy-agent');
const proxyPool = require('./proxyPool');

class RotatorServer {
  constructor() {
    this.server = null;
    this.port = 8899;
    this.isRunning = false;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.strategy = 'round-robin'; // 'round-robin' | 'random' | 'lowest-latency'
    this.currentIndex = 0;
    this.onLog = () => {};
  }

  setLogger(logger) {
    this.onLog = logger;
  }

  getNextProxy() {
    const alive = proxyPool.getAlive();
    if (!alive.length) return null;

    if (this.strategy === 'lowest-latency') {
      const sorted = [...alive].sort((a, b) => (a.latency || 9999) - (b.latency || 9999));
      return sorted[0];
    } else if (this.strategy === 'random') {
      return alive[Math.floor(Math.random() * alive.length)];
    } else {
      // Round-robin
      this.currentIndex = (this.currentIndex + 1) % alive.length;
      return alive[this.currentIndex];
    }
  }

  start(port = 8899) {
    if (this.isRunning) return;
    this.port = port;

    this.server = http.createServer((req, res) => {
      this.totalRequests++;
      const proxy = this.getNextProxy();

      if (!proxy) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('Tor-Pulse Rotator: No verified alive proxies available in the pool. Run Scraper & Health Check first.');
        return;
      }

      const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      
      const attemptRequest = (retryCount = 0) => {
        const proxy = this.getNextProxy();
        if (!proxy) {
          res.writeHead(503, { 'Content-Type': 'text/plain' });
          res.end('Tor-Pulse Rotator: No verified alive proxies available.');
          return;
        }

        this.onLog(`[ROTATOR] HTTP ${req.method} ${parsed.pathname} -> Routed via [${proxy.protocol}] ${proxy.ip}:${proxy.port}`);

        const options = {
          host: proxy.ip,
          port: proxy.port,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: parsed.host },
          timeout: 6000
        };

        const proxyReq = http.request(options, (proxyRes) => {
          this.successfulRequests++;
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });

        proxyReq.on('timeout', () => {
          proxyReq.destroy();
          if (retryCount < 2) {
            this.onLog(`[ROTATOR] Upstream timed out on ${proxy.ip}:${proxy.port}, rotating to next proxy...`);
            attemptRequest(retryCount + 1);
          } else {
            res.writeHead(504, { 'Content-Type': 'text/plain' });
            res.end('Proxy upstream timed out');
          }
        });

        proxyReq.on('error', (err) => {
          if (retryCount < 2) {
            this.onLog(`[ROTATOR] Upstream error on ${proxy.ip}:${proxy.port} (${err.code}), rotating to next proxy...`);
            attemptRequest(retryCount + 1);
          } else {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Proxy upstream failed: ' + err.message);
          }
        });

        req.pipe(proxyReq);
      };

      attemptRequest(0);
    });

    // Handle HTTPS CONNECT tunneling
    this.server.on('connect', (req, clientSocket, head) => {
      this.totalRequests++;
      const proxy = this.getNextProxy();

      if (!proxy) {
        clientSocket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
        clientSocket.end();
        return;
      }

      this.onLog(`[ROTATOR] HTTPS CONNECT ${req.url} -> Tunneling via [${proxy.protocol}] ${proxy.ip}:${proxy.port}`);

      const [targetHost, targetPort] = req.url.split(':');

      if (proxy.protocol === 'SOCKS5' || proxy.protocol === 'SOCKS4') {
        const agent = new SocksProxyAgent(`${proxy.protocol.toLowerCase()}://${proxy.ip}:${proxy.port}`);
        // Socks socket creation
        agent.connect({ host: targetHost, port: Number(targetPort) }, (err, upstreamSocket) => {
          if (err || !upstreamSocket) {
            clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
            clientSocket.end();
            return;
          }
          this.successfulRequests++;
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          upstreamSocket.write(head);
          upstreamSocket.pipe(clientSocket);
          clientSocket.pipe(upstreamSocket);
        });
      } else {
        // HTTP CONNECT tunnel through HTTP/HTTPS proxy
        const upstreamSocket = net.connect(proxy.port, proxy.ip, () => {
          this.successfulRequests++;
          upstreamSocket.write(`CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\n\r\n`);
        });

        let established = false;
        upstreamSocket.on('data', (chunk) => {
          if (!established) {
            established = true;
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head && head.length) upstreamSocket.write(head);
            upstreamSocket.pipe(clientSocket);
            clientSocket.pipe(upstreamSocket);
          }
        });

        upstreamSocket.on('error', (err) => {
          clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          clientSocket.end();
        });

        clientSocket.on('error', () => upstreamSocket.destroy());
      }
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      this.isRunning = true;
      this.onLog(`[ROTATOR] 🌟 Local Rotating Gateway active on http://127.0.0.1:${this.port}`);
    });

    this.server.on('error', (err) => {
      this.onLog(`[ROTATOR] Server error: ${err.message}`);
    });
  }

  stop() {
    if (this.server && this.isRunning) {
      this.server.close();
      this.isRunning = false;
      this.onLog('[ROTATOR] Rotating Gateway stopped.');
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      port: this.port,
      endpoint: `http://127.0.0.1:${this.port}`,
      strategy: this.strategy,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      availableAlive: proxyPool.getAlive().length
    };
  }
}

module.exports = new RotatorServer();
