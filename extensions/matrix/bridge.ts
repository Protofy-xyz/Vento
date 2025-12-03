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
const VENTO_ROOM_LOCAL_ALIAS = 'vento';
// Cache for DM room -> agent mapping
const dmRoomAgentCache: Map<string, string> = new Map();
// Room ID of #vento (to exclude from DM detection)
let ventoRoomId: string | null = null;
// Track if we've tried to ensure the room exists
let ventoRoomEnsured = false;
// Max history messages to keep per DM
const MAX_DM_HISTORY = 50;
// Timeout for agent calls (in milliseconds)
const AGENT_CALL_TIMEOUT_MS = 120000; // 2 minutes

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);

        promise
            .then((result) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
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
 * Ensure the #vento room exists, creating it if necessary
 * Returns the room ID
 */
async function ensureVentoRoom(): Promise<string | null> {
    if (ventoRoomId) {
        return ventoRoomId;
    }
    
    if (ventoRoomEnsured) {
        // Already tried, don't retry
        return ventoRoomId;
    }
    ventoRoomEnsured = true;
    
    // First, try to resolve the room alias to get the room ID
    try {
        const resolveResult = await matrixRequest(
            'GET',
            `/_matrix/client/v3/directory/room/${encodeURIComponent(VENTO_ROOM_ALIAS)}`
        );
        if (resolveResult?.room_id) {
            ventoRoomId = resolveResult.room_id;
            logger.info({ roomId: ventoRoomId }, '#vento room already exists');
            return ventoRoomId;
        }
    } catch (error: any) {
        // Room doesn't exist, we'll create it
        logger.info('#vento room does not exist, creating it...');
    }
    
    // Create the room as the appservice bot (ventobot)
    const botUserId = `@ventobot:${SERVER_NAME}`;
    try {
        // First register the bot user if needed
        try {
            await matrixRequest('POST', '/_matrix/client/v3/register', {
                type: 'm.login.application_service',
                username: 'ventobot',
            });
        } catch (e) {
            // Bot user might already exist, that's fine
        }
        
        // Create the room
        const createResult = await matrixRequest(
            'POST',
            '/_matrix/client/v3/createRoom',
            {
                name: 'Vento Network',
                topic: 'Vento agents and users network',
                room_alias_name: VENTO_ROOM_LOCAL_ALIAS,
                visibility: 'public',
                preset: 'public_chat',
                initial_state: [
                    {
                        type: 'm.room.join_rules',
                        state_key: '',
                        content: { join_rule: 'public' }
                    },
                    {
                        type: 'm.room.history_visibility',
                        state_key: '',
                        content: { history_visibility: 'shared' }
                    }
                ]
            },
            botUserId
        );
        
        ventoRoomId = createResult?.room_id;
        logger.info({ roomId: ventoRoomId }, 'Created #vento room');
        return ventoRoomId;
    } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to create #vento room');
        return null;
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

    // Ensure the room exists first
    const roomId = await ensureVentoRoom();
    if (!roomId) {
        logger.warn({ agent: agent.boardId }, 'Cannot join #vento - room could not be created');
        return;
    }

    logger.info({ agent: agent.boardId, room: VENTO_ROOM_ALIAS, matrixId: agent.matrixUserId }, 'Attempting to join #vento');

    try {
        // Join by room ID (more reliable than alias)
        const joinResult = await matrixRequest(
            'POST',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`,
            {},
            agent.matrixUserId
        );
        agentsInVentoRoom.add(agent.matrixUserId);
        logger.info({ agent: agent.boardId, room: VENTO_ROOM_ALIAS, joinResult }, 'Agent joined #vento room');
    } catch (error: any) {
        logger.warn({ error: error.message, agent: agent.boardId, room: VENTO_ROOM_ALIAS }, 'Join error');
        // Already joined - mark anyway
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
    for (const [boardId, agent] of Array.from(registeredAgents)) {
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

    const apiCall = API.get(url + `?message=${encodeURIComponent(message)}&sender=${encodeURIComponent(sender)}&token=${token}`);
    
    const response = await withTimeout(
        apiCall,
        AGENT_CALL_TIMEOUT_MS,
        `Agent ${boardId} did not respond within ${AGENT_CALL_TIMEOUT_MS / 1000} seconds`
    );

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
    const apiCall = API.get(url + `?message=${encodeURIComponent(messageParam)}&sender=${encodeURIComponent(sender)}&token=${token}`);
    
    const response = await withTimeout(
        apiCall,
        AGENT_CALL_TIMEOUT_MS,
        `Agent ${boardId} did not respond within ${AGENT_CALL_TIMEOUT_MS / 1000} seconds`
    );

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
        // Handle invite in background (non-blocking)
        handleInvite(event).catch(err => {
            logger.error({ error: err.message }, 'Error handling invite');
        });
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

    logger.debug({ sender, roomId, body: body.substring(0, 50) }, 'Processing Matrix message');

    // Check if message mentions an agent
    for (const [boardId, agent] of Array.from(registeredAgents)) {
        const mentionPatterns = [
            new RegExp(`^@?${USER_PREFIX}${boardId}[:\\s]+(.+)$`, 'is'),
            new RegExp(`^@?${boardId}[:\\s]+(.+)$`, 'is'),
        ];

        for (const pattern of mentionPatterns) {
            const match = body.match(pattern);
            if (match) {
                const message = match[1].trim();
                logger.info({ agent: boardId, message, sender }, 'Agent mentioned');

                // Handle agent call in background (non-blocking)
                handleAgentMention(agent, boardId, roomId, message, sender);
                return;
            }
        }
    }

    // No mention found - check if this is a DM with an agent
    // Handle DM detection and processing in background (fully non-blocking)
    processMessageAsDM(roomId, body, sender);
}

/**
 * Process a message as potential DM (non-blocking)
 */
async function processMessageAsDM(roomId: string, body: string, sender: string): Promise<void> {
    try {
        const dmAgent = await detectDMAgent(roomId, sender);
        if (dmAgent) {
            logger.debug({ agent: dmAgent.boardId, sender, roomId }, 'DM to agent detected');
            // Don't await - let it run in background
            handleAgentDM(dmAgent, roomId, body, sender).catch(err => {
                logger.error({ error: err.message, roomId, agent: dmAgent.boardId }, 'handleAgentDM failed');
            });
        }
    } catch (error: any) {
        logger.error({ error: error.message, roomId }, 'Error detecting DM agent');
    }
}


/**
 * Handle agent mention in background (non-blocking)
 */
async function handleAgentMention(agent: VentoAgent, boardId: string, roomId: string, message: string, sender: string): Promise<void> {
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
}

/**
 * Handle DM to agent - each message is processed independently (no queue/locks)
 * This allows multiple messages to be sent while waiting for responses
 */
async function handleAgentDM(agent: VentoAgent, roomId: string, body: string, sender: string): Promise<void> {
    logger.debug({ roomId, agent: agent.boardId }, 'handleAgentDM called');
    
    try {
        // Show typing indicator while processing
        await setTypingIndicator(agent, roomId, true).catch(() => {});
        
        // Load conversation history (per room, so new DM = fresh conversation)
        const history = loadDMHistory(agent.boardId, roomId);
        
        // Add user's new message to history
        history.push({ role: 'user', content: body });
        
        // Save history with user message immediately (so parallel requests see it)
        saveDMHistory(agent.boardId, roomId, history);
        
        // Call agent with full history
        logger.debug({ roomId, agent: agent.boardId, historyLength: history.length }, 'Calling agent API');
        const response = await callAgentWithHistory(agent.boardId, history, sender);
        logger.debug({ roomId, agent: agent.boardId, responseLength: response?.length }, 'Agent responded');
        
        // Stop typing indicator
        await setTypingIndicator(agent, roomId, false).catch(() => {});
        
        // Re-load history (it may have changed while we were waiting)
        const updatedHistory = loadDMHistory(agent.boardId, roomId);
        
        // Add assistant's response to history
        updatedHistory.push({ role: 'assistant', content: response });
        
        // Save updated history
        saveDMHistory(agent.boardId, roomId, updatedHistory);
        
        // Send response to Matrix
        await sendMessageAsAgent(agent, roomId, response);
        logger.info({ roomId, agent: agent.boardId }, 'Response sent to Matrix');
    } catch (error: any) {
        // Stop typing indicator on error (ignore failures)
        await setTypingIndicator(agent, roomId, false).catch(() => {});
        
        logger.error({ error: error.message, agent: agent.boardId, roomId }, 'Error handling DM message');
        
        // Try to send error message (but don't fail if this fails)
        try {
            await sendErrorAsAgent(agent, roomId, error);
            logger.info({ roomId }, 'Error message sent to Matrix');
        } catch (sendError: any) {
            logger.error({ error: sendError.message }, 'Failed to send error message to Matrix');
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
 * Sync agents with cleanup - removes agents that no longer exist from Matrix
 * This compares current boards with previously registered agents and removes stale ones
 */
export async function syncAgentsWithCleanup(): Promise<void> {
    try {
        logger.info('Starting Matrix agent sync with cleanup...');
        const token = getServiceToken();
        
        // Get current boards from API
        const response = await API.get(`/api/core/v1/boards?all=true&token=${token}`);

        if (response.isError) {
            logger.warn({ error: response.error }, 'Failed to fetch boards for agent sync');
            return;
        }

        const boards = response.data?.items || response.data || [];
        
        // Build set of valid agent board names
        const validAgentNames = new Set<string>();
        for (const board of boards) {
            const boardName = board.name;
            const visibility = board.visibility;
            const isVisibleInChat = !visibility || (Array.isArray(visibility) && visibility.includes('chat'));
            const hasAgentInput = board.cards?.some((card: any) =>
                card.name === 'agent_input' || card.enableAgentInputMode
            );
            
            if (isVisibleInChat && hasAgentInput) {
                validAgentNames.add(boardName);
            }
        }
        
        // Find agents that are registered but no longer valid
        const agentsToRemove: string[] = [];
        for (const [boardId] of Array.from(registeredAgents)) {
            if (!validAgentNames.has(boardId)) {
                agentsToRemove.push(boardId);
            }
        }
        
        // Remove stale agents
        for (const boardId of agentsToRemove) {
            logger.info({ boardId }, 'Removing stale agent');
            await removeAgent(boardId);
        }
        
        // Now do normal sync for remaining/new agents
        await syncAgents();
        
        logger.info({ removed: agentsToRemove.length, agentsToRemove }, 'Sync with cleanup completed');
    } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack }, 'Error in syncAgentsWithCleanup');
    }
}

/**
 * Clean up orphaned agents from #vento room on startup
 * This handles agents that were left in Matrix from previous bridge runs
 */
export async function cleanupOrphanedAgents(): Promise<void> {
    try {
        logger.info('Cleaning up orphaned agents from previous runs...');
        
        // First ensure we have the #vento room ID
        const roomId = await ensureVentoRoom();
        if (!roomId) {
            logger.warn('Cannot cleanup orphaned agents - #vento room not available');
            return;
        }
        
        // Get current valid agent names from API
        const token = getServiceToken();
        const response = await API.get(`/api/core/v1/boards?all=true&token=${token}`);
        
        if (response.isError) {
            logger.warn({ error: response.error }, 'Failed to fetch boards for orphan cleanup');
            return;
        }
        
        const boards = response.data?.items || response.data || [];
        const validAgentNames = new Set<string>();
        
        for (const board of boards) {
            const boardName = board.name;
            const visibility = board.visibility;
            const isVisibleInChat = !visibility || (Array.isArray(visibility) && visibility.includes('chat'));
            const hasAgentInput = board.cards?.some((card: any) =>
                card.name === 'agent_input' || card.enableAgentInputMode
            );
            
            if (isVisibleInChat && hasAgentInput) {
                validAgentNames.add(boardName.toLowerCase());
            }
        }
        
        logger.info({ validAgents: Array.from(validAgentNames) }, 'Valid agents from current boards');
        
        // Get all members of #vento room using the appservice bot
        const botUserId = `@ventobot:${SERVER_NAME}`;
        let members: any[] = [];
        
        try {
            const membersResult = await matrixRequest(
                'GET',
                `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/members?membership=join`,
                undefined,
                botUserId
            );
            members = membersResult?.chunk || [];
        } catch (error: any) {
            logger.warn({ error: error.message }, 'Failed to get #vento room members');
            return;
        }
        
        // Find _vento_ users that are not valid agents
        const orphanedUsers: string[] = [];
        for (const member of members) {
            const userId = member.state_key;
            if (userId && userId.startsWith(`@${USER_PREFIX}`)) {
                // Extract agent name from @_vento_agentname:server
                const agentName = getAgentNameFromMatrixId(userId);
                if (agentName && !validAgentNames.has(agentName.toLowerCase())) {
                    orphanedUsers.push(userId);
                }
            }
        }
        
        if (orphanedUsers.length === 0) {
            logger.info('No orphaned agents found');
            return;
        }
        
        logger.info({ orphanedUsers }, 'Found orphaned agents to remove');
        
        // Remove each orphaned user from #vento
        for (const orphanUserId of orphanedUsers) {
            try {
                // Set presence to offline
                await matrixRequest(
                    'PUT',
                    `/_matrix/client/v3/presence/${encodeURIComponent(orphanUserId)}/status`,
                    { presence: 'offline' },
                    orphanUserId
                );
                
                // Leave the #vento room
                await matrixRequest(
                    'POST',
                    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/leave`,
                    {},
                    orphanUserId
                );
                
                logger.info({ orphanUserId }, 'Removed orphaned agent from #vento');
            } catch (error: any) {
                logger.warn({ error: error.message, orphanUserId }, 'Failed to remove orphaned agent');
            }
        }
        
        logger.info({ removed: orphanedUsers.length }, 'Orphan cleanup completed');
    } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack }, 'Error cleaning up orphaned agents');
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
    for (const [, agent] of Array.from(registeredAgents)) {
        await setAgentPresence(agent, 'online');
    }
}


/**
 * Leave a room as an agent
 */
async function leaveRoom(agent: VentoAgent, roomId: string): Promise<void> {
    try {
        await matrixRequest(
            'POST',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/leave`,
            {},
            agent.matrixUserId
        );
        logger.info({ agent: agent.boardId, roomId }, 'Agent left room');
    } catch (error: any) {
        logger.warn({ error: error.message, agent: agent.boardId, roomId }, 'Failed to leave room');
    }
}

/**
 * Get all rooms an agent is joined to
 */
async function getAgentJoinedRooms(agent: VentoAgent): Promise<string[]> {
    try {
        const result = await matrixRequest(
            'GET',
            '/_matrix/client/v3/joined_rooms',
            undefined,
            agent.matrixUserId
        );
        return result?.joined_rooms || [];
    } catch (error: any) {
        logger.warn({ error: error.message, agent: agent.boardId }, 'Failed to get joined rooms');
        return [];
    }
}

/**
 * Remove an agent completely - leave all rooms and clean up state
 * Called when a board is deleted
 */
export async function removeAgent(boardId: string): Promise<void> {
    const agent = registeredAgents.get(boardId);
    if (!agent) {
        logger.debug({ boardId }, 'Agent not found, nothing to remove');
        return;
    }

    logger.info({ agent: agent.boardId, matrixId: agent.matrixUserId }, 'Removing agent from Matrix');

    // Set presence to offline first
    await setAgentPresence(agent, 'offline');

    // Get all rooms the agent is in and leave them
    const joinedRooms = await getAgentJoinedRooms(agent);
    logger.info({ agent: agent.boardId, roomCount: joinedRooms.length }, 'Leaving all rooms');

    for (const roomId of joinedRooms) {
        await leaveRoom(agent, roomId);
    }

    // Clean up all internal state
    registeredAgents.delete(boardId);
    createdMatrixUsers.delete(agent.matrixUserId);
    agentsInVentoRoom.delete(agent.matrixUserId);

    // Clean up DM cache - remove any entries pointing to this agent
    Array.from(dmRoomAgentCache.entries()).forEach(([roomId, agentId]) => {
        if (agentId === boardId) {
            dmRoomAgentCache.delete(roomId);
        }
    });

    logger.info({ agent: boardId }, 'Agent removed successfully');
}

// Export config for status endpoint
export const APPSERVICE_CONFIG = {
    homeserverUrl: HOMESERVER_URL,
    serverName: SERVER_NAME,
    userPrefix: USER_PREFIX,
};
