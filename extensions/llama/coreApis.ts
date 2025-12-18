/**
 * =============================================================================
 * LLAMA EXTENSION - HTTP API Routes
 * =============================================================================
 * 
 * These routes handle /api/core/v1/llama/* endpoints.
 * The actual inference is done by llama-server (binary), managed by coreContext.
 * =============================================================================
 */

import { handler } from 'protonode';
import { getLogger } from 'protobase';
import {
    llamaChat,
    llamaPrompt,
    llamaListModels,
    llamaStartDownload,
    llamaGetDownloadProgress,
    llamaListDownloads,
    llamaDeleteModel,
    llamaUnloadModel,
    llamaStatus,
    llamaSystemReset,
    llamaFastShutdown,
    llamaPreload
} from './coreContext';

const logger = getLogger();

export default (app, context) => {
    /**
     * POST /api/core/v1/llama/chat
     */
    app.post('/api/core/v1/llama/chat', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        const { model, messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            res.status(400).send({ error: 'messages array is required' });
            return;
        }

        try {
            const response = await llamaChat({ model, messages });

            if ((response as any).isError) {
                res.status((response as any).statusCode || 500).send(response);
                return;
            }

            res.json(response);
        } catch (err: any) {
            logger.error({ error: err?.message }, 'Error in /llama/chat');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * POST /api/core/v1/llama/generate
     */
    app.post('/api/core/v1/llama/generate', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        const { model, prompt } = req.body;

        if (!prompt) {
            res.status(400).send({ error: 'prompt is required' });
            return;
        }

        try {
            const response = await llamaPrompt({ model, message: prompt });

            if ((response as any).isError) {
                res.status((response as any).statusCode || 500).send(response);
                return;
            }

            res.json({ response: response[0] });
        } catch (err: any) {
            logger.error({ error: err?.message }, 'Error in /llama/generate');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * GET /api/core/v1/llama/models
     */
    app.get('/api/core/v1/llama/models', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        try {
            const models = await llamaListModels();
            res.json({ models });
        } catch (err: any) {
            logger.error({ error: err?.message }, 'Error in /llama/models');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * POST /api/core/v1/llama/models/download
     */
    app.post('/api/core/v1/llama/models/download', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        const { url, filename, modelName } = req.body;

        if (!url) {
            res.status(400).send({ error: 'url is required' });
            return;
        }

        const rawName = modelName || filename || url.split('/').pop() || 'model';
        const name = rawName.replace(/\.gguf$/i, ''); // Remove .gguf extension if present

        try {
            const result = await llamaStartDownload({ url, modelName: name });
            res.json(result);
        } catch (err: any) {
            logger.error({ error: err?.message, url }, 'Error in /llama/models/download');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * GET /api/core/v1/llama/models/download/:downloadId
     */
    app.get('/api/core/v1/llama/models/download/:downloadId', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        const progress = llamaGetDownloadProgress(req.params.downloadId);
        if (!progress) {
            res.status(404).send({ error: 'Download not found' });
            return;
        }
        res.json(progress);
    }));

    /**
     * GET /api/core/v1/llama/models/downloads
     */
    app.get('/api/core/v1/llama/models/downloads', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }
        res.json({ downloads: llamaListDownloads() });
    }));

    /**
     * DELETE /api/core/v1/llama/models/delete
     */
    app.delete('/api/core/v1/llama/models/delete', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        const { model } = req.body;
        if (!model) {
            res.status(400).send({ error: 'model name is required' });
            return;
        }

        try {
            const result = await llamaDeleteModel(model);
            if (!result.success) {
                res.status(500).send({ error: result.error });
                return;
            }
            res.json(result);
        } catch (err: any) {
            logger.error({ error: err?.message }, 'Error in /llama/models/delete');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * POST /api/core/v1/llama/models/unload
     */
    app.post('/api/core/v1/llama/models/unload', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        try {
            const result = await llamaUnloadModel();
            res.json(result);
        } catch (err: any) {
            logger.error({ error: err?.message }, 'Error in /llama/models/unload');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * POST /api/core/v1/llama/preload
     * 
     * Preload the model so it's ready when user talks.
     * Called by AI Setup Wizard after download completes.
     */
    app.post('/api/core/v1/llama/preload', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        const { model } = req.body;

        try {
            const result = await llamaPreload(model);
            res.json(result);
        } catch (err: any) {
            logger.error({ error: err?.message }, 'Error in /llama/preload');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * GET /api/core/v1/llama/status
     */
    app.get('/api/core/v1/llama/status', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        try {
            const status = await llamaStatus();
            res.json(status);
        } catch (err: any) {
            logger.error({ error: err?.message }, 'Error in /llama/status');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * POST /api/core/v1/llama/system/reset
     */
    app.post('/api/core/v1/llama/system/reset', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        try {
            const result = await llamaSystemReset();
            res.json(result);
        } catch (err: any) {
            logger.error({ error: err?.message }, 'Error in /llama/system/reset');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    // =========================================================================
    // CLEANUP HOOK
    // =========================================================================
    
    if (context.registerCleanupHook) {
        context.registerCleanupHook('llama-server', async () => {
            logger.info('Stopping llama-server...');
            await llamaFastShutdown();
        });
    }

    // =========================================================================
    // AUTO-START: If ai.provider is 'llama', preload the model on startup
    // =========================================================================
    
    (async () => {
        try {
            // Wait for settings to be available
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const provider = await context.settings.get({ key: 'ai.provider' });
            
            if (provider !== 'llama') {
                logger.debug({ provider }, 'Llama auto-start skipped: ai.provider is not llama');
                return;
            }
            
            const localModel = await context.settings.get({ key: 'ai.localmodel' });
            
            logger.info({ model: localModel }, 'Auto-starting llama server (ai.provider = llama)...');
            
            const result = await llamaPreload(localModel || undefined);
            
            if (result.success) {
                logger.info({ model: result.model }, 'Llama server auto-started successfully');
            } else {
                logger.warn({ reason: result.message }, 'Llama server auto-start failed');
            }
        } catch (err: any) {
            logger.debug({ error: err?.message }, 'Llama auto-start error (settings may not be configured yet)');
        }
    })();

    logger.info('Llama extension loaded (uses external llama-server binary)');
};
