import { getLlama, LlamaChatSession, Llama, LlamaModel, LlamaContext } from 'node-llama-cpp';
import { getLogger } from 'protobase';
import { getRoot } from 'protonode';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';

const logger = getLogger();

// Models directory
const getModelsDir = () => path.join(getRoot(), 'data', 'models');

// Singleton instances
let llamaInstance: Llama | null = null;
const loadedModels: Map<string, LlamaModel> = new Map();
const activeContexts: Map<string, LlamaContext> = new Map();
const activeSessions: Map<string, LlamaChatSession> = new Map();

/**
 * Get or create Llama instance
 */
const getLlamaInstance = async (): Promise<Llama> => {
    if (!llamaInstance) {
        llamaInstance = await getLlama();
        logger.info('Llama instance initialized');
    }
    return llamaInstance;
};

/**
 * Ensure models directory exists
 */
const ensureModelsDir = async () => {
    const modelsDir = getModelsDir();
    if (!fs.existsSync(modelsDir)) {
        await fsp.mkdir(modelsDir, { recursive: true });
    }
    return modelsDir;
};

/**
 * Get model path from model name
 */
const getModelPath = (modelName: string): string => {
    const modelsDir = getModelsDir();
    // If it's already a full path or ends with .gguf, use as is
    if (modelName.endsWith('.gguf')) {
        if (path.isAbsolute(modelName)) {
            return modelName;
        }
        return path.join(modelsDir, modelName);
    }
    // Otherwise, assume it's a model name and add .gguf
    return path.join(modelsDir, `${modelName}.gguf`);
};

/**
 * Load a model (cached)
 */
const loadModel = async (modelName: string): Promise<LlamaModel> => {
    const modelPath = getModelPath(modelName);
    
    // Check cache
    if (loadedModels.has(modelPath)) {
        return loadedModels.get(modelPath)!;
    }
    
    // Check if model file exists
    if (!fs.existsSync(modelPath)) {
        throw new Error(`Model not found: ${modelPath}. Download it first using /models/download`);
    }
    
    const llama = await getLlamaInstance();
    logger.info({ modelPath }, 'Loading model');
    
    const model = await llama.loadModel({ modelPath });
    loadedModels.set(modelPath, model);
    
    logger.info({ modelPath }, 'Model loaded successfully');
    return model;
};

/**
 * Get or create a context for a model
 */
const getContext = async (modelName: string, sessionId?: string): Promise<LlamaContext> => {
    const contextKey = sessionId || modelName;
    
    if (activeContexts.has(contextKey)) {
        return activeContexts.get(contextKey)!;
    }
    
    const model = await loadModel(modelName);
    const context = await model.createContext();
    activeContexts.set(contextKey, context);
    
    return context;
};

/**
 * Get or create a chat session
 */
const getSession = async (modelName: string, sessionId?: string): Promise<LlamaChatSession> => {
    const sessionKey = sessionId || `default_${modelName}`;
    
    if (activeSessions.has(sessionKey)) {
        return activeSessions.get(sessionKey)!;
    }
    
    const context = await getContext(modelName, sessionKey);
    const session = new LlamaChatSession({
        contextSequence: context.getSequence()
    });
    activeSessions.set(sessionKey, session);
    
    return session;
};

/**
 * Send a prompt and get a response (similar to chatGPTPrompt)
 */
export const llamaPrompt = async (options: {
    message: string;
    model?: string;
    sessionId?: string;
    done?: (response: any, message: string) => void;
    error?: (err: any) => void;
}) => {
    const {
        message,
        model = 'default',
        sessionId,
        done = () => {},
        error = () => {}
    } = options;

    try {
        const session = await getSession(model, sessionId);
        const response = await session.prompt(message);
        
        done({ content: response }, response);
        return [response];
    } catch (err: any) {
        logger.error({ error: err?.message || err }, 'Error in llamaPrompt');
        error(err?.message || err);
        return { isError: true, data: { error: { message: err?.message || 'LLM error' } } };
    }
};

/**
 * Chat with message history (creates new session each time for stateless operation)
 */
export const llamaChat = async (options: {
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    model?: string;
    done?: (response: any, message: string) => void;
    error?: (err: any) => void;
}) => {
    const {
        messages,
        model = 'default',
        done = () => {},
        error = () => {}
    } = options;

    try {
        const modelInstance = await loadModel(model);
        const context = await modelInstance.createContext();
        const session = new LlamaChatSession({
            contextSequence: context.getSequence()
        });
        
        // Process system message if present
        const systemMessage = messages.find(m => m.role === 'system');
        if (systemMessage) {
            session.setChatHistory([{
                type: 'system',
                text: systemMessage.content
            }]);
        }
        
        // Get the last user message
        const userMessages = messages.filter(m => m.role === 'user');
        const lastUserMessage = userMessages[userMessages.length - 1];
        
        if (!lastUserMessage) {
            throw new Error('No user message provided');
        }
        
        const response = await session.prompt(lastUserMessage.content);
        
        // Dispose context after use
        await context.dispose();
        
        const result = {
            choices: [
                {
                    message: {
                        content: response,
                        role: 'assistant'
                    }
                }
            ],
            model
        };
        
        done(result, response);
        return result;
    } catch (err: any) {
        logger.error({ error: err?.message || err }, 'Error in llamaChat');
        error(err?.message || err);
        return { isError: true, data: { error: { message: err?.message || 'LLM error' } } };
    }
};

/**
 * List available models in data/models/
 */
export const llamaListModels = async () => {
    try {
        const modelsDir = await ensureModelsDir();
        const files = await fsp.readdir(modelsDir);
        
        const models = files
            .filter(f => f.endsWith('.gguf'))
            .map(f => {
                const filePath = path.join(modelsDir, f);
                const stats = fs.statSync(filePath);
                return {
                    name: f.replace('.gguf', ''),
                    file: f,
                    path: filePath,
                    size: stats.size,
                    sizeHuman: formatBytes(stats.size),
                    modified: stats.mtime
                };
            });
        
        return models;
    } catch (err: any) {
        logger.error({ error: err?.message || err }, 'Error listing models');
        return [];
    }
};

/**
 * Download a model from HuggingFace
 * Supports URLs like:
 * - https://huggingface.co/TheBloke/Llama-2-7B-GGUF/resolve/main/llama-2-7b.Q4_K_M.gguf
 * - TheBloke/Llama-2-7B-GGUF (will list available files)
 */
export const llamaDownloadModel = async (options: {
    url: string;
    filename?: string;
    onProgress?: (progress: { percent: number; downloaded: number; total: number }) => void;
}) => {
    const { url, filename, onProgress } = options;
    
    try {
        const modelsDir = await ensureModelsDir();
        
        // Determine the download URL and filename
        let downloadUrl = url;
        let outputFilename = filename;
        
        // If it's a direct GGUF URL
        if (url.includes('/resolve/') && url.endsWith('.gguf')) {
            downloadUrl = url;
            if (!outputFilename) {
                outputFilename = path.basename(url);
            }
        }
        // If it's a HuggingFace model page URL or repo ID
        else if (url.includes('huggingface.co') || url.match(/^[\w-]+\/[\w-]+$/)) {
            throw new Error('Please provide a direct link to a .gguf file. Go to the model page on HuggingFace, find a .gguf file, and copy its download URL.');
        }
        
        if (!outputFilename) {
            throw new Error('Could not determine filename. Please provide a filename.');
        }
        
        const outputPath = path.join(modelsDir, outputFilename);
        
        // Check if already exists
        if (fs.existsSync(outputPath)) {
            return { 
                success: true, 
                message: 'Model already exists',
                path: outputPath,
                filename: outputFilename
            };
        }
        
        logger.info({ url: downloadUrl, outputPath }, 'Starting model download');
        
        // Download the file
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }
        
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        const reader = response.body?.getReader();
        
        if (!reader) {
            throw new Error('Failed to get response reader');
        }
        
        const chunks: Uint8Array[] = [];
        let downloaded = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            downloaded += value.length;
            
            if (onProgress && contentLength > 0) {
                onProgress({
                    percent: Math.round((downloaded / contentLength) * 100),
                    downloaded,
                    total: contentLength
                });
            }
        }
        
        // Write to file
        const buffer = Buffer.concat(chunks);
        await fsp.writeFile(outputPath, buffer);
        
        logger.info({ outputPath, size: buffer.length }, 'Model download completed');
        
        return {
            success: true,
            path: outputPath,
            filename: outputFilename,
            size: buffer.length,
            sizeHuman: formatBytes(buffer.length)
        };
    } catch (err: any) {
        logger.error({ error: err?.message || err, url }, 'Error downloading model');
        return { success: false, error: err?.message || 'Failed to download model' };
    }
};

/**
 * Delete a model
 */
export const llamaDeleteModel = async (modelName: string) => {
    try {
        const modelPath = getModelPath(modelName);
        
        // Unload if loaded
        if (loadedModels.has(modelPath)) {
            const model = loadedModels.get(modelPath)!;
            loadedModels.delete(modelPath);
            // Note: node-llama-cpp models are garbage collected
        }
        
        if (!fs.existsSync(modelPath)) {
            return { success: false, error: 'Model not found' };
        }
        
        await fsp.unlink(modelPath);
        logger.info({ modelPath }, 'Model deleted');
        
        return { success: true, model: modelName };
    } catch (err: any) {
        logger.error({ error: err?.message || err, modelName }, 'Error deleting model');
        return { success: false, error: err?.message || 'Failed to delete model' };
    }
};

/**
 * Unload a model from memory
 */
export const llamaUnloadModel = async (modelName: string) => {
    const modelPath = getModelPath(modelName);
    
    // Clear sessions using this model
    for (const [key, _] of activeSessions) {
        if (key.includes(modelName)) {
            activeSessions.delete(key);
        }
    }
    
    // Clear contexts
    for (const [key, context] of activeContexts) {
        if (key.includes(modelName)) {
            await context.dispose();
            activeContexts.delete(key);
        }
    }
    
    // Remove model
    if (loadedModels.has(modelPath)) {
        loadedModels.delete(modelPath);
        logger.info({ modelPath }, 'Model unloaded from memory');
        return { success: true, model: modelName };
    }
    
    return { success: false, error: 'Model not loaded' };
};

/**
 * Get status of loaded models
 */
export const llamaStatus = async () => {
    return {
        llamaInitialized: llamaInstance !== null,
        loadedModels: Array.from(loadedModels.keys()),
        activeContexts: activeContexts.size,
        activeSessions: activeSessions.size,
        modelsDir: getModelsDir()
    };
};

/**
 * Format bytes to human readable
 */
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default {
    llamaPrompt,
    llamaChat,
    llamaListModels,
    llamaDownloadModel,
    llamaDeleteModel,
    llamaUnloadModel,
    llamaStatus
};

