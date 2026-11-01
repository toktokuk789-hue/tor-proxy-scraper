const fs = require('fs');
const path = require('path');

class ProxyPool {
  constructor() {
    this.proxies = new Map(); // key: "ip:port"
    this.purgedCount = 0;
    this.dataPath = path.join(__dirname, 'data');
    this.dataFile = path.join(this.dataPath, 'proxies.json');
    this.initStorage();
  }

  initStorage() {
    try {
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf8');
        const list = JSON.parse(raw);
        for (const item of list) {
          const key = `${item.ip}:${item.port}`;
          this.proxies.set(key, item);
        }
      }
    } catch (err) {
      console.error('Failed to load saved proxies:', err.message);
    }
  }

  saveToDisk() {
    try {
      const arr = Array.from(this.proxies.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(arr, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save proxies to disk:', err.message);
    }
  }

  addProxy(proxy) {
    const key = `${proxy.ip}:${proxy.port}`;
    if (this.proxies.has(key)) {
      const existing = this.proxies.get(key);
      // Preserve status if already checked
      if (existing.status === 'alive' && proxy.status === 'unchecked') {
        return false;
      }
      this.proxies.set(key, { ...existing, ...proxy });
      return false;
    }

    const item = {
      ip: proxy.ip,
      port: Number(proxy.port),
      protocol: proxy.protocol || 'HTTP',
      status: proxy.status || 'unchecked',
      latency: proxy.latency || null,
      anonymity: proxy.anonymity || 'Unknown',
      country: proxy.country || 'Unknown',
      countryCode: proxy.countryCode || 'XX',
      city: proxy.city || '',
      org: proxy.org || '',
      source: proxy.source || 'Scraper',
      lastChecked: proxy.lastChecked || null,
      firstSeen: proxy.firstSeen || new Date().toISOString(),
      failureCount: proxy.failureCount || 0
    };

    this.proxies.set(key, item);
    return true;
  }

  addBatch(items) {
    let added = 0;
    for (const item of items) {
      if (this.addProxy(item)) added++;
    }
    this.saveToDisk();
    return added;
  }

  updateProxy(ip, port, updates) {
    const key = `${ip}:${port}`;
    if (!this.proxies.has(key)) return;

    const existing = this.proxies.get(key);
    const updated = {
      ...existing,
      ...updates,
      lastChecked: new Date().toISOString()
    };

    if (updates.status === 'dead') {
      updated.failureCount = (existing.failureCount || 0) + 1;
    } else if (updates.status === 'alive') {
      updated.failureCount = 0;
    }

    this.proxies.set(key, updated);
  }

  removeProxy(ip, port) {
    const key = `${ip}:${port}`;
    const deleted = this.proxies.delete(key);
    if (deleted) this.saveToDisk();
    return deleted;
  }

  clearAll() {
    const count = this.proxies.size;
    this.proxies.clear();
    this.saveToDisk();
    return count;
  }

  purgeDead(maxLatency = null) {
    let removed = 0;
    for (const [key, proxy] of this.proxies.entries()) {
      let shouldPurge = false;

      if (proxy.status === 'dead') {
        shouldPurge = true;
      } else if (maxLatency && proxy.latency && proxy.latency > maxLatency) {
        shouldPurge = true;
      }

      if (shouldPurge) {
        this.proxies.delete(key);
        removed++;
      }
    }

    this.purgedCount += removed;
    this.saveToDisk();
    return removed;
  }

  getAll() {
    return Array.from(this.proxies.values());
  }

  getAlive() {
    return Array.from(this.proxies.values()).filter((p) => p.status === 'alive');
  }

  getRandomAlive() {
    const alive = this.getAlive();
    if (!alive.length) return null;
    return alive[Math.floor(Math.random() * alive.length)];
  }

  getStats() {
    const all = Array.from(this.proxies.values());
    const alive = all.filter((p) => p.status === 'alive');
    const dead = all.filter((p) => p.status === 'dead');
    const unchecked = all.filter((p) => p.status === 'unchecked');

    const protocols = {};
    const anonymity = {};
    const countries = {};
    let totalLatency = 0;

    for (const p of alive) {
      protocols[p.protocol] = (protocols[p.protocol] || 0) + 1;
      anonymity[p.anonymity] = (anonymity[p.anonymity] || 0) + 1;
      if (p.countryCode && p.countryCode !== 'XX') {
        countries[p.countryCode] = (countries[p.countryCode] || 0) + 1;
      }
      if (p.latency) totalLatency += p.latency;
    }

    const avgLatency = alive.length ? Math.round(totalLatency / alive.length) : 0;
    const successRate = (alive.length + dead.length) > 0
      ? Math.round((alive.length / (alive.length + dead.length)) * 100)
      : 0;

    return {
      total: all.length,
      alive: alive.length,
      dead: dead.length,
      unchecked: unchecked.length,
      purged: this.purgedCount,
      avgLatency,
      successRate,
      protocols,
      anonymity,
      countries
    };
  }

  exportText(format = 'raw', onlyAlive = true) {
    const list = onlyAlive ? this.getAlive() : this.getAll();

    return list.map((p) => {
      if (format === 'url') {
        const proto = (p.protocol || 'http').toLowerCase();
        return `${proto}://${p.ip}:${p.port}`;
      }
      return `${p.ip}:${p.port}`;
    }).join('\n');
  }

  exportJson(onlyAlive = true) {
    const list = onlyAlive ? this.getAlive() : this.getAll();
    return JSON.stringify(list, null, 2);
  }

  exportCsv(onlyAlive = true) {
    const list = onlyAlive ? this.getAlive() : this.getAll();
    const headers = ['IP', 'Port', 'Protocol', 'Status', 'Latency(ms)', 'Anonymity', 'Country', 'CountryCode', 'City', 'Org', 'Source'];
    const rows = list.map((p) => [
      p.ip,
      p.port,
      p.protocol,
      p.status,
      p.latency || '',
      p.anonymity || '',
      `"${p.country || ''}"`,
      p.countryCode || '',
      `"${p.city || ''}"`,
      `"${p.org || ''}"`,
      `"${p.source || ''}"`
    ].join(','));
    return [headers.join(','), ...rows].join('\n');
  }
}

module.exports = new ProxyPool();
