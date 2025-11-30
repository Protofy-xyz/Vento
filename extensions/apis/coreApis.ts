import { APIModel } from ".";
import { getSourceFile, addImportToSourceFile, ImportType, addObjectLiteralProperty, getDefinition, AutoAPI, getRoot, removeFileWithImports, addFeature, removeFeature, hasFeature } from 'protonode'
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as fspath from 'path';
import { API, getLogger } from 'protobase'
import { getServiceToken } from "protonode";
import { ObjectModel } from '@extensions/objects/objectsSchemas'

const logger = getLogger()

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

      // Delete associated board when task is deleted
      try {
        const token = getServiceToken();
        
        // Normalize task name to get board name
        const toBoardName = (s: string) =>
          s.trim()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/gi, "_")
            .toLowerCase();
        
        const taskName = toBoardName(value.name);
        const boardName = `${taskName}_task`;
        
        await API.get(`/api/core/v1/boards/${encodeURIComponent(boardName)}/delete?token=${token}`);
        logger.info({ boardName, taskName: value.name }, 'Deleted associated task board');
      } catch (e: any) {
        // Board doesn't exist or delete failed - log only if it's not a "not found" error
        const status = e?.response?.status || e?.status;
        if (status && status !== 404) {
          logger.warn({ taskName: value.name, err: e?.message }, 'Failed to delete associated task board');
        }
      }
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

      // Auto-create board for task
      try {
        const token = getServiceToken();
        
        // Normalize task name to valid board name format
        const toBoardName = (s: string) =>
          s.trim()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/gi, "_")
            .toLowerCase();
        
        const taskName = toBoardName(computedName);
        const boardName = `${taskName}_task`;
        
        // Create board using 'smart ai agent' template
        await API.post(`/api/core/v1/import/board?token=${token}`, {
          name: boardName,
          template: { id: "smart ai agent" }
        });
        
        // Create card structure
        const DEFAULT_HTML_ACTION = `//@card/react

function Widget(card) {
  const value = card.value;

  const content = <YStack f={1} ai="center" jc="center" width="100%">
      {card.icon && card.displayIcon !== false && (
          <Icon name={card.icon} size={48} color={card.color}/>
      )}
      {card.displayResponse !== false && (
          <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? "N/A"} />
      )}
  </YStack>

  return (
      <Tinted>
        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
          <ActionCard data={card}>
            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}
          </ActionCard>
        </ProtoThemeProvider>
      </Tinted>
  );
}
`;
        
        // Generate unique key for the card
        const uniqueKey = `action_${Date.now()}`;
        
        const cardData = {
          key: uniqueKey,
          type: 'action',
          name: taskName,
          description: `Run ${computedName} task`,
          rulesCode: `return execute_action("/api/v1/automations/${codeNameLowerCase}", userParams)`,
          params: {},
          configParams: {},
          displayResponse: true,
          icon: 'zap',
          responseKey: 'result',
          sourceFile: `${APIDirPath}${value.name}${extension}`,
          width: 3,
          height: 10,
          html: DEFAULT_HTML_ACTION,
          layer: 'base'
        };
        
        // Add card to board
        await API.post(`/api/core/v1/boards/${encodeURIComponent(boardName)}/management/add/card?token=${token}`, {
          card: cardData
        });
        
        console.log(`Auto-created board "${boardName}" with task card for task "${computedName}"`);
      } catch (e) {
        // Log error but don't fail task creation
        console.error("Auto-create task board failed:", e);
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

    // Subscribe to board delete events to delete associated task
    // Task boards end with '_task', e.g. 'my_task_task' for task 'my_task'
    context.events?.onEvent?.(
        context.mqtt,
        context,
        async (msg: any) => {
            const boardName = msg?.parsed?.payload?.id 
                || msg?.payload?.id 
                || msg?.parsed?.path?.split('/')?.[2]
                || msg?.topic?.split('/')?.[2];
            
            if (!boardName) {
                logger.warn('Board delete event received but could not extract board name');
                return;
            }

            // Only process boards that end with '_task'
            if (!boardName.endsWith('_task')) {
                return;
            }

            // Extract task name by removing '_task' suffix
            const taskName = boardName.slice(0, -5); // Remove '_task'

            if (!taskName) {
                return;
            }

            // Check if the task file exists and delete it
            try {
                const token = getServiceToken();
                
                // Try to delete the task via API
                await API.get(`/api/core/v1/apis/${encodeURIComponent(taskName)}/delete?token=${token}`);
                logger.info({ taskName, boardName }, 'Task deleted due to board deletion');
            } catch (err: any) {
                // Task doesn't exist or delete failed - log only if it's not a "not found" error
                const status = err?.response?.status || err?.status;
                if (status && status !== 404) {
                    logger.warn({ taskName, boardName, err: err?.message }, 'Failed to delete task after board deletion');
                }
            }
        },
        'boards/delete/#'
    );
}
