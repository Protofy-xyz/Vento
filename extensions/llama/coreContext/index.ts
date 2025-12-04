/**
 * =============================================================================
 * LLAMA LOCAL LLM EXTENSION - EXTERNAL SERVER VERSION
 * =============================================================================
 * 
 * This module manages a llama-server process (from llama.cpp) and provides
 * functions to interact with it via HTTP.
 * 
 * Architecture:
 *   extensions/llama (this file) → spawns → llama-server binary → GPU
 * 
 * The llama-server binary is downloaded from llama.cpp releases using:
 *   node scripts/download-llama.js
 * 
 * Why this approach?
 * - The official llama.cpp server is battle-tested and stable
 * - Process isolation: if llama-server crashes, our app continues
 * - No native Node.js bindings means no BSOD on Windows shutdown
 * - Easy to update: just download new binary
 * 
 * =============================================================================
 */

import { getLogger } from 'protobase';
import { getRoot } from 'protonode';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';

const logger = getLogger();

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    serverPort: parseInt(process.env.LLAMA_SERVER_PORT || '8788'),
    serverHost: '127.0.0.1',
    startupTimeoutMs: 120000,
    requestTimeoutMs: 600000,
    healthCheckIntervalMs: 500,
    gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || '-1'),
    contextSize: parseInt(process.env.LLAMA_CTX_SIZE || '8192'),
};

const DOWNLOAD_CONFIG = {
    maxRetries: 10,
    initialRetryDelayMs: 2000,
    maxRetryDelayMs: 60000,
    chunkTimeoutMs: 30000,
    cleanupAfterMs: 10 * 60 * 1000,
};

// =============================================================================
// PATH HELPERS
// =============================================================================

const getModelsDir = () => path.join(getRoot(), 'data', 'models');
const getBinDir = () => path.join(getRoot(), 'bin', 'llama');
const getServerBinary = () => {
    const binDir = getBinDir();
    const isWindows = process.platform === 'win32';
    return path.join(binDir, isWindows ? 'llama-server.exe' : 'llama-server');
};

const getModelPath = (modelName: string): string => {
    const modelsDir = getModelsDir();
    if (modelName.endsWith('.gguf')) {
        return path.isAbsolute(modelName) ? modelName : path.join(modelsDir, modelName);
    }
    return path.join(modelsDir, `${modelName}.gguf`);
};

/**
 * Find the best available model when none is specified
 */
const findDefaultModel = (): string => {
    const modelsDir = getModelsDir();
    
    const defaultPath = path.join(modelsDir, 'default.gguf');
    if (fs.existsSync(defaultPath)) {
        return 'default';
    }
    
    try {
        if (fs.existsSync(modelsDir)) {
            const files = fs.readdirSync(modelsDir);
            const ggufFile = files.find(f => f.endsWith('.gguf'));
            if (ggufFile) {
                logger.info({ model: ggufFile }, 'No default model, using first available');
                return ggufFile.replace('.gguf', '');
            }
        }
    } catch (e) {
        // Ignore
    }
    
    return 'default';
};

// =============================================================================
// SERVER STATE
// =============================================================================

interface ServerState {
    process: ChildProcess | null;
    modelPath: string;
    modelName: string;
    running: boolean;
    startedAt: Date | null;
    requestCount: number;
    lastError: string | null;
}

const serverState: ServerState = {
    process: null,
    modelPath: '',
    modelName: '',
    running: false,
    startedAt: null,
    requestCount: 0,
    lastError: null,
};

let isShuttingDown = false;

// =============================================================================
// SERVER MANAGEMENT
// =============================================================================

const serverBinaryExists = (): boolean => fs.existsSync(getServerBinary());

const isServerHealthy = async (): Promise<boolean> => {
    if (!serverState.running) return false;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(
            `http://${CONFIG.serverHost}:${CONFIG.serverPort}/health`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
};

const waitForServer = async (timeoutMs: number): Promise<boolean> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        if (await isServerHealthy()) return true;
        await new Promise(resolve => setTimeout(resolve, CONFIG.healthCheckIntervalMs));
    }
    return false;
};

const startServer = async (modelPath: string): Promise<void> => {
    if (serverState.running && serverState.modelPath === modelPath) {
        if (await isServerHealthy()) {
            logger.debug({ model: serverState.modelName }, 'Server already running');
            return;
        }
        logger.warn('Server died, restarting...');
        await stopServer();
    }
    
    if (serverState.running) {
        logger.info({ currentModel: serverState.modelName }, 'Switching models');
        await stopServer();
    }
    
    const binary = getServerBinary();
    if (!fs.existsSync(binary)) {
        throw new Error(`llama-server not found at ${binary}. Run 'node scripts/download-llama.js'`);
    }
    
    if (!fs.existsSync(modelPath)) {
        throw new Error(`Model not found: ${modelPath}`);
    }
    
    const args = [
        '-m', modelPath,
        '--host', CONFIG.serverHost,
        '--port', CONFIG.serverPort.toString(),
        '-c', CONFIG.contextSize.toString(),
        '-ngl', CONFIG.gpuLayers.toString(),
    ];
    
    logger.info({ binary, model: path.basename(modelPath) }, 'Starting llama-server');
    
    const proc = spawn(binary, args, {
        cwd: getBinDir(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });
    
    serverState.process = proc;
    serverState.modelPath = modelPath;
    serverState.modelName = path.basename(modelPath, '.gguf');
    serverState.running = true;
    serverState.startedAt = new Date();
    serverState.requestCount = 0;
    serverState.lastError = null;
    
    proc.stdout?.on('data', (data) => {
        logger.debug({ source: 'llama-server' }, data.toString().trim());
    });
    
    proc.stderr?.on('data', (data) => {
        logger.debug({ source: 'llama-server' }, data.toString().trim());
    });
    
    proc.on('exit', (code, signal) => {
        logger.warn({ code, signal }, 'llama-server exited');
        serverState.process = null;
        serverState.running = false;
        if (code !== 0 && code !== null) {
            serverState.lastError = `Exited with code ${code}`;
        }
    });
    
    proc.on('error', (err) => {
        logger.error({ error: err.message }, 'llama-server error');
        serverState.lastError = err.message;
        serverState.running = false;
    });
    
    logger.info('Waiting for llama-server to be ready...');
    const ready = await waitForServer(CONFIG.startupTimeoutMs);
    
    if (!ready) {
        await stopServer();
        throw new Error(`llama-server failed to start within ${CONFIG.startupTimeoutMs / 1000}s`);
    }
    
    logger.info({ model: serverState.modelName, port: CONFIG.serverPort }, 'llama-server ready');
};

const stopServer = async (): Promise<void> => {
    if (!serverState.process) {
        serverState.running = false;
        return;
    }
    
    const pid = serverState.process.pid;
    const modelName = serverState.modelName;
    
    logger.info({ pid, model: modelName }, 'Stopping llama-server');
    
    const proc = serverState.process;
    serverState.process = null;
    serverState.running = false;
    serverState.modelPath = '';
    serverState.modelName = '';
    
    try {
        proc.kill('SIGKILL');
        
        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 3000);
            proc.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });
            if (proc.killed || proc.exitCode !== null) {
                clearTimeout(timeout);
                resolve();
            }
        });
        
        logger.info({ pid }, 'llama-server stopped');
    } catch (e: any) {
        logger.debug({ error: e?.message }, 'Error killing process');
    }
};

const ensureServer = async (modelName: string): Promise<void> => {
    if (isShuttingDown) throw new Error('Server is shutting down');
    await startServer(getModelPath(modelName));
};

// =============================================================================
// HTTP CLIENT
// =============================================================================

const serverRequest = async (
    endpoint: string, 
    method: string = 'POST', 
    body?: any,
    timeoutMs: number = CONFIG.requestTimeoutMs
): Promise<any> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const url = `http://${CONFIG.serverHost}:${CONFIG.serverPort}${endpoint}`;
        const options: RequestInit = {
            method,
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`Server error ${response.status}: ${await response.text()}`);
        }
        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
};

// =============================================================================
// PUBLIC API - INFERENCE
// =============================================================================

export const llamaPrompt = async (params: {
    model?: string;
    message: string;
    images?: any[];
    files?: any[];
    conversation?: any[];
    done?: (response: any, message: string) => void;
    error?: (err: any) => void;
}) => {
    const { model, message, conversation = [], done = () => {}, error = () => {} } = params;
    const actualModel = model || findDefaultModel();
    
    try {
        await ensureServer(actualModel);
        serverState.requestCount++;
        
        const messages: Array<{ role: string; content: string }> = [];
        for (const msg of conversation) {
            const content = typeof msg.content === 'string' 
                ? msg.content 
                : Array.isArray(msg.content)
                    ? msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
                    : '';
            if (content) messages.push({ role: msg.role, content });
        }
        messages.push({ role: 'user', content: message });
        
        const response = await serverRequest('/v1/chat/completions', 'POST', { messages, stream: false });
        const responseText = response.choices?.[0]?.message?.content || '';
        
        done({ response: responseText }, responseText);
        return [responseText];
    } catch (err: any) {
        logger.error({ error: err?.message }, 'Error in llamaPrompt');
        error(err?.message || err);
        return { isError: true, statusCode: 500, data: { error: { message: err?.message || 'LLM error' } } };
    }
};

export const prompt = llamaPrompt;

export const llamaChat = async (options: {
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    model?: string;
    done?: (response: any, message: string) => void;
    error?: (err: any) => void;
}) => {
    const { messages, model, done = () => {}, error = () => {} } = options;
    const actualModel = model || findDefaultModel();
    
    try {
        await ensureServer(actualModel);
        serverState.requestCount++;
        
        const response = await serverRequest('/v1/chat/completions', 'POST', { messages, stream: false });
        const responseText = response.choices?.[0]?.message?.content || '';
        
        done(response, responseText);
        return response;
    } catch (err: any) {
        logger.error({ error: err?.message }, 'Error in llamaChat');
        error(err?.message || err);
        return { isError: true, statusCode: 500, data: { error: { message: err?.message || 'LLM error' } } };
    }
};

// =============================================================================
// PUBLIC API - MODEL MANAGEMENT
// =============================================================================

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const llamaListModels = async () => {
    const modelsDir = getModelsDir();
    try {
        if (!fs.existsSync(modelsDir)) return [];
        
        const files = await fsp.readdir(modelsDir);
        const models = [];
        
        for (const file of files) {
            if (file.endsWith('.gguf')) {
                const filePath = path.join(modelsDir, file);
                const stats = await fsp.stat(filePath);
                models.push({
                    name: file.replace('.gguf', ''),
                    filename: file,
                    size: stats.size,
                    sizeFormatted: formatBytes(stats.size),
                    path: filePath,
                    loaded: serverState.running && serverState.modelPath === filePath,
                });
            }
        }
        return models;
    } catch (err: any) {
        logger.error({ error: err?.message }, 'Error listing models');
        return [];
    }
};

export const llamaDeleteModel = async (modelName: string) => {
    try {
        const modelPath = getModelPath(modelName);
        if (serverState.modelPath === modelPath) await stopServer();
        
        if (fs.existsSync(modelPath)) {
            await fsp.unlink(modelPath);
            logger.info({ modelName }, 'Model deleted');
            return { success: true };
        }
        return { success: false, error: 'Model not found' };
    } catch (err: any) {
        logger.error({ error: err?.message }, 'Error deleting model');
        return { success: false, error: err?.message };
    }
};

export const llamaUnloadModel = async (modelName?: string) => {
    try {
        if (!serverState.running) return { success: true, message: 'No model loaded' };
        
        if (modelName) {
            const requestedPath = getModelPath(modelName);
            if (serverState.modelPath !== requestedPath) {
                return { success: false, error: 'That model is not loaded' };
            }
        }
        
        await stopServer();
        return { success: true };
    } catch (err: any) {
        logger.error({ error: err?.message }, 'Error unloading model');
        return { success: false, error: err?.message };
    }
};

// =============================================================================
// PUBLIC API - STATUS & CONTROL
// =============================================================================

export const llamaStatus = async () => ({
    serverRunning: serverState.running,
    modelLoaded: serverState.modelName || null,
    modelPath: serverState.modelPath || null,
    startedAt: serverState.startedAt?.toISOString() || null,
    requestCount: serverState.requestCount,
    lastError: serverState.lastError,
    binaryExists: serverBinaryExists(),
    healthy: await isServerHealthy(),
    config: { port: CONFIG.serverPort, contextSize: CONFIG.contextSize, gpuLayers: CONFIG.gpuLayers },
});

export const llamaSystemReset = async () => {
    logger.warn('SYSTEM RESET');
    await stopServer();
    return { success: true, message: 'System reset complete' };
};

export const llamaFastShutdown = async () => {
    logger.warn('FAST SHUTDOWN');
    isShuttingDown = true;
    await stopServer();
    logger.info('FAST SHUTDOWN complete');
};

// =============================================================================
// MODEL DOWNLOAD
// =============================================================================

interface DownloadProgress {
    id: string;
    modelName: string;
    url: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    downloaded: number;
    total: number;
    percent: number;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
}

const activeDownloads = new Map<string, DownloadProgress>();

export const llamaStartDownload = async (options: { url: string; modelName: string }): Promise<{ downloadId: string }> => {
    const { url, modelName } = options;
    
    try { new URL(url); } catch { throw new Error('Invalid URL'); }
    
    const downloadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const progress: DownloadProgress = {
        id: downloadId, modelName, url, status: 'pending',
        downloaded: 0, total: 0, percent: 0, startedAt: new Date(),
    };
    
    activeDownloads.set(downloadId, progress);
    
    const modelsDir = getModelsDir();
    if (!fs.existsSync(modelsDir)) await fsp.mkdir(modelsDir, { recursive: true });
    
    const outputPath = path.join(modelsDir, `${modelName}.gguf`);
    
    downloadWithRetry(url, outputPath, progress)
        .then(() => {
            progress.status = 'completed';
            progress.completedAt = new Date();
            logger.info({ modelName }, 'Download completed');
            setTimeout(() => activeDownloads.delete(downloadId), DOWNLOAD_CONFIG.cleanupAfterMs);
        })
        .catch((err) => {
            progress.status = 'failed';
            progress.error = err?.message;
            progress.completedAt = new Date();
            logger.error({ error: err?.message }, 'Download failed');
            setTimeout(() => activeDownloads.delete(downloadId), DOWNLOAD_CONFIG.cleanupAfterMs);
        });
    
    return { downloadId };
};

const downloadWithRetry = async (url: string, outputPath: string, progress: DownloadProgress): Promise<void> => {
    let retries = 0;
    let delay = DOWNLOAD_CONFIG.initialRetryDelayMs;
    
    while (retries <= DOWNLOAD_CONFIG.maxRetries) {
        try {
            progress.status = 'downloading';
            await downloadToFile(url, outputPath, progress);
            return;
        } catch (err: any) {
            retries++;
            if (retries > DOWNLOAD_CONFIG.maxRetries) throw err;
            logger.warn({ retry: retries }, 'Download failed, retrying...');
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 2, DOWNLOAD_CONFIG.maxRetryDelayMs);
        }
    }
};

const downloadToFile = async (url: string, outputPath: string, progress: DownloadProgress): Promise<void> => {
    let startByte = 0;
    if (fs.existsSync(outputPath)) {
        const stats = await fsp.stat(outputPath);
        startByte = stats.size;
        progress.downloaded = startByte;
    }
    
    const headers: Record<string, string> = {};
    if (startByte > 0) headers['Range'] = `bytes=${startByte}-`;
    
    const response = await fetch(url, { headers });
    if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const contentRange = response.headers.get('content-range');
    
    if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) progress.total = parseInt(match[1], 10);
    } else if (contentLength > 0) {
        progress.total = startByte + contentLength;
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');
    
    const fileHandle = await fsp.open(outputPath, startByte > 0 ? 'a' : 'w');
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            await fileHandle.write(value);
            progress.downloaded += value.length;
            if (progress.total > 0) {
                progress.percent = Math.round((progress.downloaded / progress.total) * 100);
            }
        }
    } finally {
        await fileHandle.close();
        reader.releaseLock();
    }
};

export const llamaGetDownloadProgress = (downloadId: string): DownloadProgress | null => {
    return activeDownloads.get(downloadId) || null;
};

export const llamaListDownloads = (): DownloadProgress[] => {
    return Array.from(activeDownloads.values());
};

// =============================================================================
// PRELOAD - Start server with specific model
// =============================================================================

/**
 * Preload the llama server with a specific model
 * 
 * @param modelName - The model to load (without .gguf extension)
 */
export const llamaPreload = async (modelName?: string): Promise<{ success: boolean; message: string; model?: string }> => {
    try {
        // Check if binary exists
        if (!serverBinaryExists()) {
            return { 
                success: false, 
                message: 'llama-server binary not found. Run: node scripts/download-llama.js' 
            };
        }
        
        // Use provided model or find first available
        const actualModel = modelName || findDefaultModel();
        
        // Check if model exists
        const modelPath = getModelPath(actualModel);
        if (!fs.existsSync(modelPath)) {
            return { 
                success: false, 
                message: `Model not found: ${actualModel}` 
            };
        }
        
        logger.info({ model: actualModel }, 'Preloading llama model...');
        
        // Start the server
        await ensureServer(actualModel);
        
        return { 
            success: true, 
            message: 'Model preloaded successfully',
            model: actualModel
        };
    } catch (err: any) {
        logger.error({ error: err?.message }, 'Error preloading model');
        return { 
            success: false, 
            message: err?.message || 'Failed to preload model' 
        };
    }
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
    llamaPrompt, llamaChat, prompt,
    llamaListModels, llamaStartDownload, llamaGetDownloadProgress, llamaListDownloads,
    llamaDeleteModel, llamaUnloadModel, llamaStatus, llamaSystemReset, llamaFastShutdown,
    llamaPreload,
};
