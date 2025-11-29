import { getServiceToken } from "protonode";

export const getExecuteAction = (actions, board, states) => `
const actions = ${JSON.stringify(actions)}
async function execute_action(url_or_name, params={}) {
    console.log('Executing action from getExecuteAction.ts:', url_or_name, params);
    const action = actions.find(a => a.url === url_or_name || (a.name === url_or_name && a.path == '/boards/${board}/' + a.name));
    if (!action) {
        console.error('Action not found: ', url_or_name);
        return;
    }

    console.log('Action: ', action)

    if(action.receiveBoard) {
        params.board = '${board}'
    }
    //check if the action has configParams and if it does, check if the param is visible
    //if the param is not visible, hardcode the param value to the value in the configParams defaultValue
    if(action.configParams) {
        for(const param in action.configParams) {
            if(action.configParams[param].defaultValue && (params[param] === undefined || action.configParams[param].visible === false)) {
                if(typeof action.configParams[param].defaultValue === 'string' && action.configParams[param].defaultValue.startsWith('board.')) {
                    const stateName = action.configParams[param].defaultValue.substring(6);
                    // console.log('looking in: ', states, ' for state: ', stateName);
                    if(states[stateName] && states[stateName] !== undefined) {
                        params[param] = states[stateName];
                    } else {
                        console.warn('State ' + stateName + ' not found in board ' + context.boardId);
                    }
                } else {
                    params[param] = action.configParams[param].defaultValue;
                }
            }
        }
    }
    params._stackTrace = JSON.stringify(stackTrace);
    if (action.method === 'post') {
        let { token, ...data } = params;
        if(action.token) {
            token = action.token
        }
        const url = action.url+'?token='+(token ? token : '${getServiceToken()}')
        console.log('url: ', url)
        const response = await API.post(url, data);
        if (response.isError) {
            throw new Error(JSON.stringify(response.error || 'Error executing action'));
        }             
        return response.data
    } else {
        // Resolve token
        var token = params && params.token;
        if (action.token) token = action.token;
        if (!token) token = '${getServiceToken()}';

        // Clone params and drop token so we don't include it twice
        var rest = {};
        if (params && typeof params === 'object') {
            for (var k in params) {
            if (Object.prototype.hasOwnProperty.call(params, k) && k !== 'token') {
                rest[k] = params[k];
            }
            }
        }

        // Normalize values for GET: objects/arrays -> JSON, Date -> ISO, others -> string
        var entries = Object.keys(rest)
            .filter(function (k) { return rest[k] !== undefined; })
            .map(function (k) {
            var v = rest[k];
            var out;
            if (v && typeof v === 'object') {
                if (v instanceof Date) out = v.toISOString();
                else out = JSON.stringify(v);
            } else {
                out = String(v);
            }
            return [k, out];
            });

        var paramsStr = entries
            .map(function (pair) {
            return pair[0] + '=' + encodeURIComponent(pair[1]);
            })
            .join('&');

        var url = action.url + '?token=' + encodeURIComponent(token) + (paramsStr ? '&' + paramsStr : '');

        var response = await API.get(url);
        if (response.isError) {
            throw new Error(JSON.stringify(response.error || 'Error executing action'));
        }
        return response.data
    }
}
async function executeAction({name, params = {}}) {
    return execute_action(name, params);
}
`