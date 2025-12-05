const path = require('path');
const currentDir = path.dirname(__filename);

const docsDev = {
    name: "docs-dev",
    script: 'npx',
    args: 'docusaurus start --port 3005',
    windowsHide: true,
    watch: false,
    treekill: true,
    kill_timeout: 5000,
    env: {
        NODE_ENV: 'development',
        DOTENV_CONFIG_PATH: path.resolve(__dirname, '../../.env')
    },
    cwd: currentDir,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    out_file: '../../logs/raw/docs-dev.stdout.log',
    error_file: '../../logs/raw/docs-dev.stderr.log',
    node_args: '--max-old-space-size=4096',
    vizion: false
}

module.exports = {
    apps: [docsDev]
}

