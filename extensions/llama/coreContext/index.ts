import { getLogger } from 'protobase';
import { getRoot } from 'protonode';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const logger = getLogger();

// Models directory
const getModelsDir = () => path.join(getRoot(), 'data', 'models');

// Lazy-loaded node-llama-cpp module (ESM compatibility)
let nodeLlamaCpp: any = null;
const getNodeLlamaCpp = async () => {
    if (!nodeLlamaCpp) {
        nodeLlamaCpp = await import('node-llama-cpp');
    }
    return nodeLlamaCpp;
};

// Singleton instances
let llamaInstance: any = null;
const loadedModels: Map<string, any> = new Map();
const activeContexts: Map<string, any> = new Map();
const activeSessions: Map<string, any> = new Map();

// Download tracking
interface DownloadProgress {
    id: string;
    url: string;
    filename: string;
    status: 'pending' | 'downloading' | 'completed' | 'error' | 'retrying';
    percent: number;
    downloaded: number;
    total: number;
    error?: string;
    path?: string;
    startedAt: Date;
    completedAt?: Date;
    retryCount: number;
    maxRetries: number;
    nextRetryAt?: Date;
}

const activeDownloads: Map<string, DownloadProgress> = new Map();

// Download config
const DOWNLOAD_CONFIG = {
    maxRetries: 10,
    initialRetryDelayMs: 2000,
    maxRetryDelayMs: 60000,
    chunkTimeoutMs: 30000,
    cleanupAfterMs: 10 * 60 * 1000, // 10 minutes
};

/**
 * Get or create Llama instance
 */
const getLlamaInstance = async (): Promise<any> => {
    if (!llamaInstance) {
        const { getLlama } = await getNodeLlamaCpp();
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
    if (modelName.endsWith('.gguf')) {
        if (path.isAbsolute(modelName)) {
            return modelName;
        }
        return path.join(modelsDir, modelName);
    }
    return path.join(modelsDir, `${modelName}.gguf`);
};

/**
 * Load a model (cached)
 */
const loadModel = async (modelName: string): Promise<any> => {
    const modelPath = getModelPath(modelName);
    
    if (loadedModels.has(modelPath)) {
        return loadedModels.get(modelPath)!;
    }
    
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
const getContext = async (modelName: string, sessionId?: string): Promise<any> => {
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
const getSession = async (modelName: string, sessionId?: string): Promise<any> => {
    const sessionKey = sessionId || `default_${modelName}`;
    
    if (activeSessions.has(sessionKey)) {
        return activeSessions.get(sessionKey)!;
    }
    
    const { LlamaChatSession } = await getNodeLlamaCpp();
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
 * Chat with message history
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
        const { LlamaChatSession } = await getNodeLlamaCpp();
        const modelInstance = await loadModel(model);
        const context = await modelInstance.createContext();
        const session = new LlamaChatSession({
            contextSequence: context.getSequence()
        });
        
        const systemMessage = messages.find(m => m.role === 'system');
        if (systemMessage) {
            session.setChatHistory([{
                type: 'system',
                text: systemMessage.content
            }]);
        }
        
        const userMessages = messages.filter(m => m.role === 'user');
        const lastUserMessage = userMessages[userMessages.length - 1];
        
        if (!lastUserMessage) {
            throw new Error('No user message provided');
        }
        
        const response = await session.prompt(lastUserMessage.content);
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
            .filter(f => f.endsWith('.gguf') && !f.endsWith('.tmp.gguf'))
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
 * Find existing download for same URL or filename
 */
const findExistingDownload = (url: string, filename: string): DownloadProgress | null => {
    for (const download of activeDownloads.values()) {
        // Check if same URL or filename is being downloaded
        if (download.url === url || download.filename === filename) {
            // Only return if it's still active
            if (['pending', 'downloading', 'retrying'].includes(download.status)) {
                return download;
            }
        }
    }
    return null;
};

/**
 * Start a model download (returns immediately with download ID)
 */
export const llamaStartDownload = async (options: {
    url: string;
    filename?: string;
}): Promise<{ downloadId: string; existing?: boolean } | { error: string }> => {
    const { url, filename } = options;
    
    try {
        const modelsDir = await ensureModelsDir();
        
        let downloadUrl = url;
        let outputFilename = filename;
        
        if (url.includes('/resolve/') && url.endsWith('.gguf')) {
            downloadUrl = url;
            if (!outputFilename) {
                outputFilename = path.basename(url);
            }
        } else if (url.includes('huggingface.co') || url.match(/^[\w-]+\/[\w-]+$/)) {
            return { error: 'Please provide a direct link to a .gguf file.' };
        }
        
        if (!outputFilename) {
            return { error: 'Could not determine filename. Please provide a filename.' };
        }
        
        // Check if this download is already in progress
        const existingDownload = findExistingDownload(downloadUrl, outputFilename);
        if (existingDownload) {
            logger.info({ downloadId: existingDownload.id, filename: outputFilename }, 'Download already in progress, returning existing ID');
            return { downloadId: existingDownload.id, existing: true };
        }
        
        // Create download tracking entry
        const downloadId = uuidv4();
        const progress: DownloadProgress = {
            id: downloadId,
            url: downloadUrl,
            filename: outputFilename,
            status: 'pending',
            percent: 0,
            downloaded: 0,
            total: 0,
            startedAt: new Date(),
            retryCount: 0,
            maxRetries: DOWNLOAD_CONFIG.maxRetries
        };
        
        activeDownloads.set(downloadId, progress);
        
        // Start download in background
        downloadWithRetry(downloadId, downloadUrl, modelsDir, outputFilename);
        
        logger.info({ downloadId, url: downloadUrl, filename: outputFilename }, 'Download started');
        
        return { downloadId };
    } catch (err: any) {
        logger.error({ error: err?.message || err, url }, 'Error starting download');
        return { error: err?.message || 'Failed to start download' };
    }
};

/**
 * Calculate retry delay with exponential backoff
 */
const getRetryDelay = (retryCount: number): number => {
    const delay = DOWNLOAD_CONFIG.initialRetryDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, DOWNLOAD_CONFIG.maxRetryDelayMs);
};

/**
 * Download with retry logic
 */
const downloadWithRetry = async (
    downloadId: string, 
    url: string, 
    modelsDir: string, 
    filename: string
) => {
    const progress = activeDownloads.get(downloadId);
    if (!progress) return;
    
    const finalPath = path.join(modelsDir, filename);
    const tempPath = path.join(modelsDir, filename.replace('.gguf', '.tmp.gguf'));
    
    while (progress.retryCount <= progress.maxRetries) {
        try {
            progress.status = progress.retryCount > 0 ? 'retrying' : 'downloading';
            progress.error = undefined;
            
            await downloadToFile(progress, url, tempPath);
            
            // Download successful - move temp file to final location
            // If final file exists, replace it
            if (fs.existsSync(finalPath)) {
                logger.info({ finalPath }, 'Replacing existing model file');
                await fsp.unlink(finalPath);
            }
            
            await fsp.rename(tempPath, finalPath);
            
            progress.status = 'completed';
            progress.completedAt = new Date();
            progress.path = finalPath;
            
            logger.info({ downloadId, finalPath, size: progress.downloaded }, 'Download completed successfully');
            
            // Schedule cleanup
            scheduleCleanup(downloadId);
            return;
            
        } catch (err: any) {
            progress.retryCount++;
            
            // Clean up partial temp file
            try {
                if (fs.existsSync(tempPath)) {
                    await fsp.unlink(tempPath);
                }
            } catch {}
            
            if (progress.retryCount > progress.maxRetries) {
                progress.status = 'error';
                progress.error = `Failed after ${progress.maxRetries} retries. Last error: ${err?.message || err}`;
                logger.error({ downloadId, error: err?.message, retryCount: progress.retryCount }, 'Download failed permanently');
                scheduleCleanup(downloadId);
                return;
            }
            
            // Schedule retry
            const delay = getRetryDelay(progress.retryCount);
            progress.status = 'retrying';
            progress.error = `Retry ${progress.retryCount}/${progress.maxRetries} in ${Math.round(delay / 1000)}s. Error: ${err?.message || err}`;
            progress.nextRetryAt = new Date(Date.now() + delay);
            
            logger.warn({ 
                downloadId, 
                error: err?.message, 
                retryCount: progress.retryCount, 
                nextRetryIn: delay 
            }, 'Download failed, scheduling retry');
            
            await sleep(delay);
        }
    }
};

/**
 * Download file with progress tracking and resume support
 */
const downloadToFile = async (
    progress: DownloadProgress, 
    url: string, 
    outputPath: string
): Promise<void> => {
    // Check if partial file exists for resume
    let startByte = 0;
    if (fs.existsSync(outputPath)) {
        const stats = await fsp.stat(outputPath);
        startByte = stats.size;
        progress.downloaded = startByte;
        logger.info({ outputPath, resumeFrom: startByte }, 'Resuming partial download');
    }
    
    const headers: Record<string, string> = {};
    if (startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_CONFIG.chunkTimeoutMs);
    
    let response: Response;
    try {
        response = await fetch(url, { 
            headers,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (err: any) {
        clearTimeout(timeoutId);
        throw new Error(`Network error: ${err?.message || 'Connection failed'}`);
    }
    
    if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    // Handle content length
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const contentRange = response.headers.get('content-range');
    
    if (contentRange) {
        // Partial content response: "bytes 1000-2000/3000"
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
            progress.total = parseInt(match[1], 10);
        }
    } else if (contentLength > 0) {
        progress.total = startByte + contentLength;
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Failed to get response reader');
    }
    
    // Open file for append if resuming, write if starting fresh
    const fileHandle = await fsp.open(outputPath, startByte > 0 ? 'a' : 'w');
    
    try {
        let lastActivityTime = Date.now();
        
        while (true) {
            // Check for timeout between chunks
            const timeSinceActivity = Date.now() - lastActivityTime;
            if (timeSinceActivity > DOWNLOAD_CONFIG.chunkTimeoutMs) {
                throw new Error(`Download stalled - no data received for ${Math.round(timeSinceActivity / 1000)}s`);
            }
            
            const readPromise = reader.read();
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Chunk read timeout')), DOWNLOAD_CONFIG.chunkTimeoutMs);
            });
            
            const { done, value } = await Promise.race([readPromise, timeoutPromise]);
            
            if (done) break;
            
            lastActivityTime = Date.now();
            await fileHandle.write(value);
            progress.downloaded += value.length;
            
            if (progress.total > 0) {
                progress.percent = Math.round((progress.downloaded / progress.total) * 100);
            }
        }
        
        // Verify download completed
        if (progress.total > 0 && progress.downloaded < progress.total) {
            throw new Error(`Incomplete download: got ${progress.downloaded} of ${progress.total} bytes`);
        }
        
    } finally {
        await fileHandle.close();
        reader.releaseLock();
    }
};

/**
 * Sleep utility
 */
const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Schedule cleanup of download record
 */
const scheduleCleanup = (downloadId: string) => {
    setTimeout(() => {
        activeDownloads.delete(downloadId);
    }, DOWNLOAD_CONFIG.cleanupAfterMs);
};

/**
 * Get download progress by ID
 */
export const llamaGetDownloadProgress = (downloadId: string): DownloadProgress | null => {
    return activeDownloads.get(downloadId) || null;
};

/**
 * List all active downloads
 */
export const llamaListDownloads = (): DownloadProgress[] => {
    return Array.from(activeDownloads.values());
};

/**
 * Delete a model
 */
export const llamaDeleteModel = async (modelName: string) => {
    try {
        const modelPath = getModelPath(modelName);
        
        if (loadedModels.has(modelPath)) {
            loadedModels.delete(modelPath);
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
    
    for (const [key, _] of activeSessions) {
        if (key.includes(modelName)) {
            activeSessions.delete(key);
        }
    }
    
    for (const [key, context] of activeContexts) {
        if (key.includes(modelName)) {
            await context.dispose();
            activeContexts.delete(key);
        }
    }
    
    if (loadedModels.has(modelPath)) {
        loadedModels.delete(modelPath);
        logger.info({ modelPath }, 'Model unloaded from memory');
        return { success: true, model: modelName };
    }
    
    return { success: false, error: 'Model not loaded' };
};

/**
 * Get status
 */
export const llamaStatus = async () => {
    return {
        llamaInitialized: llamaInstance !== null,
        loadedModels: Array.from(loadedModels.keys()),
        activeContexts: activeContexts.size,
        activeSessions: activeSessions.size,
        activeDownloads: activeDownloads.size,
        modelsDir: getModelsDir()
    };
};

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
    llamaStartDownload,
    llamaGetDownloadProgress,
    llamaListDownloads,
    llamaDeleteModel,
    llamaUnloadModel,
    llamaStatus
};
