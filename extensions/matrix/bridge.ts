/**
 * Matrix Application Service Bridge for Vento Agents
 * 
 * Each Vento agent appears as a real Matrix user (@_vento_agentname:vento.local)
 * Messages to these users are forwarded to the agent and responses sent back.
 */

import { API, getLogger } from 'protobase';
import { getServiceToken, getRoot } from 'protonode';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger();

// Appservice configuration
const HOMESERVER_URL = 'http://localhost:8008';
const SERVER_NAME = 'vento.local';
const USER_PREFIX = '_vento_';

// Load tokens from data/dendrite/appservice-tokens.json
function loadAppserviceTokens(): { as_token: string; hs_token: string } {
    const tokensFile = path.join(getRoot(), 'data', 'dendrite', 'appservice-tokens.json');
    try {
        if (fs.existsSync(tokensFile)) {
            const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
            return tokens;
        }
    } catch (e) {
        logger.warn({ error: (e as Error).message }, 'Error loading appservice tokens');
    }
    // Fallback (should not happen in production)
    logger.warn('Using fallback appservice tokens - run dendrite prepare to generate proper tokens');
    return {
        as_token: 'vento_appservice_token_fallback',
        hs_token: 'vento_homeserver_token_fallback'
    };
}

const { as_token: AS_TOKEN, hs_token: HS_TOKEN } = loadAppserviceTokens();

interface VentoAgent {
    boardId: string;
    name: string;
    displayName: string;
    matrixUserId: string;
}

// Store registered agents
const registeredAgents: Map<string, VentoAgent> = new Map();
// Track which agents have been created in Matrix
const createdMatrixUsers: Set<string> = new Set();
// Track which agents have joined #vento
const agentsInVentoRoom: Set<string> = new Set();
// Room alias for the main room
const VENTO_ROOM_ALIAS = '#vento:vento.local';

/**
 * Get Matrix user ID for an agent
 */
function getAgentMatrixId(agentName: string): string {
    return `@${USER_PREFIX}${agentName.toLowerCase()}:${SERVER_NAME}`;
}

/**
 * Extract agent name from Matrix user ID
 */
function getAgentNameFromMatrixId(userId: string): string | null {
    const match = userId.match(new RegExp(`^@${USER_PREFIX}(.+):${SERVER_NAME.replace('.', '\\.')}$`));
    return match ? match[1] : null;
}

/**
 * Make authenticated request to Matrix homeserver as appservice
 */
async function matrixRequest(method: string, endpoint: string, body?: any, asUser?: string): Promise<any> {
    const url = new URL(endpoint, HOMESERVER_URL);
    url.searchParams.set('access_token', AS_TOKEN);
    if (asUser) {
        url.searchParams.set('user_id', asUser);
    }

    const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Matrix API error: ${response.status} ${error}`);
    }
    return response.json();
}

/**
 * Register a virtual user in Matrix for an agent
 */
async function registerAgentUser(agent: VentoAgent): Promise<void> {
    if (createdMatrixUsers.has(agent.matrixUserId)) {
        logger.debug({ agent: agent.boardId }, 'Agent already registered, skipping');
        return;
    }

    const localpart = `${USER_PREFIX}${agent.boardId.toLowerCase()}`;
    logger.info({ localpart, matrixId: agent.matrixUserId }, 'Attempting to register Matrix user');
    
    try {
        // Register the user
        const registerResult = await matrixRequest('POST', '/_matrix/client/v3/register', {
            type: 'm.login.application_service',
            username: localpart,
        });
        logger.info({ registerResult, agent: agent.boardId }, 'Register result');
        
        // Set display name
        await matrixRequest(
            'PUT',
            `/_matrix/client/v3/profile/${encodeURIComponent(agent.matrixUserId)}/displayname`,
            { displayname: agent.displayName },
            agent.matrixUserId
        );

        createdMatrixUsers.add(agent.matrixUserId);
        logger.info({ agent: agent.boardId, matrixId: agent.matrixUserId }, 'Registered agent in Matrix');
    } catch (error: any) {
        logger.warn({ error: error.message, agent: agent.boardId, localpart }, 'Register error (may be OK if user exists)');
        // User might already exist - still mark as created so we try to join
        createdMatrixUsers.add(agent.matrixUserId);
    }
}

/**
 * Join an agent to a room by ID
 */
async function joinAgentToRoom(agent: VentoAgent, roomId: string): Promise<void> {
    try {
        await matrixRequest(
            'POST',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`,
            {},
            agent.matrixUserId
        );
        logger.debug({ agent: agent.boardId, roomId }, 'Agent joined room');
    } catch (error: any) {
        // Already joined or other error
        logger.debug({ error: error.message }, 'Could not join room');
    }
}

/**
 * Join an agent to the #vento room
 */
async function joinAgentToVentoRoom(agent: VentoAgent): Promise<void> {
    if (agentsInVentoRoom.has(agent.matrixUserId)) {
        logger.debug({ agent: agent.boardId }, 'Agent already in #vento, skipping');
        return;
    }

    logger.info({ agent: agent.boardId, room: VENTO_ROOM_ALIAS, matrixId: agent.matrixUserId }, 'Attempting to join #vento');

    try {
        // Join by alias
        const joinResult = await matrixRequest(
            'POST',
            `/_matrix/client/v3/join/${encodeURIComponent(VENTO_ROOM_ALIAS)}`,
            {},
            agent.matrixUserId
        );
        agentsInVentoRoom.add(agent.matrixUserId);
        logger.info({ agent: agent.boardId, room: VENTO_ROOM_ALIAS, joinResult }, 'Agent joined #vento room');
    } catch (error: any) {
        logger.warn({ error: error.message, agent: agent.boardId, room: VENTO_ROOM_ALIAS }, 'Join error');
        // Already joined or room doesn't exist - mark anyway
        agentsInVentoRoom.add(agent.matrixUserId);
    }
}

/**
 * Send a message as an agent
 */
async function sendMessageAsAgent(agent: VentoAgent, roomId: string, message: string): Promise<void> {
    const txnId = Date.now().toString();
    
    await matrixRequest(
        'PUT',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
        {
            msgtype: 'm.text',
            body: message,
        },
        agent.matrixUserId
    );
}

/**
 * Call the Vento agent and get response
 */
async function callAgentInput(boardId: string, message: string, sender: string): Promise<string> {
    const token = getServiceToken();
    const url = `/api/agents/v1/${boardId}/agent_input`;

    logger.debug({ url, message, sender }, 'Calling agent input');

    const response = await API.get(url + `?message=${encodeURIComponent(message)}&sender=${encodeURIComponent(sender)}&token=${token}`);

    if (response.isError) {
        throw new Error(response.error?.message || 'Agent call failed');
    }

    // Extract response text
    const data = response.data;
    if (typeof data === 'string') {
        return data;
    } else if (data?.response) {
        // Agent returned { response: "...", executedActions: [], approvals: [] }
        return data.response;
    } else if (data?.choices?.[0]?.message?.content) {
        // OpenAI-style response
        return data.choices[0].message.content;
    } else if (data?.message) {
        return data.message;
    } else if (data?.result) {
        return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
    }
    return JSON.stringify(data);
}

/**
 * Handle incoming Matrix event from appservice
 */
async function handleMatrixEvent(event: any): Promise<void> {
    // Only process room messages
    if (event.type !== 'm.room.message') return;
    
    const content = event.content;
    if (!content || content.msgtype !== 'm.text') return;

    const sender = event.sender;
    const roomId = event.room_id;
    const body = content.body || '';

    // Don't respond to our own messages
    if (sender.startsWith(`@${USER_PREFIX}`)) return;

    logger.debug({ sender, roomId, body }, 'Processing Matrix event');

    // Check if message is in a DM with an agent or mentions an agent
    // For now, check if any registered agent should respond
    
    // Look for mentions like @_vento_agentname or just agentname:
    for (const [boardId, agent] of registeredAgents) {
        const mentionPatterns = [
            new RegExp(`^@?${USER_PREFIX}${boardId}[:\\s]+(.+)$`, 'is'),
            new RegExp(`^@?${boardId}[:\\s]+(.+)$`, 'is'),
        ];

        for (const pattern of mentionPatterns) {
            const match = body.match(pattern);
            if (match) {
                const message = match[1].trim();
                logger.info({ agent: boardId, message, sender }, 'Agent mentioned');

                try {
                    // Ensure agent is registered and in room
                    await registerAgentUser(agent);
                    await joinAgentToRoom(agent, roomId);

                    // Call agent
                    const response = await callAgentInput(boardId, message, sender);

                    // Send response
                    await sendMessageAsAgent(agent, roomId, response);
                } catch (error: any) {
                    logger.error({ error: error.message, agent: boardId }, 'Error handling agent request');
                    await sendMessageAsAgent(agent, roomId, `❌ Error: ${error.message}`);
                }
                return;
            }
        }
    }
}

/**
 * Sync agents from Vento boards via API
 */
export async function syncAgents(): Promise<void> {
    try {
        logger.info('Starting Matrix agent sync...');
        const token = getServiceToken();
        
        // Use the correct API endpoint with all=true
        const response = await API.get(`/api/core/v1/boards?all=true&token=${token}`);

        if (response.isError) {
            logger.warn({ error: response.error }, 'Failed to fetch boards for agent sync');
            return;
        }

        // API returns { items: [...] }
        const boards = response.data?.items || response.data || [];
        logger.info({ boardCount: boards.length }, 'Found boards');
        
        registeredAgents.clear();

        for (const board of boards) {
            const boardName = board.name;
            
            logger.debug({ 
                boardName, 
                hasCards: !!board.cards,
                cardCount: board.cards?.length,
            }, 'Checking board');

            // Check if board has agent_input card
            const hasAgentInput = board.cards?.some((card: any) =>
                card.name === 'agent_input' || card.enableAgentInputMode
            );

            if (hasAgentInput) {
                const agent: VentoAgent = {
                    boardId: boardName,
                    name: boardName,
                    displayName: board.displayName || boardName,
                    matrixUserId: getAgentMatrixId(boardName),
                };
                registeredAgents.set(boardName, agent);
                logger.info({ agent: agent.boardId, matrixId: agent.matrixUserId }, 'Registering agent');
                
                // Register user in Matrix and join #vento
                await registerAgentUser(agent);
                await joinAgentToVentoRoom(agent);
            }
        }

        logger.info({ agentCount: registeredAgents.size, agents: Array.from(registeredAgents.keys()) }, 'Synced agents');
    } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack }, 'Error syncing agents');
    }
}

/**
 * Get list of registered agents
 */
export function getAgents(): VentoAgent[] {
    return Array.from(registeredAgents.values());
}

/**
 * Validate appservice request from homeserver
 */
export function validateHsToken(token: string): boolean {
    return token === HS_TOKEN;
}

/**
 * Handle appservice transaction (batch of events from homeserver)
 */
export async function handleTransaction(txnId: string, events: any[]): Promise<void> {
    logger.debug({ txnId, eventCount: events.length }, 'Processing appservice transaction');
    
    for (const event of events) {
        try {
            await handleMatrixEvent(event);
        } catch (error: any) {
            logger.error({ error: error.message, eventId: event.event_id }, 'Error processing event');
        }
    }
}

/**
 * Handle user query from homeserver (check if user exists)
 */
export async function handleUserQuery(userId: string): Promise<boolean> {
    const agentName = getAgentNameFromMatrixId(userId);
    if (!agentName) return false;

    // Check if this is a registered agent
    const agent = registeredAgents.get(agentName);
    if (agent) {
        await registerAgentUser(agent);
        return true;
    }

    return false;
}

// Export config for status endpoint
export const APPSERVICE_CONFIG = {
    homeserverUrl: HOMESERVER_URL,
    serverName: SERVER_NAME,
    userPrefix: USER_PREFIX,
};
