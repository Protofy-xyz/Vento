import { getServiceToken } from './serviceToken'
import { handler } from './handler'
import { API, getEnv, getLogger, generateEvent } from 'protobase';
import { dbProvider, getDBOptions } from './db';
import { ai } from './ai';

const logger = getLogger()
const _getDB = dbProvider.getDB;
const _connectDB = dbProvider.connectDB;

/*
    modelName: name of the model, used to generate api urls. for example, if model name is 'test' and prefix is '/api/v1/', then to read an item is: /api/v1/test
                the separation from prefix is to allow less parameters for the default scenario (so you dont to write /api/v1/ all the time)
    modelType: a class to interact with the data returned by the storage
    dir: the directory where your api is located. Used to load initialData.json if it exists
    prefix: exaplined in modelName
    dbName: name of the database, used by the storage engine
    transformers: a key->value object with transformations, invocable from the schema.
    _connectDB: function used by the api to preconnect the database. Its optional, used to provide your own database implementation
    _getDB: function used by the api to retrieve the database object to interact with the database. Its optional, used to provide your own database implementation (json...)
    operations: list of provided operations, by default ['create', 'read', 'update', 'delete', 'list']
    single: most apis are used to expose a list of things. Single means a single entity, not a list of things. So /api/v1/test returns the entity, not a list of things
*/

type AutoAPIOptions = {
    modelName: string,
    modelType: any,
    initialData?: Object,
    prefix?: string,
    dbName?: string | Function,
    notify?: Function,
    transformers?: any,
    connectDB?: any,
    getDB?: any,
    operations?: string[],
    single?: boolean,
    disableEvents?: boolean,
    paginatedRead?: { model: any },
    requiresAdmin?: string[],
    extraData?: any,
    logLevel?: string,
    itemsPerPage?: number
    defaultOrderBy?: string,
    defaultOrderDirection?: string,
    skipStorage?: Function,
    onBeforeList?: Function,
    onAfterList?: Function,
    onBeforeCreate?: Function,
    onAfterCreate?: Function,
    onBeforeRead?: Function,
    onAfterRead?: Function,
    onBeforeUpdate?: Function,
    onAfterUpdate?: Function,
    onBeforeDelete?: Function,
    onAfterDelete?: Function,
    skipDatabaseIndexes?: boolean,
    allowUpsert?: boolean,
    skipDatabaseInitialization?: boolean,
    ephemeralEvents?: boolean,
    dbOptions?: {
        batch?: boolean,
        batchLimit?: number,
        batchTimeout?: number,
        orderedInsert?: boolean,
        maxEntries?: number
    }
}

export const AutoAPI = ({
    modelName,
    modelType,
    initialData = {},
    prefix = "/api/v1/",
    dbName,
    transformers = {},
    connectDB = _connectDB,
    getDB = _getDB,
    notify,
    operations = ['create', 'read', 'update', 'delete', 'list'],
    single,
    disableEvents,
    paginatedRead,
    requiresAdmin,
    extraData = {},
    logLevel = 'info',
    itemsPerPage = 25,
    allowUpsert = false,
    skipStorage = async (data, session?, req?) => false,
    onBeforeList = async (data, session?, req?) => data,
    onAfterList = async (data, session?, req?) => data,
    onBeforeCreate = async (data, session?, req?) => data,
    onAfterCreate = async (data, session?, req?) => data,
    onBeforeRead = async (data, session?, req?) => data,
    onAfterRead = async (data, session?, req?) => data,
    onBeforeUpdate = async (data, session?, req?) => data,
    onAfterUpdate = async (data, session?, req?) => data,
    onBeforeDelete = async (data, session?, req?) => data,
    onAfterDelete = async (data, session?, req?) => data,
    skipDatabaseIndexes,
    dbOptions = {},
    defaultOrderBy = undefined,
    defaultOrderDirection = 'asc',
    skipDatabaseInitialization = false,
    ephemeralEvents = false,
}: AutoAPIOptions) => async (app, context) => {
    const defaultName = dbName ?? modelName
    const groupIndexes = modelType.getGroupIndexes()

    const getDBPath = (action: "init" | "list" | "create" | "read" | "update" | "delete", req?, entityModel?) => {
        if (dbName && typeof dbName == 'function') {
            return dbName(action, req, entityModel)
        }

        return defaultName
    }

    const _notify = (entityModel, action) => {
        if (notify) return notify(entityModel, action)

        if (context && context.mqtt) {
            context.mqtt.publish(entityModel.getNotificationsTopic(action), entityModel.getNotificationsPayload())
        }
    }

    if (!skipDatabaseInitialization) {
        await connectDB(getDBPath("init"), initialData, skipDatabaseIndexes ? {} : getDBOptions(modelType, dbOptions))
    }

    const _onBeforeList = async (data, session, req) => {
        groupIndexes.forEach((val) => {
            if (data[val.name] === undefined) return
            if (data.filter === undefined) {
                data.filter = {}
            }
            data.filter[val.key] = data[val.name]
        })
        return await onBeforeList(data, session, req)
    }

    const processLinks = (item) => {
        const links = modelType.getSchemaLinks()
        if (links) {
            for (const link of links) {
                if (item[link.field] !== undefined) {
                    const linkId = link.linkToId(item[link.field])
                    item[link.field] = linkId
                }
            }
        }
        return item
    }

    const recoverLinks = async (items) => {
        const links = modelType.getSchemaLinks()

        if (links) {
            for (const link of links) {
                let idsToRequest = items.map(x => x[link.field]).filter(x => x !== undefined)
                idsToRequest = [...new Set(idsToRequest)]
                items = await link.linkToReadIds(link, idsToRequest, items)
            }
        }
        return items
    }

    const _list = async (req, allResults, _itemsPerPage) => {
        const page = Number(req.query.page) || 0;
        const orderBy: string = (req.query.orderBy && req.query.orderBy != "" ? req.query.orderBy : defaultOrderBy) as string;
        const orderDirection = req.query.orderDirection && req.query.orderDirection != "" ? req.query.orderDirection : defaultOrderDirection;
        if (orderBy) {
            allResults = allResults.sort((a, b) => {
                if (a[orderBy] > b[orderBy]) return orderDirection === 'asc' ? 1 : -1;
                if (a[orderBy] < b[orderBy]) return orderDirection === 'asc' ? -1 : 1;
                return 0;
            });
        }

        allResults = await recoverLinks(allResults)


        const result = {
            itemsPerPage: _itemsPerPage,
            items: req.query.all ? allResults : allResults.slice(page * _itemsPerPage, (page + 1) * _itemsPerPage),
            total: allResults.length,
            page: req.query.all ? 0 : page,
            pages: req.query.all ? 1 : Math.ceil(allResults.length / _itemsPerPage)
        }
        return result
    }
    //list
    !single && operations.includes('list') && app.get(prefix + modelName, handler(async (req, res, session) => {
        if (requiresAdmin && (requiresAdmin.includes('list') || requiresAdmin.includes('*')) && (!session || !session?.user?.admin)) {
            res.status(401).send({ error: "Unauthorized" })
            return
        }

        const db = getDB(getDBPath("list", req), req, session, context);

        if (req.query.group) {
            let options = []
            if (db.hasCapability && db.hasCapability('groupBySingle')) {
                options = await db.getGroupIndexOptions(req.query.group, req.query.limit || 100)
            }

            if (req.query.search) {
                const search = req.query.search as string
                options = options.filter(x => x.toLowerCase().startsWith(search.toLowerCase()))
            }

            res.send(options)
            return
        }

        const allResults: any[] = [];

        const search = req.query.search;
        const groupIndexes = modelType.getGroupIndexes().reduce((acc, val) => {
            if (req.query[val.name] === undefined) return acc
            if (acc) {
                acc[val.key] = req.query[val.name];
                return acc
            } else {
                return {
                    [val.key]: req.query[val.name]
                }
            }
        }, null)


        let filter = req.query.filter

        if (groupIndexes) {
            if (filter) {
                filter = { ...(filter as object), ...groupIndexes }
            } else {
                filter = groupIndexes
            }
        }

        const preListData = typeof extraData?.prelist == 'function' ? await extraData.prelist(session, req) : (extraData?.prelist ?? {})
        const mode = req.query.mode;
        let prompt, jsCode
        if (search && mode == "ai") {
            //get a sample of model elements to use as context for the AI
            let sampleElements = await API.get(prefix + modelName + '?token=' + getServiceToken()) as any
            sampleElements = sampleElements?.data?.items || []
            sampleElements = JSON.stringify(sampleElements) //take only the first 10 elements
            // console.log('sampleElements: ', sampleElements)
            prompt = await context.autopilot.getPromptFromTemplate({
                sampleElements,
                templateName: "aiSearch",
                search,
                modelName,
                modelType: modelType.toString(),
                modelDefinition: JSON.stringify(modelType.getObjectFieldsDefinition()),
                aditionalDecriptions: modelType.getAdditionalDescriptions(),
            });
            // console.log('-------------------------------------------------------------------------')
            // console.log("******** AI prompt: ", prompt)
            const reply = await ai.callModel(prompt);
            jsCode = ai.cleanCode(reply.choices[0].message.content)
            // console.log('-------------------------------------------------------------------------')
            // console.log("******** AI code: ", jsCode)
            // console.log('-------------------------------------------------------------------------')
        }

        const parseResult = async (value, skipFilters?) => {
            const model = modelType.unserialize(value, session);
            const extraListData = typeof extraData?.list == 'function' ? await extraData.list(session, model, req) : (extraData?.list ?? {})
            const listItem = await model.listTransformed(search, transformers, session, { ...preListData, ...extraListData }, !skipFilters ? await _onBeforeList(req.query, session, req) : undefined, jsCode);
            return listItem
        }
        const _itemsPerPage = Math.max(Number(req.query.itemsPerPage) || (itemsPerPage ?? 25), 1);

        const filterKeys = Object.keys(filter || {})
        if (!search && (!filter || ((!req.query.orderBy || req.query.orderBy == modelType.getIdField()) && filterKeys.length == 1 && db.hasCapability && db.hasCapability('groupBySingle') && await db.hasGroupIndexes(filterKeys))) && !skipDatabaseIndexes && db.hasCapability && db.hasCapability('pagination')) {
            // console.log('Using indexed retrieval: ', modelName, 'filters: ', filter)
            const indexedKeys = await db.getIndexedKeys()
            const filterData = filter ? { key: filterKeys[0], value: filter[filterKeys[0]] } : null
            const total = parseInt(await db.count(filterData), 10)
            const page = Number(req.query.page) || 0;
            const orderBy: string = req.query.orderBy ? req.query.orderBy as string : (defaultOrderBy ?? modelType.getIdField())
            const orderDirection = req.query.orderDirection || defaultOrderDirection;
            if (indexedKeys.length && indexedKeys.includes(orderBy)) {
                let allResults = await Promise.all((await db.getPageItems(total, orderBy, page, _itemsPerPage, orderDirection, filterData)).map(async x => await parseResult(x, true)))
                allResults = await recoverLinks(allResults)
                const result = {
                    itemsPerPage: _itemsPerPage,
                    items: allResults,
                    total: total,
                    page: req.query.all ? 0 : page,
                    pages: req.query.all ? 1 : Math.ceil(total / _itemsPerPage)
                }
                res.send(await onAfterList(result, session, req));
                return
            }
        }

        //logger.trace("Using basic retrieval without indexes: ", modelName, 'filters: ', filter)

        for await (const [key, value] of db.iterator()) {
            //console.log("***********************key", key, "value ", value)
            const listItem = await parseResult(value)
            if (listItem) {
                allResults.push(listItem);
            }
        }

        res.send(await onAfterList(await _list(req, allResults, _itemsPerPage), session, req));

    }));

    //create
    //this endpoint serves two purposes: create and batch read (read multiple items at once)
    //post with ?action=read_multiple to read multiple items at once (body should a json array with the keys to read)
    //post without ?action to create an item
    (operations.includes('create') || operations.includes('read')) && app.post(prefix + modelName, handler(async (req, res, session) => {
        if (requiresAdmin && (requiresAdmin.includes('create') || requiresAdmin.includes('*')) && (!session || !session?.user?.admin)) {
            res.status(401).send({ error: "Unauthorized" })
            return
        }

        if (req.query.action == 'read_multiple') {
            const ids = req.body
            if (!ids || !ids.length) {
                res.status(400).send({ error: "No ids provided" })
                return
            }
            const db = getDB(getDBPath("read", req), req, session, context)
            const allResults: any[] = []
            for (const id of ids) {
                try {
                    const item = modelType.unserialize(await db.get(id), session)
                    const readData = typeof extraData?.read == 'function' ? await extraData.read(session, item, req) : (extraData?.read ?? {})
                    allResults.push(await onAfterRead(await item.readTransformed(transformers, readData), session, req))
                } catch (e) {
                    logger.error({ error: e }, "Error reading item: " + id)
                }
            }
            res.send(allResults)
            return
        } else {
            if (!operations.includes('create')) {
                res.status(404).send({ error: "Not found" })
                return
            }
        }

        const entityModel = await (modelType.load(await onBeforeCreate(req.body, session, req), session).createTransformed(transformers))
        const skipStorageResult = skipStorage ? await skipStorage(entityModel.read(), session, req) : false
        if (!skipStorageResult) {
            let dbPath = getDBPath("create", req, entityModel)
            if (!dbPath) {
                res.status(404).send({ error: "Not found" })
            }

            if (!(dbPath instanceof Array)) {
                dbPath = [dbPath]
            }

            for (const path of dbPath) {
                const db = getDB(path, req, session, context)
                try {
                    if (allowUpsert) throw new Error("Upsert enabled, inserting new document")
                    await db.get(entityModel.getId())
                    res.status(409).send({ error: "Already exists" })
                    return
                } catch (e) {
                    await db.put(entityModel.getId(), JSON.stringify(processLinks(entityModel.serialize(true))), { ...dbOptions, action: 'create', entityId: modelType.getIdField() })
                }
            }
        }

        _notify(entityModel, 'create')

        if (!disableEvents) {
            generateEvent({
                path: modelName + '/create/' + entityModel.getId(), //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
                from: 'api', // system entity where the event was generated (next, api, cmd...)
                user: session.user.id, // the original user that generates the action, 'system' if the event originated in the system itself
                payload: {
                    id: entityModel.getId(),
                    data: entityModel.read()
                }, // event payload, event-specific data
                ephemeral: ephemeralEvents ?? false
            }, getServiceToken())
        }
        logger[logLevel ?? 'info']({ id: entityModel.getId() }, modelName + " created: " + entityModel.getId())

        res.send(await onAfterCreate(await entityModel.readTransformed(transformers), session, req))
    }));

    //read
    operations.includes('read') && app.get(prefix + modelName + '/:key', handler(async (req, res, session) => {
        if (requiresAdmin && (requiresAdmin.includes('read') || requiresAdmin.includes('*')) && (!session || !session?.user?.admin)) {
            res.status(401).send({ error: "Unauthorized" })
            return
        }

        const db = getDB(getDBPath("read", req), req, session, context)

        try {
            if (paginatedRead) {
                const allResults: any[] = [];

                const search = req.query.search;
                for await (const [key, value] of db.get(req.params.key)) {
                    if (key != 'initialized') {
                        const model = paginatedRead.model.unserialize(await onBeforeRead(value, session, req), session);
                        const listItem = await model.listTransformed(search, transformers);

                        if (listItem) {
                            allResults.push({ ...listItem, _key: key });
                        }
                    }
                }
                res.send(await _list(req, await onAfterRead(allResults, session, req), Math.max(Number(req.query.itemsPerPage) || (itemsPerPage ?? 25), 1)))
            } else {
                const item = modelType.unserialize(await onBeforeRead(await db.get(req.params.key), session, req), session)
                const readData = typeof extraData?.read == 'function' ? await extraData.read(session, item, req) : (extraData?.read ?? {})
                const itemData = (await recoverLinks([await item.readTransformed(transformers, readData)]))[0]
                res.send(await onAfterRead(itemData, session, req))
            }
        } catch (error) {
            logger.error({ error }, "Error reading from database")
            res.status(404).send({ result: "not found" })
        }
    }));

    //update
    operations.includes('update') && app.post(prefix + modelName + '/:key', handler(async (req, res, session) => {
        if (requiresAdmin && (requiresAdmin.includes('update') || requiresAdmin.includes('*')) && (!session || !session?.user?.admin)) {
            res.status(401).send({ error: "Unauthorized" })
            return
        }

        const requestModel = modelType.load(await onBeforeUpdate(req.body, req, session), session)
        const db = getDB(getDBPath("update", req, requestModel), req, session, context)
        const modelData = (await recoverLinks([JSON.parse(await db.get(req.params.key))]))[0]
        const entityModel = await (modelType.load(modelData, session).updateTransformed(requestModel, transformers))
        const isPatch = req?.query?.patch === 'true'

        await db.put(entityModel.getId(), JSON.stringify({ ...(isPatch ? modelData : {}), ...processLinks(entityModel.serialize(true)) }))
        _notify(entityModel, 'update')

        if (!disableEvents) {
            generateEvent({
                path: modelName + '/update/' + entityModel.getId(), //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
                from: 'api', // system entity where the event was generated (next, api, cmd...)
                user: session.user.id, // the original user that generates the action, 'system' if the event originated in the system itself
                payload: {
                    id: entityModel.getId(),
                    data: entityModel.read()
                }, // event payload, event-specific data
                ephemeral: ephemeralEvents ?? false
            }, getServiceToken())
        }
        logger[logLevel ?? 'info']({ data: entityModel.read() }, modelName + " updated: " + entityModel.getId())
        res.send(await onAfterUpdate(await entityModel.readTransformed(transformers), session, req))
    }));

    //delete
    operations.includes('delete') && app.get(prefix + modelName + '/:key/delete', handler(async (req, res, session) => {
        if (requiresAdmin && (requiresAdmin.includes('delete') || requiresAdmin.includes('*')) && (!session || !session?.user?.admin)) {
            res.status(401).send({ error: "Unauthorized" })
            return
        }

        const db = getDB(getDBPath("delete", req), req, session, context)
        const rawEntityData = await db.get(req.params.key)

        if (!paginatedRead) {
            onBeforeDelete(rawEntityData, session, req)
            await db.del(req.params.key, rawEntityData)
        } else {
            await onBeforeDelete("{}", session, req)
            await db.del(req.params.key, rawEntityData)
        }
        try {
            const entityModel = await modelType.unserialize(rawEntityData, session)
            _notify(entityModel, 'delete')
            if (!disableEvents) {
                generateEvent({
                    path: modelName + '/delete/' + entityModel.getId(), //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
                    from: 'api', // system entity where the event was generated (next, api, cmd...)
                    user: session.user.id, // the original user that generates the action, 'system' if the event originated in the system itself
                    payload: {
                        who: '-', //TODO: wire session in dataview to api,
                        id: entityModel.getId(),
                        data: entityModel.read()
                    }, // event payload, event-specific data
                    ephemeral: ephemeralEvents ?? false
                }, getServiceToken())
            }
            logger[logLevel ?? 'info']({ data: entityModel.read() }, modelName + " deleted: " + entityModel.getId())
        } catch (e) {
            logger.error({ e }, "Error during delete notification")
        }

        res.send(await onAfterDelete({ "result": "deleted" }, session, req))
    }));
}
