# Extensions Overview

Extensions enhance Vento by adding screens, APIs, context functions, and more.

## What Extensions Can Add

| Component | File | Description |
|-----------|------|-------------|
| Context Functions | `coreContext/index.ts` | `context.{name}.*` functions |
| API Routes | `coreApis.ts` | HTTP endpoints |
| Admin Pages | `adminPages.tsx` | UI screens |
| Network Options | `networkOption.tsx` | "+ Add" menu items |
| Card Templates | `cards/*.json` | Pre-defined cards |
| Visual Nodes | `masks/*.tsx` | Flow editor nodes |

## Extension Structure

```
extensions/myextension/
├── package.json           # Dependencies
├── coreApis.ts           # API routes
├── coreContext/
│   └── index.ts          # Context functions
├── adminPages.tsx        # Admin panel pages
├── networkOption.tsx     # Network "+ Add" option
├── cards/                # Card templates
└── masks/                # Visual programming masks
```

## Creating an Extension

### 1. Create Directory

```bash
mkdir extensions/myextension
```

### 2. Add package.json

```json
{
  "name": "@extensions/myextension",
  "version": "1.0.0",
  "dependencies": {}
}
```

### 3. Add Context Functions

```typescript
// extensions/myextension/coreContext/index.ts
import { getLogger } from 'protobase'

export const myFunction = async (options: {
    param1: string,
    done?: (result) => void,
    error?: (err) => void
}) => {
    const { param1, done = (r) => r, error = () => {} } = options
    
    try {
        const result = await doSomething(param1)
        done(result)
        return result
    } catch (err) {
        error(err)
        throw err
    }
}

export default { myFunction }
```

### 4. Add API Routes (Optional)

```typescript
// extensions/myextension/coreApis.ts
import { handler } from 'protonode'

export default async (app, context) => {
    app.get('/api/core/v1/myextension/status', handler(async (req, res, session) => {
        res.json({ status: 'ok' })
    }))
}
```

## Using Your Extension

After creating, restart Vento:

```bash
yarn stop
yarn start
```

In card code:

```javascript
const result = await context.myextension.myFunction({
    param1: 'hello'
})
```

## Notable Extensions

| Extension | Description |
|-----------|-------------|
| `boards` | Board/card management |
| `events` | Event system |
| `objects` | Data objects |
| `chatgpt` | OpenAI integration |
| `llama` | Local LLM |
| `keys` | Secrets management |
| `devices` | Device management |
| `esphome` | ESP32 integration |
| `automations` | Task scheduling |
| `statemachines` | State machine support |

