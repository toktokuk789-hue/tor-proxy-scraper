<div align="center">

# ⚡ TOR PULSE
### Autonomous Tor Rotating Proxy Scraper, Health Validator & Gateway Suite

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tor](https://img.shields.io/badge/Tor_Network-Ready-7D4698?style=for-the-badge&logo=tor-project&logoColor=white)](https://www.torproject.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-00f3ff?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-10b981?style=for-the-badge)](#contributing)

A high-performance proxy harvesting, Tor circuit rotating, multi-threaded health checking, and auto-purging tool featuring an interactive dark glassmorphism dashboard and a local rotating proxy gateway.

[Explore Features](#-features) • [Quick Start](#-quick-start) • [Tor Setup](#-tor-browser--circuit-integration) • [Docker Deploy](#-docker-deployment) • [API Reference](#-rest-api--code-examples)

---

</div>

## 🌟 Features

### 🧅 Native Tor Browser & Circuit Rotation
- **1-Click Tor Launcher**: Launch Tor Browser directly from the dashboard UI with a single click.
- **Circuit Renewal on Demand**: Instant identity rotation via `SIGNAL NEWNYM` over Tor Control Port (`9151` / `9051`).
- **Tor SOCKS5 Tunnel**: Route scraper requests through Tor to bypass Cloudflare, WAFs, and target rate limits.
- **Inject Tor as an Elite Proxy**: Add Tor's local SOCKS5 proxy into your pool as an infinite rotating proxy with zero downtime.

### ⚡ Multi-Channel High-Speed Harvester
- Harvests thousands of proxies across **SOCKS5, SOCKS4, HTTPS, and HTTP** protocols.
- Curated high-uptime raw feeds from verified repositories with automatic deduplication.
- Universal regex IP:Port parser supporting raw text, HTML, and custom target URLs.
- Rejects RFC1918 private/local IP addresses automatically.

### 🩺 Concurrent Health & Anonymity Scanner
- Configurable worker concurrency (**10 to 150 parallel workers**) for scanning thousands of proxies in minutes.
- Real-time round-trip latency measurement in milliseconds.
- Three-tier anonymity detection:
  - **Elite (L1)**: Completely conceals client IP with no proxy forwarding headers.
  - **Anonymous (L2)**: Hides client IP but indicates proxy usage.
  - **Transparent (L3)**: Client IP is forwarded in request headers.
- Automatic Geo-IP location lookup: Country flag emojis, country name, city, and ISP/ASN.
- Customizable test targets (HTTPBin, Cloudflare CDN, Google, Binance API).

### 🗑️ Smart Auto-Purge
- Instantly removes dead, timed-out, or unresponsive proxies from memory and disk.
- Max latency threshold slider: automatically drop any proxy slower than your cutoff (e.g. `< 1500ms`).

### 🔄 Local Rotating Proxy Gateway (`127.0.0.1:8899`)
- Built-in local HTTP/HTTPS/SOCKS forwarder proxy server on port `8899`.
- Any external program, web scraper, or browser configured to use `http://127.0.0.1:8899` automatically gets routed through verified alive proxies, rotating on every request with upstream fallback.

### 🎨 Cyberpunk Glassmorphism UI
- Real-time telemetry dashboard using Server-Sent Events (SSE).
- Live ANSI-style streaming terminal logs.
- Multi-format exporter: `IP:Port`, `protocol://IP:Port`, full metadata JSON, or CSV spreadsheet.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [Tor Browser](https://www.torproject.org/download/) (optional, for Tor circuit routing)

### 1. Clone & Install
```bash
git clone https://github.com/toktokuk789-hue/tor-proxy-scraper.git
cd tor-proxy-scraper
npm install
```

### 2. Run the Application
```bash
# On Windows:
start.bat

# Or using Node directly:
node server.js
```

### 3. Open the Dashboard
Navigate to **`http://localhost:3000`** in your browser.

---

## 🧅 Tor Browser & Circuit Integration

### How to Connect Tor:
1. Click the **"Launch Tor"** button in the header bar of the dashboard, or open **Tor Browser** manually on your PC.
2. In Tor Browser, click **Connect**.
3. Tor automatically opens SOCKS5 proxy on `127.0.0.1:9150` and control port on `127.0.0.1:9151`.
4. The dashboard indicator will turn green: **`Tor Connected`** with your current Tor Exit IP.
5. Enable **"Scrape via Tor Circuit"** to route all harvesting through Tor, or click **"Inject to Pool"** to use Tor as a permanent Elite rotating proxy!

> **Note for ISP-Restricted Regions**: If your ISP restricts direct Tor connections, open Tor Browser Settings → **Connection** → select **"Built-In Bridge: Snowflake"**. Tor Browser will connect through Snowflake pluggable transports and Tor Pulse will bind to it automatically.

---

## 🐳 Docker Deployment

The repository includes a production-ready `Dockerfile` that bundles **both Node.js and the Tor daemon** into one self-contained container:

### Using Docker Compose (Recommended)
```bash
docker compose up -d
```

### Using Plain Docker
```bash
# Build image
docker build -t tor-pulse .

# Run container
docker run -d \
  -p 3000:3000 \
  -p 8899:8899 \
  -v $(pwd)/data:/app/data \
  --name tor-pulse-app \
  tor-pulse
```

Access the dashboard at `http://YOUR_SERVER_IP:3000`.

---

## ☁️ 1-Click Cloud Deployment

Deploy 24/7 to cloud container providers without managing servers:

| Provider | Method | Instructions |
|---|---|---|
| **Railway** | Docker | Connect GitHub repo → Railway detects the `Dockerfile` and deploys automatically. |
| **Render** | Web Service | Create "Web Service" → Environment: **Docker** → Connect repo. |
| **Fly.io** | CLI | Run `fly launch` in the repository root. |
| **Linux VPS** | Docker / PM2 | `git clone` → `docker compose up -d` or run with `pm2 start server.js`. |

---

## 💻 REST API & Code Examples

### Route Your Scrapers Through the Local Gateway (`127.0.0.1:8899`)

#### Python (`requests`)
```python
import requests

proxies = {
    'http': 'http://127.0.0.1:8899',
    'https': 'http://127.0.0.1:8899'
}

response = requests.get('https://httpbin.org/ip', proxies=proxies, timeout=10)
print("Current Proxy IP:", response.json()['origin'])
```

#### Node.js (`axios`)
```javascript
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const agent = new HttpsProxyAgent('http://127.0.0.1:8899');

async function test() {
  const res = await axios.get('https://httpbin.org/ip', {
    httpsAgent: agent,
    proxy: false
  });
  console.log('Rotated IP:', res.data);
}
test();
```

#### cURL
```bash
curl -x http://127.0.0.1:8899 https://api.ipify.org
```

#### Go
```go
package main

import (
    "fmt"
    "net/http"
    "net/url"
    "io"
)

func main() {
    proxyUrl, _ := url.Parse("http://127.0.0.1:8899")
    client := &http.Client{Transport: &http.Transport{Proxy: http.ProxyURL(proxyUrl)}}

    resp, err := client.Get("https://api.ipify.org")
    if err != nil { panic(err) }
    body, _ := io.ReadAll(resp.Body)
    fmt.Println("Rotated IP:", string(body))
}
```

---

### REST API Endpoints

| Endpoint | Method | Description | Query / Body Params |
|---|---|---|---|
| `/api/status` | `GET` | System health, Tor status, pool metrics | — |
| `/api/proxies` | `GET` | Filtered proxy list | `protocol`, `status`, `anonymity`, `search`, `page`, `limit` |
| `/api/random` | `GET` | Get a random verified alive proxy | `format=text` (`IP:Port`) or `format=url` |
| `/api/scrape` | `POST` | Trigger proxy harvest | `{"useTor": true/false, "customText": "..."}` |
| `/api/check` | `POST` | Start concurrent health scan | `{"concurrency": 50, "timeout": 4500, "autoPurge": true}` |
| `/api/stop-check`| `POST` | Abort active health scan | — |
| `/api/purge` | `POST` | Purge dead & slow proxies | `{"maxLatency": 1500}` |
| `/api/clear` | `POST` | Clear proxy pool buffer | — |
| `/api/tor/launch`| `POST` | Auto-launch Tor Browser executable | — |
| `/api/tor/rotate`| `POST` | Rotate Tor circuit identity (`NEWNYM`)| — |
| `/api/tor/inject`| `POST` | Add local Tor SOCKS5 into pool | — |
| `/api/export` | `GET` | Download proxies | `format=raw|url|json|csv`, `aliveOnly=true` |

---

## 📁 Project Structure

```
tor-proxy-scraper/
├── public/
│   ├── index.html       # Cyberpunk Glassmorphism UI
│   ├── style.css        # Responsive styling & micro-animations
│   └── app.js           # Real-time SSE controller & event handlers
├── torManager.js        # Tor SOCKS5 & Control Port circuit manager
├── torLauncher.js       # Auto-detector & launcher for Tor Browser
├── scraper.js           # Multi-feed proxy scraping engine
├── checker.js           # Concurrent health & anonymity validator
├── proxyPool.js         # Deduplication, auto-purge & multi-format export
├── rotatorServer.js     # Local rotating proxy gateway (127.0.0.1:8899)
├── sources.js           # Verified proxy feeds list
├── server.js            # Express API & Server-Sent Events stream
├── Dockerfile           # Multi-stage container with Tor + Node.js
├── docker-compose.yml   # 1-command deployment configuration
├── start.bat            # Windows 1-click launcher
└── README.md            # Documentation
```

---

## 🛡️ Disclaimer & Fair Use

This tool is created for educational, research, and authorized data gathering purposes (e.g. load testing, security testing, market research). Please respect target websites' Terms of Service, `robots.txt` guidelines, and local laws.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an Issue for new proxy sources, performance enhancements, or UI improvements.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
