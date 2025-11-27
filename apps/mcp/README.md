# Vento MCP Server

MCP (Model Context Protocol) server that exposes Vento boards as tools and resources for AI assistants like Claude Desktop, Cursor, and other MCP-compatible clients.

## Features

- **Chat Tools**: Talk to any board's agent via `{board}_chat`
- **Action Tools**: Execute any action from any board via `{board}_{action}`
- **Value Resources**: Read value cards via `vento://boards/{board}/values/{card}`

## Setup

### 1. Install dependencies

From the project root:

```bash
cd apps/mcp
yarn install
```

### 2. Configure your MCP client

#### Cursor

Edit `~/.cursor/mcp.json` (create if doesn't exist):

```json
{
  "mcpServers": {
    "vento": {
      "command": "npx",
      "args": ["tsx", "C:/Users/YOUR_USER/path/to/vento/apps/mcp/src/index.ts"],
      "env": {
        "API_URL": "http://localhost:8000"
      }
    }
  }
}
```

#### Claude Desktop

Edit the Claude Desktop config file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vento": {
      "command": "npx",
      "args": ["tsx", "/path/to/vento/apps/mcp/src/index.ts"],
      "env": {
        "API_URL": "http://localhost:8000"
      }
    }
  }
}
```

### 3. Start Vento

Make sure Vento is running before connecting an MCP client:

```bash
yarn dev
```

### 4. Restart your MCP client

After configuring, restart Cursor or Claude Desktop to load the MCP server.

## Usage

### Tools

Each board exposes:

1. **Chat tool**: `{boardName}_chat`
   - Send messages to the board's agent
   - Input: `{ "message": "your message here" }`

2. **Action tools**: `{boardName}_{actionName}`
   - Execute specific actions
   - Input: depends on the action's parameters

### Resources

Value cards are exposed as resources with URI format:
```
vento://boards/{boardName}/values/{cardName}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:8080` | Vento API base URL |

## How it works

1. When an MCP client connects, the server starts
2. Server fetches all boards from Vento's API
3. Builds tools list from boards (chat + actions)
4. Builds resources list from value cards
5. Handles tool calls by proxying to Vento API
6. When client disconnects, server process ends

**Next connection sees updated boards**: Since the server fetches boards on startup, any changes to boards will be reflected the next time an MCP client connects.

## Troubleshooting

### Server doesn't start

- Check that Vento is running
- Check the API_URL is correct
- Look at stderr output for error messages

### Tools not appearing

- Verify boards exist in Vento
- Check that boards have action cards
- Restart the MCP client after making changes

### Authentication errors

- The server uses `getServiceToken()` for authentication
- Make sure the `.env` file exists in the project root with proper secrets

