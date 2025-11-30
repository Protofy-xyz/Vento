import { LOGS_EXTENSION } from "./models/assets";

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function moveAssetStructure(sourceDir, targetDir, logsDir = "") {
    if (!fs.existsSync(sourceDir)) {
        console.error(`Source folder "${sourceDir}" does not exist.`);
        return;
    }

    const copiedFiles: any = [];
    const ventoDir = path.join(sourceDir, '.vento');

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

    if (logsDir) {
        fs.mkdirSync(logsDir, { recursive: true });
        const copiedFilesPath = path.join(logsDir, 'copiedFiles.json');
        fs.writeFileSync(copiedFilesPath, JSON.stringify(copiedFiles, null, 2), 'utf-8');
    }
}

export function installAsset(assetName) {
    if (!assetName) {
        console.error('Please provide the asset name as an argument.');
        throw new Error('Please provide the asset name as an argument.');
    }
    const sourceDir = path.join(__dirname, '..', '..', 'data', 'assets', assetName);

    if (!fs.existsSync(sourceDir)) {
        console.error(`Asset "${assetName}" does not exist in the source directory.`);
        throw new Error(`Asset "${assetName}" does not exist in the source directory.`);
    }

    const targetDir = path.join(__dirname, '..', '..');
    const logsDir = path.join(__dirname, '..', '..', 'data', 'assets', assetName + LOGS_EXTENSION);

    moveAssetStructure(sourceDir, targetDir, logsDir);
    execSync(`node ../../.yarn/releases/yarn-4.1.0.cjs`, { stdio: 'inherit' });
}