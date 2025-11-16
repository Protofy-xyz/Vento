const fs = require('fs');
const { chmodSync, unlinkSync, mkdirSync, existsSync, readdirSync } = fs;
const https = require('https');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

module.exports = async function downloadDendrite(AdmZip, tar) {
    const version = process.env.DENDRITE_VERSION || 'v0.1.2';
    const baseUrl = `https://github.com/Protofy-xyz/dendrite/releases/download/${version}`;

    const dendriteDir = path.join(__dirname, '..', 'apps', 'dendrite');
    const binDir = path.join(dendriteDir, 'bin');

    const targets = {
        win: {
            url: `${baseUrl}/dendrite-windows-amd64.zip`,
            marker: 'dendrite.exe',
            extract: async (archivePath) => {
                const zip = new AdmZip(archivePath);
                if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
                zip.extractAllTo(binDir, true);
                if (!existsSync(path.join(binDir, 'dendrite.exe'))) {
                    throw new Error('❌ dendrite.exe not found after extraction');
                }
            }
        },

        linuxX64: {
            url: `${baseUrl}/dendrite-linux-amd64.tar.gz`,
            marker: 'dendrite',
            extract: async (archivePath) => {
                await tar.x({ file: archivePath, cwd: dendriteDir, strip: 0 });
                if (!existsSync(path.join(binDir, 'dendrite'))) {
                    throw new Error('❌ dendrite not found after extraction (linux-x64)');
                }
            }
        },

        linuxArm64: {
            url: `${baseUrl}/dendrite-linux-arm64.tar.gz`,
            marker: 'dendrite',
            extract: async (archivePath) => {
                await tar.x({ file: archivePath, cwd: dendriteDir, strip: 0 });
                if (!existsSync(path.join(binDir, 'dendrite'))) {
                    throw new Error('❌ dendrite not found after extraction (linux-arm64)');
                }
            }
        },

        linuxArmv7: {
            url: `${baseUrl}/dendrite-linux-armv7.tar.gz`,
            marker: 'dendrite',
            extract: async (archivePath) => {
                await tar.x({ file: archivePath, cwd: dendriteDir, strip: 0 });
                if (!existsSync(path.join(binDir, 'dendrite'))) {
                    throw new Error('❌ dendrite not found after extraction (linux-armv7)');
                }
            }
        },

        macArm64: {
            url: `${baseUrl}/dendrite-darwin-arm64.tar.gz`,
            marker: 'dendrite',
            extract: async (archivePath) => {
                await tar.x({ file: archivePath, cwd: dendriteDir, strip: 0 });
                if (!existsSync(path.join(binDir, 'dendrite'))) {
                    throw new Error('❌ dendrite not found after extraction (darwin-arm64)');
                }
            }
        }
    };

    // -------------------------------------------------------------------------
    // Redirect-safe downloader (no delete on redirect)
    // -------------------------------------------------------------------------
    async function download(url, dest, redirectCount = 0) {
        return new Promise((resolve, reject) => {
            if (redirectCount > 5) {
                return reject(new Error(`Too many redirects: ${url}`));
            }

            const file = fs.createWriteStream(dest);
            const req = https.get(url, { headers: { 'User-Agent': 'Vento-Dendrite-Downloader' } }, (res) => {

                // Redirect handling (no unlink!)
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    file.close();
                    console.log(`↪ Redirect ${res.statusCode} → ${res.headers.location}`);
                    return resolve(download(res.headers.location, dest, redirectCount + 1));
                }

                if (res.statusCode !== 200) {
                    file.close(() => { if (existsSync(dest)) unlinkSync(dest); });
                    return reject(new Error(`Failed to download: HTTP ${res.statusCode}`));
                }

                res.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                    res.destroy();
                    req.destroy();
                });
            });

            req.on('error', (err) => {
                file.close(() => {
                    if (existsSync(dest)) unlinkSync(dest);
                });
                reject(err);
            });
        });
    }

    // -------------------------------------------------------------------------
    // Extract + chmod all bin/*
    // -------------------------------------------------------------------------
    async function finalizePermissions() {
        if (!existsSync(binDir)) return;
        for (const file of readdirSync(binDir)) {
            const full = path.join(binDir, file);
            try {
                if (fs.lstatSync(full).isFile()) {
                    chmodSync(full, 0o755);
                }
            } catch { /* Windows */ }
        }
    }

    // -------------------------------------------------------------------------
    // Setup per platform
    // -------------------------------------------------------------------------
    async function setupPlatform(key, config) {
        if (!existsSync(dendriteDir)) mkdirSync(dendriteDir, { recursive: true });

        // Skip if bin already exists and has files
        if (existsSync(binDir) && readdirSync(binDir).length > 0) {
            console.log(`✅ Dendrite already present → ${binDir}`);
            return;
        }

        const archivePath = path.join(dendriteDir, path.basename(config.url));

        console.log(`⬇️  Downloading ${key} into ${archivePath}`);
        await download(config.url, archivePath);

        console.log(`📦 Extracting ${key}...`);
        await config.extract(archivePath);

        console.log(`🧹 Deleting ${path.basename(archivePath)}`);
        unlinkSync(archivePath);

        console.log(`🔧 Fixing permissions in ${binDir}...`);
        await finalizePermissions();

        console.log(`✅ ${key} ready → ${binDir}`);
    }

    // -------------------------------------------------------------------------
    // MAIN
    // -------------------------------------------------------------------------
    async function main() {
        const arch = process.arch;
        const platform = process.platform;

        if (platform === 'win32') {
            await setupPlatform('dendrite-win-x64', targets.win);
        } else if (platform === 'darwin') {
            if (arch !== 'arm64') throw new Error("Only mac ARM64 supported");
            await setupPlatform('dendrite-darwin-arm64', targets.macArm64);
        } else if (platform === 'linux') {
            if (arch === 'x64') await setupPlatform('dendrite-linux-x64', targets.linuxX64);
            else if (arch === 'arm64') await setupPlatform('dendrite-linux-arm64', targets.linuxArm64);
            else if (arch === 'arm') await setupPlatform('dendrite-linux-armv7', targets.linuxArmv7);
            else throw new Error(`Unsupported Linux arch: ${arch}`);
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        //generate ../../data/dendrite/matrix_key.pem if it does not exist
        const dataDir = path.join(__dirname, '..', 'data', 'dendrite');
        const keyPath = path.join(dataDir, 'matrix_key.pem');
        if (!fs.existsSync(keyPath)) {
            console.log('Generating matrix_key.pem for Dendrite...');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            //inside bin folder we have generate-keys or generate-keys.exe depending on the platform
            const binDir = path.join(__dirname, '..', 'apps', 'dendrite', 'bin');
            const generateKeysPath = process.platform === 'win32' ? path.join(binDir, 'generate-keys.exe') : path.join(binDir, 'generate-keys');

            //execute generate-keys with child_process
            execSync(`"${generateKeysPath}" -private-key "${keyPath}"`, { stdio: 'inherit' });
            console.log('matrix_key.pem has been generated.');
        } else {
            console.log('matrix_key.pem already exists. Skipping generation.');
        }

        console.log("📁 bin:", existsSync(binDir) ? readdirSync(binDir) : "NONE");

        // Ensure script terminates
        process.nextTick(() => process.exit(0));
    }

    return main().catch((err) => {
        console.error("❌ Dendrite error:", err);
        process.exit(1);
    });
};