/**
 * COT Card Masks
 * Funciones para procesar y transformar datos de las cards COT
 */

// Mask para procesar la respuesta de orquestación
export const processOrchestrationResponse = (response: any) => {
    if (!response) return null;
    
    return {
        response: response.finalResponse || response.response,
        reasoning: response.reasoning,
        agents: response.selectedAgents || [],
        actions: response.actions || [],
        confidence: response.reasoning?.confidence || 0,
        iterations: response.iterations || 0,
        time: response.totalTime || 0
    };
};

// Mask para procesar la respuesta de razonamiento
export const processReasoningResponse = (response: any) => {
    if (!response) return null;
    
    return {
        conclusion: response.conclusion,
        steps: response.steps || [],
        confidence: response.confidence || 0,
        suggestedActions: response.suggestedActions || [],
        fullReasoning: response.reasoning
    };
};

// Mask para formatear el contexto empaquetado
export const formatPackedContext = (packed: any) => {
    if (!packed) return '';
    
    const parts: string[] = [];
    
    // Agrupar chunks por fuente
    const bySource = new Map<string, any[]>();
    for (const chunk of packed.chunks || []) {
        const key = chunk.sourcePath || chunk.sourceId;
        if (!bySource.has(key)) {
            bySource.set(key, []);
        }
        bySource.get(key)!.push(chunk);
    }
    
    // Generar texto formateado
    for (const [sourcePath, chunks] of bySource) {
        parts.push(`\n### ${sourcePath}\n`);
        
        for (const chunk of chunks) {
            if (chunk.startLine && chunk.endLine) {
                parts.push(`<!-- Lines ${chunk.startLine}-${chunk.endLine} -->`);
            }
            parts.push(chunk.content);
        }
    }
    
    return parts.join('\n');
};

// Mask para el historial de conversaciones
export const formatConversationHistory = (history: any[]) => {
    if (!history || history.length === 0) return [];
    
    return history.map(item => ({
        id: item.id,
        query: item.query,
        response: item.response,
        timestamp: item.timestamp,
        formattedTime: item.timestamp 
            ? new Date(item.timestamp).toLocaleString() 
            : 'Unknown'
    }));
};

// Mask para estadísticas del agente
export const getAgentStats = (boardState: any) => {
    const input = boardState?.cot_input || {};
    const process = boardState?.cot_process || {};
    const history = input?.history || [];
    
    return {
        isProcessing: !!input?.current,
        queueLength: (input?.items || []).length,
        historyLength: history.length,
        lastProcessTime: process?.time_ms || 0,
        averageConfidence: history.length > 0
            ? history.reduce((sum: number, h: any) => sum + (h.confidence || 0), 0) / history.length
            : 0
    };
};

export default {
    processOrchestrationResponse,
    processReasoningResponse,
    formatPackedContext,
    formatConversationHistory,
    getAgentStats
};

