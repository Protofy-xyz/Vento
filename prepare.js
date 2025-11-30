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
    "./data/public/clients",
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