import { Router, Application } from 'express';
import { pathToFileURL } from 'url';
import { getLogger, generateEvent } from 'protobase';
import { getServiceToken } from 'protonode';
import fs from 'fs';
import path from 'path';

const logger = getLogger();
const isProduction = process.env.NODE_ENV === 'production';
const serviceName = isProduction ? 'api' : 'api-dev';

// Registry of loaded automations
const automationRegistry: Map<string, { 
    module: any;
    loadedAt: number;
}> = new Map();

// The dynamic router that holds all automation routes
let automationRouter: Router = Router();

// Context reference (will be set on init)
let currentContext: any = null;
let currentApp: Application | null = null;

// Promise that resolves when HMR is initialized
let hmrReadyResolve: (() => void) | null = null;
const hmrReady: Promise<void> = new Promise((resolve) => {
    hmrReadyResolve = resolve;
});

// Queue for pending file changes before HMR is ready
const pendingChanges: Array<{ eventType: string; filePath: string }> = [];

// Paths configuration
const AUTOMATIONS_DIR = '../../data/automations'; // relative to cwd
const AUTOMATIONS_REQUIRE_PATH = '../../../data/automations'; // relative to this module

/**
 * Get absolute path for an automation file
 */
function getAutomationPath(filename: string): string {
    return path.resolve(process.cwd(), AUTOMATIONS_DIR, filename);
}

/**
 * Import a module with cache busting to force reload
 */
async function importWithCacheBust(modulePath: string): Promise<any> {
    const absolutePath = path.resolve(__dirname, modulePath);
    const fileUrl = pathToFileURL(absolutePath).href;
    // Add timestamp to bust ESM cache
    const urlWithCacheBust = `${fileUrl}?t=${Date.now()}`;
    return import(urlWithCacheBust);
}

/**
 * Load a single automation file
 */
async function loadAutomation(filename: string, context: any): Promise<boolean> {
    const automationPath = `${AUTOMATIONS_REQUIRE_PATH}/${filename}`;
    
    try {
        const module = await importWithCacheBust(automationPath);
        
        if (typeof module.default === 'function') {
            automationRegistry.set(filename, {
                module: module.default,
                loadedAt: Date.now()
            });
            logger.info({ automation: filename }, `[HMR] Loaded automation: ${filename}`);
            return true;
        } else {
            logger.warn({ automation: filename }, `[HMR] Automation ${filename} does not export a default function`);
            return false;
        }
    } catch (error: any) {
        logger.error({ error: error.toString(), automation: filename }, `[HMR] Error loading automation: ${filename}`);
        return false;
    }
}

/**
 * Rebuild the automation router with all registered automations
 */
function rebuildRouter(context: any): Router {
    const newRouter = Router();
    
    automationRegistry.forEach((entry, filename) => {
        try {
            // Create a mini-app for each automation to isolate routes
            const miniRouter = Router();
            entry.module(miniRouter, context);
            newRouter.use(miniRouter);
            logger.debug({ automation: filename }, `[HMR] Mounted automation: ${filename}`);
        } catch (error: any) {
            logger.error({ error: error.toString(), automation: filename }, `[HMR] Error mounting automation: ${filename}`);
        }
    });
    
    return newRouter;
}

/**
 * Initialize the HMR system
 */
export async function initHMR(app: Application, context: any): Promise<Router> {
    currentContext = context;
    currentApp = app;
    
    // Load all automations from the directory
    const automationsDir = path.resolve(process.cwd(), AUTOMATIONS_DIR);
    
    if (!fs.existsSync(automationsDir)) {
        logger.warn({ dir: automationsDir }, '[HMR] Automations directory does not exist');
        // Still mark as ready even if dir doesn't exist
        if (hmrReadyResolve) hmrReadyResolve();
        return automationRouter;
    }
    
    const files = fs.readdirSync(automationsDir).filter(file => file.endsWith('.ts'));
    
    // Load all automations in parallel
    await Promise.all(files.map(file => loadAutomation(file, context)));
    
    // Build the initial router
    automationRouter = rebuildRouter(context);
    
    logger.info({ count: automationRegistry.size }, '[HMR] Initialized with automations');
    
    // Signal that HMR is ready
    if (hmrReadyResolve) hmrReadyResolve();
    
    // Process any pending changes that arrived before initialization
    if (pendingChanges.length > 0) {
        logger.info({ count: pendingChanges.length }, '[HMR] Processing pending file changes');
        for (const { eventType, filePath } of pendingChanges) {
            await processFileChange(eventType, filePath);
        }
        pendingChanges.length = 0; // Clear the queue
    }
    
    return automationRouter;
}

/**
 * Reload a specific automation file (called when file changes)
 */
export async function reloadAutomation(filename: string): Promise<boolean> {
    if (!currentContext) {
        logger.error({}, '[HMR] Cannot reload: HMR not initialized');
        return false;
    }
    
    const startTime = Date.now();
    logger.info({ automation: filename }, `[HMR] Reloading automation: ${filename}`);
    
    // Emit stop event before reloading
    await generateEvent({
        path: `services/${serviceName}/stop`,
        from: serviceName,
        user: 'system',
        payload: { hmr: true, automation: filename, action: 'reload' }
    }, getServiceToken());
    
    // Remove from registry
    automationRegistry.delete(filename);
    
    // Reload the automation
    const success = await loadAutomation(filename, currentContext);
    
    if (success) {
        // Rebuild the router with all automations
        automationRouter = rebuildRouter(currentContext);
        const elapsed = Date.now() - startTime;
        logger.info({ automation: filename, elapsed }, `[HMR] Reloaded automation in ${elapsed}ms: ${filename}`);
        
        // Emit start/ready event after successful reload
        await generateEvent({
            path: `services/${serviceName}/start`,
            from: serviceName,
            user: 'system',
            payload: { hmr: true, automation: filename, action: 'reload', elapsed }
        }, getServiceToken());
        
        await generateEvent({
            path: 'services/api/ready',
            from: 'api',
            user: 'system',
            payload: { state: 'ready', hmr: true, automation: filename }
        }, getServiceToken());
    }
    
    return success;
}

/**
 * Remove an automation (called when file is deleted)
 */
export async function removeAutomation(filename: string): Promise<void> {
    if (!currentContext) {
        logger.error({}, '[HMR] Cannot remove: HMR not initialized');
        return;
    }
    
    if (automationRegistry.has(filename)) {
        // Emit stop event before removing
        await generateEvent({
            path: `services/${serviceName}/stop`,
            from: serviceName,
            user: 'system',
            payload: { hmr: true, automation: filename, action: 'remove' }
        }, getServiceToken());
        
        automationRegistry.delete(filename);
        automationRouter = rebuildRouter(currentContext);
        logger.info({ automation: filename }, `[HMR] Removed automation: ${filename}`);
        
        // Emit start/ready event after removal
        await generateEvent({
            path: `services/${serviceName}/start`,
            from: serviceName,
            user: 'system',
            payload: { hmr: true, automation: filename, action: 'remove' }
        }, getServiceToken());
        
        await generateEvent({
            path: 'services/api/ready',
            from: 'api',
            user: 'system',
            payload: { state: 'ready', hmr: true, automation: filename }
        }, getServiceToken());
    }
}

/**
 * Add a new automation (called when file is created)
 */
export async function addAutomation(filename: string): Promise<boolean> {
    if (!currentContext) {
        logger.error({}, '[HMR] Cannot add: HMR not initialized');
        return false;
    }
    
    const startTime = Date.now();
    logger.info({ automation: filename }, `[HMR] Adding new automation: ${filename}`);
    
    // Emit stop event before adding
    await generateEvent({
        path: `services/${serviceName}/stop`,
        from: serviceName,
        user: 'system',
        payload: { hmr: true, automation: filename, action: 'add' }
    }, getServiceToken());
    
    const success = await loadAutomation(filename, currentContext);
    
    if (success) {
        automationRouter = rebuildRouter(currentContext);
        const elapsed = Date.now() - startTime;
        logger.info({ automation: filename, elapsed }, `[HMR] Added automation in ${elapsed}ms: ${filename}`);
        
        // Emit start/ready event after successful add
        await generateEvent({
            path: `services/${serviceName}/start`,
            from: serviceName,
            user: 'system',
            payload: { hmr: true, automation: filename, action: 'add', elapsed }
        }, getServiceToken());
        
        await generateEvent({
            path: 'services/api/ready',
            from: 'api',
            user: 'system',
            payload: { state: 'ready', hmr: true, automation: filename }
        }, getServiceToken());
    }
    
    return success;
}

/**
 * Get the current automation router (use in middleware)
 */
export function getAutomationRouter(): Router {
    return automationRouter;
}

/**
 * Middleware that delegates to the current automation router
 * This allows hot-swapping the router without restarting the server
 */
export function automationMiddleware() {
    return (req: any, res: any, next: any) => {
        automationRouter(req, res, next);
    };
}

/**
 * Process a file change event (internal, called after HMR is ready)
 */
async function processFileChange(eventType: string, filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    
    switch (eventType) {
        case 'change':
            await reloadAutomation(filename);
            break;
        case 'add':
            await addAutomation(filename);
            break;
        case 'unlink':
            await removeAutomation(filename);
            break;
    }
}

/**
 * Handle file system events for HMR
 */
export async function handleFileChange(eventType: string, filePath: string): Promise<void> {
    // Extract just the filename
    const filename = path.basename(filePath);
    
    // Only handle .ts files
    if (!filename.endsWith('.ts')) {
        return;
    }
    
    // If HMR is not initialized yet, queue the change
    if (!currentContext) {
        logger.info({ automation: filename, eventType }, '[HMR] Queuing file change (waiting for init)');
        pendingChanges.push({ eventType, filePath });
        return;
    }
    
    await processFileChange(eventType, filePath);
}

