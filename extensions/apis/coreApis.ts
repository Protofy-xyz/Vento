import { APIModel } from ".";
import { getSourceFile, addImportToSourceFile, ImportType, addObjectLiteralProperty, getDefinition, AutoAPI, getRoot, removeFileWithImports, addFeature, removeFeature, hasFeature } from 'protonode'
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as fspath from 'path';
import { API } from 'protobase'
import { getServiceToken } from "protonode";
import { ObjectModel } from '@extensions/objects/objectsSchemas'

const APIDirPath = "/data/automations/"
const APIDir = (root) => fspath.join(root, "/data/automations/")

const getAPI = (name, req, extension?) => {
  let object = "None"
  let filePath = APIDir(getRoot(req)) + name
  let engine = 'typescript'
  let apiType = 'typescript'

  if (extension) {
    filePath += extension
    switch (extension) {
      case '.py':
        engine = 'python'
        apiType = 'python'
        break
      case '.php':
        engine = 'php'
        apiType = 'php'
        break
      default:
        break
    }
  } else {
    if( fsSync.existsSync(filePath + '.ts')) {
      filePath = filePath + '.ts'
      extension = '.ts'
      engine = 'typescript'
      apiType = 'typescript'
    } else if (fsSync.existsSync(filePath + '.py')) {
      filePath = filePath + '.py'
      extension = '.py'
      engine = 'python'
      apiType = 'python'
    } else if(fsSync.existsSync(filePath + '.php')) {
      filePath = filePath + '.php'
      extension = '.php'
      engine = 'php'
      apiType = 'php'
    } else {
      throw "API file not found"
    }
  }

  if (apiType === 'typescript') {
    const sourceFile = getSourceFile(filePath)
    const arg = getDefinition(sourceFile, '"type"')
    const obj = getDefinition(sourceFile, '"object"')
    apiType = arg ? arg.getText().replace(/^['"]+|['"]+$/g, '') : apiType
    object = obj ? obj.getText().replace(/^['"]+|['"]+$/g, '') : object
  }
  return {
    name: name.replace(/\.[^/.]+$/, ""), //remove extension
    type: apiType,
    object,
    engine,
    filePath: APIDirPath + name + extension
  }
}

const deleteAPI = (req, value) => {
  const api = getAPI(fspath.basename(value.name), req)
  fsSync.unlinkSync(getRoot(req) + api.filePath)
}

async function checkFileExists(filePath) {
  const exts = ['.ts', '.py', '.php'];

  for (const ext of exts) {
    try {
      await fs.access(filePath + ext, fs.constants.F_OK);
      return true;
    } catch (err) {
      // check next
    }
  }

  return false;
}

const getDB = (path, req, session) => {
  const db = {
    async *iterator() {
      const validExtensions = ["ts", "py", "php"]
      const root = getRoot(req);

      const files = (await fs.readdir(APIDir(root))).filter(f => {
        const fullPath = fspath.join(APIDir(root), f);
        const ext = f.split('.').pop();
        return !fsSync.lstatSync(fullPath).isDirectory() && validExtensions.includes(ext!);
      });
      
      let apis = await Promise.all(files.map(async f => {
        const name = f.replace(/\.[^/.]+$/, "")
        const segments = f.split('.')
        const extension = '.' + segments[segments.length - 1]
        return getAPI(name, req, extension)
      }));

      apis = apis.filter(api => api.type == 'CustomAPI')

      for (const api of apis) {
        if (api) yield [api.name, JSON.stringify(api)];
      }
    },

    async del(key, value) {
      value = JSON.parse(value)
      deleteAPI(req, value)
    },

    async put(key, value, options?) {
      value = JSON.parse(value)
      let exists
      let ObjectSourceFile

      const template = fspath.basename(value.template ?? 'empty')
      let extension = ".ts"
      switch (value.template) {
        case 'python-api':
          extension = '.py'
          break
        case 'php':
          extension = '.php'
          break
        default:
          break
      }

      if(!fsSync.existsSync(getRoot(req) + APIDirPath)) {
        fsSync.mkdirSync(getRoot(req) + APIDirPath, { recursive: true });
      } 

      let filePath = getRoot(req) + APIDirPath + fspath.basename(value.name)
      
      exists = await checkFileExists(filePath);

      if (exists) {
        console.log("Automation already exists")
        return
      }


      if (template == "automatic-crud-google-sheet") {
        const regex = /\/d\/([a-zA-Z0-9-_]+)/;
        const match = value.param.match(regex);
        const id = match ? match[1] : null;
        value.param = id
      }

      const computedName = value.name
      const codeName = computedName.replace(/\s/g, "")
      const codeNameLowerCase = codeName.toLowerCase()
      const result = await API.post('/api/core/v1/templates/file?token=' + getServiceToken(), {
        name: value.name + extension,
        data: {
          options: {
            template: `/extensions/apis/templates/${template}.tpl`, variables: {
              codeName: codeName,
              name: computedName,
              codeNameLowerCase: codeNameLowerCase,
              object: value.object,
              param: value.param,
              modelName: value.modelName
            }
          },
          path: APIDirPath
        }
      })

      if (result.isError) {
        throw result.error?.error ?? result.error
      }

      //add autoapi feature in object if needed
      if (value.object && template.startsWith("automatic-crud")) {
        console.log('Adding feature AutoAPI to object: ', value.object)
        await addFeature(ObjectSourceFile, '"AutoAPI"', "true")
      }
    },

    async get(key) {
      return JSON.stringify(getAPI(key, req))
    }
  };

  return db;
}

const APIsAutoAPI = AutoAPI({
  modelName: 'apis',
  modelType: APIModel,
  prefix: '/api/core/v1/',
  getDB: getDB,
  connectDB: () => new Promise(resolve => resolve(null)),
  requiresAdmin: ['*']
})

export default (app, context) => {
    APIsAutoAPI(app, context)
}
