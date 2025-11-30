import { handler, AutoAPI, getServiceToken, getRoot } from 'protonode'
import { API, generateEvent } from 'protobase'
import fs from 'fs';
import { PackageModel } from './packagesSchema';
import chokidar from 'chokidar';
import { generate as uuidv4 } from 'short-uuid'
import nodePath from 'path';

const root = getRoot();

const monitorPackages = () => {
  const isFullDev = process.env.FULL_DEV === '1';

  if (isFullDev) {
    const pathsToWatch = [
      '../../packages/**',
    ];

    const watcher = chokidar.watch(pathsToWatch, {
      ignored: /^([.][^.\/\\])|([\/\\]+[.][^.]|node_modules|(^|[\/\\])dist([\/\\]|$))/,
      persistent: true
    });

    watcher.on('change', async (path) => {
      const pkg = path.substring(root.length).split(nodePath.sep)[1]
      console.log(`File ${pkg} has been changed.`);
      API.get('/api/core/v1/packages/' + pkg + "/build?token=" + getServiceToken())

    });
  }

}

const readPackage = async (name, cb) => {

}

const listPackages = () => {
  return new Promise((resolve, reject) => {
    fs.readdir('../../packages', (err, files) => {
      if (err) {
        reject(err);
      }
      resolve(files);
    });
  });
};

const getDB = (path, req, session) => {
  const db = {
    async *iterator() {
      try {
        // Esperamos los servicios de forma asíncrona
        const pkgs: any = await listPackages();
        for (const pkg of pkgs) {
          // Podemos usar 'yield' aquí porque estamos en una función generadora asíncrona
          console.log("pkg:", JSON.stringify(pkg))
          yield [pkg.name, JSON.stringify({ name: pkg })];
        }
      } catch (error) {
        console.error("Error retrieving pkgs:", error);
      }
    },

    async del(key, value) {

    },

    async put(key, value) {

    },

    async get(key) {
      const name = key;
      return new Promise((resolve, reject) => {
        readPackage(name, (pkg) => {
          resolve(pkg);
        });
      });
    }
  };

  return db;
}

const packageAutoAPI = AutoAPI({
  modelName: 'packages',
  modelType: PackageModel,
  prefix: '/api/core/v1/',
  getDB: getDB,
  connectDB: () => new Promise(resolve => resolve(null)),
  requiresAdmin: ['*']
})

export default (app, context) => {
  packageAutoAPI(app, context)
  monitorPackages()
  app.get('/api/core/v1/packages/:pkg/build', handler(async (req, res, session) => {
    if (!session || !session.user.admin) {
      res.status(401).send({ error: "Unauthorized" });
      return;
    }

    const pkg = req.params.pkg;

    const buildId = uuidv4()

    const _generateEvent = (type, payload?) => {
      generateEvent({
        path: 'packages/' + pkg + '/build/' + buildId + '/' + type,
        from: 'core',
        user: session.user.id,
        payload: { buildId, ...payload }
      }, getServiceToken())
    }
    try {
      
      const path = root + "packages/" + pkg;
      if (!fs.existsSync(`${path}/package.json`)) {
        res.status(400).send({ error: "No package.json found, skiping build" });
        return;
      }
      //check if the service has a package command in the package.json
      const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf8'));
      if (!packageJson.scripts || !packageJson.scripts.build) {
        res.status(400).send({ error: "Package does not have a build script" });
        return;
      }

      _generateEvent('start')
      res.send({ buildId: buildId });
      //run the package command
      const { exec } = require('child_process');
      exec('npm run build', { cwd: path,  windowsHide: true  }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error building package: ${error}`);
          _generateEvent('error', { error })
          res.status(500).send({ error: "Error building package" });
          return;
        }
        _generateEvent('done')
      });
    } catch (e) {
      console.error(`Error building package: ${e}`);
      _generateEvent('error', { error: e })
      res.status(500).send({ error: "Error building package" });
    }
  }));
}



