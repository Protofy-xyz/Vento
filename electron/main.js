// 📦 main.js
const { app, BrowserWindow, session, ipcMain, shell} = require('electron');
const https = require('https');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const process = require('process');
const fs = require('fs');


function getNodePath(rootPath) {
  //get path to the local Node.js binary
  let nodePath = os.platform() === 'win32' ? path.join(rootPath, 'bin/node.exe') : path.join(rootPath, 'bin/node')
  const hasLocalNode = fs.existsSync(nodePath);

  if (hasLocalNode) {
    console.log('🟢 Local Node.js binary found. Using it for child processes: ', nodePath);
    process.execPath = nodePath; // Set the Node.js binary path for child processes
  } else {
    nodePath = 'node'
    console.warn('🟡 No local Node.js binary found. Using system Node.js.');
  }
  return nodePath;
}

function generateEvent(event, token = '') {
  const postData = JSON.stringify(event);

  const options = {
    hostname: 'localhost',
    port: 8000,
    path: '/api/core/v1/events?token=' + token,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    }
  };

  const req = http.request(options, (res) => {
    res.setEncoding('utf8');
    res.on('data', () => { });
    res.on('end', () => {
      console.log('✅ Event sent:', event.path);
    });
  });

  req.on('error', (e) => {
    console.error('❌ Failed to send event:', e.message);
  });

  req.write(postData);
  req.end();
}

module.exports = function start(rootPath) {
  console.log('🚀 Starting Vento Launcher...');
  console.log('📂 Root path:', rootPath);

  const nodePath = getNodePath(rootPath);

  process.env.VENTO_ELECTRON = '1';

  process.chdir(rootPath);
  console.log('🟢 Starting app...');
  console.log('📁 Current directory:', rootPath);

  // Avoid recursion
  if (process.env.IS_ECOSYSTEM_CHILD === '1') {
    console.log('🚫 Detected child process. Exiting to avoid recursion.');
    process.exit(0);
  }

  let logWindow = null;
  let mainWindow = null;
  let browserWindow = null;
  let userSession = null;

  // ====== 👇 Camera permissions on demand ======
  const ALLOWLIST_ORIGINS = new Set(['http://localhost:8000']);
  const webcamGrants = new Map(); // wc.id -> expiresAt ms

  function isArmedPeek(wc) {
    const exp = webcamGrants.get(wc.id);
    return !!exp && Date.now() < exp;
  }

  function isArmed(wc) { // one-time
    const exp = webcamGrants.get(wc.id);
    const ok = !!exp && Date.now() < exp;
    if (ok) webcamGrants.delete(wc.id);
    return ok;
  }

  function originFromUrl(u) {
    try {
      const url = new URL(u);
      if (url.protocol === 'file:' || url.protocol === 'app:') return url.protocol; // "file:" / "app:"
      return url.origin;
    } catch { return ''; }
  }

  function isAllowed(details, requestingOrigin) {
    if (requestingOrigin && ALLOWLIST_ORIGINS.has(requestingOrigin)) return true;
    const o = originFromUrl(details?.requestingUrl || '');
    if (o === 'file:' || o === 'app:') return true;
    return ALLOWLIST_ORIGINS.has(o);
  }

  function wirePermissions(ses) {
    ipcMain.handle('webcam:arm-permission', (event, { durationMs = 8000 } = {}) => {
      const wc = event.sender;
      webcamGrants.set(wc.id, Date.now() + durationMs);
      console.log('[media] armed', { wc: wc.id, until: new Date(Date.now() + durationMs).toISOString() });
      return true;
    });

    ses.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => {
      if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
        return true
        const allowed = isAllowed(details, requestingOrigin);
        const armedPeek = isArmedPeek(wc);
        console.log('[media][check]', {
          permission,
          reqOrigin: requestingOrigin,
          url: details?.requestingUrl,
          allowed,
          armedPeek
        });
        return allowed && armedPeek;
      }
      if (['clipboard-sanitized-write', 'clipboard-read', 'clipboard-write', 'clipboard'].includes(permission)) {
        const allowed = isAllowed(details, requestingOrigin);
        return allowed;
      }
      return false;
    });

    ses.setPermissionRequestHandler((wc, permission, callback, details) => {
      if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
        const originOk = isAllowed(details, details?.requestingOrigin);
        const wantsVideo = Array.isArray(details?.mediaTypes) ? details.mediaTypes.includes('video') : true;
        const armed = isArmed(wc); // one-time
        const ok = originOk && armed && (wantsVideo || permission === 'microphone');

        console.log('[media][request]', {
          permission,
          reqOrigin: details?.requestingOrigin || originFromUrl(details?.requestingUrl || ''),
          url: details?.requestingUrl,
          originOk,
          wantsVideo,
          armedConsumed: armed,
          ok
        });
        return callback(true)
        return callback(!!ok);
      }
      if (['clipboard-sanitized-write', 'clipboard-read', 'clipboard-write', 'clipboard'].includes(permission)) {
        const originOk = isAllowed(details, details?.requestingOrigin);
        return callback(!!originOk);
      }
      return callback(false);
    });
  }


  function wireSerialPermissions(ses) {
    const { randomUUID } = require('crypto');
    const { webContents } = require('electron');
    const pendingSerialChoosers = new Map();
    function sanitizePorts(list) {
      return list.map(p => ({
        portId: p.portId,
        displayName: p.displayName || p.portId || 'Unknown device',
        vendorId: p.vendorId,
        productId: p.productId,
        serialNumber: p.serialNumber,
        portName: p.portName || p.path || p.comName || undefined,
      }));
    }

    ses.on('serial-port-added', (_e, port) => {
      console.log('[serial] port added:', port);
      for (const [reqId, entry] of pendingSerialChoosers.entries()) {
        const exists = entry.portList.some(p => p.portId === port.portId);
        if (!exists) {
          entry.portList.push(port);
          sendChooserUpdate(reqId, entry);
        }
      }
    });

    ses.on('serial-port-removed', (_e, port) => {
      console.log('[serial] port removed:', port);
      for (const [reqId, entry] of pendingSerialChoosers.entries()) {
        const before = entry.portList.length;
        entry.portList = entry.portList.filter(p => p.portId !== port.portId);
        if (entry.portList.length !== before) {
          sendChooserUpdate(reqId, entry);
        }
      }
    });

    function sendChooserUpdate(reqId, entry) {
      const wc = webContents.fromId(entry.webContentsId);
      if (!wc) return;
      wc.send('serial:chooser-update', { reqId, ports: sanitizePorts(entry.portList) });
    }
    ses.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => {
      if (permission === 'serial') {
        const ok = isAllowed(details, requestingOrigin);
        console.log('[serial][check]', { ok, requestingOrigin, url: details?.requestingUrl });
        return ok;
      }
      return false;
    });

    ses.setDevicePermissionHandler((details) => {
      if (details.deviceType === 'serial') {
        const origin = details?.requestingOrigin || originFromUrl(details?.requestingUrl || '');
        const ok = origin ? isAllowed(details, origin) : true;
        console.log('[serial][device-permission]', { ok, origin });
        return ok;
      }
      return false;
    });

    ses.on('select-serial-port', (event, portList, wc, callback) => {
      event.preventDefault();
      const reqId = randomUUID();

      pendingSerialChoosers.set(reqId, { callback, portList, webContentsId: wc.id });

      const ports = sanitizePorts(portList); // 👈 use helper
      console.log('[serial][chooser-open]', { reqId, count: ports.length });
      wc.send('serial:chooser-open', { reqId, ports });
    });

    ipcMain.on('serial:chooser-select', (_e, { reqId, portId }) => {
      const entry = pendingSerialChoosers.get(reqId);
      if (!entry) {
        console.warn('[serial][chooser-select] unknown reqId', reqId);
        return;
      }

      const { callback, portList } = entry;
      pendingSerialChoosers.delete(reqId);

      if (!portId) {
        console.log('[serial][chooser-select] canceled by user');
        callback('');
        return;
      }

      const match = portList.find(p => p.portId === portId);
      if (!match) {
        console.warn('[serial][chooser-select] invalid portId (not in list for reqId)', { reqId, portId });
        callback('');
        return;
      }

      console.log('[serial][chooser-select] OK', { reqId, portIdType: typeof portId, portId });
      callback(portId);
    });
  }


  function logToRenderer(msg) {
    try {
      //if inside process.argv there is a -v argument, then log to console
      if (process.argv.includes('-v') || process.argv.includes('--verbose')) {
        console.log(msg);
      }
      logWindow.webContents.send('log', msg);
    } catch (e) {
      //console.error('❌ Error sending log to renderer:', e);
    }
  }

  // Generate a fake session for Electron - no real user needed
  // Matrix accepts the service token as password for appservice users
  const genNewSession = () => {
    const { getServiceToken } = require('protonode')
    const data = {
      id: 'electron',
      type: 'admin',
      admin: true,
      permissions: ['*', 'admin']
    }
    return {
      user: data,
      token: getServiceToken()
    }
  }

  async function runCommand(command, args = [], onData = (line) => { }) {
    console.log(`🔧 Running command: ${command} ${args.join(' ')}`);
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        windowsHide: true
      });

      child.stdout.setEncoding('utf-8');
      child.stderr.setEncoding('utf-8');

      child.stdout.on('data', data => {
        onData(data.toString());
        logToRenderer(data);
      });

      child.stderr.on('data', data => {
        onData(data.toString());
        logToRenderer(data);
      });

      child.on('error', err => {
        logToRenderer(`❌ Error: ${err.message}`);
        reject(err);
      });
      child.on('close', code => {
        resolve(code);
      });
    });
  }

  async function runYarn(command = '', onLog = (x) => { }) {
    return runCommand(nodePath, ['.yarn/releases/yarn-4.1.0.cjs', ...command.split(' ')], (line) => {
      onLog(line);
    });
  }

  function waitForPortHttp(url, timeout = 120000, interval = 1000) {
    //get port host and path from url
    const urlObj = new URL(url);
    const port = urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443);
    const path = urlObj.pathname || '/';
    const hostname = urlObj.hostname || 'localhost';


    return new Promise((resolve, reject) => {
      const start = Date.now();

      const check = () => {
        const req = http.get({ hostname, port, path, timeout: 5000 }, res => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve(); // ✅ Servidor disponible y responde correctamente
          } else {
            res.resume(); // 🧹 Consumir el cuerpo para liberar memoria
            retry();
          }
        });

        req.on('error', retry);
        req.on('timeout', () => {
          req.destroy();
          retry();
        });
      };

      const retry = () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for HTTP server on port ${port}`));
        } else {
          setTimeout(check, interval);
        }
      };

      check();
    });
  }

  // Create log window (renderer.html)
  function createLogWindow() {
    logWindow = new BrowserWindow({
      width: 1100,
      height: 800,
      title: 'Service Logs',
      autoHideMenuBar: true,
      // useContentSize: true,
      resizable: true,
      scrollBounce: false,
      fullscreenable: false,        // ⬅️ prevent entering macOS fullscreen
      backgroundColor: '#111111',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      }
    });

    logWindow.on('close', (event) => {
      event.preventDefault();
      logWindow.hide();
    });

    logWindow.loadFile(path.join(__dirname, 'splash', 'renderer.html'));
  }

  // Create main window (localhost:8000)
  function createMainWindow(fullscreen, initialUrl) {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    console.log('ENVIRONMENT VARIABLES:');
    for (const [key, value] of Object.entries(process.env)) {
      console.log(`${key}=${value}`);
    }
    console.log('📦 Creating main window...');
    userSession = genNewSession()
    const sessionStr = JSON.stringify(userSession);
    const encoded = encodeURIComponent(sessionStr);

    const electronSession = session.defaultSession;

    // Set cookie
    const cookie = {
      url: 'http://localhost:8000',
      name: 'session',
      value: encoded,
      path: '/',
    };

    electronSession.cookies.set(cookie)
      .then(() => {
        mainWindow = new BrowserWindow({
          width: 1700,
          height: 1000,
          title: 'Main App',
          autoHideMenuBar: true,
          fullscreenable: true,
          resizable: true,
          frame: true,
          show: false,                  // ⬅️ show after ready
          simpleFullScreen: true,       // ⬅️ avoids creating a new Space on macOS      
          webPreferences: {
            preload: path.join(__dirname, 'preload-main.js'),
            additionalArguments: [`--session=${encoded}`],
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: true,
            media: true
          },
          fullscreen: fullscreen
        });

        mainWindow.maximize();

        mainWindow.on('close', async () => {
          try {
            console.log('🔚 Main window closed. Stopping Vento and exiting...');
            await runYarn('kill');
          } catch (err) {
            console.error('❌ Error stopping Vento:', err);
          } finally {
            console.log('👋 Exiting app...');
            app.exit(0); // esto termina el proceso principal
          }
        });
        //hide log window
        if (logWindow) {
          logWindow.hide();
        }

        mainWindow.loadURL(initialUrl);
      })
      .catch(error => {
        console.error('❌ Failed to set session cookie:', error);
      });
  }

  app.whenReady().then(async () => {
    try {
      wirePermissions(session.defaultSession);
      wireSerialPermissions(session.defaultSession);

      let resolveWhenCoreReady;
      const coreStarted = new Promise(resolve => {
        resolveWhenCoreReady = resolve;
      });

      createLogWindow(); // Show logs immediately

      //if run from app-dev, skip install since this will delete devdependencies, including electron itself
      if (!global.skipInstall && !process.env.SKIP_INSTALL) {
        await runYarn('workspaces focus --all --production');
        console.log('✅ Yarn completed successfully.');
      }

      await runYarn('kill'); // Ensure any previous Vento processes are killed
      console.log('💣 Previous Vento processes killed.');

      // await runYarn('prepare-dev');

      const args = require('minimist')(process.argv.slice(2));
      runYarn(args.dev ? 'dev-fast' : 'start-fast', line => {
        if (line.includes('Service Started: core')) {
          resolveWhenCoreReady(); // ✅
        }
      })
      console.log('☕ Booting with mode:', args.dev ? 'dev-fast' : 'start-fast');
      console.log('⏳ Waiting for core service to start...');
      await coreStarted;
      console.log('✅ Core service started.');

      const initialUrl = args.initialUrl || 'http://localhost:8000/workspace/network';
      const initialOrigin = originFromUrl(initialUrl);
      if (initialOrigin) ALLOWLIST_ORIGINS.add(initialOrigin);
      console.log('⏳ Waiting for services to be ready (this may take a few minutes on first start)...');
      await waitForPortHttp(initialUrl, 300000);

      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✅ Port 8000 ready.');

      console.log('📦 Opening main window...');
      createMainWindow(args.fullscreen, initialUrl);
    } catch (err) {
      console.log(`❌ Startup failed: ${err.message}`);
      process.exit(1);
    }
  });

  ipcMain.on('open-external-url', (_event, url) => {
    shell.openExternal(url);
  });

  ipcMain.on('toggle-log-window', () => {
    if (!logWindow) return;

    if (logWindow.isVisible()) {
      logWindow.hide();
    } else {
      logWindow.webContents.send('log-window:show-logs');
      logWindow.show();
      logWindow.focus();
    }
  });

  ipcMain.on('open-window', (event, { window }) => {
    browserWindow = new BrowserWindow({
      width: 1100,
      height: 800,
      title: window,
      autoHideMenuBar: true,
      resizable: true,
      scrollBounce: false,
      webPreferences: {
        preload: path.join(__dirname, "windows", window, 'preload.js'),
      }
    });

    ipcMain.on('refresh-window', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        win.reload();
      }
    });

    browserWindow.loadFile(path.join(__dirname, "windows", window, 'renderer.html'));
  })

  ipcMain.on('download-asset', (event, { url, assetName }) => {
    // save to downloads: app.getPath('downloads')
    console.log("downloading asset:", assetName)
    const zipName = assetName + '.zip'
    const filePath = path.join(__dirname, "..", "data", "assets", zipName);
    const file = fs.createWriteStream(filePath);

    https.get(url, (response) => {
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('zip')) {
        console.error('❌ Invalid content type:', contentType);
        response.resume(); // descartar contenido
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();

        generateEvent({
          path: 'files/write/file',
          from: 'core',
          user: "system",
          payload: { 'path': "/data/assets", "filename": zipName, mimetype: "application/zip" }
        }, userSession?.token)

        browserWindow.webContents.send('asset-downloaded', { name: assetName });
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => { });
      console.error('error downloading asset:', err.message);
    });
  })
}
