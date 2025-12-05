# MCP Protocol

Vento exposes boards as tools for AI assistants via the Model Context Protocol (MCP).

## What is MCP?

MCP (Model Context Protocol) is a standard for connecting AI assistants to external tools and data sources. Vento implements an MCP server that exposes your boards.

## Configuration

### Cursor

Edit `~/.cursor/mcp.json`:

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

### Claude Desktop

Edit Claude's configuration file:

```json
{
  "mcpServers": {
    "vento": {
      "command": "node",
      "args": ["/path/to/vento/apps/mcp/dist/index.js"],
      "env": {
        "API_URL": "http://localhost:8000"
      }
    }
  }
}
```

## Exposed Tools

For each board, MCP exposes:

| Tool | Description |
|------|-------------|
| `{board}_chat` | Send message to agent |
| `{board}_{action}` | Execute specific action |

### Example

With a board named `home_automation`:

- `home_automation_chat` - Talk to the agent
- `home_automation_turn_lights_on` - Turn on lights
- `home_automation_set_temperature` - Set thermostat

## Exposed Resources

MCP resources expose value cards:

```
vento://boards/{board}/values/{card}
```

### Example

Read temperature sensor:
```
vento://boards/home_automation/values/temperature
```

## Using from AI Assistants

### Cursor

In Cursor, you can:

```
User: Turn on the living room lights

AI: I'll use the Vento home_automation board to do that.
[Calls home_automation_turn_lights_on with params]

The living room lights are now on.
```

### Claude Desktop

Claude can interact with your boards naturally:

```
User: What's the current temperature?

Claude: Let me check the sensor.
[Reads vento://boards/sensors/values/temperature]

The current temperature is 23.5°C.
```

## Building the MCP Server

If you need to rebuild:

```bash
cd apps/mcp
npm run build
```

Output is in `apps/mcp/dist/`.

