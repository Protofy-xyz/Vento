import dotenv from 'dotenv'
import { setConfig, getConfig, getLogger, generateEvent } from 'protobase';
import { getBaseConfig, getConfigWithoutSecrets } from '@my/config'
import { pathToFileURL } from 'url';

// get config vars
dotenv.config({ path: '../../.env' });
global.defaultRoute = '/api/core/v1'
global.appName = 'core'
import { getServiceToken, getApp, getMQTTClient, handler } from 'protonode'
setConfig(getBaseConfig("core", process, getServiceToken()))
require('events').EventEmitter.defaultMaxListeners = 100;
const { createExpressProxy, handleUpgrade } = require('app/proxy.js')

import http from 'http';

import chokidar from 'chokidar';
import BundleContext from 'app/bundles/context'
import { startMqtt } from './mqtt';

const isFullDev = process.env.FULL_DEV === '1';
let watchEnabled = false
// =============================================================================
// CLEANUP HOOKS SYSTEM
// 
// Extensions (like llama) can register cleanup hooks that MUST run before
// the process exits. This is CRITICAL for GPU-based extensions on Windows
// where not releasing GPU memory causes system crashes (0x10e BSOD).
//
// How it works:
// 1. Extensions call registerCleanupHook(name, asyncFn) during initialization
// 2. Before hot reload or shutdown, runCleanupHooks() is called
// 3. All hooks run in parallel with a timeout
// 4. Only after cleanup completes does the process exit
// =============================================================================
const cleanupHooks: Map<string, () => Promise<void>> = new Map();
let isCleaningUp = false;

/**
 * Register a cleanup hook that will be called before process exit.
 * Extensions should use this for GPU/resource cleanup.
 * @param name Unique identifier for this hook (e.g., 'llama-gpu')
 * @param fn Async function to run during cleanup
 */
export const registerCleanupHook = (name: string, fn: () => Promise<void>) => {
  cleanupHooks.set(name, fn);
  console.log(`[core] Cleanup hook registered: ${name}`);
};

/**
 * Remove a cleanup hook by name
 */
export const unregisterCleanupHook = (name: string) => {
  cleanupHooks.delete(name);
};

/**
 * Run all cleanup hooks with a timeout.
 * Returns a promise that resolves when all hooks complete or timeout.
 */
const runCleanupHooks = async (timeoutMs: number = 5000): Promise<void> => {
  if (isCleaningUp) return;
  isCleaningUp = true;
  
  if (cleanupHooks.size === 0) {
    console.log('[core] No cleanup hooks registered');
    return;
  }
  
  console.log(`[core] Running ${cleanupHooks.size} cleanup hook(s)...`);
  
  const hookPromises = Array.from(cleanupHooks.entries()).map(async ([name, fn]) => {
    try {
      console.log(`[core] Running cleanup: ${name}`);
      await fn();
      console.log(`[core] Cleanup complete: ${name}`);
    } catch (err: any) {
      console.error(`[core] Cleanup error in ${name}:`, err?.message || err);
    }
  });
  
  // Wait for all hooks with timeout
  await Promise.race([
    Promise.all(hookPromises),
    new Promise<void>((resolve) => setTimeout(() => {
      console.warn('[core] Cleanup timeout reached, continuing with exit');
      resolve();
    }, timeoutMs))
  ]);
  
  console.log('[core] All cleanup hooks finished');
};

const isWatchEnabled = () =>{
  return watchEnabled;
}

const watch = () => {
  if(isWatchEnabled()) { 
    console.log('Watcher already enabled, skipping...')
    return;
  }

  watchEnabled = true;
  
  const pathsToWatch = [
    'src/**',
    '../../extensions/**',
    '../../packages/app/conf.ts',
    '../../packages/protolib/**',
    '../../packages/app/bundles/coreApis.ts',
    '../../packages/app/bundles/coreContext.ts',
    '../../packages/protonode/dist/**',
    '../../packages/protobase/dist/**',
  ];

  const watcher = chokidar.watch(pathsToWatch, {
    ignored: /^([.][^.\/\\])|([\/\\]+[.][^.])/,
    persistent: true
  });

  var restarting = false
  var restartTimer = null
  watcher.on('change', async (path) => {
    if(!isWatchEnabled()) {
      console.log('Changed detected in file: ', path, ' but watch is not enabled, skipping restart...');
      return;
    }
    if (restarting) {
      clearTimeout(restartTimer)
    } else {
      console.log(`File ${path} has been changed, restarting...`);
      restarting = true
    }

    restartTimer = setTimeout(async () => {
      try {
        await generateEvent({
          path: 'services/core/stop', //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
          from: 'core', // system entity where the event was generated (next, api, cmd...)
          user: 'system', // the original user that generates the action, 'system' if the event originated in the system itself
          payload: {}, // event payload, event-specific data
        }, getServiceToken())
      } catch (e) {
        console.error('[core] Error generating stop event:', e);
      }
      
      // CRITICAL: Run cleanup hooks before exit (GPU memory release, etc.)
      // This prevents Windows GPU crashes (0x10e) during hot reload
      console.log('[core] Hot reload: running cleanup hooks before exit...');
      try {
        await runCleanupHooks(5000);
      } catch (e) {
        console.error('[core] Error in cleanup hooks:', e);
      }
      
      // Small delay to ensure GPU driver has time to process memory release
      // Windows NVIDIA drivers sometimes need a moment to reclaim VRAM
      console.log('[core] Hot reload: waiting for GPU driver to release memory...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('[core] Hot reload: cleanup complete, exiting...');
      
      // Exit code 100 = "restart requested" (will be restarted by process manager)
      // Exit code 0 would mean "clean shutdown, don't restart"
      process.exit(100)
    }, 1000);
  })
}
export const startCore = (ready?) => {
  const config = getConfig()
  const logger = getLogger()

  const app = getApp((app) => app.use(createExpressProxy('core')))

  process.on('uncaughtException', function (err) {
    logger.error({ err }, 'Uncaught Exception: ', err.message)
  });

  startMqtt(config)
  logger.info({ config: getConfigWithoutSecrets(config) }, "Service Started: core")
  const mqtt = getMQTTClient('core', getServiceToken())

  const topicSub = (mqtt, topic, cb) => {
    mqtt.subscribe(topic)
    mqtt.on("message", (messageTopic, message) => {
      const isWildcard = topic.endsWith("#");
      if (!isWildcard && topic != messageTopic) {
        return
      }
      if (isWildcard && !messageTopic.startsWith(topic.slice(0, -1).replace(/\/$/, ''))) {
        return
      }
      const parsedMessage = message.toString();
      cb(parsedMessage, messageTopic)
    });
  };

  const topicPub = (mqtt, topic, data) => {
    mqtt.publish(topic, data)
  }

  try {
    import(pathToFileURL(require.resolve('app/bundles/dbProviders')).href).then(async (DBBundle) => {
      DBBundle.default().then(async () => {
        try {
          const { connectDB } = await import(pathToFileURL(require.resolve('app/bundles/storageProviders')).href)
          await connectDB('__healthcheck__')
        } catch (e) {
          logger.warn({ error: (e as any)?.toString?.() || e }, 'DB provider healthcheck failed, switching to sqlite')
          await DBBundle.default('sqlite')
        }
        const adminModules = await import(pathToFileURL(require.resolve('./api/index')).href)
        logger.debug({ adminModules }, 'Admin modules: ', JSON.stringify(adminModules))
        import(pathToFileURL(require.resolve('app/bundles/coreApis')).href).then((BundleAPI) => {
          // Pass registerCleanupHook to extensions so they can register GPU/resource cleanup
          BundleAPI.default(app, { 
            mqtt, 
            topicSub, 
            topicPub, 
            registerCleanupHook,
            unregisterCleanupHook,
            ...BundleContext 
          });
        });
      });
    })

  } catch (error) {
    logger.error({ error: error.toString() }, "Server error")
  }

  const server = http.createServer(app);
  app.get('/api/core/v1/core/watch/on', handler(async (req, res, session, next) => {
    if(!session || !session.user.admin) {
        res.status(401).send({error: "Unauthorized"})
        return
    }
    watch()
    res.send({status: 'enabled'})
  }))

  app.get('/api/core/v1/core/watch/off', handler(async (req, res, session, next) => {
    if(!session || !session.user.admin) {
        res.status(401).send({error: "Unauthorized"})
        return
    }
    watchEnabled = false
    res.send({status: 'disabled'})
  }))

  handleUpgrade(server, 'core')
  const PORT = 8000
  server.listen(PORT, () => {
    logger.debug({ service: { protocol: "http", port: PORT } }, "Service started: HTTP")
    if (ready) {
      ready(PORT, getServiceToken())
    }
    if (process.send) {
      //notify potential fork parents about the service readiness
      process.send('ready');
    } else {
      //if there is no fork, generate a start event
      generateEvent({
        path: 'services/core/start', //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
        from: 'core', // system entity where the event was generated (next, api, cmd...)
        user: 'system', // the original user that generates the action, 'system' if the event originated in the system itself
        payload: {}, // event payload, event-specific data
      }, getServiceToken())
    }
  });
  
  if(isFullDev) {
    watch();
  }
  
  // ==========================================================================
  // SIGNAL HANDLERS FOR GRACEFUL SHUTDOWN
  // 
  // When the process receives SIGINT (Ctrl+C) or SIGTERM, we need to:
  // 1. Run all cleanup hooks (GPU cleanup, etc.)
  // 2. Then exit
  // 
  // This prevents Windows GPU crashes (0x10e BSOD) during normal shutdown.
  // ==========================================================================
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[core] Received ${signal}, shutting down gracefully...`);
    
    try {
      await runCleanupHooks(5000);
    } catch (err: any) {
      console.error('[core] Error during shutdown cleanup:', err?.message || err);
    }
    
    // Exit with appropriate code
    process.exit(signal === 'SIGTERM' ? 0 : 130);
  };
  
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}


if (require.main === module) {
  startCore()
}
