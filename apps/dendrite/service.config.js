// apps/dendrite/service.config.js
const path = require('path');
const currentDir = __dirname;

const service = {
  name: 'dendrite',
  script: path.join(currentDir, 'start.js'),
  interpreter: 'node',
  windowsHide: true,
  watch: false,
  treekill: true,
  kill_timeout: 5000,
  cwd: currentDir,
  env: {
    // DENDRITE_HTTP_BIND_ADDRESS: '0.0.0.0:8008'
  },
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
  out_file: path.resolve(currentDir, '../../logs/raw/dendrite.stdout.log'),
  error_file: path.resolve(currentDir, '../../logs/raw/dendrite.stderr.log'),
  vizion: false,
  exec_mode: 'fork'
};

module.exports = {
  apps: [service]
};

