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

## Board UI

### View Modes

Boards can be viewed in three modes:

| Mode | Description |
|------|-------------|
| **Graph** | Flow diagram showing card connections (default) |
| **Dashboard** | Grid layout with draggable cards |
| **Presentation** | Custom HTML view defined in `{board}_ui.js` |

### Action Bar

The action bar provides quick access to board operations:

| Button | Action |
|--------|--------|
| Add (+) | Add new card to board |
| Undo/Redo | Version history navigation |
| History | View version timeline |
| Automations | Edit board automation rules |
| Relayout | Reset graph positions (recalculate layout) |
| Play/Pause | Toggle autopilot |
| States | View board state values |
| Logs | View real-time logs |
| Settings | Board configuration |

### Graph Layout

The graph view uses automatic layout algorithms to position cards. Card positions can be:
- **Automatic**: Calculated using Sugiyama algorithm based on card connections
- **Manual**: Drag cards to custom positions (saved automatically)

Use the **Relayout** button to reset all positions and recalculate the automatic layout.

### Board Controls Context

Board UI state is managed via `BoardControlsContext`:

```typescript
import { useBoardControls } from '@extensions/boards/BoardControlsContext'

function MyComponent() {
  const {
    viewMode,      // 'ui' | 'board' | 'graph'
    setViewMode,
    autopilot,     // boolean
    tabVisible,    // Currently open panel
    setTabVisible,
  } = useBoardControls();
}
```

