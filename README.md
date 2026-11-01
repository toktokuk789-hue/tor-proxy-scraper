# ⚡ TOR PULSE — Cybernetic Tor Rotating Proxy Scraper & Health Bot

> An ultra-high-performance autonomous proxy scraping, Tor rotating circuit, concurrent health validation, and auto-purging suite with a stunning cyberpunk glassmorphism UI.

---

## 🌟 Key Features

1. **Tor Browser & Rotating Circuit Integration**:
   - **Auto-Detection**: Instantly discovers active Tor Browser instances on port `9150` or standalone Tor daemons on port `9050`.
   - **Signal NEWNYM Rotation**: 1-click or automated circuit IP rotation via Tor Control Port (`9151` / `9051`) for instant identity rotation.
   - **Tor SOCKS5 Tunnel**: Route all scraper operations through Tor to bypass rate-limits, WAFs, and IP bans.

2. **Multi-Source Scraping Engine**:
   - Curated feeds across **SOCKS5, SOCKS4, HTTPS, HTTP**, and official **Tor Exit Node** directories.
   - Universal regex IP:Port extractor capable of parsing raw text, HTML, and custom URLs.
   - Harvester deduplication and RFC1918 private IP rejection.

3. **Multi-Threaded Concurrent Health Checker**:
   - Configurable concurrency (10 - 150 parallel workers).
   - Real-time round-trip latency measurement (ms).
   - Anonymity tier classification:
     - **Elite (L1)**: Zero proxy headers, client IP completely hidden.
     - **Anonymous (L2)**: Proxy hides client IP, flags proxy usage.
     - **Transparent (L3)**: Client IP visible in headers.
   - Geo-IP location lookup with country flag emojis, city, and ISP/ASN identification.
   - Test target customization (HTTPBin, Cloudflare, Google, Binance, or custom endpoint).

4. **Intelligent Auto-Purge**:
   - Automatically drops dead and unresponsive proxies on the fly.
   - Configurable latency cutoff threshold (e.g. drop any proxy > 1500ms).

5. **Local Rotating Proxy Gateway (`127.0.0.1:8899`)**:
   - Built-in local HTTP/HTTPS/SOCKS proxy rotator server.
   - Route Python scrapers, curl, or browsers through `http://127.0.0.1:8899` to automatically cycle through alive proxies on every request.

6. **Interactive Cyberpunk UI / UX**:
   - Real-time Server-Sent Events (SSE) telemetry.
   - Live streaming terminal log console with auto-scroll.
   - Multi-format exporter: `IP:Port`, `protocol://IP:Port`, JSON with metadata, CSV.
   - 1-click copy buttons and single-proxy on-demand ping tests.

---

## 🚀 Quick Start

### 1. Launch Tor Pulse
Double-click [start.bat](file:///c:/Users/Saif%20Pc/Desktop/tor-proxy-scraper/start.bat) or run:
```bash
cd "c:\Users\Saif Pc\Desktop\tor-proxy-scraper"
node server.js
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧅 How to Use with Tor Browser

1. Start **Tor Browser** on your PC.
2. Tor Browser automatically opens SOCKS5 proxy on `127.0.0.1:9150`.
3. In Tor Pulse dashboard, the **Tor Status Indicator** will immediately turn green ("Tor Connected").
4. Enable the **Scrape via Tor Circuit** toggle in the dashboard.
5. Click **New Identity** to rotate your Tor circuit IP anytime!

*(Note: Even if Tor Browser is not running, Tor Pulse works in high-speed Direct Mode!)*

---

## 💻 Programmatic Usage & API

### Using the Local Rotating Gateway:
Point any scraper to `http://127.0.0.1:8899`:

#### Python (requests):
```python
import requests

proxies = {
    'http': 'http://127.0.0.1:8899',
    'https': 'http://127.0.0.1:8899'
}

response = requests.get('https://httpbin.org/ip', proxies=proxies)
print(response.json())
```

#### cURL:
```bash
curl -x http://127.0.0.1:8899 https://api.ipify.org
```

### Direct REST API Endpoints:
- `GET /api/random?format=text` — Returns a single random verified alive proxy (`IP:PORT`).
- `GET /api/random?format=url` — Returns formatted URL (e.g. `socks5://1.2.3.4:1080`).
- `GET /api/proxies?status=alive` — Returns JSON list of all verified alive proxies with latency & geo data.
- `GET /api/export?format=raw&aliveOnly=true` — Downloads alive proxies as a text file.
