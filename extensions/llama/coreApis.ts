import { handler } from 'protonode';
import { getLogger } from 'protobase';
import {
    llamaChat,
    llamaPrompt,
    llamaListModels,
    llamaDownloadModel,
    llamaDeleteModel,
    llamaUnloadModel,
    llamaStatus
} from './coreContext';

const logger = getLogger();

export default (app, context) => {
    /**
     * POST /api/core/v1/llama/chat
     * Chat completions with message history
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
            const response = await llamaChat({
                model: model || 'default',
                messages
            });

            if ((response as any).isError) {
                res.status(500).send(response);
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
     * Simple prompt (stateful session)
     */
    app.post('/api/core/v1/llama/generate', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        const { model, prompt, sessionId } = req.body;

        if (!prompt) {
            res.status(400).send({ error: 'prompt is required' });
            return;
        }

        try {
            const response = await llamaPrompt({
                model: model || 'default',
                message: prompt,
                sessionId
            });

            if ((response as any).isError) {
                res.status(500).send(response);
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
     * List available models in data/models/
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
     * Download a GGUF model from URL (e.g., HuggingFace)
     * 
     * Body: { url: "https://huggingface.co/.../model.gguf", filename?: "custom-name.gguf" }
     */
    app.post('/api/core/v1/llama/models/download', handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        const { url, filename } = req.body;

        if (!url) {
            res.status(400).send({ error: 'url is required' });
            return;
        }

        try {
            logger.info({ url, filename }, 'Starting model download');
            
            const result = await llamaDownloadModel({
                url,
                filename,
                onProgress: (progress) => {
                    logger.debug({ progress }, 'Model download progress');
                }
            });

            if (!result.success) {
                res.status(500).send({ error: result.error });
                return;
            }

            logger.info({ result }, 'Model download completed');
            res.json(result);
        } catch (err: any) {
            logger.error({ error: err?.message, url }, 'Error in /llama/models/download');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * DELETE /api/core/v1/llama/models/delete
     * Delete a model file
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
            logger.info({ model }, 'Deleting model');
            
            const result = await llamaDeleteModel(model);

            if (!result.success) {
                res.status(500).send({ error: result.error });
                return;
            }

            logger.info({ model }, 'Model deleted');
            res.json(result);
        } catch (err: any) {
            logger.error({ error: err?.message, model }, 'Error in /llama/models/delete');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * POST /api/core/v1/llama/models/unload
     * Unload a model from memory
     */
    app.post('/api/core/v1/llama/models/unload', handler(async (req, res, session) => {
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
            const result = await llamaUnloadModel(model);
            res.json(result);
        } catch (err: any) {
            logger.error({ error: err?.message, model }, 'Error in /llama/models/unload');
            res.status(500).send({ error: err?.message || 'Internal server error' });
        }
    }));

    /**
     * GET /api/core/v1/llama/status
     * Get status of the LLM system
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
};

