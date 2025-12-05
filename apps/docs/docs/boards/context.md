# Context Functions

Card code cannot use `require` or `import` directly. Instead, capabilities are accessed through `context.*` functions injected by extensions.

## How Context Works

1. Extensions export functions in `extensions/{name}/coreContext/index.ts`
2. `packages/app/bundles/coreContext.ts` aggregates all exports
3. Context is passed to card execution as `context.{extension}.{function}`

## Available Functions

### AI

```javascript
// OpenAI GPT
const response = await context.chatgpt.prompt({
    message: 'Hello!',
    model: 'gpt-4o-mini',
    conversation: [] // optional history
})

// Local LLM (llama.cpp)
const response = await context.llama.prompt({
    message: 'Hello!',
    model: 'gemma-3-12b-it-Q4_1'
})

// List local models
const models = await context.llama.llamaListModels()
```

### Events

```javascript
// Emit event
await context.events.emitEvent(
    'orders/created',     // path
    'api',                // from
    'user123',           // user
    { orderId: 'X' },    // payload
    false                // ephemeral
)

// Subscribe to events
context.events.onEvent(
    context.mqtt,
    context,
    async (event) => {
        console.log('Event:', event.payload)
    },
    'orders/#'  // path pattern
)

// Get last event
const last = await context.events.getLastEvent({
    path: 'devices/sensor1/reading'
})
```

### State Management

```javascript
// Set board variable
context.boards.setVar('myKey', 'myValue')

// Get board variable
const value = context.boards.getVar('myKey')

// Check if variable exists
const exists = context.boards.hasVar('myKey')

// Clear variable
context.boards.clearVar('myKey')
```

### Keys & Secrets

```javascript
// Get API key (falls back to env var)
const key = await context.keys.getKey({
    key: 'OPENAI_API_KEY',
    defaultValue: undefined
})
```

### Scheduling

```javascript
// One-time schedule
context.automations.createSchedule(
    '14:30',           // time (HH:mm)
    () => { ... },     // callback
    15,                // day
    'march',           // month
    2025               // year
)

// Periodic schedule (cron-like)
context.automations.createPeriodicSchedule(
    8,                 // hour
    30,                // minute
    () => { ... },     // callback
    'monday,wednesday,friday'
)

// Advanced scheduling
const job = context.automations.scheduleJob({
    name: 'backup-job',
    hours: 2,
    minutes: 0,
    days: 'sunday',
    callback: async () => { ... },
    autoStart: true,
    runOnInit: false
})
```

### Global State

```javascript
// Set global state
context.state.set({
    group: 'sensors',
    tag: 'temperature',
    name: 'current',
    value: 23.5
})

// Get global state
const temp = context.state.get({
    group: 'sensors',
    tag: 'temperature',
    name: 'current'
})
```

### Flow Utilities

```javascript
// Switch/case
context.flow2.switch(value, {
    'case1': () => { ... },
    'case2': () => { ... }
})

// Array operations
context.flow2.forEach(array, (item) => { ... })
context.flow2.filter(array, (item) => item.active)
context.flow2.map(array, (item) => item.name)

// JSON utilities
const obj = context.flow2.jsonParse(jsonString)
const str = context.flow2.toJson(object)
```

## Context Function Pattern

All context functions follow this pattern:

```typescript
const myFunction = async (options: {
    requiredParam: string,
    optionalParam?: number,
    done?: (result) => void,
    error?: (err) => void
}) => {
    const { requiredParam, optionalParam = 10, done = (r) => r, error = () => {} } = options
    
    try {
        const result = await doSomething(requiredParam)
        done(result)
        return result
    } catch (err) {
        error(err)
        throw err
    }
}
```

