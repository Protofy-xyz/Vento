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
// Cache for DM room -> agent mapping
const dmRoomAgentCache: Map<string, string> = new Map();
// Room ID of #vento (to exclude from DM detection)
let ventoRoomId: string | null = null;
// Max history messages to keep per DM
const MAX_DM_HISTORY = 50;

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * Get the path for DM history file (per room, so new DM = new conversation)
 */
function getDMHistoryPath(agentName: string, roomId: string): string {
    // Sanitize names for filesystem
    const safeAgent = agentName.replace(/[^a-z0-9_-]/gi, '_');
    // Room IDs look like !abc123:server - sanitize for filesystem
    const safeRoom = roomId.replace(/[^a-z0-9_-]/gi, '_');
    return path.join(getRoot(), 'data', 'dendrite', 'dms', safeAgent, `${safeRoom}.json`);
}

/**
 * Load DM history for a room with an agent
 */
function loadDMHistory(agentName: string, roomId: string): ChatMessage[] {
    const historyPath = getDMHistoryPath(agentName, roomId);
    try {
        if (fs.existsSync(historyPath)) {
            const data = fs.readFileSync(historyPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        logger.warn({ error: (e as Error).message, agentName, roomId }, 'Error loading DM history');
    }
    return [];
}

/**
 * Save DM history for a room with an agent
 */
function saveDMHistory(agentName: string, roomId: string, history: ChatMessage[]): void {
    const historyPath = getDMHistoryPath(agentName, roomId);
    try {
        // Ensure directory exists
        const dir = path.dirname(historyPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Trim history to max size
        const trimmedHistory = history.slice(-MAX_DM_HISTORY);
        fs.writeFileSync(historyPath, JSON.stringify(trimmedHistory, null, 2));
    } catch (e) {
        logger.error({ error: (e as Error).message, agentName, roomId }, 'Error saving DM history');
    }
}

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
 * Set presence status for an agent (online/offline)
 */
async function setAgentPresence(agent: VentoAgent, presence: 'online' | 'offline' | 'unavailable' = 'online'): Promise<void> {
    try {
        await matrixRequest(
            'PUT',
            `/_matrix/client/v3/presence/${encodeURIComponent(agent.matrixUserId)}/status`,
            {
                presence: presence,
                status_msg: presence === 'online' ? 'Available' : undefined,
            },
            agent.matrixUserId
        );
        logger.debug({ agent: agent.boardId, presence }, 'Set agent presence');
    } catch (error: any) {
        logger.warn({ error: error.message, agent: agent.boardId }, 'Failed to set presence');
    }
}

/**
 * Register a virtual user in Matrix for an agent
 */
async function registerAgentUser(agent: VentoAgent): Promise<void> {
    if (createdMatrixUsers.has(agent.matrixUserId)) {
        logger.debug({ agent: agent.boardId }, 'Agent already registered, skipping');
        // Still update presence even if already registered
        await setAgentPresence(agent, 'online');
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

        // Set presence to online
        await setAgentPresence(agent, 'online');

        createdMatrixUsers.add(agent.matrixUserId);
        logger.info({ agent: agent.boardId, matrixId: agent.matrixUserId }, 'Registered agent in Matrix');
    } catch (error: any) {
        logger.warn({ error: error.message, agent: agent.boardId, localpart }, 'Register error (may be OK if user exists)');
        // User might already exist - still mark as created so we try to join
        createdMatrixUsers.add(agent.matrixUserId);
        // Try to set presence anyway
        await setAgentPresence(agent, 'online');
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
 * Detect if a room is a DM with one of our agents
 * Returns the agent if this is a DM, null otherwise
 */
async function detectDMAgent(roomId: string, sender: string): Promise<VentoAgent | null> {
    // Check cache first
    const cachedAgentId = dmRoomAgentCache.get(roomId);
    if (cachedAgentId) {
        const agent = registeredAgents.get(cachedAgentId);
        if (agent) {
            logger.debug({ roomId, agent: cachedAgentId }, 'Found agent in DM cache');
            return agent;
        }
    }

    // Skip if this is the #vento room
    if (ventoRoomId && roomId === ventoRoomId) {
        return null;
    }

    // Try to detect by querying room members as each agent
    // (appservice can't query rooms it's not in, but agents can)
    for (const [boardId, agent] of registeredAgents) {
        try {
            const membersResult = await matrixRequest(
                'GET',
                `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/members?membership=join`,
                undefined,
                agent.matrixUserId // Query as the agent
            );

            const members = membersResult?.chunk || [];
            const memberIds = members.map((m: any) => m.state_key);

            // If we got here, this agent is in the room
            // Check if it's a small room (DM-like)
            if (memberIds.length <= 3 && memberIds.includes(agent.matrixUserId)) {
                dmRoomAgentCache.set(roomId, boardId);
                logger.debug({ roomId, agent: boardId, memberCount: memberIds.length }, 'Detected DM room with agent');
                return agent;
            }
        } catch (error: any) {
            // This agent is not in the room, try next
            continue;
        }
    }

    logger.debug({ roomId }, 'No agent found for this room');
    return null;
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
 * Set typing indicator for an agent in a room
 */
async function setTypingIndicator(agent: VentoAgent, roomId: string, typing: boolean): Promise<void> {
    try {
        await matrixRequest(
            'PUT',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/typing/${encodeURIComponent(agent.matrixUserId)}`,
            {
                typing: typing,
                timeout: typing ? 30000 : undefined, // 30 second timeout when typing
            },
            agent.matrixUserId
        );
        logger.debug({ agent: agent.boardId, roomId, typing }, 'Set typing indicator');
    } catch (error: any) {
        // Non-critical, just log
        logger.debug({ error: error.message }, 'Failed to set typing indicator');
    }
}

/**
 * Send an error message as an agent
 * Only shows a simple message in chat - full error details are logged to stdout
 */
async function sendErrorAsAgent(agent: VentoAgent, roomId: string, error: Error | string): Promise<void> {
    // Log full error to stdout for debugging
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'object' && error.stack ? error.stack : '';
    logger.error({ agent: agent.boardId, roomId, error: errorMessage, stack: errorStack }, 'Agent error details');
    
    // Only show simple message in chat
    await sendMessageAsAgent(
        agent, 
        roomId, 
        `❌ Error communicating with agent`
    );
}

/**
 * Call the Vento agent and get response
 */
/**
 * Call agent with a simple message (for mentions in public rooms)
 */
async function callAgentInput(boardId: string, message: string, sender: string): Promise<string> {
    const token = getServiceToken();
    const url = `/api/agents/v1/${boardId}/agent_input`;

    logger.debug({ url, message, sender }, 'Calling agent input');

    const response = await API.get(url + `?message=${encodeURIComponent(message)}&sender=${encodeURIComponent(sender)}&token=${token}`);

    if (response.isError) {
        throw new Error(response.error?.message || 'Agent call failed');
    }

    return extractAgentResponse(response.data);
}

/**
 * Call agent with conversation history (for DMs)
 */
async function callAgentWithHistory(boardId: string, messages: ChatMessage[], sender: string): Promise<string> {
    const token = getServiceToken();
    const url = `/api/agents/v1/${boardId}/agent_input`;

    logger.debug({ url, messageCount: messages.length, sender }, 'Calling agent with history');

    // Send messages array as JSON in the message parameter
    const messageParam = JSON.stringify(messages);
    const response = await API.get(url + `?message=${encodeURIComponent(messageParam)}&sender=${encodeURIComponent(sender)}&token=${token}`);

    if (response.isError) {
        throw new Error(response.error?.message || 'Agent call failed');
    }

    return extractAgentResponse(response.data);
}

/**
 * Extract response text from agent response data
 */
function extractAgentResponse(data: any): string {
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
 * Handle invite event - auto-join when an agent is invited to a room
 */
async function handleInvite(event: any): Promise<void> {
    const stateKey = event.state_key; // The user being invited
    const roomId = event.room_id;
    const sender = event.sender;
    const content = event.content;

    // Check if this is an invite for one of our agents
    if (content?.membership !== 'invite') return;
    if (!stateKey.startsWith(`@${USER_PREFIX}`)) return;

    const agentName = getAgentNameFromMatrixId(stateKey);
    if (!agentName) return;

    const agent = registeredAgents.get(agentName);
    if (!agent) {
        logger.debug({ stateKey, agentName }, 'Invite for unknown agent');
        return;
    }

    logger.info({ agent: agent.boardId, roomId, invitedBy: sender }, 'Agent invited to room, auto-joining');

    try {
        await matrixRequest(
            'POST',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`,
            {},
            agent.matrixUserId
        );
        
        // Cache this room as a DM with this agent
        dmRoomAgentCache.set(roomId, agent.boardId);
        logger.info({ agent: agent.boardId, roomId }, 'Agent auto-joined room (cached as DM)');
    } catch (error: any) {
        logger.error({ error: error.message, agent: agent.boardId, roomId }, 'Failed to auto-join room');
    }
}

/**
 * Handle incoming Matrix event from appservice
 */
async function handleMatrixEvent(event: any): Promise<void> {
    // Handle invites first
    if (event.type === 'm.room.member') {
        await handleInvite(event);
        return;
    }

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

    // Check if message mentions an agent
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
                    await registerAgentUser(agent);
                    await joinAgentToRoom(agent, roomId);
                    
                    // Show typing indicator while processing
                    await setTypingIndicator(agent, roomId, true);
                    
                    try {
                        const response = await callAgentInput(boardId, message, sender);
                        await setTypingIndicator(agent, roomId, false);
                        await sendMessageAsAgent(agent, roomId, response);
                    } catch (agentError: any) {
                        await setTypingIndicator(agent, roomId, false);
                        throw agentError;
                    }
                } catch (error: any) {
                    logger.error({ error: error.message, agent: boardId }, 'Error handling agent request');
                    await sendErrorAsAgent(agent, roomId, error);
                }
                return;
            }
        }
    }

    // No mention found - check if this is a DM with an agent
    // A DM is detected when one of our agents is a member of this room (not #vento)
    const dmAgent = await detectDMAgent(roomId, sender);
    if (dmAgent) {
        logger.info({ agent: dmAgent.boardId, message: body, sender, roomId }, 'DM to agent');
        
        // Show typing indicator while processing
        await setTypingIndicator(dmAgent, roomId, true);
        
        try {
            // Load conversation history (per room, so new DM = fresh conversation)
            const history = loadDMHistory(dmAgent.boardId, roomId);
            
            // Add user's new message to history
            history.push({ role: 'user', content: body });
            
            // Call agent with full history
            const response = await callAgentWithHistory(dmAgent.boardId, history, sender);
            
            // Stop typing indicator
            await setTypingIndicator(dmAgent, roomId, false);
            
            // Add assistant's response to history
            history.push({ role: 'assistant', content: response });
            
            // Save updated history
            saveDMHistory(dmAgent.boardId, roomId, history);
            
            // Send response to Matrix
            await sendMessageAsAgent(dmAgent, roomId, response);
        } catch (error: any) {
            // Stop typing indicator on error
            await setTypingIndicator(dmAgent, roomId, false);
            
            logger.error({ error: error.message, stack: error.stack, agent: dmAgent.boardId }, 'Error handling DM');
            await sendErrorAsAgent(dmAgent, roomId, error);
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

            // Check visibility: visible if no visibility array, or if visibility includes 'chat'
            const visibility = board.visibility;
            const isVisibleInChat = !visibility || (Array.isArray(visibility) && visibility.includes('chat'));
            
            if (!isVisibleInChat) {
                logger.debug({ boardName, visibility }, 'Board not visible in chat, skipping');
                continue;
            }

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

/**
 * Update presence for all registered agents (call periodically)
 */
export async function updateAllAgentsPresence(): Promise<void> {
    for (const [, agent] of registeredAgents) {
        await setAgentPresence(agent, 'online');
    }
}

// Export config for status endpoint
export const APPSERVICE_CONFIG = {
    homeserverUrl: HOMESERVER_URL,
    serverName: SERVER_NAME,
    userPrefix: USER_PREFIX,
};
