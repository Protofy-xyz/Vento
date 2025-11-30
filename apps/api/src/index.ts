import dotenv from 'dotenv'
dotenv.config({ path: '../../.env' });
import { getServiceToken } from 'protonode'
import { setConfig, getLogger, generateEvent } from 'protobase';
import { getBaseConfig } from '@my/config'
import { pathToFileURL } from 'url';

setConfig(getBaseConfig('api', process, getServiceToken()))
require('events').EventEmitter.defaultMaxListeners = 100;
const logger = getLogger()
const axios = require('axios')
import http from 'http';
global.defaultRoute = '/api/v1'
global.appName = 'api'
import chokidar from 'chokidar';
const { handleUpgrade } = require('app/proxy.js')

// Import HMR statically to ensure same module instance
import { handleFileChange as hmrHandleFileChange } from './hmr';

const isProduction = process.env.NODE_ENV === 'production';
const serviceName = isProduction ? 'api' : 'api-dev'

const PORT = 3001
const waitForCore = true
const coreAddr = process.env.CORE_URL || 'http://localhost:8000/api/core/v1/boards?token=' + getServiceToken()


const start = async () => {
  try {
    const BundleDbProvider = await import(pathToFileURL(require.resolve('app/bundles/dbProviders')).href);
    BundleDbProvider.default()
  } catch (error) {
    logger.error({ error: error.toString() }, "Server error");
  }
  //dynamic import of app from ./api.ts
  const module = await import('./api.js')
  const server = http.createServer(module.default);
  handleUpgrade(server, 'api')
  server.listen(PORT, () => {
    logger.debug({ service: { protocol: "http", port: PORT } }, "Service started: HTTP")
  });
  generateEvent({
    path: 'services/' + serviceName + '/start', //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
    from: serviceName, // system entity where the event was generated (next, api, cmd...)
    user: 'system', // the original user that generates the action, 'system' if the event originated in the system itself
    payload: {}, // event payload, event-specific data
  }, getServiceToken())
}

if (waitForCore) {
  //loop until core is up, 1s interval, 60s timeout
  let retries = 0
  const maxRetries = 60
  const interval = 1000
  const checkCore = async () => {
    try {
      const response = await axios.get(coreAddr)
      if (response.status !== 200) {
        throw new Error('Core not available')
      }
      start()
    } catch (error) {
      if (retries < maxRetries) {
        console.log('Core not available, retrying...')
        retries++
        setTimeout(checkCore, interval)
      } else {
        logger.error({ coreAddr }, 'Core not available after retries')
        process.exit(1)
      }
    }
  }
  checkCore()
} else {
  start()
}

if (process.env.NODE_ENV != 'production') {
  // Paths that support HMR (no restart needed)
  const hmrPaths = [
    '../../data/automations/**',
    '../../data/objects/**',
  ];

  // Paths that require full restart
  const restartPaths = [
    'src/**',
    '../../extensions/**',
    '../../packages/app/bundles/**',
    '../../packages/app/objects/**',
    '../../packages/app/chatbots/**',
    '../../packages/protolib/**',
    '../../packages/app/conf.ts',
    '../../packages/protonode/dist/**',
    '../../packages/protobase/dist/**',
  ];

  // HMR watcher for automations and objects
  const hmrWatcher = chokidar.watch(hmrPaths, {
    ignored: /^([.][^.\/\\])|([\/\\]+[.][^.])/,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 }, // faster for HMR
    persistent: true
  });

  // Restart watcher for everything else
  const restartWatcher = chokidar.watch(restartPaths, {
    ignored: /^([.][^.\/\\])|([\/\\]+[.][^.])/,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 },
    persistent: true
  });

  const scheduleRestart = (() => {
    let timer, announced = false;
    return () => {
      clearTimeout(timer);
      if (!announced) { 
        announced = true; 
        console.log('Detected changes, restarting service...'); 
      }
      timer = setTimeout(async () => {
        await generateEvent({ path: `services/${serviceName}/stop`, from: serviceName, user: 'system', payload: {} }, getServiceToken());
        // Exit code 100 = "restart requested" (will be restarted by process manager)
        process.exit(100);
      }, 1000);
    };
  })();

  let hmrArmed = false;
  let restartArmed = false;

  hmrWatcher.on('ready', () => { 
    hmrArmed = true; 
    console.log('[HMR] Watcher ready');
  });
  restartWatcher.on('ready', () => { restartArmed = true; });

  // HMR events - hot reload without restart
  const HMR_EVENTS = new Set(['change', 'add', 'unlink']);
  hmrWatcher.on('all', async (event, filePath) => {
    if (!hmrArmed) return;
    
    if (HMR_EVENTS.has(event) && filePath.endsWith('.ts')) {
      console.log(`[HMR] ${event}: ${filePath}`);
      try {
        // Use statically imported handler - same module instance as api.ts
        await hmrHandleFileChange(event, filePath);
      } catch (error) {
        console.error('[HMR] Error handling file change:', error);
      }
    }
  });

  // Restart events - full process restart
  const RESTART_EVENTS = new Set(['change', 'add']);
  restartWatcher.on('all', (event) => {
    if (!restartArmed) return;
    if (RESTART_EVENTS.has(event)) scheduleRestart();
  });
}