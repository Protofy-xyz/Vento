# Boards Overview

Boards are the fundamental abstraction in Vento. Each board represents an agent with its capabilities, state, and behavior.

## What is a Board?

A board is a collection of **cards** that define:
- **Values**: Sensor data, computed states, external information
- **Actions**: Operations the agent can perform
- **Rules**: How the agent should behave

```
┌─────────────────────────────────────────────────────────┐
│                    MY_AGENT BOARD                        │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │ temperature   │  │ pump_status   │  │ turn_pump   │  │
│  │ (value)       │  │ (value)       │  │ (action)    │  │
│  │ 23.5°C        │  │ "off"         │  │ [Run]       │  │
│  └───────────────┘  └───────────────┘  └─────────────┘  │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │ agent_input   │  │ reply         │  │ send_alert  │  │
│  │ (action)      │  │ (action)      │  │ (action)    │  │
│  │ Queue: 2      │  │ [Send]        │  │ [Run]       │  │
│  └───────────────┘  └───────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Board Files

Each board consists of multiple files in `data/boards/`:

| File | Purpose |
|------|---------|
| `{board}.json` | Board metadata and card definitions |
| `{board}.js` | Main board code |
| `{board}_ui.js` | UI-specific card code |
| `{board}/` | Directory with individual card code files |

## Creating Boards

### Via UI

1. Open Network view (click Vento logo)
2. Click **+ Add** → **Virtual Agent**
3. Choose a template
4. Enter name and create

### Via API

```bash
POST /api/core/v1/boards
{
  "name": "my_agent",
  "template": "smart ai agent"
}
```

## Board Templates

Available templates in `data/templates/boards/`:

| Template | Description |
|----------|-------------|
| `blank` | Empty board with no cards |
| `ai agent` | Basic AI agent with chat |
| `chatgpt` | ChatGPT integration |
| `rule-based agent` | Automation without AI |
| `smart ai agent` | Advanced AI with multiple capabilities |

## Board Schema

```typescript
{
    name: string,        // Lowercase, alphanumeric with underscores
    layouts: object,     // UI layout configuration
    cards: Card[],       // Array of cards
    rules: string[],     // Board-level rules
}
```

## Accessing Boards

### HTTP API

```bash
# List all boards
GET /api/core/v1/boards

# Get specific board
GET /api/core/v1/boards/{name}

# Execute action card
POST /api/core/v1/boards/{name}/actions/{action}

# Send message to agent
POST /api/agents/v1/{name}/agent_input
```

### In Card Code

```javascript
// Access board state
const temp = states.temperature

// Execute another card
await board.execute_action({
    name: 'send_alert',
    params: { message: 'Temperature high!' }
})
```

