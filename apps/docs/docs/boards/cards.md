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

Action cards can define parameters using two related fields:
- `params`: Describes what each parameter is for (shown as placeholder/hint)
- `configParams`: Configures how each parameter behaves in the UI

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
| `boolean` | Toggle switch |
| `text` | Multi-line text area |
| `json` | JSON editor with syntax highlighting |
| `array` | Comma-separated list or card picker |
| `select` | Dropdown (use `data` or `options` array) |
| `path` | File picker |

### configParams Properties

| Property | Type | Description |
|----------|------|-------------|
| `visible` | boolean | Show in UI (default: `true`) |
| `defaultValue` | any | Default value |
| `type` | string | Input type (see above) |
| `data` / `options` | array | Options for select type |
| `selector` | string | Special selector: `"agents"` |
| `cardSelector` | boolean | Use card picker for arrays |
| `multiple` | boolean | Multiple files for `path` type |
| `visibility` | object | Conditional visibility |

### Conditional Visibility

Show/hide parameters based on other parameter values using the `visibility` property.

#### Boolean Mode

Show when another boolean parameter is true/false:

```json
{
  "configParams": {
    "enableAdvanced": {
      "type": "boolean",
      "defaultValue": "false"
    },
    "advancedOption": {
      "type": "string",
      "visibility": {
        "field": "enableAdvanced",
        "mode": "boolean"
      }
    }
  }
}
```

Use `"inverted": true` to show when the field is `false` instead.

#### Equals Mode

Show when a field equals a specific value:

```json
{
  "configParams": {
    "provider": {
      "type": "select",
      "data": ["openai", "local"]
    },
    "apiKey": {
      "type": "string",
      "visibility": {
        "field": "provider",
        "mode": "equals",
        "value": "openai"
      }
    }
  }
}
```

#### Includes Mode

Show when a field value is in a list:

```json
{
  "configParams": {
    "provider": {
      "type": "select",
      "data": ["openai", "anthropic", "local"]
    },
    "apiKey": {
      "type": "string",
      "visibility": {
        "field": "provider",
        "mode": "includes",
        "values": ["openai", "anthropic"]
      }
    }
  }
}
```

#### All Mode (AND condition)

Show when ALL fields match their expected values:

```json
{
  "configParams": {
    "useCloud": {
      "type": "boolean",
      "defaultValue": "true"
    },
    "enableStreaming": {
      "type": "boolean",
      "defaultValue": "false"
    },
    "streamUrl": {
      "type": "string",
      "visibility": {
        "mode": "all",
        "fields": ["useCloud", "enableStreaming"],
        "values": [true, true]
      }
    }
  }
}
```

`streamUrl` shows only when `useCloud` is `true` **AND** `enableStreaming` is `true`.

#### Any Mode (OR condition)

Show when AT LEAST ONE field matches:

```json
{
  "configParams": {
    "useOpenAI": {
      "type": "boolean",
      "defaultValue": "false"
    },
    "useAnthropic": {
      "type": "boolean",
      "defaultValue": "false"
    },
    "apiKey": {
      "type": "string",
      "visibility": {
        "mode": "any",
        "fields": ["useOpenAI", "useAnthropic"],
        "values": [true, true]
      }
    }
  }
}
```

`apiKey` shows when `useOpenAI` is `true` **OR** `useAnthropic` is `true`.

### Dynamic Options

Make dropdown options depend on another field:

```json
{
  "configParams": {
    "provider": {
      "type": "select",
      "data": ["openai", "anthropic"]
    },
    "model": {
      "type": "select",
      "dataFromField": "provider",
      "dataMap": {
        "openai": ["gpt-4o", "gpt-4o-mini"],
        "anthropic": ["claude-3-opus", "claude-3-sonnet"]
      },
      "defaultValueMap": {
        "openai": "gpt-4o-mini",
        "anthropic": "claude-3-sonnet"
      }
    }
  }
}
```

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

