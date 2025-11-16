//run yarn to install dependencies in ../cinny
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const AdmZip = require('adm-zip');
const tar = require('tar');

async function prepare() {
    console.log('Preparing Dendrite binaries...');

    const downloadDendrite = require('./../../scripts/download-dendrite');
    await downloadDendrite(AdmZip, tar);

    console.log('Dendrite binaries are ready.');
}

prepare().catch(err => {
    console.error('Error preparing Dendrite:', err);
    process.exit(1);
});

if(!fs.existsSync(path.join(__dirname, '..', '..', 'data', 'dendrite'))) {
    fs.mkdirSync(path.join(__dirname, '..', '..', 'data', 'dendrite'), { recursive: true });
}

