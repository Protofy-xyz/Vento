import { API, getServiceToken } from "protobase";

const callModel = async (prompt) => {
    const res = await API.post("/api/agents/v1/llm_agent/agent_input?token=" + getServiceToken(), {
        prompt
    })

    return res.data
}

const cleanCode = (code) => {
    //remove ```(plus anything is not an space) from the beginning of the code
    //remove ``` from the end of the code
    let cleaned = code.replace(/^```[^\s]+/g, '').replace(/```/g, '').trim()
    //remove 'javascript' from the beginning of the code if it exists
    if (cleaned.startsWith('javascript')) {
        cleaned = cleaned.replace('javascript', '').trim()
    }
    return cleaned
}

export const processAgentResponse = async ({ response, execute_action, done = async (v) => v, error = (e) => e }) => {
    if (!response) return null;
    if (!execute_action) return null;

    try {
        const parsedResponse = JSON.parse(
            response
                .replace(/^```[\w]*\n?/, '')
                .replace(/```$/, '')
                .trim()
        );
        const executedActions = [];
        const approvals = [];
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
                const boardId = result.boardId
                const actionName = result.action || action.name;
                const approvalId = result.approvalId;
                const message = result.message;

                let urls = undefined;
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

export const ai = {
    callModel: async (prompt) => {
        return await callModel(prompt)
    },
    cleanCode: (code) => {
        return cleanCode(code)
    }
} 