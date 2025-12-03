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
    cleanupAfterMs: 10 * 60 * 1000,
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

// ============================================================================
// Image processing helpers (same as chatGPT)
// ============================================================================

/**
 * Normalize data URL to ensure ;base64 is present
 */
const normalizeDataUrl = (s: string): string => {
    if (!s.startsWith("data:")) return s;
    const comma = s.indexOf(",");
    if (comma === -1) return s;
    const header = s.slice(0, comma);
    if (/;base64$/i.test(header)) return s;
    return `${header};base64${s.slice(comma)}`;
};

/**
 * Guess MIME type from file extension
 */
const guessMimeFromExt = (p: string): string => {
    const extension = path.extname(p).toLowerCase();
    if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
    if (extension === ".png") return "image/png";
    if (extension === ".gif") return "image/gif";
    if (extension === ".webp") return "image/webp";
    return `image/${extension.slice(1)}`;
};

/**
 * Convert file path to data URL
 */
const filePathToDataUrl = async (p: string): Promise<string> => {
    const clean = p.replace(/^[/\\]+/, "");
    const abs = path.join(getRoot(), clean);
    const buf = await fsp.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    let mime = "application/octet-stream";
    if (ext.startsWith(".")) {
        mime = guessMimeFromExt(ext);
    }
    return `data:${mime};base64,${buf.toString("base64")}`;
};

/**
 * Process images array to Buffer[] for node-llama-cpp
 */
const processImages = async (images: any[]): Promise<Buffer[]> => {
    const processed: Buffer[] = [];
    
    for (const img of images) {
        try {
            if (!img) continue;
            
            // Already a Buffer
            if (Buffer.isBuffer(img)) {
                processed.push(img);
                continue;
            }
            
            if (typeof img !== "string") continue;
            
            // Data URI - extract base64 and convert to Buffer
            if (img.startsWith("data:")) {
                const normalized = normalizeDataUrl(img.trim());
                const base64Match = normalized.match(/base64,(.+)$/);
                if (base64Match) {
                    processed.push(Buffer.from(base64Match[1], 'base64'));
                }
                continue;
            }
            
            // HTTP URL - fetch and convert to Buffer
            if (img.startsWith("http")) {
                const response = await fetch(img);
                const arrayBuffer = await response.arrayBuffer();
                processed.push(Buffer.from(arrayBuffer));
                continue;
            }
            
            // File path - read file to Buffer
            const filePath = img.startsWith('/') || img.startsWith('\\') || img.match(/^[a-zA-Z]:/) 
                ? img 
                : path.join(getRoot(), img.replace(/^[/\\]+/, ''));
            
            if (fs.existsSync(filePath)) {
                const buffer = await fsp.readFile(filePath);
                processed.push(buffer);
            }
        } catch (err) {
            logger.warn({ img, error: (err as any)?.message }, 'Error processing image');
        }
    }
    
    return processed;
};

/**
 * Read file contents for context
 */
const processFiles = async (files: any[]): Promise<string[]> => {
    const contents: string[] = [];
    
    for (const filePath of files) {
        try {
            if (typeof filePath !== "string") continue;
            const abs = path.isAbsolute(filePath) ? filePath : path.join(getRoot(), filePath);
            const content = await fsp.readFile(abs, 'utf-8');
            contents.push(`[File: ${path.basename(filePath)}]\n${content}`);
        } catch (err) {
            logger.warn({ filePath, error: (err as any)?.message }, 'Error reading file');
        }
    }
    
    return contents;
};

// ============================================================================
// Main prompt function (1:1 compatible with chatGPTPrompt)
// ============================================================================

/**
 * Send a prompt to Llama - compatible with chatGPTPrompt interface
 * 
 * @param model - Model name (default: 'default')
 * @param message - The user message/prompt
 * @param images - Array of image URLs/paths/data URIs
 * @param files - Array of file paths to include as context
 * @param conversation - Previous messages (system prompt, history)
 * @param done - Success callback (response, message)
 * @param error - Error callback
 */
export const llamaPrompt = async ({
    model = "default",
    message,
    images = [],
    files = [],
    conversation = [],
    ...props
}: {
    model?: string;
    message: string;
    images?: any[];
    files?: any[];
    conversation?: any[];
    done?: (response: any, message: string) => void;
    error?: (err: any) => void;
    [key: string]: any;
}) => {
    const done = props.done || (() => {});
    const error = props.error || (() => {});

    try {
        logger.debug({ message, images: images?.length, files: files?.length, conversation: conversation?.length }, 'llamaPrompt called');

        const { LlamaChatSession } = await getNodeLlamaCpp();
        const modelInstance = await loadModel(model);
        const context = await modelInstance.createContext();
        const session = new LlamaChatSession({
            contextSequence: context.getSequence()
        });

        // Build chat history from conversation
        const chatHistory: any[] = [];
        
        for (const msg of conversation) {
            if (msg.role === 'system') {
                // Handle system messages
                let text = '';
                if (typeof msg.content === 'string') {
                    text = msg.content;
                } else if (Array.isArray(msg.content)) {
                    text = msg.content
                        .filter((c: any) => c.type === 'text')
                        .map((c: any) => c.text)
                        .join('\n');
                }
                if (text) {
                    chatHistory.push({ type: 'system', text });
                }
            } else if (msg.role === 'user') {
                let text = typeof msg.content === 'string' ? msg.content : 
                    Array.isArray(msg.content) ? msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') : '';
                if (text) {
                    chatHistory.push({ type: 'user', text });
                }
            } else if (msg.role === 'assistant') {
                let text = typeof msg.content === 'string' ? msg.content :
                    Array.isArray(msg.content) ? msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') : '';
                if (text) {
                    chatHistory.push({ type: 'model', response: [text] });
                }
            }
        }

        if (chatHistory.length > 0) {
            session.setChatHistory(chatHistory);
        }

        // Build the user message content
        let fullMessage = message;

        // Process files and prepend their content
        if (files && files.length > 0) {
            const fileContents = await processFiles(files.map(f => 
                typeof f === 'string' ? (f.startsWith('/') ? f : path.join(getRoot(), f)) : f
            ));
            if (fileContents.length > 0) {
                fullMessage = fileContents.join('\n\n') + '\n\n' + fullMessage;
            }
        }

        // Process images - llama.cpp supports images in multimodal models (like Gemma 3)
        let imageBuffers: Buffer[] = [];
        if (images && images.length > 0) {
            imageBuffers = await processImages(images);
            logger.info({ count: imageBuffers.length }, 'Processed images for llama');
        }

        // Call the model
        let response: string;
        if (imageBuffers.length > 0) {
            // For multimodal models (Gemma 3, LLaVA, etc.), pass images as Buffers
            try {
                logger.info({ imageCount: imageBuffers.length, messageLength: fullMessage.length }, 'Calling model with images');
                response = await session.prompt(fullMessage, {
                    images: imageBuffers
                });
            } catch (imgErr: any) {
                // If model doesn't support images, fall back to text only
                logger.warn({ error: imgErr?.message }, 'Model may not support images, falling back to text-only');
                response = await session.prompt(fullMessage);
            }
        } else {
            response = await session.prompt(fullMessage);
        }

        // Dispose context
        await context.dispose();

        logger.debug({ responseLength: response?.length }, 'llamaPrompt completed');

        // Call done callback with same format as chatGPT
        done({ choices: [response] }, response);

        // Return same format as chatGPTPrompt
        return [response];

    } catch (err: any) {
        logger.error({ error: err?.message || err }, 'Error in llamaPrompt');
        error(err?.message || err);
        return { isError: true, data: { error: { message: err?.message || 'LLM error' } } };
    }
};

/**
 * Chat with message history (alternative interface)
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
 * Simple prompt function (like context.chatgpt.prompt)
 */
export const prompt = async (options: {
    message: string;
    images?: any[];
    files?: any[];
    conversation?: any[];
    model?: string;
    done?: (result: any) => void;
    error?: (err: any) => void;
}) => {
    const {
        message,
        images = [],
        files = [],
        conversation = [],
        model = "default",
        done = () => {},
        error = () => {}
    } = options;

    const response = await llamaPrompt({
        model,
        images,
        files: files.map(file => getRoot() + file),
        message,
        conversation,
        done: (response, msg) => {
            done(response);
        },
        error: (err) => {
            error(err);
        }
    });

    return response && Array.isArray(response) ? response[0] : response;
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
        if (download.url === url || download.filename === filename) {
            if (['pending', 'downloading', 'retrying'].includes(download.status)) {
                return download;
            }
        }
    }
    return null;
};

/**
 * Start a model download (returns immediately with download ID)
 * - If file already exists on disk → returns completed status with 100%
 * - If download already in progress → returns existing download ID
 * - Otherwise → starts new download
 */
export const llamaStartDownload = async (options: {
    url: string;
    filename?: string;
}): Promise<{ downloadId: string; existing?: boolean; alreadyDownloaded?: boolean } | { error: string }> => {
    const { url, filename } = options;
    
    try {
        const modelsDir = await ensureModelsDir();
        
        let downloadUrl = url;
        let outputFilename = filename;
        
        if (url.includes('/resolve/') && url.endsWith('.gguf')) {
            downloadUrl = url;
            if (!outputFilename) {
                outputFilename = path.basename(url).split('?')[0]; // Remove query params
            }
        } else if (url.includes('huggingface.co') || url.match(/^[\w-]+\/[\w-]+$/)) {
            return { error: 'Please provide a direct link to a .gguf file.' };
        }
        
        if (!outputFilename) {
            return { error: 'Could not determine filename. Please provide a filename.' };
        }
        
        // Check if file already exists on disk
        const finalPath = path.join(modelsDir, outputFilename);
        if (fs.existsSync(finalPath)) {
            const stats = fs.statSync(finalPath);
            const downloadId = `completed_${outputFilename}`;
            
            // Create a completed progress entry so getDownloadProgress works
            const completedProgress: DownloadProgress = {
                id: downloadId,
                url: downloadUrl,
                filename: outputFilename,
                status: 'completed',
                percent: 100,
                downloaded: stats.size,
                total: stats.size,
                startedAt: stats.mtime,
                completedAt: stats.mtime,
                path: finalPath,
                retryCount: 0,
                maxRetries: DOWNLOAD_CONFIG.maxRetries
            };
            
            activeDownloads.set(downloadId, completedProgress);
            scheduleCleanup(downloadId);
            
            logger.info({ downloadId, filename: outputFilename, size: stats.size }, 'Model already downloaded');
            return { downloadId, alreadyDownloaded: true };
        }
        
        // Check if there's an active download for this file
        const existingDownload = findExistingDownload(downloadUrl, outputFilename);
        if (existingDownload) {
            logger.info({ downloadId: existingDownload.id, filename: outputFilename }, 'Download already in progress');
            return { downloadId: existingDownload.id, existing: true };
        }
        
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
        downloadWithRetry(downloadId, downloadUrl, modelsDir, outputFilename);
        
        logger.info({ downloadId, url: downloadUrl, filename: outputFilename }, 'Download started');
        return { downloadId };
    } catch (err: any) {
        logger.error({ error: err?.message || err, url }, 'Error starting download');
        return { error: err?.message || 'Failed to start download' };
    }
};

const getRetryDelay = (retryCount: number): number => {
    const delay = DOWNLOAD_CONFIG.initialRetryDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, DOWNLOAD_CONFIG.maxRetryDelayMs);
};

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
            
            if (fs.existsSync(finalPath)) {
                logger.info({ finalPath }, 'Replacing existing model file');
                await fsp.unlink(finalPath);
            }
            
            await fsp.rename(tempPath, finalPath);
            
            progress.status = 'completed';
            progress.completedAt = new Date();
            progress.path = finalPath;
            
            logger.info({ downloadId, finalPath, size: progress.downloaded }, 'Download completed');
            scheduleCleanup(downloadId);
            return;
            
        } catch (err: any) {
            progress.retryCount++;
            
            try {
                if (fs.existsSync(tempPath)) {
                    await fsp.unlink(tempPath);
                }
            } catch {}
            
            if (progress.retryCount > progress.maxRetries) {
                progress.status = 'error';
                progress.error = `Failed after ${progress.maxRetries} retries. Last error: ${err?.message || err}`;
                logger.error({ downloadId, error: err?.message, retryCount: progress.retryCount }, 'Download failed');
                scheduleCleanup(downloadId);
                return;
            }
            
            const delay = getRetryDelay(progress.retryCount);
            progress.status = 'retrying';
            progress.error = `Retry ${progress.retryCount}/${progress.maxRetries} in ${Math.round(delay / 1000)}s. Error: ${err?.message || err}`;
            progress.nextRetryAt = new Date(Date.now() + delay);
            
            logger.warn({ downloadId, error: err?.message, retryCount: progress.retryCount, nextRetryIn: delay }, 'Scheduling retry');
            await sleep(delay);
        }
    }
};

const downloadToFile = async (
    progress: DownloadProgress, 
    url: string, 
    outputPath: string
): Promise<void> => {
    let startByte = 0;
    if (fs.existsSync(outputPath)) {
        const stats = await fsp.stat(outputPath);
        startByte = stats.size;
        progress.downloaded = startByte;
        logger.info({ outputPath, resumeFrom: startByte }, 'Resuming download');
    }
    
    const headers: Record<string, string> = {};
    if (startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_CONFIG.chunkTimeoutMs);
    
    let response: Response;
    try {
        response = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeoutId);
    } catch (err: any) {
        clearTimeout(timeoutId);
        throw new Error(`Network error: ${err?.message || 'Connection failed'}`);
    }
    
    if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const contentRange = response.headers.get('content-range');
    
    if (contentRange) {
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
    
    const fileHandle = await fsp.open(outputPath, startByte > 0 ? 'a' : 'w');
    
    try {
        let lastActivityTime = Date.now();
        
        while (true) {
            const timeSinceActivity = Date.now() - lastActivityTime;
            if (timeSinceActivity > DOWNLOAD_CONFIG.chunkTimeoutMs) {
                throw new Error(`Download stalled - no data for ${Math.round(timeSinceActivity / 1000)}s`);
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
        
        if (progress.total > 0 && progress.downloaded < progress.total) {
            throw new Error(`Incomplete: got ${progress.downloaded} of ${progress.total} bytes`);
        }
        
    } finally {
        await fileHandle.close();
        reader.releaseLock();
    }
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const scheduleCleanup = (downloadId: string) => {
    setTimeout(() => activeDownloads.delete(downloadId), DOWNLOAD_CONFIG.cleanupAfterMs);
};

export const llamaGetDownloadProgress = (downloadId: string): DownloadProgress | null => {
    return activeDownloads.get(downloadId) || null;
};

export const llamaListDownloads = (): DownloadProgress[] => {
    return Array.from(activeDownloads.values());
};

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
        logger.info({ modelPath }, 'Model unloaded');
        return { success: true, model: modelName };
    }
    
    return { success: false, error: 'Model not loaded' };
};

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
    prompt,
    llamaListModels,
    llamaStartDownload,
    llamaGetDownloadProgress,
    llamaListDownloads,
    llamaDeleteModel,
    llamaUnloadModel,
    llamaStatus
};
