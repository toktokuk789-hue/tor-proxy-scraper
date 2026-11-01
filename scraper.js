const axios = require('axios');
const sources = require('./sources');
const torManager = require('./torManager');
const proxyPool = require('./proxyPool');

class Scraper {
  constructor() {
    this.isScraping = false;
    this.ipPortRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):([0-9]{2,5})\b/g;
  }

  isPrivateIp(ip) {
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.')) return true;
    if (ip.startsWith('172.')) {
      const second = parseInt(ip.split('.')[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
    return false;
  }

  // Extract proxies from raw text
  extractProxies(rawText, defaultProtocol = 'HTTP', sourceName = 'Feed') {
    const list = [];
    let match;
    this.ipPortRegex.lastIndex = 0;

    while ((match = this.ipPortRegex.exec(rawText)) !== null) {
      const full = match[0];
      const [ip, portStr] = full.split(':');
      const port = parseInt(portStr, 10);

      if (port > 0 && port <= 65535 && !this.isPrivateIp(ip)) {
        list.push({
          ip,
          port,
          protocol: defaultProtocol,
          source: sourceName,
          status: 'unchecked'
        });
      }
    }

    return list;
  }

  // Scrape a single source
  async scrapeSource(source, useTor = false, onLog = () => {}) {
    try {
      const config = {
        timeout: 14000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      };

      if (useTor) {
        if (!torManager.isConnected) {
          onLog(`[TOR] ⚠️ Tor Browser / Tor daemon is not running on 127.0.0.1:9150. Cannot route via Tor for ${source.name}.`);
          return { source: source.name, found: 0, added: 0, error: 'Tor offline' };
        }

        const agent = torManager.getAgent();
        if (agent) {
          config.httpAgent = agent;
          config.httpsAgent = agent;
          config.proxy = false; // Prevent Axios from ignoring the SOCKS agent
          onLog(`[TOR] 🧅 Fetching ${source.name} via Tor Circuit (${torManager.currentTorIp || 'Active'})...`);
        }
      } else {
        onLog(`[SCRAPER] Fetching: ${source.name} (${source.type})...`);
      }

      const res = await axios.get(source.url, config);
      const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const extracted = this.extractProxies(text, source.type, source.name);

      const added = proxyPool.addBatch(extracted);
      onLog(`[SCRAPER] ✓ ${source.name}: Found ${extracted.length} (${added} unique new added)`);

      return { source: source.name, found: extracted.length, added };
    } catch (err) {
      onLog(`[SCRAPER] ✗ Failed ${source.name}: ${err.message}`);
      return { source: source.name, found: 0, added: 0, error: err.message };
    }
  }

  // Scrape all sources concurrently
  async scrapeAll({ useTor = false, customSources = [], onLog = () => {}, onProgress = () => {} } = {}) {
    if (this.isScraping) {
      return { success: false, message: 'Scraping is already in progress' };
    }

    this.isScraping = true;
    const allFeeds = [...sources.feeds, ...customSources];
    const results = [];
    let totalFound = 0;
    let totalAdded = 0;

    // Check Tor status before starting
    if (useTor) {
      await torManager.checkStatus();
      if (!torManager.isConnected) {
        onLog('[TOR] ❌ Tor is NOT connected! Tor Browser is not running on port 9150/9050.');
        onLog('[TOR] 💡 Start Tor Browser on your PC, then click "Harvest Proxies" again.');
        this.isScraping = false;
        return {
          success: false,
          error: 'Tor is offline. Please launch Tor Browser first.',
          totalFound: 0,
          totalAdded: 0
        };
      } else {
        onLog(`[TOR] 🌟 Connected to ${torManager.getState().mode} on port ${torManager.activeSocksPort}. Exit IP: ${torManager.currentTorIp}`);
      }
    }

    onLog(`[SCRAPER] ⚡ Initiating Proxy Harvest across ${allFeeds.length} channels${useTor ? ' via Tor' : ''}...`);

    const limit = useTor ? 2 : 4; // Lower concurrency for Tor circuits to avoid bandwidth saturation
    for (let i = 0; i < allFeeds.length; i += limit) {
      const chunk = allFeeds.slice(i, i + limit);
      const chunkResults = await Promise.all(
        chunk.map((feed) => this.scrapeSource(feed, useTor, onLog))
      );

      for (const res of chunkResults) {
        results.push(res);
        totalFound += res.found;
        totalAdded += res.added;
      }

      onProgress({
        completed: Math.min(i + limit, allFeeds.length),
        total: allFeeds.length,
        totalFound,
        totalAdded
      });

      // Optionally rotate Tor circuit after every 6 sources
      if (useTor && i > 0 && i % 6 === 0) {
        onLog('[TOR] Rotating Tor identity for fresh scrape circuit...');
        await torManager.rotateCircuit();
      }
    }

    this.isScraping = false;
    onLog(`[SCRAPER] 🏁 Harvest complete! Total discovered: ${totalFound} | Net unique added: ${totalAdded}`);

    return {
      success: true,
      totalFound,
      totalAdded,
      poolStats: proxyPool.getStats()
    };
  }

  // Scrape raw text or custom URL
  async scrapeCustom(input, type = 'HTTP', onLog = () => {}) {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return this.scrapeSource({ url: input, type, name: 'Custom URL' }, false, onLog);
    }
    const extracted = this.extractProxies(input, type, 'Manual Input');
    const added = proxyPool.addBatch(extracted);
    onLog(`[SCRAPER] Custom parsed: ${extracted.length} proxies (${added} added to pool)`);
    return { found: extracted.length, added };
  }
}

module.exports = new Scraper();
