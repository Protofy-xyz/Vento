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
      await generateEvent({
        path: 'services/core/stop', //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
        from: 'core', // system entity where the event was generated (next, api, cmd...)
        user: 'system', // the original user that generates the action, 'system' if the event originated in the system itself
        payload: {}, // event payload, event-specific data
      }, getServiceToken())
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
          BundleAPI.default(app, { mqtt, topicSub, topicPub, ...BundleContext });
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
}


if (require.main === module) {
  startCore()
}
