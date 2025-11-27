const path = require('path');
const currentDir = path.join(__dirname, '..', 'cinny');

const siteDev = {
  name: "cinny-dev",
  script: path.join(currentDir, 'node_modules', 'vite', 'bin', 'vite.js'),
  args: '--port 8181',
  interpreter: 'node',
  windowsHide: true,
  watch: false,
  treekill: true,
  kill_timeout: 5000,
  env: {
    NODE_ENV: 'development',
    DOTENV_CONFIG_PATH: path.resolve(currentDir, '../../.env')
  },
  cwd: currentDir,
  log_date_format: "YYYY-MM-DD HH:mm:ss",
  out_file: path.resolve(currentDir, '../../logs/raw/cinny-dev.stdout.log'),
  error_file: path.resolve(currentDir, '../../logs/raw/cinny-dev.stderr.log'),
  node_args: '--max-old-space-size=4096',
  vizion: false
}

module.exports = {
  apps: [siteDev]
}