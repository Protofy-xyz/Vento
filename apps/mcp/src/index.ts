#!/usr/bin/env node
/**
 * Vento MCP Server
 * 
 * Exposes Vento boards as MCP tools and resources.
 * 
 * Tools:
 *   - {board}_chat: Send a message to the board's agent
 *   - {board}_{action}: Execute a specific action from the board
 * 
 * Resources:
 *   - vento://boards/{board}/values/{card}: Read a value card from a board
 */

import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
// @ts-ignore - protonode uses CommonJS
import pkg from 'protonode';
const { getServiceToken } = pkg;

// Configuration
const API_BASE = process.env.API_URL || 'http://localhost:8000';
const token = getServiceToken();

// Types
interface ConfigParam {
  type?: string;
  defaultValue?: any;
  visible?: boolean;
  description?: string;
}

interface Card {
  name: string;
  type: 'action' | 'value';
  description?: string;
  params?: Record<string, string>;
  configParams?: Record<string, ConfigParam>;
  enableAgentInputMode?: boolean;
}

interface Board {
  name: string;
  description?: string;
  cards: Card[];
  inputs?: {
    default?: string;
  };
}

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

// Fetch all boards from Vento API
async function fetchBoards(): Promise<Board[]> {
  try {
    const res = await fetch(`${API_BASE}/api/core/v1/boards?all=true&token=${token}`);
    if (!res.ok) {
      console.error(`Failed to fetch boards: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching boards:', error);
    return [];
  }
}

// Fetch a single board with full details
async function fetchBoard(boardName: string): Promise<Board | null> {
  try {
    const res = await fetch(`${API_BASE}/api/core/v1/boards/${boardName}?token=${token}`);
    if (!res.ok) {
      console.error(`Failed to fetch board ${boardName}: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error(`Error fetching board ${boardName}:`, error);
    return null;
  }
}

// Build MCP tools from boards
function buildTools(boards: Board[]): Tool[] {
  const tools: Tool[] = [];

  for (const board of boards) {
    // Chat tool for the board (talk to the agent)
    tools.push({
      name: `${board.name}_chat`,
      description: board.description 
        ? `Chat with "${board.name}" agent: ${board.description}`
        : `Send a message to the "${board.name}" agent`,
      inputSchema: {
        type: "object",
        properties: {
          message: { 
            type: "string", 
            description: "Message to send to the agent" 
          }
        },
        required: ["message"]
      }
    });

    // Action tools
    const actionCards = (board.cards || []).filter(c => c.type === 'action');
    
    for (const card of actionCards) {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      // Build input schema from params
      for (const [paramName, paramDesc] of Object.entries(card.params || {})) {
        const config = card.configParams?.[paramName];
        
        // Skip hidden params
        if (config?.visible === false) continue;

        // Determine type
        let paramType = "string";
        if (config?.type) {
          if (config.type === 'number' || config.type === 'integer') {
            paramType = 'number';
          } else if (config.type === 'boolean') {
            paramType = 'boolean';
          } else if (config.type === 'array') {
            paramType = 'array';
          } else if (config.type === 'object') {
            paramType = 'object';
          }
        }

        properties[paramName] = {
          type: paramType,
          description: paramDesc || config?.description || paramName
        };

        // If no default value, it's required
        if (config?.defaultValue === undefined) {
          required.push(paramName);
        }
      }

      tools.push({
        name: `${board.name}_${card.name}`,
        description: card.description || `Execute "${card.name}" action from board "${board.name}"`,
        inputSchema: {
          type: "object",
          properties,
          required
        }
      });
    }
  }

  return tools;
}

// Build MCP resources from boards
function buildResources(boards: Board[]): Resource[] {
  const resources: Resource[] = [];

  for (const board of boards) {
    const valueCards = (board.cards || []).filter(c => c.type === 'value');

    for (const card of valueCards) {
      resources.push({
        uri: `vento://boards/${board.name}/values/${card.name}`,
        name: `${board.name}/${card.name}`,
        description: card.description || `Value "${card.name}" from board "${board.name}"`,
        mimeType: "application/json"
      });
    }
  }

  return resources;
}

// Execute a tool
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  // Parse tool name: {board}_{action} or {board}_chat
  const underscoreIndex = name.indexOf('_');
  if (underscoreIndex === -1) {
    return JSON.stringify({ error: `Invalid tool name: ${name}` });
  }

  const boardName = name.substring(0, underscoreIndex);
  const actionName = name.substring(underscoreIndex + 1);

  try {
    if (actionName === 'chat') {
      // Chat with the agent via agent_input
      const res = await fetch(
        `${API_BASE}/api/agents/v1/${boardName}/agent_input?token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        }
      );
      
      if (!res.ok) {
        return JSON.stringify({ 
          error: `Agent request failed: ${res.status}`,
          message: await res.text()
        });
      }
      
      return JSON.stringify(await res.json());
    } else {
      // Execute action
      const res = await fetch(
        `${API_BASE}/api/core/v1/boards/${boardName}/actions/${actionName}?token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        }
      );

      if (!res.ok) {
        return JSON.stringify({ 
          error: `Action request failed: ${res.status}`,
          message: await res.text()
        });
      }

      return JSON.stringify(await res.json());
    }
  } catch (error) {
    return JSON.stringify({ 
      error: 'Request failed', 
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

// Read a resource
async function readResource(uri: string): Promise<string> {
  // Parse URI: vento://boards/{boardName}/values/{cardName}
  const match = uri.match(/^vento:\/\/boards\/([^/]+)\/values\/([^/]+)$/);
  if (!match) {
    return JSON.stringify({ error: `Invalid resource URI: ${uri}` });
  }

  const [, boardName, cardName] = match;

  try {
    const res = await fetch(
      `${API_BASE}/api/core/v1/boards/${boardName}/cards/${cardName}?token=${token}`
    );

    if (!res.ok) {
      return JSON.stringify({ 
        error: `Resource request failed: ${res.status}`,
        message: await res.text()
      });
    }

    const value = await res.json();
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return JSON.stringify({ 
      error: 'Request failed', 
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

// Main
async function main() {
  console.error('Vento MCP Server starting...');
  console.error(`API Base: ${API_BASE}`);

  // Fetch boards and build tools/resources
  const boards = await fetchBoards();
  console.error(`Loaded ${boards.length} boards`);

  // Fetch full details for each board
  const fullBoards: Board[] = [];
  for (const board of boards) {
    const fullBoard = await fetchBoard(board.name);
    if (fullBoard) {
      fullBoards.push(fullBoard);
    }
  }

  const tools = buildTools(fullBoards);
  const resources = buildResources(fullBoards);

  console.error(`Registered ${tools.length} tools and ${resources.length} resources`);

  // Create MCP server
  const server = new Server(
    { name: "vento", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  // Handler: list tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools
  }));

  // Handler: call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.error(`Calling tool: ${request.params.name}`);
    const result = await executeTool(
      request.params.name, 
      (request.params.arguments || {}) as Record<string, any>
    );
    return {
      content: [{ type: "text", text: result }]
    };
  });

  // Handler: list resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources
  }));

  // Handler: read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    console.error(`Reading resource: ${request.params.uri}`);
    const content = await readResource(request.params.uri);
    return {
      contents: [{ 
        uri: request.params.uri, 
        mimeType: "application/json", 
        text: content 
      }]
    };
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Vento MCP Server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

