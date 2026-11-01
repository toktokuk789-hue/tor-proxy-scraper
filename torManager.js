const net = require('net');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const proxyPool = require('./proxyPool');

class TorManager {
  constructor() {
    this.socksPorts = [9150, 9050, 9152, 9052]; // 9150: Tor Browser, 9050: Tor Daemon
    this.controlPorts = [9151, 9051, 9153, 9053];
    this.activeSocksPort = null;
    this.activeControlPort = null;
    this.isConnected = false;
    this.currentTorIp = null;
    this.latency = null;
    this.lastChecked = null;
    this.lastRotated = null;
  }

  // Probe if a port is open
  async probePort(port, host = '127.0.0.1', timeout = 1000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  // Detect active Tor ports and connection state
  async checkStatus() {
    let foundSocks = null;
    for (const port of this.socksPorts) {
      const isOpen = await this.probePort(port);
      if (isOpen) {
        foundSocks = port;
        break;
      }
    }

    let foundControl = null;
    for (const port of this.controlPorts) {
      const isOpen = await this.probePort(port);
      if (isOpen) {
        foundControl = port;
        break;
      }
    }

    this.activeSocksPort = foundSocks;
    this.activeControlPort = foundControl;
    this.isConnected = Boolean(foundSocks);
    this.lastChecked = new Date().toISOString();

    if (this.isConnected) {
      try {
        const agent = this.getAgent();
        const start = Date.now();
        // Use censorship-resilient ipify endpoint
        const res = await axios.get('https://api.ipify.org?format=json', {
          httpAgent: agent,
          httpsAgent: agent,
          proxy: false, // Required for Axios with custom agent
          timeout: 8000
        });
        this.currentTorIp = res.data?.ip || 'Connected';
        this.latency = Date.now() - start;
      } catch (err) {
        try {
          const agent = this.getAgent();
          const res = await axios.get('https://httpbin.org/ip', {
            httpAgent: agent,
            httpsAgent: agent,
            proxy: false,
            timeout: 6000
          });
          const origin = res.data?.origin ? res.data.origin.split(',')[0].trim() : 'Active';
          this.currentTorIp = origin;
        } catch (e) {
          this.currentTorIp = 'Active (SOCKS5 Ready)';
        }
      }
    } else {
      this.currentTorIp = null;
      this.latency = null;
    }

    return this.getState();
  }

  getAgent() {
    if (!this.activeSocksPort) return null;
    // socks5h ensures DNS lookups are routed through Tor
    return new SocksProxyAgent(`socks5h://127.0.0.1:${this.activeSocksPort}`);
  }

  // Rotate Tor circuit using Control Port (SIGNAL NEWNYM)
  async rotateCircuit(password = '') {
    if (!this.activeControlPort) {
      return {
        success: false,
        message: 'Tor Control Port (9151 / 9051) not active. Open Tor Browser to enable instant circuit rotation.'
      };
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let step = 0;
      let resolved = false;

      socket.setTimeout(4000);

      const finish = (result) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(result);
        }
      };

      socket.on('connect', () => {
        socket.write(`AUTHENTICATE "${password}"\r\n`);
      });

      socket.on('data', (data) => {
        const response = data.toString();
        if (step === 0) {
          if (response.includes('250')) {
            step = 1;
            socket.write('SIGNAL NEWNYM\r\n');
          } else {
            finish({ success: false, message: 'Tor Authentication failed: ' + response.trim() });
          }
        } else if (step === 1) {
          if (response.includes('250')) {
            this.lastRotated = new Date().toISOString();
            setTimeout(async () => {
              await this.checkStatus();
            }, 1200);
            finish({
              success: true,
              message: 'Tor circuit refreshed! New identity created (NEWNYM signal sent).',
              timestamp: this.lastRotated
            });
          } else {
            finish({ success: false, message: 'SIGNAL NEWNYM error: ' + response.trim() });
          }
        }
      });

      socket.on('timeout', () => finish({ success: false, message: 'Tor Control Port timed out' }));
      socket.on('error', (err) => finish({ success: false, message: err.message }));

      socket.connect(this.activeControlPort, '127.0.0.1');
    });
  }

  // Inject the local Tor circuit directly into the proxy pool as an Elite rotating SOCKS5 proxy
  injectTorProxy() {
    if (!this.isConnected || !this.activeSocksPort) {
      return { success: false, message: 'Tor Browser is not running. Please start Tor first.' };
    }

    const torProxy = {
      ip: '127.0.0.1',
      port: this.activeSocksPort,
      protocol: 'SOCKS5',
      status: 'alive',
      latency: this.latency || 250,
      anonymity: 'Elite',
      country: 'Tor Network',
      countryCode: 'TOR',
      city: 'Rotating Circuit',
      org: 'The Tor Project',
      source: 'Tor Browser',
      lastChecked: new Date().toISOString()
    };

    proxyPool.addProxy(torProxy);
    proxyPool.saveToDisk();

    return {
      success: true,
      proxy: torProxy,
      message: `Tor SOCKS5 (127.0.0.1:${this.activeSocksPort}) added as Elite Rotating Proxy to pool!`
    };
  }

  getState() {
    return {
      connected: this.isConnected,
      socksPort: this.activeSocksPort,
      controlPort: this.activeControlPort,
      currentIp: this.currentTorIp,
      latency: this.latency,
      lastChecked: this.lastChecked,
      lastRotated: this.lastRotated,
      mode: this.isConnected ? (this.activeSocksPort === 9150 ? 'Tor Browser' : 'Tor Daemon') : 'Disconnected'
    };
  }
}

module.exports = new TorManager();
