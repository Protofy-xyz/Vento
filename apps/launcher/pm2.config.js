const path = require('path');
const currentDir = path.dirname(__filename);


const siteDev = {
  name: "launcher-dev",
  script: path.join(currentDir, 'entrypoint.js'),
  windowsHide: true,
  watch: false,
  treekill: true,
  kill_timeout: 5000,
  env: {
      NODE_ENV: 'development',
      DOTENV_CONFIG_PATH: path.resolve(__dirname, '../../.env'),
      NEXT_PUBLIC_APP_ID: 'launcher'
  },
  cwd: currentDir,
  log_date_format: "YYYY-MM-DD HH:mm:ss",
  out_file: '../../logs/raw/launcher-dev.stdout.log',
  error_file: '../../logs/raw/launcher-dev.stderr.log',
  node_args: '--max-old-space-size=4096',
  vizion: false
}

module.exports = {
    apps: [siteDev] 
}