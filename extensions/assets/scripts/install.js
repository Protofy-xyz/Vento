const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function moveAssetStructure(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) {
        console.error(`Source folder "${sourceDir}" does not exist.`);
        return;
    }

    const copiedFiles = [];
    const ventoDir = path.join(sourceDir, '.vento');
    const logPath = path.join(ventoDir, 'copiedFiles.json');

    function walkAndMove(currentSource, currentTarget) {
        const entries = fs.readdirSync(currentSource, { withFileTypes: true })
                          .filter(entry => entry.name !== '.vento');

        for (const entry of entries) {
            const srcPath = path.join(currentSource, entry.name);
            const destPath = path.join(currentTarget, entry.name);

            if (entry.isDirectory()) {
                if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true });
                }
                walkAndMove(srcPath, destPath);

                // delete the original directory if it is empty
                const remaining = fs.readdirSync(srcPath).filter(name => name !== '.vento');
                if (remaining.length === 0) {
                    fs.rmdirSync(srcPath);
                }
            } else if (entry.isFile()) {
                if (!fs.existsSync(destPath)) {
                    fs.copyFileSync(srcPath, destPath);
                    fs.unlinkSync(srcPath); // delete the original file
                    const relativePath = path.relative(sourceDir, srcPath);
                    copiedFiles.push(relativePath);
                }
            }
        }
    }

    walkAndMove(sourceDir, targetDir);

    if (!fs.existsSync(ventoDir)) {
        fs.mkdirSync(ventoDir);
    }

    fs.writeFileSync(logPath, JSON.stringify(copiedFiles, null, 2), 'utf-8');
}

function installAsset(assetName) {
    if (!assetName) {
        console.error('Please provide the asset name as an argument.');
        throw new Error('Please provide the asset name as an argument.');
    }
    const baseDir = path.resolve(__dirname, '../../../');
    const sourceDir = path.join(baseDir, '/data/assets', assetName);

    if (!fs.existsSync(sourceDir)) {
        console.error(`Asset "${assetName}" does not exist in the source directory.`);
        throw new Error(`Asset "${assetName}" does not exist in the source directory.`);
    }

    const targetDir = path.join(__dirname, '..', '..');

    moveAssetStructure(sourceDir, targetDir);

    console.log(`Asset files "${assetName}" moved successfully.`);

    const yarnPath = path.join(baseDir, '.yarn', 'releases', 'yarn-4.1.0.cjs');

    execSync(`node ${yarnPath}`, { stdio: 'inherit' });
}

module.exports = {installAsset}