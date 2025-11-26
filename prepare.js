const fs = require('fs')
const semver = require('semver');
const AdmZip = require('adm-zip');

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
        console.log('Compiled pages not found, downloading from release...');
        fs.mkdirSync('./data/pages');
        const response = await fetch('https://github.com/Protofy-xyz/Vento/releases/download/development/vento-pages.zip');
        const zip = await response.arrayBuffer();
        const zipFile = new AdmZip(Buffer.from(zip));
        zipFile.extractAllTo('.');
    }
})();