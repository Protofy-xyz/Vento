// apps/dendrite/ecosystem.config.js
const path = require('path');
const currentDir = __dirname;

const binName = process.platform === 'win32' ? 'dendrite.exe' : 'dendrite';
const dendriteBinary = path.join(currentDir, 'bin', binName);
const configPath = path.resolve(currentDir, '../../data/dendrite/dendrite.yaml');

const service = {
  name: 'dendrite',
  script: dendriteBinary,
  args: ['--config', configPath, '--really-enable-open-registration'],
  interpreter: 'none',
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