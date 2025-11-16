const { app, BrowserWindow, protocol, session, ipcMain, shell, dialog, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { spawnSync } = require('child_process');

const isDev = process.argv.includes('--ui-dev');
const PROJECTS_DIR = path.join(app.getPath('userData'), 'vento-projects');
console.log('Projects directory:', PROJECTS_DIR);
const PROJECTS_FILE = path.join(PROJECTS_DIR, 'projects.json');

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

const cameraPermission = async () => {
  const status = systemPreferences.getMediaAccessStatus('camera'); // 'not-determined' | 'granted' | 'denied' | 'restricted'
  await dialog.showErrorBox("CameraPermission", `Status: ${status}`)
  if (status === 'not-determined') {
    const granted = await systemPreferences.askForMediaAccess('camera');
    return { status: granted ? 'granted' : 'denied' };
  }
  if (status === 'denied' || status === 'restricted') {
    // opcional: abre Preferencias si está denegado
    try {
      // Electron tiene openSystemPreferences en macOS; si no, abre la URL
      if (systemPreferences.openSystemPreferences) {
        await systemPreferences.openSystemPreferences('security', 'Privacy_Camera');
      } else {
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Camera');
      }
    } catch { }
    return { status };
  }
  return { status }; // 'granted'
}

app.whenReady().then(async () => {
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

      try {
        // read project to get version
        const projects = readProjects();
        const project = projects.find(p => p.name === projectName);
        if (!project) {
          return respond({ statusCode: 404, data: Buffer.from('Project not found') });
        }

        // >>> ADD: mark JSON status
        // updateProjectStatus(projectName, 'downloading');

        // get zip url from github (keep your code, or apply your 'stable→latest' tweak if you want)
        const url = 'https://api.github.com/repos/Protofy-xyz/Vento/releases/tags/' + (project.version == 'latest' ? 'latest' : 'v' + project.version);
        const response = await fetch(url);
        const data = await response.json();
        const zipBallUrl = data?.assets[0]?.browser_download_url;
        if (!zipBallUrl) {
          return respond({ statusCode: 404, data: Buffer.from('Release not found') });
        }

        // download the zip file to PROJECTS_DIR
        const zipFilePath = path.join(PROJECTS_DIR, `${projectName}.zip`);
        const zipResponse = await fetch(zipBallUrl);
        if (!zipResponse.ok) {
          return respond({ statusCode: zipResponse.status, data: Buffer.from('Failed to download project zip') });
        }
        const arrayBuffer = await zipResponse.arrayBuffer();
        const zipBuffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(zipFilePath, zipBuffer);
        console.log('Project downloaded:', zipFilePath);

        // extract the zip file
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(zipFilePath);
        const projectFolderPath = path.join(PROJECTS_DIR, projectName);
        zip.extractAllTo(projectFolderPath, true);
        console.log('Project extracted to:', projectFolderPath);
        fs.unlinkSync(zipFilePath);
        console.log('Zip file removed:', zipFilePath);

        // run scripts
        const removeDevModeScript = path.join(projectFolderPath, 'scripts', 'removeDevMode.js');
        require(removeDevModeScript);
        console.log('removeDevMode script executed');

        const downloadBinariesScript = path.join(projectFolderPath, 'scripts', 'download-bins.js');
        await require(downloadBinariesScript)(AdmZip, require('tar'));
        console.log('download-bins script executed');

        const downloadDendriteScript = path.join(projectFolderPath, 'scripts', 'download-dendrite.js');
        await require(downloadDendriteScript)(AdmZip, require('tar'));
        console.log('download-dendrite script executed');

        // >>> ADD: mark JSON status
        updateProjectStatus(projectName, 'downloaded');

        return respond({
          mimeType: 'application/json',
          data: Buffer.from(JSON.stringify({ success: true, message: 'done' }))
        });
      } catch (err) {
        console.error('Download failed:', err);
        // >>> ADD: mark JSON status
        updateProjectStatus(projectName, 'error');

        return respond({ statusCode: 500, data: Buffer.from('Failed to download project') });
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
          fs.rmSync(projectPath, { recursive: true, force: true });
          notifyProjectStatus(projectName, 'deleted');
          console.log('Project deleted:', projectPath);
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