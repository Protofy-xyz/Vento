/**
 * API client for Vento
 * Reuses the same endpoints as the MCP server
 */

const path = require('path');

// Load .env from project root
require('dotenv').config({ 
  path: path.resolve(__dirname, '../../../.env') 
});

const { getServiceToken } = require('protonode');

const API_BASE = process.env.API_URL || 'http://localhost:8000';

/**
 * Get auth token
 */
function getToken() {
  return getServiceToken();
}

/**
 * Fetch with auth
 */
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const url = `${API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${token}`;
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const text = await res.text();
  
  if (!text || text.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Get all boards (agents)
 */
async function getBoards() {
  const data = await apiFetch('/api/core/v1/boards?all=true');
  return data?.items || [];
}

/**
 * Get a single board with details
 */
async function getBoard(boardName) {
  return await apiFetch(`/api/core/v1/boards/${boardName}`);
}

/**
 * Get all tools (actions from all boards)
 */
async function getTools() {
  const boards = await getBoards();
  const tools = [];

  for (const board of boards) {
    const fullBoard = await getBoard(board.name);
    const actions = (fullBoard?.cards || []).filter(c => c.type === 'action');
    
    for (const action of actions) {
      tools.push({
        board: board.name,
        name: action.name,
        fullName: `${board.name}_${action.name}`,
        description: action.description || '',
        params: action.params || {}
      });
    }

    // Add chat tool
    tools.push({
      board: board.name,
      name: 'chat',
      fullName: `${board.name}_chat`,
      description: `Chat with ${board.name} agent`,
      params: { message: 'Message to send' }
    });
  }

  return tools;
}

/**
 * Get all values from all boards
 */
async function getValues() {
  const boards = await getBoards();
  const values = [];

  for (const board of boards) {
    const fullBoard = await getBoard(board.name);
    const valueCards = (fullBoard?.cards || []).filter(c => c.type === 'value');
    
    for (const card of valueCards) {
      values.push({
        board: board.name,
        name: card.name,
        fullName: `${board.name}/${card.name}`,
        description: card.description || '',
        value: card.value
      });
    }
  }

  return values;
}

/**
 * Get a specific value
 */
async function getValue(boardName, cardName) {
  return await apiFetch(`/api/core/v1/boards/${boardName}/cards/${cardName}`);
}

/**
 * Execute an action
 */
async function runAction(boardName, actionName, params = {}) {
  return await apiFetch(`/api/core/v1/boards/${boardName}/actions/${actionName}`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * Chat with an agent
 */
async function chat(boardName, message) {
  return await apiFetch(`/api/agents/v1/${boardName}/agent_input`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

module.exports = {
  getBoards,
  getBoard,
  getTools,
  getValues,
  getValue,
  runAction,
  chat,
  API_BASE
};

