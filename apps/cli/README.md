# 🚀 Vento CLI

Command-line interface for interacting with Vento agents, tools, and values.

## Installation

The CLI is included in the Vento workspace. Just run:

```bash
yarn install
```

## Usage

### From project root

```bash
yarn vento [command]
```

### Interactive Mode

Run without arguments for an interactive menu:

```bash
yarn vento
```

This opens a menu where you can:
- Browse and select agents
- List and run tools
- View and get values
- Chat with agents

## Commands

### List Resources

```bash
# List all agents (boards)
yarn vento list agents

# List all tools (actions)
yarn vento list tools

# List tools for a specific board
yarn vento list tools --board control

# List all values
yarn vento list values

# List values for a specific board
yarn vento list values --board control
```

### Run a Tool

Execute an action from a board:

```bash
# Basic usage
yarn vento run <board>_<action>

# With parameters
yarn vento run control_set_temperature -p '{"value": 22}'

# Alternative format
yarn vento run control/set_temperature -p '{"value": 22}'
```

### Chat with an Agent

Send a message to a board's agent:

```bash
yarn vento chat <agent> <message>

# Examples
yarn vento chat control "Turn on the lights"
yarn vento chat llm_agent "What's the weather like?"
yarn vento chat agent_builder "Create a new agent for home automation"
```

### Get a Value

Read the current value of a card:

```bash
# Using slash format
yarn vento get control/temperature

# Using underscore format
yarn vento get control_temperature
```

## Examples

### List all available agents

```bash
$ yarn vento list agents

🤖 Vento Agents
────────────────────────────────────────
┌─────────────────┬─────────────────────┐
│ Agent           │ Description         │
├─────────────────┼─────────────────────┤
│ control         │ Home automation     │
│ llm_agent       │ General purpose LLM │
│ agent_builder   │ Create new agents   │
└─────────────────┴─────────────────────┘
• 3 agent(s) available
```

### Run an action with parameters

```bash
$ yarn vento run control_notify -p '{"message": "Hello!", "priority": "high"}'

🔧 Running control_notify
────────────────────────────────────────
• Parameters: {"message":"Hello!","priority":"high"}
- Executing...
✨ Action completed

{
  "success": true,
  "notificationId": "abc123"
}
```

### Chat with an agent

```bash
$ yarn vento chat control "What's the current temperature?"

💬 Chatting with control
────────────────────────────────────────
• You: What's the current temperature?

- Thinking...
🤖 control:
The current temperature is 22°C in the living room and 20°C in the bedroom.
```

### Get a value

```bash
$ yarn vento get control/temperature

📊 Value: control/temperature
────────────────────────────────────────
Board: control
Card: temperature

22.5
```

## Command Reference

| Command | Description |
|---------|-------------|
| `vento` | Interactive menu |
| `vento list agents` | List all agents |
| `vento list tools` | List all tools |
| `vento list values` | List all values |
| `vento run <tool>` | Run a tool |
| `vento chat <agent> <msg>` | Chat with agent |
| `vento get <value>` | Get a value |
| `vento --help` | Show help |
| `vento --version` | Show version |

## Options

### Global Options

- `-V, --version` - Show version number
- `-h, --help` - Show help

### List Options

- `-b, --board <name>` - Filter by board name

### Run Options

- `-p, --params <json>` - Parameters as JSON string

## Requirements

- Vento must be running (`yarn start` or `yarn dev`)
- API accessible at `http://localhost:8000` (or set `API_URL` env var)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:8000` | Vento API base URL |

## Troubleshooting

### "Connection refused" error

Make sure Vento is running:

```bash
yarn start
```

### "Unauthorized" error

The CLI uses the service token from `.env`. Make sure the `.env` file exists in the project root.

### Tools/values not showing

- Check that boards exist in Vento
- Verify the API is responding: `curl http://localhost:8000/api/core/v1/boards`

