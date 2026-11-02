const net = require('net');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const proxyPool = require('./proxyPool');

class TorManager {
  constructor() {
    this.socksPorts = [9150, 9050, 9152, 9052]; // 9150: Tor Browser / Embedded, 9050: Daemon
    this.controlPorts = [9151, 9051, 9153, 9053];
    this.activeSocksPort = null;
    this.activeControlPort = null;
    this.isConnected = false;
    this.currentTorIp = null;
    this.latency = null;
    this.lastChecked = null;
    this.lastRotated = null;
    this.torProcess = null;
    this.isStarting = false;

    this.torExePaths = [
      path.join(os.homedir(), 'Desktop', 'Tor Browser', 'Browser', 'TorBrowser', 'Tor', 'tor.exe'),
      path.join(os.homedir(), 'Downloads', 'Tor Browser', 'Browser', 'TorBrowser', 'Tor', 'tor.exe'),
      'C:\\Program Files\\Tor Browser\\Browser\\TorBrowser\\Tor\\tor.exe',
      'C:\\Program Files (x86)\\Tor Browser\\Browser\\TorBrowser\\Tor\\tor.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Tor Browser', 'Browser', 'TorBrowser', 'Tor', 'tor.exe'),
      path.join(process.cwd(), 'tor', 'tor.exe')
    ];
  }

  findTorExe() {
    for (const p of this.torExePaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
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
        const res = await axios.get('https://api.ipify.org?format=json', {
          httpAgent: agent,
          httpsAgent: agent,
          proxy: false,
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

  // Start background Tor daemon directly
  async startTorService(onLog = () => {}) {
    if (this.isConnected) {
      return { success: true, message: `Tor is already active on port ${this.activeSocksPort}` };
    }

    const torExe = this.findTorExe();
    if (!torExe) {
      return {
        success: false,
        message: 'Could not find tor.exe on your computer. Please install Tor Browser on your Desktop or in Program Files.'
      };
    }

    const dataDir = path.join(process.cwd(), 'data', 'tor');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    onLog(`[TOR] 🚀 Starting Tor daemon from: ${torExe}...`);

    return new Promise((resolve) => {
      try {
        this.torProcess = spawn(torExe, [
          '--SocksPort', '9150',
          '--ControlPort', '9151',
          '--DataDirectory', dataDir,
          '--CookieAuthentication', '0'
        ], {
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        this.torProcess.stdout.on('data', (data) => {
          const line = data.toString().trim();
          if (line.includes('Opened Socks listener connection')) {
            onLog('[TOR] ✓ SOCKS5 Listener open on 127.0.0.1:9150 (Tor Ready!)');
          }
          if (line.includes('Bootstrapped 100%')) {
            onLog('[TOR] 🌟 Tor Circuit Bootstrapped 100% (Fully Connected to Onion Network)');
          }
        });

        this.torProcess.stderr.on('data', (data) => {
          onLog(`[TOR] ${data.toString().trim()}`);
        });

        this.torProcess.on('error', (err) => {
          onLog(`[TOR] Process error: ${err.message}`);
          resolve({ success: false, message: err.message });
        });

        this.torProcess.on('exit', (code) => {
          this.isConnected = false;
          this.activeSocksPort = null;
          onLog(`[TOR] Tor daemon exited with code ${code}`);
        });

        // Wait up to 6 seconds for port 9150 to open
        let attempts = 0;
        const checkTimer = setInterval(async () => {
          attempts++;
          const open = await this.probePort(9150);
          if (open) {
            clearInterval(checkTimer);
            this.activeSocksPort = 9150;
            this.activeControlPort = 9151;
            this.isConnected = true;
            await this.checkStatus();
            onLog(`[TOR] 🌟 Tor Service successfully started! (SOCKS5: 127.0.0.1:9150 | Control: 127.0.0.1:9151)`);
            resolve({
              success: true,
              message: 'Tor Service started and listening on 127.0.0.1:9150',
              state: this.getState()
            });
          } else if (attempts >= 8) {
            clearInterval(checkTimer);
            resolve({
              success: false,
              message: 'Tor started but port 9150 did not respond in time.'
            });
          }
        }, 800);
      } catch (err) {
        resolve({ success: false, message: `Failed to spawn Tor: ${err.message}` });
      }
    });
  }

  // Stop background Tor service
  async stopTorService(onLog = () => {}) {
    if (this.torProcess) {
      try {
        this.torProcess.kill();
        this.torProcess = null;
      } catch (e) {}
    }

    // Also kill any orphaned tor.exe on Windows
    if (process.platform === 'win32') {
      exec('taskkill /F /IM tor.exe /T', () => {});
    }

    this.isConnected = false;
    this.activeSocksPort = null;
    this.currentTorIp = null;
    onLog('[TOR] Tor Service stopped.');

    return { success: true, message: 'Tor service stopped.' };
  }

  getAgent() {
    if (!this.activeSocksPort) return null;
    return new SocksProxyAgent(`socks5h://127.0.0.1:${this.activeSocksPort}`);
  }

  // Rotate Tor circuit using Control Port (SIGNAL NEWNYM)
  async rotateCircuit(password = '') {
    if (!this.activeControlPort) {
      return {
        success: false,
        message: 'Tor Control Port (9151 / 9051) not active. Click "Start Tor" first.'
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
      return { success: false, message: 'Tor is not running. Please click "Start Tor" first.' };
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
      source: 'Tor Network',
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
      serviceRunning: Boolean(this.torProcess),
      mode: this.isConnected ? (this.torProcess ? 'Tor Service (Active)' : 'Tor Browser') : 'Disconnected'
    };
  }
}

module.exports = new TorManager();
