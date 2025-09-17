import { getBoard } from "./boards";
import { getServiceToken, requireAdmin } from "protonode";
import { API, generateEvent } from "protobase";
import { dbProvider, getDBOptions } from 'protonode';
import { getExecuteAction } from "./getExecuteAction";
import fetch from 'node-fetch';
import { getLogger } from 'protobase';

const getBoardCardActions = async (boardId) => {
    const board = await getBoard(boardId);
    if (!board.cards || !Array.isArray(board.cards)) {
        return [];
    }
    return board.cards.filter(c => c.type === 'action');
}
const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
const token = getServiceToken()

export const getActions = async (context) => {
    const actions = await context.state.getStateTree({ chunk: 'actions' });
    const flatActions = []
    const flatten = (obj, path) => {
        if (obj.url) {
            flatActions.push({ ...obj, path: path })
        } else {
            for (const key in obj) {
                flatten(obj[key], path + '/' + key)
            }
        }
    }
    flatten(actions, '')
    return flatActions
}

function toPath(path) {
    return path
        .replace(/\?\./g, ".")           // remove optional chaining
        .replace(/\[(["']?)(.*?)\1\]/g, ".$2") // convert [x] or ["x"] into .x
        .split(".")
        .filter(Boolean);
}

function getByPath(obj, path, def?) {
    return toPath(path).reduce((acc, key) => acc?.[key], obj) ?? def;
}

const castValueToType = (value, type, boardStates) => {
    switch (type) {
        case 'string':
            return String(value);
        case 'number':
            return Number(value);
        case 'boolean':
            return value === 'true' || value === true;
        case 'json':
            try {
                return JSON.parse(value);
            } catch (e) {
                return {};
            }
        case 'array':
            try {
                return JSON.parse(value);
            } catch (e) {
                return [];
            }
        case 'card':
            return value; // Assuming card is a string identifier
        case 'text':
            return value; // Assuming markdown is a string
        case "state":
            return JSON.stringify(getByPath(boardStates, value))
        default:
            return value; // Default case, return as is
    }
}

export const handleBoardAction = async (context, Manager, boardId, action_or_card_id, res, rawParams, rawResponse = false, responseCb = undefined) => {
    const actions = await getBoardCardActions(boardId);
    const action = actions.find(a => a.name === action_or_card_id);
    const { _stackTrace, ...params } = rawParams;
    let stackTrace
    try {
        stackTrace = _stackTrace ? JSON.parse(_stackTrace) : [];
        if (!Array.isArray(stackTrace)) {
            stackTrace = [];
        }
    } catch (error) {
        stackTrace = [];
    }
    if (stackTrace.find((item) => item.name === action.name && item.board === boardId)) {
        await generateEvent({
            path: `actions/boards/${boardId}/${action_or_card_id}/code/error`,
            from: 'system',
            user: 'system',
            ephemeral: true,
            payload: {
                status: 'code_error',
                action: action_or_card_id,
                boardId: boardId,
                params,
                msg: "Recursive action call detected",
                stackTrace
            },
        }, getServiceToken());

        getLogger({ module: 'boards', board: boardId, card: action.name }).error({ err: "Recursive action call detected" }, "Error executing card: ");
        res.status(500).send({ _err: "e_code", error: "Error executing action code", message: "Recursive action call detected" });
        return;
    } else {
        stackTrace = [{ name: action.name, board: boardId }, ...stackTrace];
    }

    if (!action) {
        res.send({ error: "Action not found" });
        return;
    }

    if (!action.rulesCode) {
        res.send({ error: "No code found for action" });
        return;
    }


    //cast params to each param type
    for (const param in params) {
        if (action.configParams && action.configParams[param]) {
            // si action.configParams[param] es tipo string y empieza por board. cogemos el valor del state del board
            if (typeof action.configParams[param].defaultValue === 'string' && action.configParams[param].defaultValue.startsWith('board.')) {
                const stateName = action.configParams[param].defaultValue.substring(6);
                const states = await context.state.getStateTree();
                if (states?.boards?.[boardId] && states.boards[boardId][stateName] !== undefined) {
                    params[param] = states.boards[boardId][stateName];
                } else {
                    console.warn('State ' + stateName + ' not found in board ' + boardId);
                }
            }
            const type = action.configParams[param]?.type;
            if (type) {
                const states = await context.state.getStateTree();
                const boardsStates = { board: states?.boards?.[boardId] ?? {} };
                params[param] = castValueToType(params[param], type, boardsStates);
            }
        }
    }

    await generateEvent({
        path: `actions/boards/${boardId}/${action_or_card_id}/run`,
        from: 'system',
        user: 'system',
        ephemeral: true,
        payload: {
            status: 'running',
            action: action_or_card_id,
            boardId: boardId,
            params,
            stackTrace
        },
    }, getServiceToken());

    const states = await context.state.getStateTree();
    let rulesCode = action.rulesCode.trim();

    if (rulesCode.startsWith('<')) {
        rulesCode = 'return `' + rulesCode.replace(/`/g, '\\`') + '`';
    }

    const wrapper = new AsyncFunction('boardName', 'name', 'states', 'boardActions', 'board', 'userParams', 'params', 'token', 'context', 'API', 'fetch', 'logger', 'stackTrace', `
        ${getExecuteAction(await getActions(context), boardId)}
        ${rulesCode}
    `);

    try {
        let response = null;
        try {
            response = await wrapper(boardId, action_or_card_id, states, actions, states?.boards?.[boardId] ?? {}, params, params, token, context, API, fetch, getLogger({ module: 'boards', board: boardId, card: action.name }), stackTrace);
            getLogger({ module: 'boards', board: boardId, card: action.name }).info({ value: response, stackTrace }, "New value for card: " + action.name);
        } catch (err) {
            await generateEvent({
                path: `actions/boards/${boardId}/${action_or_card_id}/code/error`,
                from: 'system',
                user: 'system',
                ephemeral: true,
                payload: {
                    status: 'code_error',
                    action: action_or_card_id,
                    boardId: boardId,
                    params,
                    stack: err.stack,
                    message: err.message,
                    name: err.name,
                    code: err.code,
                    stackTrace
                },
            }, getServiceToken());

            getLogger({ module: 'boards', board: boardId, card: action.name }).error({ err }, "Error executing card: ");
            res.status(500).send({ _err: "e_code", error: "Error executing action code", message: err.message, stack: err.stack, stackTrace, name: err.name, code: err.code });
            return;
        }

        if (action.responseKey && response && typeof response === 'object' && action.responseKey in response) {
            response = response[action.responseKey];
        }

        const prevValue = await context.state.get({ group: 'boards', tag: boardId, name: action.name });
        if (action?.alwaysReportValue || JSON.stringify(response) !== JSON.stringify(prevValue)) {
            await context.state.set({ group: 'boards', tag: boardId, name: action.name, value: response, emitEvent: true });
            Manager.update(`../../data/boards/${boardId}.js`, 'states', action.name, response);
        }

        if (responseCb) {
            responseCb(response);
        } else {
            if (rawResponse) {
                res.send(response);
            } else {
                res.json(response);
            }
        }


        await generateEvent({
            path: `actions/boards/${boardId}/${action_or_card_id}/done`,
            from: 'system',
            user: 'system',
            ephemeral: true,
            payload: {
                status: 'done',
                action: action_or_card_id,
                boardId: boardId,
                params,
                response,
                stackTrace
            },
        }, getServiceToken());

        // if persistValue is true
        if (action.persistValue) {
            const db = dbProvider.getDB('board_' + boardId);
            await db.put(action.name, response === undefined ? '' : JSON.stringify(response, null, 4));
        }
    } catch (err) {
        await generateEvent({
            path: `actions/boards/${boardId}/${action_or_card_id}/error`,
            from: 'system',
            user: 'system',
            ephemeral: true,
            payload: {
                status: 'error',
                action: action_or_card_id,
                boardId: boardId,
                params,
                stack: err.stack,
                message: err.message,
                name: err.name,
                code: err.code,
                stackTrace
            },
        }, getServiceToken());
        console.error("Error executing action: ", err);
        res.status(500).send({ _err: "e_general", error: "Error executing action", message: err.message, stack: err.stack, name: err.name, code: err.code });
    }
};