/**
 * Curated high-yield, verified proxy sources
 * Across HTTP, HTTPS, SOCKS4, SOCKS5 and Tor Onion mirrors
 */

module.exports = {
  // Primary raw proxy feeds (Censorship-resistant GitHub raw mirrors)
  feeds: [
    // SOCKS5 feeds (Highest Anonymity)
    { url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt', type: 'SOCKS5', name: 'TheSpeedX SOCKS5' },
    { url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt', type: 'SOCKS5', name: 'Hookzof SOCKS5' },
    { url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt', type: 'SOCKS5', name: 'Roosterkid SOCKS5' },
    { url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt', type: 'SOCKS5', name: 'Monosans SOCKS5' },
    { url: 'https://raw.githubusercontent.com/zevtyardt/proxy-list/main/socks5.txt', type: 'SOCKS5', name: 'Zevtyardt SOCKS5' },
    { url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt', type: 'SOCKS5', name: 'Proxifly SOCKS5' },

    // SOCKS4 feeds
    { url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt', type: 'SOCKS4', name: 'TheSpeedX SOCKS4' },
    { url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS4_RAW.txt', type: 'SOCKS4', name: 'Roosterkid SOCKS4' },
    { url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt', type: 'SOCKS4', name: 'Monosans SOCKS4' },
    { url: 'https://raw.githubusercontent.com/zevtyardt/proxy-list/main/socks4.txt', type: 'SOCKS4', name: 'Zevtyardt SOCKS4' },

    // HTTP / HTTPS feeds
    { url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt', type: 'HTTP', name: 'TheSpeedX HTTP' },
    { url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt', type: 'HTTP', name: 'Monosans HTTP' },
    { url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt', type: 'HTTPS', name: 'Roosterkid HTTPS' },
    { url: 'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt', type: 'HTTP', name: 'Clarketm HTTP' },
    { url: 'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/generated/http_proxies.txt', type: 'HTTP', name: 'Sunny9577 HTTP' },
    { url: 'https://raw.githubusercontent.com/zevtyardt/proxy-list/main/http.txt', type: 'HTTP', name: 'Zevtyardt HTTP' },
    { url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt', type: 'HTTP', name: 'Proxifly HTTP' }
  ],

  // Common target test endpoints (Censorship-free)
  testTargets: {
    httpbin: 'https://httpbin.org/ip',
    ipify: 'https://api.ipify.org?format=json',
    cloudflare: 'https://1.1.1.1/cdn-cgi/trace',
    google: 'https://www.google.com/generate_204'
  }
};
