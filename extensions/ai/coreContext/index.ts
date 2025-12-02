import { API, getServiceToken } from "protobase";

/**
 * Call the default LLM agent with a prompt
 */
export const callModel = async (prompt: string) => {
    const res = await API.post("/api/agents/v1/llm_agent/agent_input?token=" + getServiceToken(), {
        prompt
    });
    return res.data;
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
    response: string;
    execute_action: (name: string, params: any) => Promise<any>;
    done?: (result: any) => Promise<any>;
    error?: (e: any) => any;
}) => {
    const { 
        response, 
        execute_action, 
        done = async (v) => v, 
        error = (e) => e 
    } = options;
    
    if (!response) return null;
    if (!execute_action) return null;

    try {
        const parsedResponse = JSON.parse(
            response
                .replace(/^```[\w]*\n?/, '')
                .replace(/```$/, '')
                .trim()
        );
        
        const executedActions: any[] = [];
        const approvals: any[] = [];
        
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
        return error(e);
    }
};

// Backwards-compatible alias
export const processResponse = processAgentResponse;

export default {
    callModel,
    getSystemPrompt,
    cleanCode,
    processAgentResponse,
    processResponse
};

