/**
 * Download Vento Agent
 * 
 * Detects OS and architecture, downloads the appropriate binary from GitHub releases.
 * 
 * Binaries available:
 * - ventoagent-darwin-amd64    (macOS Intel)
 * - ventoagent-darwin-arm64    (macOS Apple Silicon)
 * - ventoagent-linux-amd64
 * - ventoagent-linux-arm64
 * - ventoagent-linux-armv7
 * - ventoagent-windows-amd64.exe
 * - ventoagent-windows-arm64.exe
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const RELEASE_BASE_URL = 'https://github.com/Protofy-xyz/Vento/releases/download/development';
const BIN_DIR = path.resolve(__dirname, '../bin');

/**
 * Get the platform identifier for the download
 */
function getPlatform() {
  const platform = os.platform();
  
  switch (platform) {
    case 'darwin':
      return 'darwin';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get the architecture identifier for the download
 */
function getArch() {
  const arch = os.arch();
  
  switch (arch) {
    case 'x64':
      return 'amd64';
    case 'arm64':
      return 'arm64';
    case 'arm':
      return 'armv7';
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }
}

/**
 * Get the binary filename for the current platform
 */
function getBinaryName(platform, arch) {
  const ext = platform === 'windows' ? '.exe' : '';
  return `ventoagent-${platform}-${arch}${ext}`;
}

/**
 * Get the local filename to save as
 */
function getLocalName(platform) {
  return platform === 'windows' ? 'ventoagent.exe' : 'ventoagent';
}

/**
 * Download file with retry logic
 */
async function downloadFile(url, destPath, maxRetries = 3, retryDelay = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  📥 Download attempt ${attempt}/${maxRetries}...`);
      
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Vento-Installer'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(destPath, Buffer.from(buffer));
      
      // Make executable on Unix systems
      if (os.platform() !== 'win32') {
        fs.chmodSync(destPath, 0o755);
      }
      
      return true;
    } catch (error) {
      console.error(`  ❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        console.log(`  ⏳ Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  return false;
}

/**
 * Main download function
 */
async function downloadAgent(options = {}) {
  const { force = false, silent = false } = options;
  
  const log = silent ? () => {} : console.log;
  
  try {
    const platform = getPlatform();
    const arch = getArch();
    const binaryName = getBinaryName(platform, arch);
    const localName = getLocalName(platform);
    const destPath = path.join(BIN_DIR, localName);
    
    // Check if already exists
    if (fs.existsSync(destPath) && !force) {
      log(`\n✅ Agent already installed at ${destPath}`);
      return { success: true, path: destPath, skipped: true };
    }

    log(`\n🤖 Vento Agent Downloader`);
    log(`   Platform: ${platform}`);
    log(`   Architecture: ${arch}`);
    log(`   Binary: ${binaryName}`);
    
    // Ensure bin directory exists
    if (!fs.existsSync(BIN_DIR)) {
      fs.mkdirSync(BIN_DIR, { recursive: true });
    }
    
    const url = `${RELEASE_BASE_URL}/${binaryName}`;
    log(`\n📡 Downloading from:`);
    log(`   ${url}`);
    
    const success = await downloadFile(url, destPath);
    
    if (success) {
      const stats = fs.statSync(destPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      log(`\n✅ Agent downloaded successfully!`);
      log(`   Location: ${destPath}`);
      log(`   Size: ${sizeMB} MB`);
      return { success: true, path: destPath, skipped: false };
    } else {
      console.error(`\n❌ Failed to download agent after all retries`);
      return { success: false, error: 'Download failed' };
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// CLI execution
if (require.main === module) {
  const force = process.argv.includes('--force');
  
  downloadAgent({ force })
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { downloadAgent };

