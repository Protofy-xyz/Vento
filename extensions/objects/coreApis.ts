import { ObjectModel } from ".";
import { handler, requireAdmin, getSourceFile, extractChainCalls, getDefinition, AutoAPI, getRoot, addFeature, toSourceFile, getObjectCardDefinitions } from 'protonode'
import { promises as fs } from 'fs';
import syncFs from 'fs';
import * as fspath from 'path';
import { ObjectLiteralExpression, PropertyAssignment, Project, SyntaxKind, Node } from 'ts-morph';
import { getServiceToken } from 'protonode'
import { API, getLogger } from 'protobase'
import { APIModel } from '@extensions/apis/apisSchemas'

const logger = getLogger()


const indexFile = "/packages/app/objects/index.ts"

const getSchemas = async (req, displayAll?) => {

  let schemas = []
  const tsFiles = syncFs.readdirSync(fspath.join(getRoot(req), 'data/objects')).filter(file => file.endsWith('.ts')).map(file => fspath.join(getRoot(req), 'data/objects', file))

  if (displayAll || (req.query && req.query.display && req.query.display === 'all')) {
    //iterate through all directories in ../../extensions and for each directory, check if there is a file named with the same name as the directory but ending in Schema.ts
    //for example, if there is a directory named "patatas", check if there is a file named "patatasSchema.ts" in that directory
    //if so, add the file to the list of tsFiles
    const extensionsPath = fspath.join(getRoot(req), 'extensions')
    const extensionDirs = syncFs.readdirSync(extensionsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    extensionDirs.forEach(dir => {
      const schemaFile = fspath.join(extensionsPath, dir, dir + 'Schemas.ts')
      if (syncFs.existsSync(schemaFile)) {
        tsFiles.push(schemaFile)
      }
    })
  }
  tsFiles.forEach(async (file) => {
    const fileName = fspath.basename(file)
    const idSchema = fileName.replace('Schemas.ts', 'Model').replace('.ts', 'Model')
    const schemaName = fileName.replace('Schemas.ts', '').replace('.ts', '')

    const objectData = await getSchemaTS(file, idSchema, schemaName)
    if (objectData) {
      schemas.push(objectData)
    } else {
      console.error("Ignoring schema in file: ", file, "because it could not be parsed")
    }
  })
  return schemas;
}

const extractKeysFromSchema = (schema: ObjectLiteralExpression) => {
  const keys: any = {}
  schema.getProperties().forEach(prop => {
    if (prop instanceof PropertyAssignment) {
      const chain = extractChainCalls(prop.getInitializer())
      if (chain.length) {
        const typ = chain.shift()
        keys[prop.getName()] = {
          type: typ.name,
          params: typ.params,
          modifiers: chain
        }
      }
    }
  })
  return keys
}

const getSchemaTS = async (filePath, idSchema, schemaName) => {
  let sourceFile
  try {
    sourceFile = getSourceFile(filePath)
  } catch (e) {
    return
  }
  const node = getDefinition(sourceFile, '"schema"')
  const keys = (node && node instanceof ObjectLiteralExpression) ? extractKeysFromSchema(node) : {}
  const featuresNode = getDefinition(sourceFile, '"features"')
  let features = {}
  if (featuresNode instanceof ObjectLiteralExpression) {
    try {
      features = JSON.parse(featuresNode.getText())
    } catch (e) {
      console.error("Ignoring features in object: ", idSchema, "because of an error: ", e)
      console.error("Features text producing the error: ", featuresNode.getText())
    }
  }

  const apiOptionsNode = getDefinition(sourceFile, '"api"')
  let options = {
    name: idSchema,
    prefix: '/api/v1/'
  }

  if (apiOptionsNode instanceof ObjectLiteralExpression) {
    try {
      options = JSON.parse(apiOptionsNode.getText().replaceAll(/'/g, '"'))
    } catch (e) {
      console.error("Ignoring api options in object: ", idSchema, "because of an error: ", e)
      console.error("Api options text producing the error: ", apiOptionsNode.getText())
    }
  }
  const normalizedPath = fspath.normalize(filePath).replace(/^(\.\.[\\/])+/, '').replace(/\\/g, '/');
  return { name: schemaName, features, id: idSchema, keys, apiOptions: options, filePath: normalizedPath }
}


const getSchema = async (idSchema, schemas, req, name?) => {
  //list all objects in data/objects folder and check if any has a name matching the idSchema
  //if so, return that object
  const schema = schemas.find(s => s.id == idSchema)
  const schemaName = name ?? schema?.name
  const tsFile = fspath.join(getRoot(req), schema.filePath)
  const tsData = await getSchemaTS(tsFile, idSchema, schemaName)
  if (tsData) {
    return tsData
  }

  throw "Schema with id " + idSchema + " not found in schemas";
}


const setSchema = (path, content, value, req) => {
  let sourceFile = getSourceFile(path)
  const secondArgument = getDefinition(sourceFile, '"schema"')
  if (!secondArgument) {
    throw "No schema marker found for file: " + path
  }

  secondArgument.replaceWithText(content);
  sourceFile.saveSync();
}

const getDB = (path, req, session) => {
  const db = {
    async *iterator() {
      const schemas = await getSchemas(req);
      for (const schema of schemas) {
        yield [schema.name, JSON.stringify(schema)];
      }
    },

    async del(key, value) {
      value = JSON.parse(value)
      if (syncFs.existsSync(fspath.join(getRoot(req), 'data/objects', value.name + '.ts'))) {
        syncFs.unlinkSync(fspath.join(getRoot(req), 'data/objects', value.name + '.ts'))
      }

      if (syncFs.existsSync(fspath.join(getRoot(req), 'data/automations', value.name + '.ts'))) {
        syncFs.unlinkSync(fspath.join(getRoot(req), 'data/automations', value.name + '.ts'))
      }

      // Delete associated board when object is deleted
      try {
        const token = getServiceToken();
        
        // Normalize object name to get board name
        const toBoardName = (s: string) =>
          s.trim()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/gi, "_")
            .toLowerCase();
        
        const objectName = toBoardName(value.name);
        const boardName = `${objectName}_object`;
        
        await API.get(`/api/core/v1/boards/${encodeURIComponent(boardName)}/delete?token=${token}`);
        logger.info({ boardName, objectName: value.name }, 'Deleted associated object board');
      } catch (e: any) {
        // Board doesn't exist or delete failed - log only if it's not a "not found" error
        const status = e?.response?.status || e?.status;
        if (status && status !== 404) {
          logger.warn({ objectName: value.name, err: e?.message }, 'Failed to delete associated object board');
        }
      }
    },

    async put(key, value) {
      value = JSON.parse(value)
      value = {
        ...value,
        name: value.name.replace(/\s/g, ""),
        id: value.id.replace(/\s/g, "")
      }

      value.initialData = {}
      value.apiOptions = {
        name: value.name,
        prefix: '/api/v1/'
      }
      value.features = {
        AutoAPI: value.api ? value.api : false,
        adminPage: '/objects/view?object=' + value.name + "Model"
      }
      // delete value.api
      delete value.adminPage
      const relPath = "/data/objects/"
      const filePath = getRoot(req) + relPath + fspath.basename(value.name) + '.ts'
      let exists
      try {
        await fs.access(filePath, fs.constants.F_OK)
        exists = true
      } catch (error) {
        exists = false
      }

      if (exists) {
        console.log('File: ' + filePath + ' already exists, not executing template')
      } else {
        const result = await API.post('/api/core/v1/templates/file?token=' + getServiceToken(), {
          name: value.name + '.ts',
          data: {
            options: { template: '/extensions/objects/templateSchema.tpl', variables: { lowername: value.name.toLowerCase(), name: value.name.charAt(0).toUpperCase() + value.name.slice(1) } },
            path: relPath
          }
        })

        if (result.isError) {
          throw result.error
        }

      }

      const result = ObjectModel.load(value).getSourceCode()

      await setSchema(filePath, result, value, req)
      let ObjectSourceFile = getSourceFile(filePath)
      if (value.features.AutoAPI) await addFeature(ObjectSourceFile, '"AutoAPI"', `"${value.features.AutoAPI}"`)
      if (value.features.adminPage) await addFeature(ObjectSourceFile, '"adminPage"', `"${value.features.adminPage}"`)

      await API.get('/api/v1/objects/reload?token=' + getServiceToken())


      //if api is selected, create an autoapi for the object
      const templateName = value.databaseType === "Google Sheets" ? "automatic-crud-google-sheet" : (value.databaseType === "Default Provider") ? "automatic-crud" : "automatic-crud-storage"
      if (session) {
        const objectApi = APIModel.load({
          name: value.name,
          object: value.name,
          template: templateName,
          param: value.param,
          modelName: value.id
        })
        await API.post("/api/core/v1/apis?token=" + session.token, objectApi.create().getData())
      }
      // Auto-create board for object with its cards
      try {
        const token = session?.token ?? getServiceToken();

        const toBoardName = (s: string) =>
          s.trim()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/gi, "_")
            .toLowerCase();

        const objectName = toBoardName(value.name);
        const boardName = `${objectName}_object`;

        // Create board using 'smart ai agent' template
        await API.post(`/api/core/v1/import/board?token=${token}`, {
          name: boardName,
          template: { id: "smart ai agent" }
        });

        // Get the card definitions for this object with its field types
        const cardDefinitions = getObjectCardDefinitions({
          modelName: objectName,
          object: value.name,
          keys: value.keys // Pass the object field definitions to generate proper params
        });

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

        const DEFAULT_HTML_VALUE = `//@card/react
function Widget(card) {
  const value = card.value;
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card.icon && card.displayIcon !== false && (
            <Icon name={card.icon} size={48} color={card.color}/>
          )}
          {card.displayResponse !== false && (
            <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? "N/A"} />
          )}
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
`;

        // Add each card to the board
        for (const cardDef of cardDefinitions) {
          const uniqueKey = `${cardDef.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const cardData: Record<string, any> = {
            key: uniqueKey,
            type: cardDef.defaults.type || 'action',
            name: cardDef.defaults.name,
            description: cardDef.defaults.description || '',
            rulesCode: cardDef.defaults.rulesCode || '',
            params: cardDef.defaults.params || {},
            configParams: cardDef.defaults.configParams || {},
            displayResponse: cardDef.defaults.displayResponse ?? true,
            icon: cardDef.defaults.icon || 'box',
            width: cardDef.defaults.width || 2,
            height: cardDef.defaults.height || 8,
            html: cardDef.defaults.html || (cardDef.defaults.type === 'action' ? DEFAULT_HTML_ACTION : DEFAULT_HTML_VALUE),
            layer: 'base'
          };

          // Add optional properties if they exist
          if (cardDef.defaults.presets) {
            cardData.presets = cardDef.defaults.presets;
          }
          if (cardDef.defaults.method) {
            cardData.method = cardDef.defaults.method;
          }

          await API.post(`/api/core/v1/boards/${encodeURIComponent(boardName)}/management/add/card?token=${token}`, {
            card: cardData
          });
        }

        console.log(`Auto-created board "${boardName}" with ${cardDefinitions.length} cards for object "${value.name}"`);
      } catch (e) {
        // Log error but don't fail object creation
        console.error("Auto-create object board failed:", e);
      }
    },

    async get(key) {
      const schemas = await getSchemas(req, true)
      return JSON.stringify(await getSchema(key, schemas, req))
    }
  };

  return db;
}

const ObjectsAutoAPI = AutoAPI({
  modelName: 'objects',
  modelType: ObjectModel,
  prefix: '/api/core/v1/',
  getDB: getDB,
  connectDB: () => new Promise(resolve => resolve(null)),
  requiresAdmin: ['*']
})

export default (app, context) => {

  app.post('/api/core/v1/objects/parseKeys', requireAdmin(), handler(async (req, res) => {
    const { code } = req.body || {}
    const project = new Project({ useInMemoryFileSystem: true });
    const wrapped = `const __obj = ${code};`;
    const source = project.createSourceFile("_temp1.ts", wrapped, { overwrite: true });

    const obj = source
      .getVariableDeclaration("__obj")
      ?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);

    if (!obj) {
      res.send({ keys: {}, node: source.getText(), message: "No literal object found" });
      return;
    }
    const keys = extractKeysFromSchema(obj)
    res.send({ keys, node: obj.getText() });
  }))

  ObjectsAutoAPI(app, context)

  // Subscribe to board delete events to delete associated object
  // Object boards end with '_object', e.g. 'myobject_object' for object 'myobject'
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

      // Only process boards that end with '_object'
      if (!boardName.endsWith('_object')) {
        return;
      }

      // Extract object name by removing '_object' suffix
      const objectName = boardName.slice(0, -7); // Remove '_object'

      if (!objectName) {
        return;
      }

      // Check if the object file exists and delete it
      try {
        const token = getServiceToken();

        // Try to delete the object via API
        await API.get(`/api/core/v1/objects/${encodeURIComponent(objectName)}Model/delete?token=${token}`);
        logger.info({ objectName, boardName }, 'Object deleted due to board deletion');
      } catch (err: any) {
        // Object doesn't exist or delete failed - log only if it's not a "not found" error
        const status = err?.response?.status || err?.status;
        if (status && status !== 404) {
          logger.warn({ objectName, boardName, err: err?.message }, 'Failed to delete object after board deletion');
        }
      }
    },
    'boards/delete/#'
  );
}
