const isProduction = process.env.NODE_ENV === 'production';
const isFullDev = process.env.FULL_DEV === '1';
const path = require('path');
const currentDir = path.dirname(__filename);

const commonEnv = {
    PATH: `${path.resolve(currentDir, '../../bin')}${path.delimiter}${process.env.PATH}`
};

let node = 'node'
if (process.platform === 'win32') {
    const nodeBin = path.resolve(path.join(currentDir, '../../bin/node.exe'));
    if (require('fs').existsSync(nodeBin)) {
        node = nodeBin;
    } else {
        console.warn(`Node binary not found at ${nodeBin}. Using default node.`);
    }
} else if (process.platform === 'darwin') {
    const nodeBin = path.resolve(path.join(currentDir, '../../bin/node'));
    if (require('fs').existsSync(nodeBin)) {
        node = nodeBin;
    } else {
        console.warn(`Node binary not found at ${nodeBin}. Using default node.`);
    }
} else if (process.platform === 'linux') {
    const nodeBin = path.resolve(path.join(currentDir, '../../bin/node'));
    if (require('fs').existsSync(nodeBin)) {
        node = nodeBin;
    } else {
        console.warn(`Node binary not found at ${nodeBin}. Using default node.`);
    }
}

module.exports = {
    apps: [
        isFullDev ? {
            name: 'core-dev',
            script: 'src/index.ts',
            interpreter: node,
            interpreter_args: '--import tsx',
            watch: false,
            autorestart: true,
            windowsHide: true,
            treekill: true,
            kill_timeout: 5000,
            env: {
                NODE_ENV: 'development',
                ...commonEnv
            },
            cwd: currentDir,
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            out_file: '../../logs/raw/core-dev.stdout.log',
            error_file: '../../logs/raw/core-dev.stderr.log',
            vizion: false
        } : {
            name: 'core',
            script: 'src/index.ts',
            interpreter: node,
            interpreter_args: '--import tsx',
            watch: false,
            autorestart: true,
            windowsHide: true,
            treekill: true,
            kill_timeout: 5000,
            env: {
                NODE_ENV: 'production',
                ...commonEnv
            },
            cwd: currentDir,
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            out_file: '../../logs/raw/core.stdout.log',
            error_file: '../../logs/raw/core.stderr.log',
            vizion: false
        }
    ],
};