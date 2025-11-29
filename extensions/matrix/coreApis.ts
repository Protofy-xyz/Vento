/**
 * Matrix Application Service - Core APIs
 * 
 * Exposes endpoints for:
 * 1. Matrix homeserver to push events (appservice protocol)
 * 2. Admin endpoints for status and management
 */

import { handler, requireAdmin } from 'protonode';
import { getLogger } from 'protobase';
import {
    syncAgents,
    getAgents,
    validateHsToken,
    handleTransaction,
    handleUserQuery,
    updateAllAgentsPresence,
    removeAgent,
    APPSERVICE_CONFIG,
} from './bridge';

const logger = getLogger();

export default async (app: any, context: any) => {
    logger.info('Initializing Matrix Application Service extension');

    // Initial sync after a delay (wait for other services)
    logger.info('Scheduling initial Matrix agent sync in 10 seconds...');
    setTimeout(async () => {
        logger.info('Running initial Matrix agent sync NOW');
        try {
            await syncAgents();
            logger.info('Initial agent sync completed successfully');
        } catch (error) {
            logger.error({ error: (error as Error).message, stack: (error as Error).stack }, 'Initial agent sync failed');
        }
    }, 10000);

    // Update agent presence periodically (every 30 seconds)
    setInterval(async () => {
        try {
            await updateAllAgentsPresence();
        } catch (error) {
            logger.warn({ error: (error as Error).message }, 'Failed to update agent presence');
        }
    }, 30000);

    // Hook into board updates to sync agents
    context.events?.onEvent?.(
        context.mqtt,
        context,
        async () => {
            logger.debug('Board updated, syncing Matrix agents');
            await syncAgents();
        },
        'boards/update/#'
    );

    context.events?.onEvent?.(
        context.mqtt,
        context,
        async () => {
            logger.info('Board created, syncing Matrix agents');
            await syncAgents();
        },
        'boards/create/#'
    );

    context.events?.onEvent?.(
        context.mqtt,
        context,
        async (msg: any) => {
            // Extract board name from event path: boards/delete/{boardName}
            const boardName = msg?.parsed?.path?.split('/')[2];
            if (boardName) {
                logger.info({ boardName }, 'Board deleted, removing Matrix agent');
                await removeAgent(boardName);
            } else {
                // Fallback: full sync if we can't extract the board name
                logger.debug('Board deleted, syncing Matrix agents');
                await syncAgents();
            }
        },
        'boards/delete/#'
    );

    // ===========================================
    // APPSERVICE ENDPOINTS (called by Dendrite)
    // Dendrite appends /_matrix/app/v1/ to the base URL
    // ===========================================

    const AS_BASE = '/api/core/v1/matrix/appservice/_matrix/app/v1';

    /**
     * PUT /_matrix/app/v1/transactions/:txnId
     * Receive events from Matrix homeserver
     */
    app.put(`${AS_BASE}/transactions/:txnId`, async (req: any, res: any) => {
        // Validate hs_token
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '') || req.query.access_token;
        
        if (!validateHsToken(token)) {
            logger.warn('Invalid hs_token in appservice request');
            return res.status(401).json({ errcode: 'M_UNKNOWN_TOKEN', error: 'Invalid token' });
        }

        const txnId = req.params.txnId;
        const events = req.body?.events || [];

        logger.info({ txnId, eventCount: events.length }, 'Received appservice transaction');

        try {
            await handleTransaction(txnId, events);
            res.json({});
        } catch (error: any) {
            logger.error({ error: error.message, txnId }, 'Error handling transaction');
            res.status(500).json({ errcode: 'M_UNKNOWN', error: error.message });
        }
    });

    /**
     * GET /_matrix/app/v1/users/:userId
     * Query if a user exists (user lookup)
     */
    app.get(`${AS_BASE}/users/:userId`, async (req: any, res: any) => {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '') || req.query.access_token;
        
        if (!validateHsToken(token)) {
            return res.status(401).json({ errcode: 'M_UNKNOWN_TOKEN', error: 'Invalid token' });
        }

        const userId = decodeURIComponent(req.params.userId);
        logger.info({ userId }, 'User query from homeserver');
        
        try {
            const exists = await handleUserQuery(userId);
            if (exists) {
                res.json({});
            } else {
                res.status(404).json({ errcode: 'M_NOT_FOUND', error: 'User not found' });
            }
        } catch (error: any) {
            logger.error({ error: error.message, userId }, 'Error handling user query');
            res.status(500).json({ errcode: 'M_UNKNOWN', error: error.message });
        }
    });

    /**
     * GET /_matrix/app/v1/rooms/:roomAlias
     * Query if a room alias exists
     */
    app.get(`${AS_BASE}/rooms/:roomAlias`, async (req: any, res: any) => {
        // We don't manage room aliases, always return not found
        res.status(404).json({ errcode: 'M_NOT_FOUND', error: 'Room not found' });
    });

    // ===========================================
    // ADMIN ENDPOINTS
    // ===========================================

    /**
     * GET /api/core/v1/matrix/status
     * Get appservice status
     */
    app.get('/api/core/v1/matrix/status', requireAdmin(), handler(async (req: any, res: any) => {
        res.json({
            type: 'appservice',
            homeserver: APPSERVICE_CONFIG.homeserverUrl,
            serverName: APPSERVICE_CONFIG.serverName,
            userPrefix: APPSERVICE_CONFIG.userPrefix,
            agents: getAgents(),
        });
    }));

    /**
     * POST /api/core/v1/matrix/sync
     * Force sync agents
     */
    app.post('/api/core/v1/matrix/sync', requireAdmin(), handler(async (req: any, res: any) => {
        await syncAgents();
        res.json({
            success: true,
            agents: getAgents(),
        });
    }));

    /**
     * GET /api/core/v1/matrix/agents
     * List agents
     */
    app.get('/api/core/v1/matrix/agents', requireAdmin(), handler(async (req: any, res: any) => {
        res.json({
            agents: getAgents(),
        });
    }));

    logger.info('Matrix Application Service APIs registered');
};
