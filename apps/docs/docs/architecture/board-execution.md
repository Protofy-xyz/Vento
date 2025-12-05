# Board Execution

Understanding how boards and cards execute internally.

## Card Execution

When an action card is triggered (via API, event, or another card), the core service loads and executes the card's JavaScript code directly within its process.

Each card file in `data/boards/{board}/` exports a `run` function that receives the execution context:

```javascript
const run = async ({ context, states, board, params }) => {
    // Access other card values
    const temp = states.boards.my_board.temperature
    
    // Use context functions
    const response = await context.chatgpt.prompt({ message: params.query })
    
    // Return becomes the card's value
    return response
}
```

## Execution Context

When a card runs, it receives:

### `context`

All extension functions (`context.chatgpt`, `context.events`, etc.)

### `states`

All board card values:
```javascript
{
    boards: {
        my_board: {
            temperature: 23.5,
            humidity: 65,
            pump_status: 'off'
        }
    }
}
```

### `board`

Board utilities:

```javascript
board.id                // Board identifier
board.log()             // Prefixed logging
board.onChange()        // Subscribe to state changes
board.execute_action()  // Run another card
```

### `params`

Input parameters for action cards.

## Executing Other Cards

```javascript
const result = await board.execute_action({
    name: 'send_alert',
    params: { message: 'Temperature too high!' },
    done: (result) => console.log('Success:', result),
    error: (err) => console.error('Failed:', err)
})
```

## Autopilot

The **Autopilot** is a separate process spawned when you click the **play button** on a board.

### What Autopilot Does

- **Monitors board state**: Watches for changes in card values
- **Executes actions**: Triggers action cards when conditions are met
- **Schedules timers**: Plans future executions based on rules

### Why Separate?

Running autopilot in its own process ensures:
- **CPU isolation**: A busy autopilot doesn't block other boards or core
- **Crash resilience**: If an autopilot crashes, core continues running
- **Independent lifecycle**: Each board's automation runs independently

### Autopilot Rules

Rules are written in **natural language** and stored in the board's `rules` state. When the autopilot runs, it sends these rules along with the current state and available actions to an LLM, which generates JavaScript code that implements the rules.

**Example rules (natural language):**
- "If temperature is above 30, turn on the cooling"
- "Check status every 5 minutes"
- "When motion is detected, send an alert"

**Generated JS (by LLM):**
```javascript
function process_state(states) {
    const urls = []
    if (states['temperature'] > 30) {
        urls.push('cooling_on')
    }
    if (states['motion_detected'] === true) {
        urls.push('send_alert?message=Motion+detected')
    }
    return urls
}
```

The generated code is cached and only regenerated when the rules change. Each time the board state changes, the code runs to determine which actions to execute.

## Parameter Resolution

Parameters can reference board state:

```javascript
// Static value
{ message: "Hello" }

// Reference to card value
{ message: "board.current_request" }

// Nested property
{ message: "board.current_request.text" }
```

### Type Casting

Parameters are cast based on `configParams.type`:

| Type | Conversion |
|------|------------|
| `string` | `String(value)` |
| `number` | `Number(value)` |
| `boolean` | `value === 'true' || value === true` |
| `json` | `JSON.parse(value)` |
| `array` | `JSON.parse(value)` |

## Context Functions Only

Card code uses `context.*` functions for all capabilities:

```javascript
// AI
const response = await context.chatgpt.prompt({ message: 'Hello' })

// Events
await context.events.emitEvent('my/event', 'card', 'system', {})

// Keys
const key = await context.keys.getKey({ key: 'API_KEY' })

// Files
const content = await context.files.read({ path: 'data/myfile.txt' })
```

## Logging

```javascript
board.log('Processing request')
// Output: "Board log [my_board]: Processing request"
```

## Return Values

- **Value cards**: Return value becomes the card's state
- **Action cards**: Return value is sent as HTTP response and stored as card value

```javascript
// Value card - computed temperature
return (states.temp_c * 9/5) + 32

// Action card - operation result
return { success: true, orderId: 'ORD-123' }
```
