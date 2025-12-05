# Cards

Cards are the building blocks of boards. Each card represents either a piece of state (value) or an operation (action).

## Card Types

### Value Cards

Value cards compute and display information. They:
- Run automatically when board state changes
- Cannot have side effects
- Return a value that becomes the card's state

```javascript
// Example: Compute average temperature
const readings = states.temperature_readings || []
const avg = readings.reduce((a, b) => a + b, 0) / readings.length
return avg.toFixed(2)
```

### Action Cards

Action cards execute operations. They:
- Run on-demand (via API, button, or other cards)
- Can have side effects
- Can access `context.*` functions
- May return a value

```javascript
// Example: Send notification
await context.chatgpt.prompt({
    message: `Alert: ${params.message}`,
    model: 'gpt-4o-mini'
})
return { sent: true }
```

## Card Properties

| Property | Description |
|----------|-------------|
| `name` | Unique identifier |
| `type` | `value` or `action` |
| `description` | For AI context |
| `icon` | Lucide icon name |
| `params` | Input parameters (actions only) |
| `rulesCode` | JavaScript execution code |
| `html` | Custom rendering |

## Card Code

Card code runs in a sandboxed environment with access to:

### Available Variables

```javascript
const run = async ({ context, states, board, params }) => {
    // context - Extension functions (context.chatgpt, context.events, etc.)
    // states - All board card values
    // board - Board utilities
    // params - Input parameters (for action cards)
    
    return result
}
```

### Board Object

```javascript
// Watch for state changes
board.onChange({
    name: 'some_card',
    changed: (newValue) => {
        console.log('Card changed:', newValue)
    }
})

// Execute another action
await board.execute_action({
    name: 'other_action',
    params: { key: 'value' }
})

// Log with board prefix
board.log('Something happened')
```

## Parameters

Action cards can define parameters:

```json
{
  "params": {
    "message": "The message to send",
    "priority": "Priority level (high/low)"
  },
  "configParams": {
    "message": {
      "visible": true,
      "defaultValue": "",
      "type": "string"
    },
    "priority": {
      "visible": true,
      "defaultValue": "low",
      "type": "select",
      "data": ["high", "low"]
    }
  }
}
```

### Parameter Types

| Type | Description |
|------|-------------|
| `string` | Text input |
| `number` | Numeric input |
| `boolean` | Checkbox |
| `json` | JSON editor |
| `select` | Dropdown (use `data` array) |

## Custom Rendering

Cards can have custom HTML/React rendering via the `html` field.

### React Mode

```javascript
//@card/react
function Widget(card) {
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack ai="center" jc="center">
          <Icon name={card.icon} size={48} color={card.color}/>
          <CardValue value={card.value ?? "N/A"} />
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
```

### Available Components

| Component | Description |
|-----------|-------------|
| `Tinted` | Theme tinting |
| `ProtoThemeProvider` | Theme context |
| `YStack`, `XStack` | Flex containers |
| `Icon` | Lucide icons |
| `CardValue` | Display values |
| `ActionCard` | Action wrapper |
| `ParamsForm` | Parameter form |
| `StorageView` | Object CRUD |
| `PieChart`, `BarChart`, etc. | Charts |

## Special Cards

Some cards have special behavior:

| Card | Purpose |
|------|---------|
| `agent_input` | Entry point for chat messages |
| `reply` | Send responses back |
| `current_request` | Current pending request |

