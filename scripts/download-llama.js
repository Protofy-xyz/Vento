/**
 * Download llama-server binary from llama.cpp releases
 * 
 * Usage standalone:
 *   node scripts/download-llama.js [--vulkan|--cuda|--cpu]
 * 
 * Usage from prepare.js:
 *   const downloadLlama = require('./scripts/download-llama');
 *   await downloadLlama(AdmZip);
 */

const fs = require('fs');
const { unlinkSync, mkdirSync, existsSync, readdirSync, chmodSync } = fs;
const https = require('https');
const path = require('path');

// Latest stable release from https://github.com/ggml-org/llama.cpp/releases
const LLAMA_CPP_VERSION = 'b7266';
const GITHUB_BASE = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_VERSION}`;

// Platform-specific release assets
const RELEASES = {
    'win32-cuda': {
        asset: `llama-${LLAMA_CPP_VERSION}-bin-win-cuda-12.4-x64.zip`,
        binary: 'llama-server.exe',
        description: 'Windows x64 with CUDA 12.4 (NVIDIA GPU)',
        cudart: `cudart-llama-bin-win-cuda-12.4-x64.zip`
    },
    'win32-vulkan': {
        asset: `llama-${LLAMA_CPP_VERSION}-bin-win-vulkan-x64.zip`,
        binary: 'llama-server.exe',
        description: 'Windows x64 with Vulkan (AMD/NVIDIA/Intel)'
    },
    'win32-cpu': {
        asset: `llama-${LLAMA_CPP_VERSION}-bin-win-cpu-x64.zip`,
        binary: 'llama-server.exe',
        description: 'Windows x64 CPU only'
    },
    'darwin-arm64': {
        asset: `llama-${LLAMA_CPP_VERSION}-bin-macos-arm64.zip`,
        binary: 'llama-server',
        description: 'macOS Apple Silicon (M1/M2/M3/M4)'
    },
    'darwin-x64': {
        asset: `llama-${LLAMA_CPP_VERSION}-bin-macos-x64.zip`,
        binary: 'llama-server',
        description: 'macOS Intel x64'
    },
    'linux-vulkan': {
        asset: `llama-${LLAMA_CPP_VERSION}-bin-ubuntu-vulkan-x64.zip`,
        binary: 'llama-server',
        description: 'Linux x64 with Vulkan'
    },
    'linux-cpu': {
        asset: `llama-${LLAMA_CPP_VERSION}-bin-ubuntu-x64.zip`,
        binary: 'llama-server',
        description: 'Linux x64 CPU'
    }
};

/**
 * Detect best release for current platform
 */
function detectRelease(options = {}) {
    const platform = process.platform;
    const arch = process.arch;
    
    const wantCuda = options.cuda || process.argv.includes('--cuda');
    const wantVulkan = options.vulkan || process.argv.includes('--vulkan');
    const wantCpu = options.cpu || process.argv.includes('--cpu');
    
    if (platform === 'win32') {
        if (wantCpu) return { key: 'win32-cpu', ...RELEASES['win32-cpu'] };
        if (wantCuda) return { key: 'win32-cuda', ...RELEASES['win32-cuda'] };
        if (wantVulkan) return { key: 'win32-vulkan', ...RELEASES['win32-vulkan'] };
        // Default: Vulkan is most stable on Windows
        return { key: 'win32-vulkan', ...RELEASES['win32-vulkan'] };
    }
    
    if (platform === 'darwin') {
        if (arch === 'arm64') return { key: 'darwin-arm64', ...RELEASES['darwin-arm64'] };
        return { key: 'darwin-x64', ...RELEASES['darwin-x64'] };
    }
    
    // Linux
    if (wantVulkan) return { key: 'linux-vulkan', ...RELEASES['linux-vulkan'] };
    return { key: 'linux-cpu', ...RELEASES['linux-cpu'] };
}

/**
 * Download file with redirect support
 */
async function download(url, dest, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            return reject(new Error(`Too many redirects: ${url}`));
        }

        const file = fs.createWriteStream(dest);
        const req = https.get(url, { headers: { 'User-Agent': 'Vento-Llama-Downloader' } }, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                console.log(`   ↪ Redirect ${res.statusCode}`);
                return resolve(download(res.headers.location, dest, redirectCount + 1));
            }

            if (res.statusCode !== 200) {
                file.close(() => { if (existsSync(dest)) unlinkSync(dest); });
                return reject(new Error(`HTTP ${res.statusCode}`));
            }

            const totalSize = parseInt(res.headers['content-length'], 10);
            let downloadedSize = 0;
            let lastPercent = 0;

            res.on('data', (chunk) => {
                downloadedSize += chunk.length;
                const percent = totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0;
                if (percent !== lastPercent && percent % 10 === 0) {
                    console.log(`   ${percent}% (${formatBytes(downloadedSize)})`);
                    lastPercent = percent;
                }
            });

            res.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        });

        req.on('error', (err) => {
            file.close(() => { if (existsSync(dest)) unlinkSync(dest); });
            reject(err);
        });
    });
}

function formatBytes(bytes) {
    if (!bytes) return '?';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Find a file recursively in directory
 */
function findFile(dir, filename) {
    const files = readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory()) {
            const found = findFile(fullPath, filename);
            if (found) return found;
        } else if (file.name === filename) {
            return fullPath;
        }
    }
    
    return null;
}

/**
 * Find all DLL files in directory
 */
function findDlls(dir) {
    const dlls = [];
    const files = readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory()) {
            dlls.push(...findDlls(fullPath));
        } else if (file.name.endsWith('.dll') || file.name.endsWith('.so') || file.name.endsWith('.dylib')) {
            dlls.push(fullPath);
        }
    }
    
    return dlls;
}

/**
 * Fix permissions on Unix
 */
function fixPermissions(binDir) {
    if (process.platform === 'win32') return;
    
    for (const file of readdirSync(binDir)) {
        const full = path.join(binDir, file);
        try {
            if (fs.lstatSync(full).isFile()) {
                chmodSync(full, 0o755);
            }
        } catch { }
    }
}

/**
 * Main download function
 * @param {typeof import('adm-zip')} AdmZip - AdmZip class
 * @param {object} options - { cuda, vulkan, cpu, force }
 */
async function downloadLlama(AdmZip, options = {}) {
    const binDir = path.join(__dirname, '..', 'bin', 'llama');
    const release = detectRelease(options);
    
    // Check if already downloaded
    const binaryPath = path.join(binDir, release.binary);
    if (existsSync(binaryPath) && !options.force) {
        console.log(`✅ llama-server already present → ${binDir}`);
        return { success: true, path: binaryPath };
    }
    
    console.log(`🦙 Downloading llama.cpp ${LLAMA_CPP_VERSION}`);
    console.log(`   Variant: ${release.description}`);
    
    // Ensure bin directory exists
    if (!existsSync(binDir)) {
        mkdirSync(binDir, { recursive: true });
    }
    
    const archivePath = path.join(binDir, release.asset);
    const extractDir = path.join(binDir, 'extracted');
    
    try {
        // Download main package
        console.log(`⬇️  Downloading ${release.asset}...`);
        await download(`${GITHUB_BASE}/${release.asset}`, archivePath);
        
        // Extract
        console.log(`📦 Extracting...`);
        if (existsSync(extractDir)) {
            fs.rmSync(extractDir, { recursive: true });
        }
        mkdirSync(extractDir);
        
        const zip = new AdmZip(archivePath);
        zip.extractAllTo(extractDir, true);
        
        // Find and copy binary
        const foundBinary = findFile(extractDir, release.binary);
        if (!foundBinary) {
            throw new Error(`Could not find ${release.binary} in extracted files`);
        }
        
        fs.copyFileSync(foundBinary, binaryPath);
        console.log(`   ✓ ${release.binary}`);
        
        // Copy DLLs/shared libs
        const libs = findDlls(extractDir);
        for (const lib of libs) {
            const destLib = path.join(binDir, path.basename(lib));
            fs.copyFileSync(lib, destLib);
            console.log(`   ✓ ${path.basename(lib)}`);
        }
        
        // Download CUDA runtime if needed
        if (release.cudart) {
            console.log(`⬇️  Downloading CUDA runtime...`);
            const cudartPath = path.join(binDir, release.cudart);
            await download(`${GITHUB_BASE}/${release.cudart}`, cudartPath);
            
            const cudartExtract = path.join(binDir, 'cudart_extracted');
            if (existsSync(cudartExtract)) {
                fs.rmSync(cudartExtract, { recursive: true });
            }
            mkdirSync(cudartExtract);
            
            const cudartZip = new AdmZip(cudartPath);
            cudartZip.extractAllTo(cudartExtract, true);
            
            const cudaDlls = findDlls(cudartExtract);
            for (const dll of cudaDlls) {
                const destDll = path.join(binDir, path.basename(dll));
                fs.copyFileSync(dll, destDll);
                console.log(`   ✓ ${path.basename(dll)}`);
            }
            
            fs.rmSync(cudartExtract, { recursive: true });
            unlinkSync(cudartPath);
        }
        
        // Cleanup
        fs.rmSync(extractDir, { recursive: true });
        unlinkSync(archivePath);
        
        // Fix permissions
        fixPermissions(binDir);
        
        console.log(`✅ llama-server ready → ${binDir}`);
        return { success: true, path: binaryPath };
        
    } catch (err) {
        console.error(`❌ Error downloading llama-server: ${err.message}`);
        // Cleanup on error
        try {
            if (existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
            if (existsSync(archivePath)) unlinkSync(archivePath);
        } catch { }
        return { success: false, error: err.message };
    }
}

// Export for use from prepare.js
module.exports = downloadLlama;

// Allow standalone execution
if (require.main === module) {
    const AdmZip = require('adm-zip');
    const options = {
        cuda: process.argv.includes('--cuda'),
        vulkan: process.argv.includes('--vulkan'),
        cpu: process.argv.includes('--cpu'),
        force: process.argv.includes('--force')
    };
    
    downloadLlama(AdmZip, options)
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

