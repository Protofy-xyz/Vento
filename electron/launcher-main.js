const { app, BrowserWindow, protocol, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { spawnSync, fork } = require('child_process');
const os = require('os');
const { v4: uuid } = require('uuid');

const isDev = process.argv.includes('--ui-dev');
const PROJECTS_DIR = path.join(app.getPath('userData'), 'vento-projects');
console.log('Projects directory:', PROJECTS_DIR);
const PROJECTS_FILE = path.join(PROJECTS_DIR, 'projects.json');
const LAUNCHER_ENV_FILE = path.join(app.getPath('userData'), 'launcher-env');

let hasRun = false;

if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

function isValidProjectName(name) {
  return name == '' ? false : /^[a-z0-9_-]+$/.test(name)
}

function notifyProjectStatus(name, status) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('vento:project-status', {
        name,
        status,
        at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('notifyProjectStatus error:', e);
  }
}

function readProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      const projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
      return projects.map(project => {
        return {
          ...project,
          status: project.status || 'pending', // default if missing
        };
      });

    } else {
      return [];
    }
  } catch (err) {
    console.error('Error reading projects.json:', err);
    return [];
  }
}
function updateProjectStatus(name, status) {
  const projects = readProjects();
  const i = projects.findIndex(p => p.name === name);
  if (i === -1) return false;
  projects[i] = {
    ...projects[i],
    status,
    updatedAt: new Date().toISOString(),
  };
  writeProjects(projects);
  notifyProjectStatus(name, status);
  return true;
}


function writeProjects(projects) {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing projects.json:', err);
  }
}

let mainWindow;

function createWindow() {
  const launcherUrl = isDev
    ? 'http://localhost:8000/launcher'
    : `file://${path.join(__dirname, 'launcher', 'index.html')}`;

  const webPreferences = {
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: !isDev,
    allowRunningInsecureContent: isDev,
    preload: path.join(__dirname, 'preload-launcher.js'),
  };

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1000,
    title: 'Vento Launcher',
    autoHideMenuBar: true,
    webPreferences
  });

  mainWindow.loadURL(launcherUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);


const respond = ({ statusCode = 200, data = Buffer.from(""), mimeType = "text/plain" } = {}) => {
  if (!Buffer.isBuffer(data)) {
    throw new Error("Response data is not a buffer")
  }

  let headers = {}
  headers['Content-Type'] = mimeType
  return new Response(data, { status: statusCode, headers })
}

function parseEnv(raw = '') {
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return acc;
      const key = line.slice(0, idx).trim();
      const value = stripOuterQuotes(line.slice(idx + 1).trim());
      if (key) acc[key] = value;
      return acc;
    }, {});
}

function stripOuterQuotes(value = '') {
  const wrapped =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  return wrapped && value.length >= 2 ? value.slice(1, -1) : value;
}

const rootPath = path.resolve(__dirname, '..');
const telemetryUrl = 'https://cloud.vento.build/api/v1/telemetryEvent';

function readKeyValueFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf8');
    return parseEnv(raw);
  } catch (err) {
    console.warn(`[env] Could not read ${filePath}:`, err?.message || err);
    return {};
  }
}

function writeKeyValueFile(filePath, data = {}) {
  try {
    const lines = Object.entries(data).map(([k, v]) => `${k}=${v}`);
    const content = lines.length ? `${lines.join(os.EOL)}${os.EOL}` : '';
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (err) {
    console.warn(`[env] Could not write ${filePath}:`, err?.message || err);
  }
}

function getRuntimeTelemetryContext() {
  const { version, releaseVersion } = getPackageInfo(rootPath);
  return {
    version,
    releaseVersion,
    platform: os.platform(),
    arch: os.arch(),
    electron: process.versions?.electron,
    chrome: process.versions?.chrome,
    node: process.versions?.node,
  };
}

async function sendTelemetryEvent(pathName, payload = {}) {
  if (typeof fetch !== 'function') return;
  try {
    const from = await ensureLauncherInstanceId(path.join(rootPath, '.env'));
    const body = {
      path: pathName,
      from,
      payload: {
        ...getRuntimeTelemetryContext(),
        ...payload,
      },
    };
    await fetch(telemetryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn(`[telemetry] ${pathName} telemetry failed:`, err?.message || err);
  }
}

function sendDownloadTelemetry(result, payload = {}) {
  return sendTelemetryEvent(`/launcher/download/${result}`, {
    action: 'download',
    ...payload,
  });
}

function sendRunTelemetry(result, payload = {}) {
  return sendTelemetryEvent(`/launcher/run/${result}`, {
    action: 'run-project',
    ...payload,
  });
}

function getPackageInfo(rootPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootPath, 'package.json'), 'utf8'));
    return {
      version: pkg.version || undefined,
      releaseVersion: (pkg.release || pkg.version || '').toString() || undefined,
    };
  } catch {
    return { version: undefined, releaseVersion: undefined };
  }
}

const ensureLauncherInstanceId = async (envPath) => {
  try {
    if (process.env.LAUNCHER_INSTANCE_ID) {
      return process.env.LAUNCHER_INSTANCE_ID;
    }

    const launcherEnv = readKeyValueFile(LAUNCHER_ENV_FILE);
    if (launcherEnv.LAUNCHER_INSTANCE_ID) {
      process.env.LAUNCHER_INSTANCE_ID = launcherEnv.LAUNCHER_INSTANCE_ID;
      return launcherEnv.LAUNCHER_INSTANCE_ID;
    }

    const rawEnv = envPath && fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const parsed = rawEnv ? parseEnv(rawEnv) : {};
    const existing = parsed.LAUNCHER_INSTANCE_ID;
    if (existing) {
      process.env.LAUNCHER_INSTANCE_ID = existing;
      try {
        writeKeyValueFile(LAUNCHER_ENV_FILE, { ...launcherEnv, LAUNCHER_INSTANCE_ID: existing });
      } catch (err) {
        console.warn('[env] Could not persist existing LAUNCHER_INSTANCE_ID:', err?.message || err);
      }
      return existing;
    }

    const id = uuid();
    process.env.LAUNCHER_INSTANCE_ID = id;
    try {
      writeKeyValueFile(LAUNCHER_ENV_FILE, { ...launcherEnv, LAUNCHER_INSTANCE_ID: id });
    } catch (err) {
      console.warn('[env] Could not persist generated LAUNCHER_INSTANCE_ID:', err?.message || err);
    }
    try {
      if (envPath && fs.existsSync(envPath)) {
        const needsEol = rawEnv.length > 0 && !rawEnv.endsWith('\n') && !rawEnv.endsWith('\r\n');
        const prefix = needsEol ? os.EOL : '';
        fs.appendFileSync(envPath, `${prefix}LAUNCHER_INSTANCE_ID=${id}${os.EOL}`);
      }
    } catch (err) {
      console.warn('[env] Could not append LAUNCHER_INSTANCE_ID to env file:', err?.message || err);
    }
    return id;
  } catch (err) {
    console.warn('[env] Could not ensure LAUNCHER_INSTANCE_ID:', err?.message || err);
    return process.env.LAUNCHER_INSTANCE_ID || '';
  }
};



app.whenReady().then(async () => {
  try {
    await sendTelemetryEvent('/launcher/start');

  } catch (e) {
    console.warn('Failed to send launch telemetry', e);
  }
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    console.log('Request for:', pathname);
    if (request.method === 'GET' && pathname === '/api/v1/projects') {
      const projects = readProjects();

      const responseBody = JSON.stringify({
        items: projects,
        total: projects.length,
        itemsPerPage: projects.length,
        page: 0,
        pages: 1
      });

      return respond({
        mimeType: 'application/json',
        data: Buffer.from(responseBody)
      });
    } else if (
      request.method === 'GET' &&
      /^\/api\/v1\/projects\/[^\/]+\/download$/.test(pathname)
    ) {
      const match = pathname.match(/^\/api\/v1\/projects\/([^\/]+)\/download$/);
      const projectName = match?.[1];

      // start background worker and return quickly so the UI stays responsive
      try {
        const projects = readProjects();
        const project = projects.find(p => p.name === projectName);
        if (!project) {
          return respond({ statusCode: 404, data: Buffer.from('Project not found') });
        }

        updateProjectStatus(projectName, 'downloading');

        const workerPath = path.join(__dirname, 'launcher-download-worker.js');
        const child = fork(workerPath, [PROJECTS_DIR, projectName, String(project.version || '')], {
          stdio: 'inherit',
        });

        child.on('exit', (code) => {
          if (code === 0) {
            updateProjectStatus(projectName, 'downloaded');
            sendDownloadTelemetry('success', {
              projectName,
              version: project.version || '',
            });
          } else {
            updateProjectStatus(projectName, 'error');
            sendDownloadTelemetry('error', {
              projectName,
              version: project.version || '',
              code,
            });
          }
        });

        child.on('error', (err) => {
          console.error('Download worker error:', err);
          updateProjectStatus(projectName, 'error');
          sendDownloadTelemetry('error', {
            projectName,
            version: project.version || '',
            message: err?.message || String(err),
            stack: err?.stack,
          });
        });

        return respond({
          mimeType: 'application/json',
          data: Buffer.from(JSON.stringify({ success: true, message: 'Download started' }))
        });
      } catch (err) {
        console.error('Download failed to start:', err);
        updateProjectStatus(projectName, 'error');
        sendDownloadTelemetry('error', {
          projectName,
          version: project?.version || '',
          message: err?.message || String(err),
          stack: err?.stack,
        });

        return respond({ statusCode: 500, data: Buffer.from('Failed to start project download') });
      }
    } else if (
      request.method === 'GET' &&
      /^\/api\/v1\/projects\/[^\/]+\/delete$/.test(pathname)
    ) {
      const match = pathname.match(/^\/api\/v1\/projects\/([^\/]+)\/delete$/);
      const projectName = match?.[1];

      if (projectName) {
        const projects = readProjects();
        const updatedProjects = projects.filter(project => project.name !== projectName);
        writeProjects(updatedProjects);
        const projectPath = path.join(PROJECTS_DIR, projectName);
        if (fs.existsSync(projectPath)) {
          // delete folder asynchronously to avoid blocking the main process
          fs.rm(projectPath, { recursive: true, force: true }, (err) => {
            if (err) {
              console.error('Failed to delete project folder:', err);
              return;
            }
            notifyProjectStatus(projectName, 'deleted');
            console.log('Project deleted:', projectPath);
          });
        } else {
          notifyProjectStatus(projectName, 'deleted');
        }
        return respond({
          mimeType: 'application/json',
          data: Buffer.from(JSON.stringify({ success: true, message: 'Project deleted successfully' }))
        });
      } else {
        return respond({
          mimeType: 'application/json',
          data: Buffer.from(JSON.stringify({ success: false, message: 'Invalid project name' }))
        });
      }

    } else if (
      request.method === 'GET' &&
      /^\/api\/v1\/projects\/[^\/]+\/open-folder$/.test(pathname)
    ) {
      const match = pathname.match(/^\/api\/v1\/projects\/([^\/]+)\/open-folder$/);
      const projectName = match?.[1];

      if (!projectName) {
        return respond({
          statusCode: 400,
          data: Buffer.from('Invalid project name')
        });

      }

      const projectFolderPath = path.join(PROJECTS_DIR, projectName);
      if (!fs.existsSync(projectFolderPath)) {
        return respond({
          statusCode: 404,
          data: Buffer.from('Project folder not found')
        });
      }

      try {
        const openError = await shell.openPath(projectFolderPath);
        if (openError) {
          return respond({
            statusCode: 500,
            data: Buffer.from(openError || 'Failed to open folder')
          });
        }

        return respond({
          mimeType: 'application/json',
          data: Buffer.from(JSON.stringify({ success: true }))
        });
      } catch (err) {
        return respond({
          statusCode: 500,
          data: Buffer.from('Failed to open folder')
        });

      }

    } else if (
      request.method === 'GET' &&
      /^\/api\/v1\/projects\/[^\/]+\/run$/.test(pathname)
    ) {
      const match = pathname.match(/^\/api\/v1\/projects\/([^\/]+)\/run$/);
      const projectName = match?.[1];

      //read project to get version
      const projects = readProjects();
      const project = projects.find(p => p.name === projectName);
      if (!project) {
        return respond({
          statusCode: 404,
          data: Buffer.from('Project not found')
        });
      }

      try {
        const projectFolderPath = path.join(PROJECTS_DIR, projectName);
        // Pre-run safeguard: rebuild native modules if needed
        const electronVersion = '29.4.6';
        const opts = {
          cwd: projectFolderPath,
          windowsHide: true,
          stdio: 'pipe',
          shell: process.platform === 'win32'
        };

        const r = spawnSync('npx', ['--yes', 'electron-rebuild', '-f', '--version', electronVersion], opts);

        if (r.error || r.status !== 0) {
          spawnSync('npm', ['rebuild'], opts);
        }
        const startMain = require(projectFolderPath + '/electron/main.js');
        startMain(projectFolderPath);
        // only mark and close on success
        hasRun = true;
        sendRunTelemetry('success', {
          projectName,
          version: project.version || '',
        });
        if (mainWindow) {
          mainWindow.close();
        }
        //reply to the renderer process
        return respond({
          mimeType: 'application/json',
          data: Buffer.from(JSON.stringify({ success: true, message: 'done' }))
        });
      } catch (e) {
        console.error('Run project failed:', e);
        sendRunTelemetry('error', {
          projectName,
          version: project?.version || '',
          message: e?.message || String(e),
          stack: e?.stack,
        });
        return respond({ statusCode: 500, data: Buffer.from(JSON.stringify(e)) });
      }
    }
    return respond({ statusCode: 404, data: Buffer.from('not found') });
  });



  if (!isDev) {
    // Interceptar rutas file:// en producción
    protocol.interceptFileProtocol('file', (request, callback) => {
      const parsedUrl = new URL(request.url);
      const pathname = decodeURIComponent(parsedUrl.pathname);

      if (pathname.includes('/public/')) {
        const relativePath = pathname.split('/public/')[1];
        const resolvedPath = path.join(__dirname, 'launcher', 'public', relativePath);
        callback({ path: resolvedPath });
      } else if (pathname.includes('/_next/')) {
        const relativePath = pathname.split('/_next/')[1];
        const resolvedPath = path.join(__dirname, 'launcher', '_next', relativePath);
        callback({ path: resolvedPath });
      } else {
        callback({ path: pathname });
      }
    });
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (!hasRun) {
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});

ipcMain.on('create-project', (event, newProject) => {
  const name = newProject?.name
  if (!isValidProjectName(name)) {
    event.reply('create-project-done', { success: false, error: 'Project name must use only lowercase and underscores' })
    return
  }

  const projects = readProjects();
  const exists = projects.some(p => p.name === name);
  if (exists) {
    event.reply('create-project-done', { success: false, error: 'A project with this name already exists' });
    return;
  }
  projects.push({
    ...newProject,
    name,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  writeProjects(projects);
  event.reply('create-project-done', { success: true });
});
