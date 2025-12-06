import { API, getServiceToken } from "protobase";

/**
 * Call the default LLM agent with a prompt (simple version)
 */
export const callModel = async (prompt: string) => {
    const res = await API.post("/api/agents/v1/llm_agent/agent_input?token=" + getServiceToken(), {
        prompt
    });
    return res.data;
};

/**
 * Simple prompt function similar to context.chatgpt.prompt
 * Returns the response directly (string)
 */
export const prompt = async (options: {
    message: string;
    conversation?: any[];
    images?: any[];
    files?: any[];
    model?: string;
    done?: (result: any) => void;
    error?: (err: any) => void;
}) => {
    const {
        message,
        conversation = [],
        images = [],
        files = [],
        model,
        done = () => { },
        error = () => { }
    } = options;

    try {
        const res = await API.post("/api/agents/v1/llm_agent/agent_input?token=" + getServiceToken(), {
            message,
            conversation,
            images,
            files,
            model
        });

        const response = res.data;

        // Extract the actual response text
        let result = response;
        if (response?.reply?.choices?.[0]?.message?.content) {
            result = response.reply.choices[0].message.content;
        } else if (response?.reply) {
            result = response.reply;
        }

        done(result);
        return result;
    } catch (err: any) {
        error(err?.message || err);
        return { isError: true, data: { error: { message: err?.message || 'LLM error' } } };
    }
};

/**
 * Generate a system prompt message structure
 */
export const getSystemPrompt = (options: {
    prompt: string;
    done?: (result: any) => any;
    error?: (e: any) => any;
}) => {
    const { prompt, done = async (p) => p, error = (e) => e } = options;

    const result = [
        {
            role: "system",
            content: [
                {
                    type: "text",
                    text: prompt,
                },
            ],
        },
    ];

    done(result);
    return result;
};

/**
 * Clean code from markdown code blocks
 */
export const cleanCode = (code: string): string => {
    // Remove ```(plus anything that's not a space) from the beginning
    // Remove ``` from the end
    let cleaned = code.replace(/^```[^\s]+/g, '').replace(/```/g, '').trim();

    // Remove 'javascript' from the beginning if it exists
    if (cleaned.startsWith('javascript')) {
        cleaned = cleaned.replace('javascript', '').trim();
    }

    return cleaned;
};

/**
 * Process an agent response with actions
 */
export const processAgentResponse = async (options: {
    response: string | { choices: { message: { content: string; } }[] };
    execute_action: (name: string, params: any) => Promise<any>;
    done?: (result: any) => Promise<any>;
    error?: (e: any) => any;
}) => {
    let {
        response,
        execute_action,
        done = async (v) => v,
        error = (e) => e
    } = options;

    if (!response) return null;
    if (!execute_action) return null;

    if (typeof response === 'object' && 'choices' in response && response?.choices?.[0]?.message?.content) {
        response = response.choices[0].message.content;
    }

    try {
        let parsedResponse: any;
        const executedActions: any[] = [];
        const approvals: any[] = [];
        try {
            parsedResponse = JSON.parse(
                response
                    .replace(/^```[\w]*\n?/, '')
                    .replace(/```$/, '')
                    .trim()
            );

        } catch (e) {
            return await done({
                response: response ?? "",
                executedActions,
                approvals,
            });

        }

        for (const action of parsedResponse.actions || []) {
            if (!action || !action.name) continue;

            const params = action.params || {};
            const result = await execute_action(action.name, params);

            executedActions.push({
                name: action.name,
                params,
                result,
            });

            if (result && typeof result === "object" && result.offered === true && result.approvalId) {
                const boardId = result.boardId;
                const actionName = result.action || action.name;
                const approvalId = result.approvalId;
                const message = result.message;

                let urls: any = undefined;
                if (boardId && actionName && approvalId) {
                    const base = `/api/core/v1/boards/${boardId}/actions/${actionName}/approvals/${approvalId}`;
                    urls = {
                        accept: `${base}/accept`,
                        reject: `${base}/reject`,
                        status: `${base}/status`,
                    };
                }

                approvals.push({
                    boardId,
                    action: actionName,
                    approvalId,
                    id: approvalId,
                    message,
                    params,
                    urls,
                });
            }
        }

        return await done({
            response: parsedResponse.response ?? "",
            executedActions,
            approvals,
        });
    } catch (e) {
        console.error({ error: e }, 'Error in processAgentResponse');
        return error(e);
    }
};

function objectToXML(obj, rootName = 'root', options = {}) {
    const {
        indent = '\t',
        arrayItemNameOverrides = {
            board_actions: 'board_action',
            history: 'message', // ex. <history><message>...</message></history>
            actions: 'action'
        },
        parseJsonStrings = true
    } = options;

    function escapeXml(str) {
        return String(str).replace(/[<>&]/g, c => ({
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;'
        }[c]));
    }

    function maybeParseJson(value) {
        if (!parseJsonStrings || typeof value !== 'string') return value;
        const s = value.trim();
        if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
            try { return JSON.parse(s); } catch { }
        }
        return value;
    }

    function itemTagFor(parentKey) {
        if (arrayItemNameOverrides && arrayItemNameOverrides[parentKey]) {
            return arrayItemNameOverrides[parentKey];
        }

        if (typeof parentKey === 'string') {
            if (parentKey.endsWith('ies')) return parentKey.slice(0, -3) + 'y';
            if (parentKey.endsWith('s')) return parentKey.slice(0, -1);
        }
        return 'item';
    }

    function convert(key, value, level) {
        value = maybeParseJson(value);

        const pad = indent.repeat(level);
        const padInner = indent.repeat(level + 1);

        if (value === null || value === undefined) {
            return `${pad}<${key}></${key}>\n`;
        }

        if (Array.isArray(value)) {
            const itemTag = itemTagFor(key);
            const children = value.map(item => convert(itemTag, item, level + 1)).join('');
            return `${pad}<${key}>\n${children}${pad}</${key}>\n`;
        }

        if (typeof value === 'object') {
            const entries = Object.entries(value);
            const children = entries.map(([k, v]) => convert(k, v, level + 1)).join('');
            return `${pad}<${key}>\n${children}${pad}</${key}>\n`;
        }

        return `${pad}<${key}>${escapeXml(value)}</${key}>\n`;
    }

    const rootWrapped = convert(rootName, obj, 0);
    return rootWrapped.trim();
}

// Backwards-compatible alias
export const processResponse = processAgentResponse;

export default {
    callModel,
    prompt,
    getSystemPrompt,
    cleanCode,
    processAgentResponse,
    processResponse,
    objectToXML
};
