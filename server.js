const express = require('express');
const cors = require('cors');
const path = require('path');
const torManager = require('./torManager');
const proxyPool = require('./proxyPool');
const scraper = require('./scraper');
const checker = require('./checker');
const rotatorServer = require('./rotatorServer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Server-Sent Events (SSE) Clients
const sseClients = new Set();

function broadcastSSE(type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function logEvent(message, level = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const entry = { timestamp, message, level };
  broadcastSSE('log', entry);
  console.log(`[${timestamp}] ${message}`);
}

rotatorServer.setLogger((msg) => logEvent(msg, 'rotator'));

// Real-time Event Stream
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// System Status
app.get('/api/status', async (req, res) => {
  res.json({
    tor: torManager.getState(),
    pool: proxyPool.getStats(),
    rotator: rotatorServer.getStatus(),
    isScraping: scraper.isScraping,
    isChecking: checker.isChecking
  });
});

// Proxy list with filters & pagination
app.get('/api/proxies', (req, res) => {
  const { protocol, status, anonymity, search, maxLatency, sort = 'latency', order = 'asc', limit = 100, page = 1 } = req.query;

  let list = proxyPool.getAll();

  if (protocol && protocol !== 'ALL') {
    list = list.filter((p) => p.protocol.toUpperCase() === protocol.toUpperCase());
  }

  if (status && status !== 'ALL') {
    list = list.filter((p) => p.status === status);
  }

  if (anonymity && anonymity !== 'ALL') {
    list = list.filter((p) => p.anonymity === anonymity);
  }

  if (maxLatency) {
    const max = parseInt(maxLatency, 10);
    list = list.filter((p) => p.latency && p.latency <= max);
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter((p) =>
      p.ip.toLowerCase().includes(q) ||
      String(p.port).includes(q) ||
      (p.country && p.country.toLowerCase().includes(q)) ||
      (p.countryCode && p.countryCode.toLowerCase().includes(q)) ||
      (p.org && p.org.toLowerCase().includes(q))
    );
  }

  // Sorting
  list.sort((a, b) => {
    let valA = a[sort];
    let valB = b[sort];

    if (sort === 'latency') {
      valA = valA === null ? 99999 : valA;
      valB = valB === null ? 99999 : valB;
    }

    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });

  const total = list.length;
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.max(1, parseInt(limit, 10));
  const paginated = list.slice((p - 1) * l, p * l);

  res.json({
    total,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l),
    proxies: paginated
  });
});

// Single random proxy API (convenient for scripts/bots)
app.get('/api/random', (req, res) => {
  const proxy = proxyPool.getRandomAlive();
  if (!proxy) {
    return res.status(404).json({ error: 'No alive proxies found' });
  }

  const { format } = req.query;
  if (format === 'text') {
    return res.send(`${proxy.ip}:${proxy.port}`);
  }
  if (format === 'url') {
    return res.send(`${proxy.protocol.toLowerCase()}://${proxy.ip}:${proxy.port}`);
  }
  res.json(proxy);
});

// Start Scraping
app.post('/api/scrape', async (req, res) => {
  const { useTor = false, customText = null } = req.body;

  if (scraper.isScraping) {
    return res.status(400).json({ error: 'Scraper already running' });
  }

  res.json({ message: 'Scrape started' });

  if (customText) {
    await scraper.scrapeCustom(customText, 'HTTP', (msg) => logEvent(msg, 'scraper'));
    broadcastSSE('stats', proxyPool.getStats());
  } else {
    await scraper.scrapeAll({
      useTor,
      onLog: (msg) => logEvent(msg, 'scraper'),
      onProgress: (p) => broadcastSSE('scrape-progress', p)
    });
    broadcastSSE('stats', proxyPool.getStats());
  }
});

// Start Health Check
app.post('/api/check', async (req, res) => {
  const {
    onlyUnchecked = false,
    concurrency = 40,
    timeout = 4000,
    testUrl = 'https://httpbin.org/ip',
    autoPurge = true,
    maxLatency = null
  } = req.body;

  if (checker.isChecking) {
    return res.status(400).json({ error: 'Health scan already running' });
  }

  res.json({ message: 'Health check started' });

  await checker.checkAll({
    onlyUnchecked,
    concurrency: Number(concurrency) || 40,
    timeout: Number(timeout) || 4000,
    testUrl,
    autoPurge: Boolean(autoPurge),
    maxLatency: maxLatency ? Number(maxLatency) : null,
    onProgress: (p) => broadcastSSE('check-progress', p),
    onLog: (msg) => logEvent(msg, 'checker')
  });

  broadcastSSE('stats', proxyPool.getStats());
});

// Stop Health Check
app.post('/api/stop-check', (req, res) => {
  checker.stop();
  logEvent('[CHECKER] Stop signal requested by user.');
  res.json({ message: 'Stopping health scan...' });
});

// Purge Dead / Slow Proxies
app.post('/api/purge', (req, res) => {
  const { maxLatency = null } = req.body;
  const removed = proxyPool.purgeDead(maxLatency ? Number(maxLatency) : null);
  logEvent(`[PURGE] Removed ${removed} dead/slow proxies.`);
  broadcastSSE('stats', proxyPool.getStats());
  res.json({ success: true, removed, stats: proxyPool.getStats() });
});

// Clear All
app.post('/api/clear', (req, res) => {
  const count = proxyPool.clearAll();
  logEvent(`[POOL] Cleared ${count} proxies from pool.`);
  broadcastSSE('stats', proxyPool.getStats());
  res.json({ success: true, count });
});

// Check single proxy
app.post('/api/check-single', async (req, res) => {
  const { ip, port, protocol } = req.body;
  logEvent(`[CHECKER] Manual ping test for ${protocol}://${ip}:${port}...`);
  const result = await checker.checkProxy({ ip, port, protocol }, { timeout: 4000 });
  if (result.alive) {
    proxyPool.updateProxy(ip, port, {
      status: 'alive',
      latency: result.latency,
      anonymity: result.anonymity,
      country: result.country,
      countryCode: result.countryCode,
      city: result.city,
      org: result.org
    });
    logEvent(`[CHECKER] ✓ ${ip}:${port} ALIVE (${result.latency}ms, ${result.countryCode})`);
  } else {
    proxyPool.updateProxy(ip, port, { status: 'dead' });
    logEvent(`[CHECKER] ✗ ${ip}:${port} DEAD (${result.error})`);
  }
  broadcastSSE('stats', proxyPool.getStats());
  res.json(result);
});

// Delete single proxy
app.delete('/api/proxy', (req, res) => {
  const { ip, port } = req.body;
  const deleted = proxyPool.removeProxy(ip, port);
  broadcastSSE('stats', proxyPool.getStats());
  res.json({ success: deleted });
});

// Tor Status & Circuit Rotation
app.get('/api/tor/status', async (req, res) => {
  const state = await torManager.checkStatus();
  broadcastSSE('tor-status', state);
  res.json(state);
});

app.post('/api/tor/rotate', async (req, res) => {
  logEvent('[TOR] Requesting Circuit Rotation (SIGNAL NEWNYM)...');
  const result = await torManager.rotateCircuit();
  if (result.success) {
    logEvent(`[TOR] ✓ ${result.message}`);
  } else {
    logEvent(`[TOR] ✗ ${result.message}`, 'error');
  }
  const state = torManager.getState();
  broadcastSSE('tor-status', state);
  res.json({ ...result, state });
});

app.post('/api/tor/inject', (req, res) => {
  const result = torManager.injectTorProxy();
  if (result.success) {
    logEvent(`[TOR] ✓ ${result.message}`);
    broadcastSSE('stats', proxyPool.getStats());
  } else {
    logEvent(`[TOR] ⚠️ ${result.message}`, 'error');
  }
  res.json(result);
});

// Launch Tor Browser Executable
app.post('/api/tor/launch', (req, res) => {
  const torLauncher = require('./torLauncher');
  const result = torLauncher.openBrowser();
  if (result.success) {
    logEvent(`[TOR] 🚀 ${result.message}`);
  } else {
    logEvent(`[TOR] ⚠️ ${result.message}`, 'error');
  }
  res.json(result);
});

// Rotator Gateway Control
app.post('/api/rotator/toggle', (req, res) => {
  const { enable, port = 8899, strategy = 'round-robin' } = req.body;
  rotatorServer.strategy = strategy;

  if (enable && !rotatorServer.isRunning) {
    rotatorServer.start(Number(port) || 8899);
  } else if (!enable && rotatorServer.isRunning) {
    rotatorServer.stop();
  }

  res.json(rotatorServer.getStatus());
});

// Export Proxies
app.get('/api/export', (req, res) => {
  const { format = 'raw', aliveOnly = 'true' } = req.query;
  const onlyAlive = aliveOnly === 'true';

  if (format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename="proxies.json"');
    res.setHeader('Content-Type', 'application/json');
    return res.send(proxyPool.exportJson(onlyAlive));
  }

  if (format === 'csv') {
    res.setHeader('Content-Disposition', 'attachment; filename="proxies.csv"');
    res.setHeader('Content-Type', 'text/csv');
    return res.send(proxyPool.exportCsv(onlyAlive));
  }

  // Raw or URL text
  res.setHeader('Content-Disposition', 'attachment; filename="proxies.txt"');
  res.setHeader('Content-Type', 'text/plain');
  res.send(proxyPool.exportText(format, onlyAlive));
});

// Background loop for periodic Tor status check
setInterval(async () => {
  const prevConnected = torManager.isConnected;
  const state = await torManager.checkStatus();
  if (prevConnected !== state.connected) {
    logEvent(`[TOR] Status transition: ${state.mode} (${state.connected ? 'ONLINE' : 'OFFLINE'})`);
    broadcastSSE('tor-status', state);
  }
}, 15000);

// Start HTTP Server
const server = app.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`🚀 TOR PULSE Dashboard running on http://localhost:${PORT}`);
  console.log(`======================================================\n`);

  // Probe Tor initially
  await torManager.checkStatus();
  // Start Rotator server by default
  rotatorServer.start(8899);
});
