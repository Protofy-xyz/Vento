const fs = require('fs')
const semver = require('semver');
const AdmZip = require('adm-zip');

const skipPagesDownload = process.argv.includes('--skip-pages-download') || process.env.SKIP_PAGES_DOWNLOAD === 'true';
const skipDownloadClient = process.argv.includes('--skip-download-client') || process.env.SKIP_DOWNLOAD_CLIENT === 'true';
const requiredVersion = '>=18.0.0';

if (!semver.satisfies(process.version, requiredVersion)) {
    console.error(`Protofy requires node version: ${requiredVersion}. Current version ${process.version}.`);
    console.error('If you need help, join our discord: https://discord.gg/VpeZxMFfYW')
    process.exit(1);
}
const directories = [
    "./bin",
    "./data",
    "./data/public",
    "./data/models",
    "./data/public/clients",
    "./data/public/clients/desktop",
    "./data/tmp",
    "./logs/raw",
    "./data/databases"
];

directories.forEach(directory => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }
});

//download data/pages if it doesn't exist
(async () => {
    if (!fs.existsSync('./data/pages')) {
        if (skipPagesDownload) {
            console.log('Skipping pages download (--skip-pages-download flag detected)');
            fs.mkdirSync('./data/pages');
            return;
        }
        console.log('Compiled pages not found, downloading from release...');
        fs.mkdirSync('./data/pages');
        
        const url = 'https://github.com/Protofy-xyz/Vento/releases/download/development/vento-pages.zip';
        const maxRetries = 3;
        const retryDelay = 3000;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Download attempt ${attempt}/${maxRetries}...`);
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
                }
                
                console.log('Download complete, extracting files...');
                const zip = await response.arrayBuffer();
                const zipFile = new AdmZip(Buffer.from(zip));
                zipFile.extractAllTo('.');
                console.log('Pages extracted successfully!');
                return;
            } catch (error) {
                console.error(`Attempt ${attempt} failed: ${error.message}`);
                if (attempt < maxRetries) {
                    console.log(`Retrying in ${retryDelay / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    console.error('All download attempts failed. Please check your internet connection.');
                    fs.rmdirSync('./data/pages');
                    process.exit(1);
                }
            }
        }
    }
})();

(async () => {
    if (!fs.existsSync('./data/public/clients/vento-client.apk')) {
        console.log('Downloading android client...');
        const clientUrl = 'https://github.com/Protofy-xyz/Vento/releases/download/development/vento-client.apk';
        const response = await fetch(clientUrl);
        if (!response.ok) {
            console.error(`Failed to download client: ${response.status} ${response.statusText}`);
            return;
        }
        const client = await response.arrayBuffer();
        fs.writeFileSync('./data/public/clients/vento-client.apk', Buffer.from(client));
        console.log('Android client downloaded successfully!');
    }
    
    // Download all agents to data/public/clients/desktop
    const agents = [
        'ventoagent-darwin-amd64',
        'ventoagent-darwin-arm64',
        'ventoagent-linux-amd64',
        'ventoagent-linux-arm64',
        'ventoagent-linux-armv7',
        'ventoagent-windows-amd64.exe',
        'ventoagent-windows-arm64.exe'
    ];

    const baseUrl = 'https://github.com/Protofy-xyz/Vento/releases/download/development/';
    const destDir = './data/public/clients/desktop';

    const maxRetries = 3;
    const retryDelay = 3000;

    for (const agent of agents) {
        const destPath = `${destDir}/${agent}`;
        if (!fs.existsSync(destPath)) {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`Downloading ${agent} (attempt ${attempt}/${maxRetries})...`);
                    const response = await fetch(`${baseUrl}${agent}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
                    }
                    const data = await response.arrayBuffer();
                    fs.writeFileSync(destPath, Buffer.from(data));
                    console.log(`${agent} downloaded successfully!`);
                    break;
                } catch (error) {
                    console.error(`Attempt ${attempt} failed for ${agent}: ${error.message}`);
                    if (attempt < maxRetries) {
                        console.log(`Retrying in ${retryDelay / 1000} seconds...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    } else {
                        console.error(`Failed to download ${agent} after ${maxRetries} attempts.`);
                    }
                }
            }
        }
    }
})();
//download vento agent if it doesn't exist
(async () => {
    if (skipDownloadClient) {
        console.log('Skipping agent download (--skip-download-client flag detected)');
        return;
    }
    
    const { downloadAgent } = require('./scripts/download-agent');
    const result = await downloadAgent({ force: false });
    
    if (!result.success) {
        console.error('Warning: Failed to download Vento agent. You can retry with: node scripts/download-agent.js');
    }
})();

// Download llama-server binary for local LLM inference
(async () => {
    const skipLlamaDownload = process.argv.includes('--skip-llama-download') || process.env.SKIP_LLAMA_DOWNLOAD === 'true';
    
    if (skipLlamaDownload) {
        console.log('Skipping llama-server download (--skip-llama-download flag detected)');
        return;
    }
    
    try {
        const downloadLlama = require('./scripts/download-llama');
        const result = await downloadLlama(AdmZip);
        
        if (!result.success) {
            console.error('Warning: Failed to download llama-server. You can retry with: node scripts/download-llama.js');
        }
    } catch (err) {
        console.error('Warning: Failed to download llama-server:', err.message);
        console.error('You can retry with: node scripts/download-llama.js');
    }
})();