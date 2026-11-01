const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class TorLauncher {
  constructor() {
    this.torBrowserPaths = [
      path.join(os.homedir(), 'Desktop', 'Tor Browser', 'Browser', 'firefox.exe'),
      path.join(os.homedir(), 'Downloads', 'Tor Browser', 'Browser', 'firefox.exe'),
      'C:\\Program Files\\Tor Browser\\Browser\\firefox.exe',
      'C:\\Program Files (x86)\\Tor Browser\\Browser\\firefox.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Tor Browser', 'Browser', 'firefox.exe')
    ];
    this.torExePaths = [
      path.join(os.homedir(), 'Desktop', 'Tor Browser', 'Browser', 'TorBrowser', 'Tor', 'tor.exe'),
      'C:\\Program Files\\Tor Browser\\Browser\\TorBrowser\\Tor\\tor.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Tor Browser', 'Browser', 'TorBrowser', 'Tor', 'tor.exe')
    ];
  }

  findTorBrowser() {
    for (const p of this.torBrowserPaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  findTorExe() {
    for (const p of this.torExePaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  // Open Tor Browser GUI
  openBrowser() {
    const browserPath = this.findTorBrowser();
    if (!browserPath) {
      return {
        success: false,
        message: 'Tor Browser executable not found in default paths. Please install Tor Browser or open it manually.'
      };
    }

    try {
      if (process.platform === 'win32') {
        exec(`start "" "${browserPath}"`);
      } else {
        spawn(browserPath, [], { detached: true, stdio: 'ignore' }).unref();
      }

      return {
        success: true,
        path: browserPath,
        message: `Tor Browser opened from: ${browserPath}. If prompted, click "Connect".`
      };
    } catch (err) {
      return { success: false, message: `Failed to open Tor Browser: ${err.message}` };
    }
  }
}

module.exports = new TorLauncher();
