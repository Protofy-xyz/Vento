const fs = require('fs')
const semver = require('semver');
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