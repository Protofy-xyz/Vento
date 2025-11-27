#!/usr/bin/env node
/**
 * Build Vento Agent from Go source
 * 
 * Compiles the Go agent and places it in bin/ with the correct name
 * for the current platform (same as download-agent.js would).
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT_DIR = path.join(__dirname, '..');
const BIN_DIR = path.join(ROOT_DIR, 'bin');
const GO_SRC_DIR = path.join(ROOT_DIR, 'apps', 'clients', 'go');

function getPlatform() {
    const platform = os.platform();
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'darwin';
    return 'linux';
}

function getArch() {
    const arch = os.arch();
    if (arch === 'x64') return 'amd64';
    if (arch === 'arm64') return 'arm64';
    if (arch === 'arm') return 'arm';
    return arch;
}

function getBinaryName() {
    const platform = getPlatform();
    return platform === 'windows' ? 'ventoagent.exe' : 'ventoagent';
}

async function main() {
    const platform = getPlatform();
    const arch = getArch();
    const binaryName = getBinaryName();
    const outputPath = path.join(BIN_DIR, binaryName);

    console.log('\n🔨 Building Vento Agent');
    console.log(`   Platform: ${platform}`);
    console.log(`   Architecture: ${arch}`);
    console.log(`   Output: ${outputPath}\n`);

    // Ensure bin directory exists
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
    }

    // Check if Go is installed
    try {
        const goVersion = execSync('go version', { encoding: 'utf8' }).trim();
        console.log(`   Go: ${goVersion}\n`);
    } catch (e) {
        console.error('❌ Go is not installed or not in PATH');
        console.error('   Install Go from https://go.dev/dl/');
        process.exit(1);
    }

    // Check if source exists
    if (!fs.existsSync(GO_SRC_DIR)) {
        console.error(`❌ Go source not found at ${GO_SRC_DIR}`);
        process.exit(1);
    }

    // Build
    console.log('   Compiling...');
    try {
        const env = {
            ...process.env,
            GOOS: platform === 'darwin' ? 'darwin' : platform === 'windows' ? 'windows' : 'linux',
            GOARCH: arch,
            CGO_ENABLED: '0'  // Static binary
        };

        execSync(`go build -o "${outputPath}" ./cmd/ventoagent`, {
            cwd: GO_SRC_DIR,
            stdio: 'inherit',
            env
        });

        console.log(`\n✅ Agent built successfully!`);
        console.log(`   Binary: ${outputPath}`);
        
        // Show file size
        const stats = fs.statSync(outputPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`   Size: ${sizeMB} MB\n`);

    } catch (e) {
        console.error('\n❌ Build failed');
        process.exit(1);
    }
}

main().catch(console.error);

