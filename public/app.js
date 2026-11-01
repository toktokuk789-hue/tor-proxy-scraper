// State Management
const state = {
  tor: { connected: false, currentIp: null, socksPort: 9150 },
  poolStats: { total: 0, alive: 0, dead: 0, unchecked: 0, purged: 0, avgLatency: 0, successRate: 0 },
  rotator: { running: true, port: 8899, totalRequests: 0 },
  filters: {
    protocol: 'ALL',
    status: 'ALL',
    search: '',
    page: 1,
    limit: 50
  },
  isScraping: false,
  isChecking: false
};

// DOM Elements
const el = {
  torDot: document.getElementById('torDot'),
  torStatusTitle: document.getElementById('torStatusTitle'),
  torPortBadge: document.getElementById('torPortBadge'),
  torCurrentIp: document.getElementById('torCurrentIp'),
  btnRotateTor: document.getElementById('btnRotateTor'),
  rotateIcon: document.getElementById('rotateIcon'),
  gatewayEndpoint: document.getElementById('gatewayEndpoint'),
  btnCopyGateway: document.getElementById('btnCopyGateway'),

  // Metrics
  statTotal: document.getElementById('statTotal'),
  statAlive: document.getElementById('statAlive'),
  statSuccessRate: document.getElementById('statSuccessRate'),
  statPurged: document.getElementById('statPurged'),
  statLatency: document.getElementById('statLatency'),
  statHits: document.getElementById('statHits'),

  // Controls
  btnScrape: document.getElementById('btnScrape'),
  btnHealthCheck: document.getElementById('btnHealthCheck'),
  btnStopCheck: document.getElementById('btnStopCheck'),
  btnPurgeDead: document.getElementById('btnPurgeDead'),
  btnClearPool: document.getElementById('btnClearPool'),
  chkUseTor: document.getElementById('chkUseTor'),
  chkAutoPurge: document.getElementById('chkAutoPurge'),
  rngConcurrency: document.getElementById('rngConcurrency'),
  valConcurrency: document.getElementById('valConcurrency'),
  rngMaxLatency: document.getElementById('rngMaxLatency'),
  valMaxLatency: document.getElementById('valMaxLatency'),
  selTestTarget: document.getElementById('selTestTarget'),

  // Progress
  progressBarContainer: document.getElementById('progressBarContainer'),
  progressBarFill: document.getElementById('progressBarFill'),
  progressBarText: document.getElementById('progressBarText'),

  // Filters
  protocolFilter: document.getElementById('protocolFilter'),
  countAll: document.getElementById('countAll'),
  countSocks5: document.getElementById('countSocks5'),
  countSocks4: document.getElementById('countSocks4'),
  countHttps: document.getElementById('countHttps'),
  countHttp: document.getElementById('countHttp'),
  searchInput: document.getElementById('searchInput'),

  // Table
  proxyTableBody: document.getElementById('proxyTableBody'),
  paginationInfo: document.getElementById('paginationInfo'),
  btnPrevPage: document.getElementById('btnPrevPage'),
  btnNextPage: document.getElementById('btnNextPage'),
  pageIndicator: document.getElementById('pageIndicator'),

  // Terminal
  terminalLogs: document.getElementById('terminalLogs'),
  btnClearTerminal: document.getElementById('btnClearTerminal'),

  // Modals
  exportModal: document.getElementById('exportModal'),
  btnExportModal: document.getElementById('btnExportModal'),
  btnCloseExport: document.getElementById('btnCloseExport'),
  exportPreview: document.getElementById('exportPreview'),
  btnCopyExport: document.getElementById('btnCopyExport'),
  btnDownloadExport: document.getElementById('btnDownloadExport'),
  chkExportAliveOnly: document.getElementById('chkExportAliveOnly'),

  customModal: document.getElementById('customModal'),
  btnCustomModal: document.getElementById('btnCustomModal'),
  btnCloseCustom: document.getElementById('btnCloseCustom'),
  btnCancelCustom: document.getElementById('btnCancelCustom'),
  customInput: document.getElementById('customInput'),
  btnSubmitCustom: document.getElementById('btnSubmitCustom'),

  // Tor Extras
  btnInjectTor: document.getElementById('btnInjectTor'),
  btnTorHelp: document.getElementById('btnTorHelp'),
  torGuideModal: document.getElementById('torGuideModal'),
  btnCloseTorGuide: document.getElementById('btnCloseTorGuide'),
  btnDoneTorGuide: document.getElementById('btnDoneTorGuide'),
  btnCheckTorNow: document.getElementById('btnCheckTorNow'),
  modalTorDot: document.getElementById('modalTorDot'),
  modalTorText: document.getElementById('modalTorText'),

  toastContainer: document.getElementById('toastContainer')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupSSE();
  fetchInitialStatus();
  fetchProxies();
  attachEventListeners();
  lucide.createIcons();
});

// Toast notification helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
  toast.innerHTML = `<i data-lucide="${iconName}" class="${type === 'success' ? 'text-emerald' : type === 'error' ? 'text-rose' : 'text-cyan'}"></i> <span>${message}</span>`;
  el.toastContainer.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Log to Terminal
function appendTerminal(message, level = 'info') {
  const line = document.createElement('div');
  line.className = 'log-line';
  if (message.includes('✓') || message.includes('ALIVE')) line.classList.add('text-emerald');
  else if (message.includes('✗') || message.includes('error') || message.includes('Failed')) line.classList.add('text-rose');
  else if (message.includes('[SCRAPER]') || message.includes('[TOR]')) line.classList.add('text-cyan');

  line.textContent = message;
  el.terminalLogs.appendChild(line);

  // Keep max 200 logs
  if (el.terminalLogs.children.length > 200) {
    el.terminalLogs.removeChild(el.terminalLogs.firstChild);
  }

  el.terminalLogs.scrollTop = el.terminalLogs.scrollHeight;
}

// SSE Connection
function setupSSE() {
  const evtSource = new EventSource('/api/stream');

  evtSource.addEventListener('log', (e) => {
    const data = JSON.parse(e.data);
    appendTerminal(`[${data.timestamp}] ${data.message}`, data.level);
  });

  evtSource.addEventListener('tor-status', (e) => {
    const tor = JSON.parse(e.data);
    updateTorUI(tor);
  });

  evtSource.addEventListener('stats', (e) => {
    const stats = JSON.parse(e.data);
    updateStatsUI(stats);
    fetchProxies();
  });

  evtSource.addEventListener('scrape-progress', (e) => {
    const p = JSON.parse(e.data);
    const pct = Math.round((p.completed / p.total) * 100);
    showProgress(pct, `Scraping feeds: ${p.completed}/${p.total} (${pct}%) — Harvested: ${p.totalFound}`);
    if (pct >= 100) {
      setTimeout(() => hideProgress(), 1500);
      setScrapingState(false);
      showToast(`Scrape completed! Discovered ${p.totalFound} proxies (${p.totalAdded} new)`, 'success');
      fetchProxies();
    }
  });

  evtSource.addEventListener('check-progress', (e) => {
    const p = JSON.parse(e.data);
    const pct = Math.round((p.completed / p.total) * 100);
    showProgress(pct, `Testing: ${p.completed}/${p.total} (${pct}%) | Alive: ${p.alive} | Dead: ${p.dead}`);
    if (pct >= 100) {
      setTimeout(() => hideProgress(), 1500);
      setCheckingState(false);
      showToast(`Scan complete! Alive: ${p.alive} | Purged: ${p.purged}`, 'success');
      fetchProxies();
    }
  });

  evtSource.onerror = () => {
    console.warn('SSE connection interrupted. Reconnecting in 3s...');
  };
}

function showProgress(pct, text) {
  el.progressBarContainer.style.display = 'block';
  el.progressBarFill.style.width = `${pct}%`;
  el.progressBarText.textContent = text;
}

function hideProgress() {
  el.progressBarContainer.style.display = 'none';
  el.progressBarFill.style.width = '0%';
}

// Fetch Initial Status
async function fetchInitialStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    updateTorUI(data.tor);
    updateStatsUI(data.pool);
    if (data.rotator) {
      el.statHits.textContent = data.rotator.totalRequests || 0;
    }
    setScrapingState(data.isScraping);
    setCheckingState(data.isChecking);
  } catch (err) {
    console.error('Failed to fetch status:', err);
  }
}

// Update Tor Card
function updateTorUI(tor) {
  state.tor = tor;
  if (tor.connected) {
    el.torDot.className = 'tor-indicator-dot connected';
    el.torStatusTitle.textContent = tor.mode || 'Tor Connected';
    el.torPortBadge.textContent = `PORT ${tor.socksPort}`;
    el.torPortBadge.style.color = '#10b981';
    el.torCurrentIp.textContent = `Exit IP: ${tor.currentIp || 'Connected'}`;
    el.chkUseTor.disabled = false;
    if (el.btnInjectTor) el.btnInjectTor.disabled = false;

    if (el.modalTorDot) el.modalTorDot.style.background = '#10b981';
    if (el.modalTorText) el.modalTorText.textContent = `Connected! ${tor.mode} active on port ${tor.socksPort} (Exit IP: ${tor.currentIp || 'Active'})`;
  } else {
    el.torDot.className = 'tor-indicator-dot';
    el.torStatusTitle.textContent = 'Tor Offline';
    el.torPortBadge.textContent = 'NO CIRCUIT';
    el.torPortBadge.style.color = '#94a3b8';
    el.torCurrentIp.textContent = 'Tor Browser closed (Click help to connect)';
    if (el.chkUseTor.checked) {
      el.chkUseTor.checked = false;
    }
    if (el.btnInjectTor) el.btnInjectTor.disabled = true;

    if (el.modalTorDot) el.modalTorDot.style.background = '#f43f5e';
    if (el.modalTorText) el.modalTorText.textContent = 'Tor is offline. Please launch Tor Browser on your PC.';
  }
}

// Update Metric Counters
function updateStatsUI(stats) {
  state.poolStats = stats;
  el.statTotal.textContent = Number(stats.total).toLocaleString();
  el.statAlive.textContent = Number(stats.alive).toLocaleString();
  el.statPurged.textContent = Number(stats.purged).toLocaleString();
  el.statLatency.textContent = `${stats.avgLatency || 0} ms`;
  el.statSuccessRate.textContent = `${stats.successRate || 0}% Healthy & Verified`;

  // Protocol pill numbers
  el.countAll.textContent = stats.total || 0;
  el.countSocks5.textContent = stats.protocols?.SOCKS5 || 0;
  el.countSocks4.textContent = stats.protocols?.SOCKS4 || 0;
  el.countHttps.textContent = stats.protocols?.HTTPS || 0;
  el.countHttp.textContent = stats.protocols?.HTTP || 0;
}

// Fetch and Render Table Data
async function fetchProxies() {
  try {
    const query = new URLSearchParams({
      protocol: state.filters.protocol,
      status: state.filters.status,
      search: state.filters.search,
      page: state.filters.page,
      limit: state.filters.limit,
      sort: 'latency',
      order: 'asc'
    });

    const res = await fetch(`/api/proxies?${query}`);
    const data = await res.json();
    renderTable(data.proxies, data.total, data.page, data.totalPages);
  } catch (err) {
    console.error('Failed to fetch proxies:', err);
  }
}

// Render Proxy Data Table
function renderTable(proxies, total, page, totalPages) {
  el.paginationInfo.textContent = `Showing ${proxies.length} of ${total} proxies`;
  el.pageIndicator.textContent = `Page ${page} of ${Math.max(1, totalPages)}`;
  el.btnPrevPage.disabled = page <= 1;
  el.btnNextPage.disabled = page >= totalPages;

  if (!proxies || proxies.length === 0) {
    el.proxyTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">
          <div class="empty-state">
            <i data-lucide="radar" class="empty-icon"></i>
            <h3>No Proxies Found</h3>
            <p>Try clearing filters or click <strong>Harvest Proxies</strong> to fetch a fresh pool.</p>
          </div>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  const rows = proxies.map((p, idx) => {
    const num = (page - 1) * state.filters.limit + idx + 1;
    const protoLower = (p.protocol || 'http').toLowerCase();
    const anonymityLower = (p.anonymity || 'unknown').toLowerCase();

    // Speed classification
    let speedClass = 'fast';
    if (!p.latency) speedClass = '';
    else if (p.latency > 1500) speedClass = 'slow';
    else if (p.latency > 600) speedClass = 'medium';

    const latencyText = p.latency ? `${p.latency} ms` : '—';
    const flag = p.countryCode && p.countryCode !== 'XX' ? getCountryFlag(p.countryCode) : '🌐';
    const locationText = p.country && p.country !== 'Unknown' ? `${p.country} (${p.countryCode})` : 'Global';

    return `
      <tr>
        <td style="color: var(--text-muted); font-family: var(--font-mono);">${num}</td>
        <td>
          <div class="cell-ip">
            <strong>${p.ip}:${p.port}</strong>
            <button class="btn-copy-tiny" onclick="copyText('${p.ip}:${p.port}')" title="Copy IP:Port">
              <i data-lucide="copy"></i>
            </button>
          </div>
        </td>
        <td><span class="badge-protocol ${protoLower}">${p.protocol}</span></td>
        <td><span class="badge-anonymity ${anonymityLower}">${p.anonymity}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${flag}</span>
            <span>${locationText}</span>
          </div>
        </td>
        <td>
          <span class="badge-latency ${speedClass}">
            <i data-lucide="zap" style="width: 12px; height: 12px;"></i>
            ${latencyText}
          </span>
        </td>
        <td>
          <span class="status-pill ${p.status}">
            <span class="status-dot"></span>
            ${p.status}
          </span>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn-icon" onclick="pingSingle('${p.ip}', ${p.port}, '${p.protocol}')" title="Ping test">
              <i data-lucide="play" style="width: 14px; height: 14px;"></i>
            </button>
            <button class="btn-icon text-rose" onclick="deleteSingle('${p.ip}', ${p.port})" title="Remove">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  el.proxyTableBody.innerHTML = rows;
  lucide.createIcons();
}

// Country code to emoji flag
function getCountryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  const offset = 127397;
  const chars = [...code.toUpperCase()].map(c => c.charCodeAt() + offset);
  return String.fromCodePoint(...chars);
}

// Global Actions for Table rows
window.copyText = function(text) {
  navigator.clipboard.writeText(text);
  showToast(`Copied ${text}`, 'success');
};

window.pingSingle = async function(ip, port, protocol) {
  showToast(`Testing ${ip}:${port}...`);
  try {
    const res = await fetch('/api/check-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, protocol })
    });
    const result = await res.json();
    if (result.alive) {
      showToast(`✓ Alive! Latency: ${result.latency}ms`, 'success');
    } else {
      showToast(`✗ Dead: ${result.error}`, 'error');
    }
    fetchProxies();
  } catch (e) {
    showToast('Ping failed', 'error');
  }
};

window.deleteSingle = async function(ip, port) {
  try {
    await fetch('/api/proxy', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    showToast(`Removed ${ip}:${port}`);
    fetchProxies();
  } catch (e) {
    showToast('Delete failed', 'error');
  }
};

// UI State Toggles
function setScrapingState(active) {
  state.isScraping = active;
  el.btnScrape.disabled = active;
  if (active) {
    el.btnScrape.innerHTML = `<i data-lucide="loader" class="btn-icon-spin"></i> <span>Harvesting...</span>`;
  } else {
    el.btnScrape.innerHTML = `<i data-lucide="download-cloud"></i> <span>Harvest Proxies</span>`;
  }
  lucide.createIcons();
}

function setCheckingState(active) {
  state.isChecking = active;
  el.btnHealthCheck.disabled = active;
  el.btnStopCheck.style.display = active ? 'inline-flex' : 'none';
  if (active) {
    el.btnHealthCheck.innerHTML = `<i data-lucide="loader" class="btn-icon-spin"></i> <span>Scanning...</span>`;
  } else {
    el.btnHealthCheck.innerHTML = `<i data-lucide="stethoscope"></i> <span>Run Health Check</span>`;
  }
  lucide.createIcons();
}

// Event Listeners
function attachEventListeners() {
  // Harvest Proxies Button
  el.btnScrape.addEventListener('click', async () => {
    if (el.chkUseTor.checked && !state.tor.connected) {
      showToast('Tor is not active! Start Tor Browser or uncheck "Scrape via Tor".', 'error');
      el.torGuideModal.classList.add('active');
      return;
    }

    setScrapingState(true);
    showToast(el.chkUseTor.checked ? 'Harvesting proxies through Tor Circuit...' : 'Starting proxy harvest across feeds...');
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useTor: el.chkUseTor.checked })
      });
      const data = await res.json();
      if (!res.ok) {
        setScrapingState(false);
        showToast(data.error || 'Scraper failed to start', 'error');
      }
    } catch (err) {
      setScrapingState(false);
      showToast('Scraper failed to start', 'error');
    }
  });

  // Toggle Tor Checkbox validation
  el.chkUseTor.addEventListener('change', () => {
    if (el.chkUseTor.checked && !state.tor.connected) {
      el.chkUseTor.checked = false;
      showToast('Tor is offline. Please launch Tor Browser first.', 'error');
      el.torGuideModal.classList.add('active');
    }
  });

  // Tor Inject Button
  if (el.btnInjectTor) {
    el.btnInjectTor.addEventListener('click', async () => {
      if (!state.tor.connected) {
        showToast('Please open Tor Browser first', 'error');
        el.torGuideModal.classList.add('active');
        return;
      }
      try {
        const res = await fetch('/api/tor/inject', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          fetchProxies();
        } else {
          showToast(data.message, 'error');
        }
      } catch (e) {
        showToast('Failed to inject Tor proxy', 'error');
      }
    });
  }

  // Tor Guide Modal triggers
  if (el.btnTorHelp) {
    el.btnTorHelp.addEventListener('click', () => el.torGuideModal.classList.add('active'));
  }
  if (el.btnCloseTorGuide) {
    el.btnCloseTorGuide.addEventListener('click', () => el.torGuideModal.classList.remove('active'));
  }
  if (el.btnDoneTorGuide) {
    el.btnDoneTorGuide.addEventListener('click', () => el.torGuideModal.classList.remove('active'));
  }
  if (el.btnCheckTorNow) {
    el.btnCheckTorNow.addEventListener('click', async () => {
      showToast('Testing Tor SOCKS5 ports (9150 / 9050)...');
      try {
        const res = await fetch('/api/tor/status');
        const data = await res.json();
        updateTorUI(data);
        if (data.connected) {
          showToast(`✓ Tor Connected! Exit IP: ${data.currentIp}`, 'success');
        } else {
          showToast('Tor ports 9150/9050 not responding. Is Tor Browser open?', 'error');
        }
      } catch (e) {
        showToast('Error testing Tor connection', 'error');
      }
    });
  }

  // Run Health Check Button
  el.btnHealthCheck.addEventListener('click', async () => {
    setCheckingState(true);
    showToast('Initiating health scan...');
    try {
      await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concurrency: el.rngConcurrency.value,
          timeout: 4500,
          testUrl: el.selTestTarget.value,
          autoPurge: el.chkAutoPurge.checked,
          maxLatency: el.rngMaxLatency.value,
          onlyUnchecked: false
        })
      });
    } catch (err) {
      setCheckingState(false);
      showToast('Health check failed', 'error');
    }
  });

  // Stop Check Button
  el.btnStopCheck.addEventListener('click', async () => {
    await fetch('/api/stop-check', { method: 'POST' });
    showToast('Scan abort requested.');
    setCheckingState(false);
  });

  // Purge Dead Button
  el.btnPurgeDead.addEventListener('click', async () => {
    const res = await fetch('/api/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxLatency: el.rngMaxLatency.value })
    });
    const data = await res.json();
    showToast(`Purged ${data.removed} dead or slow proxies`, 'success');
    fetchProxies();
  });

  // Clear Pool Button
  el.btnClearPool.addEventListener('click', async () => {
    if (confirm('Clear all proxies from memory and disk?')) {
      const res = await fetch('/api/clear', { method: 'POST' });
      const data = await res.json();
      showToast(`Cleared ${data.count} proxies`);
      fetchProxies();
    }
  });

  // Tor Circuit Rotate Button
  el.btnRotateTor.addEventListener('click', async () => {
    el.rotateIcon.classList.add('spin-anim');
    showToast('Requesting Tor circuit rotation (NEWNYM)...');
    try {
      const res = await fetch('/api/tor/rotate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast('Tor rotation error', 'error');
    } finally {
      setTimeout(() => el.rotateIcon.classList.remove('spin-anim'), 1000);
    }
  });

  // Copy Gateway Button
  el.btnCopyGateway.addEventListener('click', () => {
    navigator.clipboard.writeText('http://127.0.0.1:8899');
    showToast('Copied Gateway URL (http://127.0.0.1:8899)', 'success');
  });

  // Slider Displays
  el.rngConcurrency.addEventListener('input', (e) => {
    el.valConcurrency.textContent = e.target.value;
  });
  el.rngMaxLatency.addEventListener('input', (e) => {
    el.valMaxLatency.textContent = e.target.value;
  });

  // Protocol Filter Tabs
  el.protocolFilter.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      el.protocolFilter.querySelector('.pill.active')?.classList.remove('active');
      pill.classList.add('active');
      state.filters.protocol = pill.getAttribute('data-protocol');
      state.filters.page = 1;
      fetchProxies();
    });
  });

  // Status Filter Pills
  document.querySelectorAll('.status-filter-pills .sub-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelector('.status-filter-pills .sub-pill.active')?.classList.remove('active');
      pill.classList.add('active');
      state.filters.status = pill.getAttribute('data-status');
      state.filters.page = 1;
      fetchProxies();
    });
  });

  // Search Input with Debounce
  let searchTimeout;
  el.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.search = e.target.value.trim();
      state.filters.page = 1;
      fetchProxies();
    }, 250);
  });

  // Pagination Buttons
  el.btnPrevPage.addEventListener('click', () => {
    if (state.filters.page > 1) {
      state.filters.page--;
      fetchProxies();
    }
  });
  el.btnNextPage.addEventListener('click', () => {
    state.filters.page++;
    fetchProxies();
  });

  // Clear Terminal Button
  el.btnClearTerminal.addEventListener('click', () => {
    el.terminalLogs.innerHTML = '';
  });

  // Copy snippet buttons
  document.getElementById('btnCopyCurl')?.addEventListener('click', () => {
    navigator.clipboard.writeText('curl -x http://127.0.0.1:8899 https://api.ipify.org');
    showToast('Copied curl command', 'success');
  });
  document.getElementById('btnCopyPy')?.addEventListener('click', () => {
    navigator.clipboard.writeText("proxies={'https': 'http://127.0.0.1:8899'}");
    showToast('Copied Python snippet', 'success');
  });

  // Export Modal Open / Close
  el.btnExportModal.addEventListener('click', () => {
    el.exportModal.classList.add('active');
    updateExportPreview();
  });
  el.btnCloseExport.addEventListener('click', () => el.exportModal.classList.remove('active'));

  // Export Option change
  document.querySelectorAll('input[name="exportFormat"]').forEach((radio) => {
    radio.addEventListener('change', updateExportPreview);
  });
  el.chkExportAliveOnly.addEventListener('change', updateExportPreview);

  // Export Copy & Download
  el.btnCopyExport.addEventListener('click', () => {
    navigator.clipboard.writeText(el.exportPreview.value);
    showToast('Proxies copied to clipboard!', 'success');
  });

  el.btnDownloadExport.addEventListener('click', () => {
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const aliveOnly = el.chkExportAliveOnly.checked;
    window.location.href = `/api/export?format=${format}&aliveOnly=${aliveOnly}`;
  });

  // Custom Import Modal
  el.btnCustomModal.addEventListener('click', () => el.customModal.classList.add('active'));
  el.btnCloseCustom.addEventListener('click', () => el.customModal.classList.remove('active'));
  el.btnCancelCustom.addEventListener('click', () => el.customModal.classList.remove('active'));

  el.btnSubmitCustom.addEventListener('click', async () => {
    const text = el.customInput.value.trim();
    if (!text) return;
    el.customModal.classList.remove('active');
    showToast('Ingesting custom proxy data...');
    await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customText: text })
    });
    el.customInput.value = '';
    fetchProxies();
  });
}

// Update Export Preview in Modal
async function updateExportPreview() {
  const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'raw';
  const aliveOnly = el.chkExportAliveOnly.checked;
  try {
    const res = await fetch(`/api/export?format=${format}&aliveOnly=${aliveOnly}`);
    const text = await res.text();
    el.exportPreview.value = text;
  } catch (e) {
    el.exportPreview.value = 'Failed to generate preview';
  }
}
