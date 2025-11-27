const isProduction = process.env.NODE_ENV === 'production';

const path = require('path');
const currentDir = path.dirname(__filename);

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

const api = {
    name: 'api',
    script: 'src/index.ts',
    interpreter: node,
    interpreter_args: '--import tsx',
    watch: false,
    autorestart: true,
    windowsHide: true,
    treekill: true,
    kill_timeout: 5000,
    env: {
        NODE_ENV: 'production'
    },
    cwd: currentDir,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    out_file: '../../logs/raw/api.stdout.log',
    error_file: '../../logs/raw/api.stderr.log',
    vizion: false
}

const apiDev = {
    name: 'api-dev',
    script: 'src/index.ts',
    interpreter: node,
    interpreter_args: '--import tsx',
    watch: false,
    autorestart: true,
    windowsHide: true,
    treekill: true,
    kill_timeout: 5000,
    env: {
        NODE_ENV: 'development'
    },
    cwd: currentDir,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    out_file: '../../logs/raw/api-dev.stdout.log',
    error_file: '../../logs/raw/api-dev.stderr.log',
    vizion: false
}

module.exports = {
    apps: isProduction ? [api] : [apiDev],
};