import { getBoard } from "./boards";
import { getServiceToken, requireAdmin, resolveBoardParam } from "protonode";
import { API, generateEvent, ProtoMemDB } from "protobase";
import { v4 as uuidv4 } from 'uuid';
import { dbProvider, getDBOptions } from 'protonode';
import { getExecuteAction } from "./getExecuteAction";
import fetch from 'node-fetch';
import { getLogger } from 'protobase';
import { TypeParser } from "./types";

const getBoardCardActions = async (boardId) => {
    const board = await getBoard(boardId);
    if (!board.cards || !Array.isArray(board.cards)) return [];

    const base = board.cards.filter(c => c.type === 'action');
    const result = [...base];

    const isPlainObject = (o) =>
        o && typeof o === 'object' && Object.prototype.toString.call(o) === '[object Object]';

    const deepMerge = (a = {}, b = {}) => {
        if (!isPlainObject(a)) a = {};
        if (!isPlainObject(b)) return b; // si b no es objeto plano, reemplaza
        const out = { ...a };
        for (const k of Object.keys(b)) {
            const av = a[k], bv = b[k];
            if (isPlainObject(av) && isPlainObject(bv)) out[k] = deepMerge(av, bv);
            else if (Array.isArray(bv)) out[k] = bv.slice(); // sustituye arrays; para concatenar: (Array.isArray(av)?av:[]).concat(bv)
            else out[k] = bv;
        }
        return out;
    };

    for (const action of base) {
        const presets = action?.presets;
        if (presets && typeof presets === 'object') {
            for (const [presetKey, preset] of Object.entries(presets)) {
                result.push({
                    ...action,
                    aliasedName: action.name + '.' + presetKey,
                    description: preset?.description ?? action.description,
                    configParams: deepMerge(action.configParams || {}, preset?.configParams || {}),
                });
            }
        }
    }

    return result;
};

const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
const token = getServiceToken()

const executeLinks = async (boardId: string, action: any, type: 'pre' | 'post') => {
    if (!action?.links || !Array.isArray(action.links)) return;
    const links = action.links.filter((t: any) => t.type === type && t.name);
    for (const link of links) {
        try {
            await API.get(`/api/core/v1/boards/${boardId}/actions/${link.name}?token=${getServiceToken()}`);
        } catch (error) {
            getLogger({ module: 'boards', board: boardId, card: action.name }).error({ err: error }, `Error calling ${type} link action: ${link.name}`);
        }
    }
}

export const normalizeRulesCode = (code: string): string => {
    const trimmed = (code || '').trim();
    if (!trimmed) return '';
    return trimmed.startsWith('<')
        ? 'return `' + trimmed.replace(/`/g, '\\`') + '`'
        : trimmed;
}

export const buildActionWrapper = (actions: any, boardId: string, states: any, rulesCode: string) => new AsyncFunction(
    'req', 'res', 'boardName', 'name', 'states', 'boardActions', 'board', 'userParams', 'params', 'token', 'context', 'API', 'fetch', 'logger', 'stackTrace',
    `${getExecuteAction(actions, boardId, states)}\n${rulesCode}`
);

//TODO: refactor to use only protomemdb (state.set) for card state persistance and updates on frontend  (now using .set for persist and state event for updates)
const updateActionStatus = async (context, boardId, actionId, status, payload = {}) => {
    const action = await context.state.get({ chunk: 'actions', group: 'boards', tag: boardId, name: actionId });
    await context.state.set({ chunk: 'actions', group: 'boards', tag: boardId, name: actionId, value: { ...action, status, ...payload } });
};

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

export const setActionValue = async (Manager, context, boardId, action, value) => {
    const prevValue = await context.state.get({ group: 'boards', tag: boardId, name: action.name });
    if (action?.alwaysReportValue || JSON.stringify(value) !== JSON.stringify(prevValue)) {
        await context.state.set({ group: 'boards', tag: boardId, name: action.name, value: value, emitEvent: true });
        Manager.update(`../../data/boards/${boardId}.js`, 'states', action.name, value);
        // Ensure dependent value-cards recompute immediately, not waiting for interval
        try {
            await API.get(`/api/core/v1/boards/${boardId}/reload?token=${token}`)
        } catch (e) {
            getLogger({ module: 'boards', board: boardId, card: action.name }).warn({ err: e }, 'Failed to trigger immediate board reload')
        }
    }
}

export const handleBoardAction = async (context, Manager, req, boardId, action_or_card_id, res, rawParams, rawResponse = false, responseCb = undefined) => {
    const actions = await getBoardCardActions(boardId);
    console.log('Actions for board ', boardId, actions.map(a => a.name))
    //aliasedName allows to call presets directly
    const action = actions.find(a => a.name == action_or_card_id || a.aliasedName === action_or_card_id);
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
            path: `actions/boards/${boardId}/${action.name}/code/error`,
            from: 'system',
            user: 'system',
            ephemeral: true,
            payload: {
                status: 'code_error',
                action: action.name,
                boardId: boardId,
                params,
                msg: "Recursive action call detected",
                stackTrace
            },
        }, getServiceToken());
        await setActionValue(Manager, context, boardId, action, { error: "Recursive action call detected" });
        await updateActionStatus(context, boardId, action.name, 'error', { error: { message: "Recursive action call detected" } });

        getLogger({ module: 'boards', board: boardId, card: action.name }).error({ err: "Recursive action call detected" }, "Error executing card: ");
        res.status(500).send({ _err: "e_code", error: "Error executing action code", message: "Recursive action call detected" });
        return;
    } else {
        stackTrace = [{ name: action?.name, board: boardId }, ...stackTrace];
    }

    if (!action) {
        res.send({ error: "Action not found" });
        return;
    }

    if (!action.rulesCode) {
        res.send({ error: "No code found for action" });
        return;
    }



    if (action.configParams) {
        for (const param in action.configParams) {
            params[param] = await resolveBoardParam({
                states: await context.state.getStateTree(),
                boardId,
                defaultValue: action.configParams[param]?.defaultValue,
                value: params[param],
                type: action.configParams[param]?.type
            });
        }
    }

    try {
        const requestApproval = action?.requestApproval === true 
        const isConfirmedLegacy = params?.confirmed === true || (req.query && (req.confirmed === 'true'));

        if (requestApproval && !isConfirmedLegacy) {
            const approvalId = uuidv4();
            const fullStates = await context.state.getStateTree();
            const boardOnlyStates = {
                ...(fullStates || {}),
                boards: { [boardId]: (fullStates?.boards?.[boardId] ?? {}) }
            };

            const snapshot = {
                statesSnapshot: boardOnlyStates,
                cardSnapshot: action,
                paramsSnapshot: params,
                meta: {
                    boardId,
                    actionName: action.name,
                    createdAt: new Date().toISOString(),
                    requestedBy: (req as any)?.session?.user?.email || (req as any)?.session?.user?.name || 'system',
                    status: 'offered'
                }
            };

            // store snapshot under approvals/{boardId}/{approvalId}
            ProtoMemDB('approvals').set('approvals', boardId, approvalId, snapshot);

            // notify via MQTT event
            await generateEvent({
                path: `actions/approval/${boardId}/${action.name}/${approvalId}`,
                from: 'system',
                user: 'system',
                ephemeral: true,
                payload: {
                    status: 'offered',
                    action: action.name,
                    boardId,
                    approvalId,
                    params,
                    message: action.approvalMessage || undefined
                },
            }, getServiceToken());

            // execute pre and post-links immediately (no rules executed here)
            await executeLinks(boardId, action, 'pre');
            await executeLinks(boardId, action, 'post');

            // update action state and respond
            // await setActionValue(Manager, context, boardId, action, { approvalId, message: 'Notified user' });
            await updateActionStatus(context, boardId, action.name, 'offered');
            res.status(202).send({
                offered: true,
                approvalId,
                boardId,
                action: action.name,
                message: action.approvalMessage || undefined,
            });
            return;
        }
    } catch (e) {
        console.error("Error handling approval offer: ", e);
    }

    await generateEvent({
        path: `actions/boards/${boardId}/${action.name}/run`,
        from: 'system',
        user: 'system',
        ephemeral: true,
        payload: {
            status: 'running',
            action: action.name,
            boardId: boardId,
            params,
            stackTrace
        },
    }, getServiceToken());
    await updateActionStatus(context, boardId, action.name, 'running');

    const states = await context.state.getStateTree();
    let rulesCode = normalizeRulesCode(action.rulesCode);
    const wrapper = buildActionWrapper(await getActions(context), boardId, states, rulesCode);

    try {
        await executeLinks(boardId, action, 'pre');
        let response = null;
        let failed = false;
        try {
            response = await wrapper(req, res, boardId, action.name, states, actions, states?.boards?.[boardId] ?? {}, params, params, token, context, API, fetch, getLogger({ module: 'boards', board: boardId, card: action.name }), stackTrace);
            response = action.returnType && typeof TypeParser?.[action.returnType] === "function"
                ? TypeParser?.[action.returnType](response, action.enableReturnCustomFallback, action.fallbackValue)
                : response
            getLogger({ module: 'boards', board: boardId, card: action.name }).info({ value: response, stackTrace }, "New value for card: " + action.name);
        } catch (err) {
            await generateEvent({
                path: `actions/boards/${boardId}/${action.name}/code/error`,
                from: 'system',
                user: 'system',
                ephemeral: true,
                payload: {
                    status: 'code_error',
                    action: action.name,
                    boardId: boardId,
                    params,
                    stack: err.stack,
                    message: err.message,
                    name: err.name,
                    code: err.code,
                    stackTrace
                },
            }, getServiceToken());

            await setActionValue(Manager, context, boardId, action, { error: err });
            await updateActionStatus(context, boardId, action.name, 'error', { error: err });


            getLogger({ module: 'boards', board: boardId, card: action.name }).error({ err }, "Error executing card: ");
            res.status(500).send({ _err: "e_code", error: "Error executing action code", message: err.message, stack: err.stack, stackTrace, name: err.name, code: err.code });
            failed = true;
        }

        if (!failed) {
            if (action.responseKey && response && typeof response === 'object' && action.responseKey in response) {
                response = response[action.responseKey];
            }

            await setActionValue(Manager, context, boardId, action, response);

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
                path: `actions/boards/${boardId}/${action.name}/done`,
                from: 'system',
                user: 'system',
                ephemeral: true,
                payload: {
                    status: 'done',
                    action: action.name,
                    boardId: boardId,
                    params,
                    response,
                    stackTrace
                },
            }, getServiceToken());
            await updateActionStatus(context, boardId, action.name, 'idle');

            // if persistValue is true
            if (action.persistValue) {
                const db = dbProvider.getDB('board_' + boardId);
                await db.put(action.name, response === undefined ? '' : JSON.stringify(response, null, 4));
            }
        }

        await executeLinks(boardId, action, 'post');


    } catch (err) {
        await generateEvent({
            path: `actions/boards/${boardId}/${action.name}/error`,
            from: 'system',
            user: 'system',
            ephemeral: true,
            payload: {
                status: 'error',
                action: action.name,
                boardId: boardId,
                params,
                stack: err.stack,
                message: err.message,
                name: err.name,
                code: err.code,
                stackTrace
            },
        }, getServiceToken());
        await setActionValue(Manager, context, boardId, action, { error: err });
        await updateActionStatus(context, boardId, action.name, 'error', { error: err });
        console.error("Error executing action: ", err);
        res.status(500).send({ _err: "e_general", error: "Error executing action", message: err.message, stack: err.stack, name: err.name, code: err.code });
    }
};
