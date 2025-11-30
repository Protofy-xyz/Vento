import { API } from "protobase";
import { handler } from "../lib/handler";
import { getServiceToken } from "./serviceToken";

type AutoActionsParams = {
    modelName: string;
    modelType: any; // should be an instance of AutoModel
    apiUrl?: string;
    prefix?: string; // where the API for the actions will be created
    object?: string; // what to display to the user in the list view
    notificationsName?: string; // name of the notifications to listen to
    pluralName?: string; // plural name for the model, used in cards and actions
    html?: Record<string, string>; // additional HTML content for cards
}

export type ObjectCardDefinition = {
    group: string;
    tag: string;
    name: string;
    id: string;
    templateName: string;
    defaults: Record<string, any>;
    emitEvent?: boolean;
}

export type GetObjectCardsParams = {
    modelName: string;
    modelType?: any;
    pluralName?: string;
    object?: string;
    html?: Record<string, string>;
}

const getListRules = (modelName) => {
    return `const action = userParams.action;
delete userParams[\"action\"];

if (action == \"create\") {
    return execute_action(\"/api/v1/actions/${modelName}/create\", userParams);
} else if (action == \"update\") {
    return execute_action(\"/api/v1/actions/${modelName}/update\", userParams);
} else if (action == \"read\") {
    return execute_action(\"/api/v1/actions/${modelName}/read\", userParams);
} else if (action == \"delete\") {
  return execute_action(\"/api/v1/actions/${modelName}/delete\", userParams);
} else if (action == \"exists\") {
  return execute_action(\"/api/v1/actions/${modelName}/exists\", userParams);
} else if (action == "select") {
  if (!userParams.selectedItem) {
    return
  }

  return {
    selected: userParams.selectedItem.data, 
    items: await execute_action("/api/v1/actions/${modelName}/list", {})
  };
} else {
  return {
    selected: null, 
    items: await execute_action("/api/v1/actions/${modelName}/list", {})
  };
}`
}

/**
 * Returns the card definitions for an object/storage
 * These are used to create the cards in the board and to register them in the context
 */
export const getObjectCardDefinitions = ({
    modelName,
    modelType,
    pluralName,
    object,
    html = {}
}: GetObjectCardsParams): ObjectCardDefinition[] => {
    const plurName = pluralName ?? modelName;
    
    const getHTML = (name: string, defaultValue?) => {
        if (html[name]) {
            return html[name];
        }
        return defaultValue;
    }

    // Get params from modelType if available (for create card)
    let createParams = {};
    let updateParams = {
        id: `id of the ${modelName} to update`,
        field: `field to update in the ${modelName}`,
        value: `new value for the field`
    };
    
    if (modelType?.getObjectFieldsDefinition) {
        const def = modelType.getObjectFieldsDefinition();
        createParams = Object.keys(def).filter(key => def[key].autogenerate == false).map((key) => {
            return {
                [key]: def[key].description + " (" + def[key].type + ")" + (def[key].isId ? " (this will be used as the id of the element)" : "")
            }
        }).reduce((acc, val) => ({ ...acc, ...val }), {});
        
        updateParams = {
            id: `id of the ${modelName} to update`,
            field: `field to update in the ${modelName}. Possible fields: ${Object.keys(def).join(", ")}`,
            value: `new value for the field`
        };
    }

    const cards: ObjectCardDefinition[] = [
        // exists
        {
            group: 'storages',
            tag: modelName,
            name: 'exists',
            id: 'storage_' + modelName + '_exists',
            templateName: 'Check if a ' + modelName + ' exists in the storage',
            defaults: {
                html: getHTML('exists'),
                width: 2,
                height: 8,
                icon: 'file-check',
                displayResponse: true,
                name: `exists ${modelName}`,
                type: 'action',
                description: `Check if ${modelName} exists given an id. Returns true if it exists, false otherwise.`,
                params: {
                    id: 'id to look for'
                },
                rulesCode: `return execute_action("/api/v1/actions/${modelName}/exists", userParams)`
            }
        },
        // table
        {
            group: 'storages',
            tag: modelName,
            name: 'table',
            id: 'storage_' + modelName + '_last_table',
            templateName: "Last " + modelName + " table",
            defaults: {
                width: 3,
                height: 8,
                name: "Table",
                icon: "table-properties",
                description: "Displays a table with the last " + plurName,
                type: 'value',
                html: getHTML("last_table", "\n//data contains: data.value, data.icon and data.color\nreturn card({\n    content: cardTable(data.value), padding: '3px'\n});\n"),
                rulesCode: `return states.storages?.${modelName}.lastEntries`
            }
        },
        // read
        {
            group: 'storages',
            tag: modelName,
            name: 'read',
            id: 'storage_' + modelName + '_read',
            templateName: 'Read ' + modelName + ' from the storage',
            defaults: {
                html: getHTML('read'),
                width: 2,
                height: 8,
                icon: 'file-search',
                displayResponse: true,
                name: `read ${modelName}`,
                type: 'action',
                description: `Reads${modelName} given an id. Returns the content of the object if it exists, false otherwise.`,
                params: {
                    id: `id of the ${modelName} to read`
                },
                rulesCode: `return execute_action("/api/v1/actions/${modelName}/read", userParams)`
            }
        },
        // create
        {
            group: 'storages',
            tag: modelName,
            name: 'create',
            id: 'storage_' + modelName + '_create',
            templateName: 'Create ' + modelName + ' in the storage',
            defaults: {
                html: getHTML('create'),
                width: 2,
                height: 14,
                icon: 'file-plus',
                displayResponse: true,
                name: `create ${modelName}`,
                type: 'action',
                description: `Creates a ${modelName} given its content. Returns the created ${modelName}.`,
                params: createParams,
                rulesCode: `return execute_action("/api/v1/actions/${modelName}/create", userParams)`
            }
        },
        // delete
        {
            group: 'storages',
            tag: modelName,
            name: 'delete',
            id: 'storage_' + modelName + '_delete',
            templateName: 'Delete ' + modelName + ' from the storage',
            defaults: {
                width: 2,
                height: 8,
                icon: 'trash',
                displayResponse: true,
                name: `delete ${modelName}`,
                type: 'action',
                html: getHTML('delete'),
                description: `Deletes ${modelName} by id. Returns true if it was deleted, false otherwise.`,
                params: {
                    id: 'id of the ' + modelName + ' to delete'
                },
                rulesCode: `return execute_action("/api/v1/actions/${modelName}/delete", userParams)`
            }
        },
        // update
        {
            group: 'storages',
            tag: modelName,
            name: 'update',
            id: 'storage_' + modelName + '_update',
            templateName: 'Updates ' + modelName + ' in the storage',
            defaults: {
                html: getHTML('update'),
                width: 2,
                height: 12,
                icon: 'file-pen-line',
                displayResponse: true,
                name: `update ${modelName}`,
                type: 'action',
                description: `Updates a ${modelName} by id, changing field with a given value. Returns the updated ${modelName} if it was updated, false otherwise.`,
                params: updateParams,
                rulesCode: `return execute_action("/api/v1/actions/${modelName}/update", userParams)`
            }
        },
        // lastCreated
        {
            group: 'storages',
            tag: modelName,
            name: 'lastCreated',
            id: 'storage_' + modelName + '_lastCreated',
            templateName: 'Last created ' + modelName,
            defaults: {
                width: 2,
                height: 8,
                html: getHTML('lastCreated'),
                type: "value",
                icon: 'rss',
                name: `lastCreated ${modelName}`,
                description: `Last Created ${modelName}`,
                rulesCode: `return states.storages?.${modelName}.lastCreated;`,
            }
        },
        // lastUpdated
        {
            group: 'storages',
            tag: modelName,
            name: 'lastUpdated',
            id: 'storage_' + modelName + '_lastUpdated',
            templateName: 'Last updated ' + modelName,
            defaults: {
                html: getHTML('lastUpdated'),
                type: "value",
                icon: 'rss',
                name: `lastUpdated ${modelName}`,
                description: `Last updated ${modelName}`,
                rulesCode: `return states.storages?.${modelName}.lastUpdated;`,
            }
        },
        // totalItems
        {
            group: 'storages',
            tag: modelName,
            name: 'totalItems',
            id: 'storage_' + modelName + '_totalitems',
            templateName: 'Total ' + plurName,
            defaults: {
                html: getHTML('totalItems'),
                type: "value",
                icon: 'boxes',
                name: `Total ${plurName}`,
                description: `Total ${plurName}`,
                rulesCode: `return states.storages?.${modelName}.total;`,
            }
        },
        // list (manager)
        {
            group: 'storages',
            tag: modelName,
            name: 'list',
            id: 'storage_' + modelName + '_manager',
            templateName: modelName + ' storage manager',
            emitEvent: true,
            defaults: {
                width: 4,
                height: 10,
                icon: 'search',
                displayResponse: true,
                method: 'post',
                name: `${modelName} storage manager`,
                html: "//@card/react\r\n\r\nfunction Widget(card) {\r\n  return (\r\n      <Tinted>\r\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\r\n         <StorageView name=\"" + (object ?? modelName) + "\" onItemsChange={() => execute_action(card.name, {})} onSelectItem={(item) => execute_action(card.name, {action: \"select\", selectedItem: JSON.stringify(item)})}/>\r\n        </ProtoThemeProvider>\r\n      </Tinted>\r\n  );\r\n}\r\n",
                type: 'action',
                description: `Returns a list of ${modelName} objects. You can filter the results by passing itemsPerPage, page, search, orderBy and orderDirection parameters.`,
                params: {
                    itemsPerPage: 'number of items per page (optional)',
                    page: 'page number to retrieve (optional)',
                    search: 'search term to filter the results (optional)',
                    orderBy: 'field to order the results by (optional)',
                    orderDirection: 'direction to order the results by (asc or desc) (optional)',
                    action: "action to perform in the storage: list, read, create, update, delete, exists",
                    id: "id (required for actions: read, create, update, delete, exists)",
                    selectedItem: "selected item on user click"
                },
                configParams: {
                    "selectedItem": {
                        "defaultValue": "",
                        "type": "json"
                    }
                },
                presets: {
                    "create": {
                        "description": "creates/adds item to the storage",
                        "configParams": {
                            "action": {
                                "defaultValue": "create"
                            }
                        }
                    },
                    "update": {
                        "description": "updates field of item of the storage",
                        "configParams": {
                            "action": {
                                "defaultValue": "update"
                            }
                        }
                    },
                    "read": {
                        "description": "reads item of the storage",
                        "configParams": {
                            "action": {
                                "defaultValue": "read"
                            }
                        }
                    },
                    "delete": {
                        "description": "deletes item of the storage",
                        "configParams": {
                            "action": {
                                "defaultValue": "delete"
                            }
                        }
                    },
                    "list": {
                        "description": "list items of the storage",
                        "configParams": {
                            "action": {
                                "defaultValue": "list"
                            }
                        }
                    },
                    "select": {
                        "configParams": {
                            "action": {
                                "defaultValue": "action",
                            },
                            "selectedItem": {
                                "defaultValue": "",
                                "type": "json"
                            }
                        },
                    },
                    "exists": {
                        "description": "checks if exists item on the storage",
                        "configParams": {
                            "action": {
                                "defaultValue": "exists"
                            }
                        }
                    }
                },
                rulesCode: getListRules(modelName),
            }
        },
        // search
        {
            group: 'storages',
            tag: modelName,
            name: 'search',
            id: 'storage_' + modelName + '_search',
            templateName: modelName + ' storage search',
            emitEvent: true,
            defaults: {
                width: 2,
                height: 8,
                icon: 'search',
                displayResponse: true,
                method: 'post',
                name: `Search ${modelName} in storage`,
                html: "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n\n  const content = <YStack f={1} ai=\"center\" jc=\"center\" width=\"100%\">\n      {card.icon && card.displayIcon !== false && (\n          <Icon name={card.icon} size={48} color={card.color}/>\n      )}\n      {card.displayResponse !== false && (\n          <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? \"N/A\"} />\n      )}\n  </YStack>\n\n  return (\n      <Tinted>\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n          <ActionCard data={card}>\n            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}\n          </ActionCard>\n        </ProtoThemeProvider>\n      </Tinted>\n  );\n}\n",
                type: 'action',
                description: `Search ${modelName} in the storage and returns a list of ${modelName} objects. You can use use querys in natural language for searching`,
                params: {
                    search: "search term",
                    ai_mode: "enables natural language search mode"
                },
                configParams: {
                    search: {
                        visible: true,
                        defaultValue: "",
                        type: "string"
                    },
                    ai_mode: {
                        visible: true,
                        defaultValue: "true",
                        type: "boolean"
                    }
                },
                rulesCode: `return execute_action("/api/v1/actions/${modelName}/list", {\r\n    ...params,\r\n    mode: params.ai_mode ? 'ai' : 'normal'\r\n})`,
            }
        }
    ];

    return cards;
}

/**
 * Returns the cards for an object/storage with the token already set
 * Use this function when you need to get the cards for a board
 */
export const getObjectCards = (params: GetObjectCardsParams) => {
    const cards = getObjectCardDefinitions(params);
    const token = getServiceToken();
    return cards.map(card => ({
        ...card,
        token
    }));
}

export const AutoActions = ({
    modelName,
    modelType,
    apiUrl = undefined,
    prefix = "/api/v1/",
    object = undefined,
    notificationsName = undefined,
    pluralName = undefined,
    html = {}
}: AutoActionsParams) => async (app, context) => {
    const plurName = pluralName ?? modelName
    const urlPrefix = apiUrl ?? `${prefix}${modelName}`;
    const actionUrlPrefix = `${prefix}actions/${modelName}`;
    const notiName = notificationsName ?? modelName;

    const loadTotal = async () => {
        try {
            const result = await API.get(`${urlPrefix}?token=${getServiceToken()}`);
            if (result.isLoaded && result.data && result.data.total) {
                context.state.set({ group: 'storages', tag: modelName, name: 'total', value: result.data.total });
                context.state.set({ group: 'storages', tag: modelName, name: 'lastEntries', value: result.data.items });
            }
        } catch (e) {
            console.error("Error loading total for " + modelName, e);
        }
        return 0;
    }
    setTimeout(() => loadTotal(), 1000);

    // Get card definitions
    const cardDefinitions = getObjectCardDefinitions({
        modelName,
        modelType,
        pluralName: plurName,
        object,
        html
    });

    // Helper to find card by name
    const getCard = (name: string) => cardDefinitions.find(c => c.name === name);

    //exists
    app.get(actionUrlPrefix + '/exists', handler(async (req, res, session) => {
        const params = req.query;
        const id = params.id;
        try {
            const result = await API.get(`${urlPrefix}/${id}?token=${session.token}`);
            if (result.isLoaded) {
                res.json(true);
                return
            }
            res.json(false);
            return
        } catch (e) {
            res.status(500).json(false);
            return
        }
    }))

    await context.actions.add({
        group: 'storages',
        name: 'exists',
        url: actionUrlPrefix + '/exists',
        tag: modelName,
        description: `Check if ${modelName} exists given an id. Returns true if it exists, false otherwise.`,
        params: { id: "id to look for" },
        token: getServiceToken()
    })

    // Add exists card
    const existsCard = getCard('exists');
    if (existsCard) {
        await context.cards.add({ ...existsCard, token: getServiceToken() });
    }

    // Add table card
    const tableCard = getCard('table');
    if (tableCard) {
        await context.cards.add({ ...tableCard, token: getServiceToken() });
    }

    //create
    const isObject = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const looksLikeJSON = (s: any) =>
        typeof s === 'string' && s.length > 1 && ((s[0] === '{' && s.at(-1) === '}') || (s[0] === '[' && s.at(-1) === ']'));

    const coerceByType = (raw: any, type?: string) => {
        switch (type) {
            case 'number': {
                const n = typeof raw === 'number' ? raw : Number(raw);
                return n;
            }
            case 'boolean': {
                let b: boolean;
                if (typeof raw === 'boolean') b = raw;
                else if (typeof raw === 'number') b = raw !== 0;
                else if (typeof raw === 'string') b = (raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes');
                else b = Boolean(raw);
                return b;
            }
            case 'record': {
                if (isObject(raw)) {
                    return raw;
                }
                if (looksLikeJSON(raw)) {
                    try {
                        const parsed = JSON.parse(raw as string);
                        return parsed;
                    } catch (e) {
                    }
                } else {
                }
                return raw; // keep as-is if we can't parse
            }
            case 'string':
            default: {
                const s = typeof raw === 'string' ? raw : String(raw);
                return s;
            }
        }
    };

    const fixParamsForModel = (params: any, modelType: any) => {
        const def = modelType.getObjectFieldsDefinition?.() ?? {};
        for (const key of Object.keys(params)) {
            const fieldType = def[key]?.type;
            if (!fieldType) continue;
            params[key] = coerceByType(params[key], fieldType);
        }
        return params;
    };

    const fixParamsForUpdate = (params: any, modelType: any) => {
        const def = modelType.getObjectFieldsDefinition?.() ?? {};
        if (typeof params.field === 'string' && 'value' in params) {
            const fieldType = def[params.field]?.type;
            if (fieldType) {
                params.value = coerceByType(params.value, fieldType);
            }
        }
        return params;
    };

    //read
    app.get(actionUrlPrefix + '/read', handler(async (req, res, session) => {
        const params = req.query;
        delete params._stackTrace;
        const id = params.id;
        try {
            const result = await API.get(`${urlPrefix}/${id}?token=${session.token}`);
            if (result.isLoaded) {
                fixParamsForModel(result.data, modelType);
                res.json(result.data);
                return
            }
            res.json(false);
            return
        } catch (e) {
            res.status(500).json(false);
            return
        }
    }))

    await context.actions.add({
        group: 'storages',
        name: 'read',
        url: actionUrlPrefix + '/read',
        tag: modelName,
        description: `Read ${modelName} given an id. Returns an object with the data of the ${modelName} if it exists, false otherwise.`,
        params: { id: `id of the ${modelName} to read` },
        token: getServiceToken(),
    })

    // Add read card
    const readCard = getCard('read');
    if (readCard) {
        await context.cards.add({ ...readCard, token: getServiceToken() });
    }

    app.post(actionUrlPrefix + '/create', handler(async (req, res, session) => {
        const params = req.body;
        delete params._stackTrace;
        fixParamsForModel(params, modelType);
        try {
            const result = await API.post(`${urlPrefix}?token=${session.token}`, params);
            if (result.isLoaded) {
                res.json(result.data);
                return
            }
            res.json(false);
            return
        } catch (e) {
            res.status(500).json(false);
            return
        }
    }))

    const def = modelType.getObjectFieldsDefinition()
    
    const params = Object.keys(def).filter(key => def[key].autogenerate == false).map((key) => {
        return {
            [key]: def[key].description + " (" + def[key].type + ")" + (def[key].isId ? " (this will be used as the id of the element)" : "")
        }
    }).reduce((acc, val) => ({ ...acc, ...val }), {});

    await context.actions.add({
        group: 'storages',
        name: 'create',
        url: actionUrlPrefix + '/create',
        tag: modelName,
        description: `Creates new ${modelName} given an object with the data. Returns the id of the new ${modelName}.`,
        params: params,
        token: getServiceToken(),
        method: 'post'
    })

    // Add create card
    const createCard = getCard('create');
    if (createCard) {
        await context.cards.add({ ...createCard, token: getServiceToken() });
    }

    //delete
    context.events.onEvent(
        context.mqtt,
        context,
        async (event) => {
            loadTotal();
            context.state.set({ group: 'storages', tag: modelName, name: 'lastDeleteddId', value: event?.payload?.id });
        },
        notiName + "/delete/#"
    )
    app.get(actionUrlPrefix + '/delete', handler(async (req, res, session) => {
        const params = req.query;
        const id = params.id;
        try {
            const result = await API.get(`${urlPrefix}/${id}/delete?token=${session.token}`);
            if (result.isLoaded) {
                res.json(true);
                return
            }
            res.json(false);
            return
        } catch (e) {
            res.status(500).json(false);
            return
        }
    }))

    await context.actions.add({
        group: 'storages',
        name: 'delete',
        url: actionUrlPrefix + '/delete',
        tag: modelName,
        description: `Deletes ${modelName} given an id. Returns true if it was deleted, false otherwise.`,
        params: { id: "id of the " + modelName + " to delete" },
        token: getServiceToken()
    })

    // Add delete card
    const deleteCard = getCard('delete');
    if (deleteCard) {
        await context.cards.add({ ...deleteCard, token: getServiceToken() });
    }

    //update
    app.get(actionUrlPrefix + '/update', handler(async (req, res, session) => {
        const params = req.query;
        delete params._stackTrace;
        fixParamsForUpdate(params, modelType);
        const id = params.id;
        const field: any = params.field;
        const value = params.value;
        try {
            const result = await API.get(`${urlPrefix}/${id}?token=${params.token ? params.token : session.token}`);
            if (result.isLoaded) {
                const data = result.data;
                data[field] = value;
                const resultUpdate = await API.post(`${urlPrefix}/${id}?token=${params.token ? params.token : session.token}`, data);
                if (resultUpdate.isLoaded) {
                    res.json(resultUpdate.data);
                    return
                }
            }
        } catch (e) {
            res.status(500).json(false);
            return
        }
    }))

    const updateParams = {
        id: `id of the ${modelName} to update`,
        field: `field to update in the ${modelName}. Possible fields: ${Object.keys(def).join(", ")}`,
        value: `new value for the field`
    }

    await context.actions.add({
        group: 'storages',
        name: 'update',
        url: actionUrlPrefix + '/update',
        tag: modelName,
        description: `Updates ${modelName} by id, changing field with a given value. Returns the updated ${modelName} if it was updated, false otherwise.`,
        params: updateParams,
        token: getServiceToken(),
    })

    // Add update card
    const updateCard = getCard('update');
    if (updateCard) {
        await context.cards.add({ ...updateCard, token: getServiceToken() });
    }

    context.events.onEvent(
        context.mqtt,
        context,
        async (event) => {
            loadTotal();
            context.state.set({ group: 'storages', tag: modelName, name: 'lastCreated', value: event?.payload?.data });
            context.state.set({ group: 'storages', tag: modelName, name: 'lastCreatedMetadata', value: event });
            context.state.set({ group: 'storages', tag: modelName, name: 'lastCreatedId', value: event?.payload?.id });
        },
        notiName + "/create/#"
    )

    // Add lastCreated card
    const lastCreatedCard = getCard('lastCreated');
    if (lastCreatedCard) {
        context.cards.add({ ...lastCreatedCard, token: getServiceToken() });
    }

    context.events.onEvent(
        context.mqtt,
        context,
        async (event) => {
            context.state.set({ group: 'storages', tag: modelName, name: 'lastUpdated', value: event?.payload?.data });
            context.state.set({ group: 'storages', tag: modelName, name: 'lastUpdatedMetadata', value: event });
            context.state.set({ group: 'storages', tag: modelName, name: 'lastUpdatedId', value: event?.payload?.id });
        },
        notiName + "/update/#"
    )

    // Add lastUpdated card
    const lastUpdatedCard = getCard('lastUpdated');
    if (lastUpdatedCard) {
        context.cards.add({ ...lastUpdatedCard, token: getServiceToken() });
    }

    // Add totalItems card
    const totalItemsCard = getCard('totalItems');
    if (totalItemsCard) {
        context.cards.add({ ...totalItemsCard, token: getServiceToken() });
    }

    app.get(actionUrlPrefix + '/list', handler(async (req, res, session) => {
        const params = req.query;
        const itemsPerPage = params.itemsPerPage;
        const page = params.page
        const search = params.search;
        const orderBy = params.orderBy;
        const orderDirection = params.orderDirection;
        const mode = params.mode || 'normal';

        const finalUrl = `${urlPrefix}?token=${session.token}&${itemsPerPage ? `itemsPerPage=${itemsPerPage}` : ''}${page ? `&page=${page}` : ''}${search ? `&search=${search}` : ''}${orderBy ? `&orderBy=${orderBy}` : ''}${orderDirection ? `&orderDirection=${orderDirection}` : ''}${mode ? `&mode=${mode}` : ''}`;
        try {
            const result = await API.get(finalUrl);
            if (result.isLoaded) {
                res.json(result.data.items);
                return
            }
            res.json(false);
            return
        } catch (e) {
            res.status(500).json(false);
            return
        }
    }))

    await context.actions.add({
        group: 'storages',
        name: 'list',
        url: actionUrlPrefix + '/list',
        tag: modelName,
        description: `Returns a list of ${modelName} objects. You can filter the results by passing itemsPerPage, page, search, orderBy and orderDirection parameters.`,
        params: {
            itemsPerPage: 'number of items per page (optional)',
            page: 'page number to retrieve (optional)',
            search: 'search term to filter the results (optional)',
            orderBy: 'field to order the results by (optional)',
            orderDirection: 'direction to order the results by (asc or desc) (optional)'
        },
        token: getServiceToken(),
    })

    // Add list card
    const listCard = getCard('list');
    if (listCard) {
        await context.cards.add({ ...listCard, token: getServiceToken() });
    }

    // Add search card
    const searchCard = getCard('search');
    if (searchCard) {
        await context.cards.add({ ...searchCard, token: getServiceToken() });
    }
}