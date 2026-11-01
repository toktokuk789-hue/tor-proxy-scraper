/**
 * Curated high-yield public & verified proxy sources
 * Across HTTP, HTTPS, SOCKS4, SOCKS5 and Tor Exit Node directory
 */

module.exports = {
  // Primary raw proxy feeds
  feeds: [
    // SOCKS5 feeds
    { url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt', type: 'SOCKS5', name: 'TheSpeedX SOCKS5' },
    { url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt', type: 'SOCKS5', name: 'Hookzof SOCKS5' },
    { url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt', type: 'SOCKS5', name: 'Roosterkid SOCKS5' },
    { url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt', type: 'SOCKS5', name: 'Monosans SOCKS5' },
    { url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=5000&country=all', type: 'SOCKS5', name: 'ProxyScrape SOCKS5' },

    // SOCKS4 feeds
    { url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt', type: 'SOCKS4', name: 'TheSpeedX SOCKS4' },
    { url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS4_RAW.txt', type: 'SOCKS4', name: 'Roosterkid SOCKS4' },
    { url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt', type: 'SOCKS4', name: 'Monosans SOCKS4' },
    { url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=5000&country=all', type: 'SOCKS4', name: 'ProxyScrape SOCKS4' },

    // HTTP / HTTPS feeds
    { url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt', type: 'HTTP', name: 'TheSpeedX HTTP' },
    { url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt', type: 'HTTP', name: 'Monosans HTTP' },
    { url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt', type: 'HTTPS', name: 'Roosterkid HTTPS' },
    { url: 'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt', type: 'HTTP', name: 'Clarketm HTTP' },
    { url: 'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/generated/http_proxies.txt', type: 'HTTP', name: 'Sunny9577 HTTP' },
    { url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all', type: 'HTTP', name: 'ProxyScrape HTTP' },

    // Tor Public Exit Nodes list (high anonymity)
    { url: 'https://check.torproject.org/torbulkexitlist', type: 'TOR_EXIT', name: 'Tor Project Official Exit List' },
    { url: 'https://www.dan.me.uk/torlist/?exit', type: 'TOR_EXIT', name: 'Dan.me.uk Tor Exits' }
  ],

  // Common target test endpoints
  testTargets: {
    httpbin: 'https://httpbin.org/ip',
    cloudflare: 'https://1.1.1.1/cdn-cgi/trace',
    google: 'https://www.google.com/generate_204',
    binance: 'https://api.binance.com/api/v3/ping'
  }
};
