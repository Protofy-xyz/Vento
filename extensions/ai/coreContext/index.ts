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

function objectToXML(obj, rootName = 'root', options: any = {}) {
    const {
        indent = '  ',  // 2 spaces by default for better compatibility
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

/**
 * Convert an object to semantic HTML - great for LLMs and visual debugging
 * Uses dark-first colors that work in both themes
 */
function objectToHTML(obj, rootName = 'root', options: any = {}) {
    const {
        parseJsonStrings = true,
        styles = true  // include inline styles for visual debugging
    } = options;

    // Dark-first color palette (works in dark mode, acceptable in light)
    const colors = {
        bg: '#1c1c1e',
        bgAlt: '#2c2c2e',
        text: '#e5e5e7',
        textMuted: '#98989d',
        textBold: '#ffffff',
        border: '#3a3a3c',
        accent: '#0a84ff',
        accentBg: '#1a3a5c'
    };

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function maybeParseJson(value) {
        if (!parseJsonStrings || typeof value !== 'string') return value;
        const s = value.trim();
        if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
            try { return JSON.parse(s); } catch { }
        }
        return value;
    }

    function formatKey(key) {
        // Convert snake_case to Title Case
        return String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    function convert(value, key = null, isArrayItem = false) {
        value = maybeParseJson(value);

        if (value === null || value === undefined) {
            return key ? `<div><strong>${formatKey(key)}:</strong> <em style="color:${colors.textMuted};">empty</em></div>` : `<em style="color:${colors.textMuted};">empty</em>`;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return key ? `<div><strong>${formatKey(key)}:</strong> <em style="color:${colors.textMuted};">empty list</em></div>` : `<em style="color:${colors.textMuted};">empty list</em>`;
            }
            const items = value.map((item, i) => `<li style="margin:4px 0;">${convert(item, null, true)}</li>`).join('\n');
            const list = `<ul style="margin:4px 0;padding-left:20px;list-style:disc;">\n${items}\n</ul>`;
            return key ? `<details open style="margin:8px 0;"><summary style="cursor:pointer;font-weight:600;color:${colors.textBold};">${formatKey(key)} <span style="color:${colors.textMuted};font-weight:normal;">(${value.length})</span></summary>${list}</details>` : list;
        }

        if (typeof value === 'object') {
            const entries = Object.entries(value);
            if (entries.length === 0) {
                return key ? `<div><strong>${formatKey(key)}:</strong> <em style="color:${colors.textMuted};">empty</em></div>` : `<em style="color:${colors.textMuted};">empty</em>`;
            }
            
            const dlItems = entries.map(([k, v]) => {
                const rendered = convert(v, null, false);
                // If it's a simple value, use inline style
                if (typeof v !== 'object' || v === null) {
                    return `<div style="margin:4px 0;padding:2px 0;"><strong style="color:${colors.text};">${formatKey(k)}:</strong> ${rendered}</div>`;
                }
                // For nested objects/arrays, use details
                return convert(v, k, false);
            }).join('\n');
            
            if (key) {
                return `<details open style="margin:8px 0;border-left:2px solid ${colors.border};padding-left:12px;"><summary style="cursor:pointer;font-weight:600;color:${colors.textBold};">${formatKey(key)}</summary>\n${dlItems}\n</details>`;
            }
            return dlItems;
        }

        // Primitive value
        const strVal = escapeHtml(String(value));
        // Truncate very long strings for display
        const displayVal = strVal.length > 300 ? strVal.slice(0, 300) + '...' : strVal;
        return `<span style="color:${colors.accent};">${displayVal}</span>`;
    }

    const content = convert(obj);
    const containerStyle = styles ? ` style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.6;padding:16px;background:${colors.bg};color:${colors.text};border-radius:12px;border:1px solid ${colors.border};overflow:auto;"` : '';
    
    return `<section${containerStyle}>\n<h3 style="margin:0 0 12px 0;color:${colors.textBold};border-bottom:1px solid ${colors.border};padding-bottom:8px;font-size:15px;">${formatKey(rootName)}</h3>\n${content}\n</section>`;
}

/**
 * Create a simple HTML box with dark-first styling
 */
function htmlBox(content, title = null, options: any = {}) {
    const { accent = false } = options;
    
    const colors = {
        bg: accent ? '#1a3a5c' : '#1c1c1e',
        text: '#e5e5e7',
        textBold: '#ffffff',
        border: accent ? '#0a84ff' : '#3a3a3c'
    };
    
    const titleHtml = title ? `<h3 style="margin:0 0 12px 0;color:${colors.textBold};border-bottom:1px solid ${colors.border};padding-bottom:8px;font-size:15px;">${title}</h3>\n` : '';
    
    return `<section style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.6;padding:16px;background:${colors.bg};color:${colors.text};border-radius:12px;border:1px solid ${colors.border};overflow:auto;margin:8px 0;">\n${titleHtml}${content}\n</section>`;
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
    objectToXML,
    objectToHTML,
    htmlBox
};
