const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const proxyPool = require('./proxyPool');

class Checker {
  constructor() {
    this.isChecking = false;
    this.shouldStop = false;
    this.geoCache = new Map();
    this.userRealIp = null;
    this.initUserIp();
  }

  async initUserIp() {
    try {
      const res = await axios.get('https://api.ipify.org?format=json', { timeout: 4000 });
      this.userRealIp = res.data?.ip;
    } catch (e) {
      this.userRealIp = null;
    }
  }

  // Get agent for specific proxy protocol
  createAgent(proxy, timeout) {
    const proto = (proxy.protocol || 'HTTP').toUpperCase();
    const target = `${proxy.ip}:${proxy.port}`;

    if (proto === 'SOCKS5') {
      return new SocksProxyAgent(`socks5://${target}`, { timeout });
    } else if (proto === 'SOCKS4') {
      return new SocksProxyAgent(`socks4://${target}`, { timeout });
    } else {
      return new HttpsProxyAgent(`http://${target}`, { timeout });
    }
  }

  // Check single proxy health
  async checkProxy(proxy, { testUrl = 'https://httpbin.org/ip', timeout = 5000, lookupGeo = true } = {}) {
    const startTime = Date.now();
    let agent;

    try {
      agent = this.createAgent(proxy, timeout);
    } catch (err) {
      return { alive: false, error: 'Agent creation failed: ' + err.message };
    }

    try {
      const response = await axios.get(testUrl, {
        httpAgent: agent,
        httpsAgent: agent,
        proxy: false,
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36'
        },
        validateStatus: (status) => status >= 200 && status < 400
      });

      const latency = Date.now() - startTime;
      let anonymity = 'Anonymous';

      // Detect anonymity level
      const respData = response.data;
      if (respData) {
        const respStr = typeof respData === 'string' ? respData : JSON.stringify(respData);

        if (this.userRealIp && respStr.includes(this.userRealIp)) {
          anonymity = 'Transparent';
        } else if (respStr.includes(proxy.ip)) {
          anonymity = 'Elite';
        } else {
          anonymity = 'Anonymous';
        }
      }

      // Geo lookup if needed
      let geo = { country: proxy.country, countryCode: proxy.countryCode, city: proxy.city, org: proxy.org };
      if (lookupGeo && (!proxy.country || proxy.country === 'Unknown')) {
        geo = await this.getGeo(proxy.ip);
      }

      return {
        alive: true,
        latency,
        anonymity,
        ...geo
      };
    } catch (err) {
      return {
        alive: false,
        latency: null,
        error: err.code || err.message
      };
    }
  }

  // Fast Geolocation with cache
  async getGeo(ip) {
    if (this.geoCache.has(ip)) {
      return this.geoCache.get(ip);
    }

    try {
      const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,org`, {
        timeout: 2500
      });

      if (res.data && res.data.status === 'success') {
        const data = {
          country: res.data.country || 'Unknown',
          countryCode: res.data.countryCode || 'XX',
          city: res.data.city || '',
          org: res.data.org || ''
        };
        this.geoCache.set(ip, data);
        return data;
      }
    } catch (e) {
      // ignore rate limits or timeout
    }

    const fallback = { country: 'Global', countryCode: 'XX', city: '', org: '' };
    this.geoCache.set(ip, fallback);
    return fallback;
  }

  // Concurrent queue runner to test list of proxies
  async checkAll({
    onlyUnchecked = false,
    concurrency = 40,
    timeout = 4000,
    testUrl = 'https://httpbin.org/ip',
    autoPurge = false,
    maxLatency = null,
    onProgress = () => {},
    onLog = () => {}
  } = {}) {
    if (this.isChecking) {
      return { success: false, message: 'Check is already running' };
    }

    this.isChecking = true;
    this.shouldStop = false;

    let targets = proxyPool.getAll();
    if (onlyUnchecked) {
      targets = targets.filter((p) => p.status === 'unchecked');
    }

    if (targets.length === 0) {
      this.isChecking = false;
      onLog('[CHECKER] No proxies to check in selected mode.');
      return { success: true, checked: 0, alive: 0, dead: 0 };
    }

    onLog(`[CHECKER] 🚀 Launching Health Scanner on ${targets.length} proxies (Concurrency: ${concurrency}, Timeout: ${timeout}ms)...`);

    let completed = 0;
    let aliveCount = 0;
    let deadCount = 0;
    let purgedCount = 0;

    let index = 0;

    const worker = async () => {
      while (index < targets.length && !this.shouldStop) {
        const currentIndex = index++;
        const proxy = targets[currentIndex];

        proxyPool.updateProxy(proxy.ip, proxy.port, { status: 'checking' });

        const result = await this.checkProxy(proxy, { testUrl, timeout, lookupGeo: true });
        completed++;

        if (result.alive) {
          // Check max latency filter
          if (maxLatency && result.latency > maxLatency) {
            if (autoPurge) {
              proxyPool.removeProxy(proxy.ip, proxy.port);
              purgedCount++;
              onLog(`[PURGE] Removed slow proxy ${proxy.ip}:${proxy.port} (${result.latency}ms > ${maxLatency}ms)`);
            } else {
              proxyPool.updateProxy(proxy.ip, proxy.port, {
                status: 'alive',
                latency: result.latency,
                anonymity: result.anonymity,
                country: result.country,
                countryCode: result.countryCode,
                city: result.city,
                org: result.org
              });
              aliveCount++;
            }
          } else {
            aliveCount++;
            proxyPool.updateProxy(proxy.ip, proxy.port, {
              status: 'alive',
              latency: result.latency,
              anonymity: result.anonymity,
              country: result.country,
              countryCode: result.countryCode,
              city: result.city,
              org: result.org
            });
            onLog(`[CHECKER] ✓ ALIVE [${proxy.protocol}] ${proxy.ip}:${proxy.port} (${result.latency}ms, ${result.countryCode}, ${result.anonymity})`);
          }
        } else {
          deadCount++;
          if (autoPurge) {
            proxyPool.removeProxy(proxy.ip, proxy.port);
            purgedCount++;
          } else {
            proxyPool.updateProxy(proxy.ip, proxy.port, {
              status: 'dead',
              latency: null
            });
          }
        }

        onProgress({
          completed,
          total: targets.length,
          alive: aliveCount,
          dead: deadCount,
          purged: purgedCount,
          current: `${proxy.ip}:${proxy.port}`
        });
      }
    };

    const workers = [];
    const actualConcurrency = Math.min(concurrency, targets.length);
    for (let w = 0; w < actualConcurrency; w++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    proxyPool.saveToDisk();
    this.isChecking = false;

    onLog(`[CHECKER] 🎯 Health Scan Finished! Checked: ${completed} | Alive: ${aliveCount} | Dead: ${deadCount}${autoPurge ? ` | Purged: ${purgedCount}` : ''}`);

    return {
      success: true,
      stopped: this.shouldStop,
      completed,
      alive: aliveCount,
      dead: deadCount,
      purged: purgedCount,
      poolStats: proxyPool.getStats()
    };
  }

  stop() {
    if (this.isChecking) {
      this.shouldStop = true;
    }
  }
}

module.exports = new Checker();
