# Monorepo Structure

Vento uses a monorepo architecture managed by Yarn workspaces. This enables code sharing between services while maintaining clear boundaries.

## Directory Structure

```
vento/
├── apps/                    # Services and applications
│   ├── adminpanel/         # Next.js admin UI
│   ├── api/                # User automations server
│   ├── agent/              # Local Go agent launcher
│   ├── chat/               # Matrix chat wrapper
│   ├── cinny/              # Matrix web client
│   ├── core/               # Main Vento service
│   ├── dendrite/           # Matrix server
│   ├── launcher/           # Electron launcher UI
│   ├── llama/              # Local LLM server
│   ├── mcp/                # MCP protocol server
│   └── clients/            # Device agents
│       ├── go/             # Go agent (Windows/Linux/macOS)
│       ├── expo/           # React Native (Android)
│       └── python/         # Python agent (Raspberry Pi)
├── packages/               # Shared libraries
│   ├── app/               # App-level code, bundles
│   ├── config/            # Configuration schemas
│   ├── protobase/         # Core utilities, models
│   ├── protodevice/       # ESP32/device components
│   ├── protoflow/         # Visual flow editor
│   ├── protolib/          # UI component library
│   ├── protonode/         # Node.js utilities
│   └── ui/                # Base UI primitives
├── extensions/            # Feature modules
│   ├── boards/           # Board system
│   ├── events/           # Event system
│   ├── objects/          # Data objects
│   ├── chatgpt/          # OpenAI integration
│   ├── llama/            # Local LLM integration
│   └── ...               # Many more
├── data/                  # Runtime data
│   ├── boards/           # Board definitions
│   ├── automations/      # User APIs
│   ├── objects/          # Data schemas
│   ├── databases/        # SQLite files
│   ├── models/           # LLM model files
│   └── settings/         # Configuration
├── bin/                   # Downloaded binaries
├── logs/                  # Service logs
└── scripts/              # Utility scripts
```

## Apps

Each app in `apps/` is a standalone service with its own:
- `package.json` - Dependencies
- `services.js` - Route definitions
- `service.config.js` - Process manager config

### Service Configuration

**`services.js`** declares HTTP routes:

```javascript
const services = [{
    name: "myservice",
    disabled: false,
    route: (req) => {
        if (req.url.startsWith('/mypath/')) {
            return 'http://localhost:3010'
        }
    }
}]
module.exports = services;
```

**`service.config.js`** configures the process:

```javascript
module.exports = {
    apps: [{
        name: 'myservice',
        script: 'src/index.ts',
        interpreter: 'node',
        interpreter_args: '--import tsx',
        env: { NODE_ENV: 'production' }
    }]
}
```

## Packages

Shared code organized as internal packages:

| Package | Purpose |
|---------|---------|
| `protobase` | Core models, schemas, utilities |
| `protonode` | Node.js helpers, API handler, MQTT |
| `protolib` | 250+ React UI components |
| `protoflow` | Visual flow editor |
| `protodevice` | ESP32/IoT components |
| `ui` | Base Tamagui primitives |
| `app` | App bundles, context aggregation |
| `config` | Configuration schemas |

### Importing Packages

```typescript
import { ProtoModel, API, getLogger } from 'protobase'
import { handler, getServiceToken } from 'protonode'
import { DataView, AdminPage } from 'protolib/components'
```

## Extensions

Extensions add features modularly:

```
extensions/myextension/
├── package.json           # Dependencies
├── coreApis.ts           # API routes for core
├── coreContext/
│   └── index.ts          # context.myextension.* functions
├── adminPages.tsx        # Admin panel pages
├── networkOption.tsx     # "+ Add" menu option
├── cards/                # Card templates (JSON)
└── masks/                # Visual programming nodes
```

Extensions are auto-discovered and loaded by the core service.

## Data Directory

User-generated content lives in `data/`:

| Path | Content |
|------|---------|
| `data/boards/` | Board definitions (.json, .js files) |
| `data/automations/` | User API definitions |
| `data/objects/` | Data model schemas |
| `data/databases/` | SQLite database files |
| `data/models/` | LLM model files (.gguf) |
| `data/keys/` | API keys and secrets |
| `data/settings/` | System configuration |
| `data/pages/` | Static frontend builds |

