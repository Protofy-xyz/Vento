# Rules

Read this document, understand the structure (extensions, etc) and always follow the same conventions and structures described here.

---

# Vento - Functional Introduction

Vento is a system for building networks that connect physical devices, AI agents, and people.

It runs as an application on Windows, Linux, and macOS, and when launched it spins up a local control hub capable of onboarding smartphones, ESP32 boards, Raspberry Pis, laptops, servers, APIs, and virtual agents.

The central service—**vento**—distributes APKs, ZIPs, EXEs, etc. to clients. Once executed, these clients automatically join the Vento network and appear in the control panel as agents.

Each agent has a visual board with buttons and cards, plus a chatbot interface to interact with it using natural language.

**The UI displays the network graph.**

- Click an agent → you see its board.
- The sidebar shows the Matrix chat (Cinny). Clicking an agent's identity in chat allows you to send natural-language commands to it, ask questions about its controlled system, or request actions.

Think of it as a **botnet for good**—a distributed automation network with superpowers.

---

## Monorepo Structure

### Top-level structure

| Directory | Description |
|-----------|-------------|
| `.github/` | GitHub Actions workflows to build apps and publish them to GitHub Releases: Android client, Go client, and compiled frontend bundles for `apps/cinny` and `apps/adminpanel`. |
| `apps/` | Vento services. Some run automatically as part of the Vento runtime; others are clients to be built (via Vento or CI) and distributed to remote devices. |
| `apps/clients/` | Client implementations for systems that join the Vento network (Go, Python, Expo/Android, etc.). |
| `bin/` | Binary cache directory. Used for downloading/compiling things like Dendrite (Matrix server), Node.js binaries (when using the launcher's embedded Node), LLaMA inference binaries for local AI, and the compiled Go agent (`ventoagent.exe`). |
| `data/` | User-generated content: boards (agent definitions), cards, databases, pages, prompts, themes, templates, etc. |
| `docker/` | Docker definitions for running Vento as a containerized service. |
| `electron/` | The Electron launcher application. This wraps Vento into a single downloadable `.exe`/`.app`. It provides a UI (compiled from `apps/launcher`) that downloads Vento releases and launches them without requiring Node or a terminal. |
| `extensions/` | Extension modules that enhance core Vento services (`apps/core`, `apps/api`, `apps/adminpanel`). Extensions may add admin panel pages, new core API endpoints, user API endpoints, new `context.*` functions, etc. |
| `logs/` | Log directory. Contains `core.log`, `api.log`, `adminpanel.log`, and raw stdout/stderr in `logs/raw/`. |
| `packages/` | Internal packages providing UI components, utilities, shared Node functions, and other base libraries. |
| `scripts/` | Utility scripts for binary downloads, enabling/disabling UI dev mode, and maintenance tasks. |
| `scripts/start.js` | The main Vento entrypoint. Handles start, stop, kill, environment setup, etc. This is what `yarn start` invokes. The Electron launcher also uses this. |

---

## Apps

### Core Services

#### `apps/core`
The central Vento service. This is the heart of the system:
- **HTTP proxy** on port 8000 (all traffic goes through here)
- **MQTT broker** for real-time messaging between agents
- **Databases** (SQLite by default, configurable)
- **APIs** under `/api/core/v1/`
- **Authentication** and session management
- **Agent state orchestration**
- **hooks system** To add more apis or context functions trough extensions/. The core service loads extensions dynamically from `packages/app/bundles/coreApis.ts` and `packages/app/bundles/coreContext.ts`.

**Key files:**
- `src/index.ts` - Main entry, starts HTTP server, MQTT, loads bundles
- `src/mqtt.ts` - MQTT broker configuration
- `service.config.js` - Process manager configuration

#### `apps/api`
The "user API" server. Loads automations created in `data/automations`. Enables users to define custom APIs ("tasks") from the Admin Panel without modifying the core server.

APIs are defined in `data/automations/` and loaded dynamically.

#### `apps/agent`
A service that starts the Go client (`apps/clients/go`) locally, enrolling the local machine as the first Vento agent.

The Go client binary is stored in `bin/ventoagent.exe` (Windows) or `bin/ventoagent` (Linux/macOS).

### Frontend Services

#### `apps/adminpanel`
Next.js frontend served at `http://localhost/workspace/`.

This is the main Vento UI for:
- Browsing the network graph
- Creating and managing agents/boards
- Inspecting board cards and states
- Managing databases, keys, events
- Configuring AI providers

Requires authentication. The launcher auto-creates a user; when running manually, run `yarn add-user`.

**Key structure:**
- `pages/` - Next.js page routes
- `services.js` - Route claims and proxy configuration
- `conf.ts` - App configuration

#### `apps/cinny`
Matrix web UI embedded inside the Admin Panel sidebar. Based on the Cinny Matrix client.

Agents appear as Matrix users via Vento's Matrix App Service bridge.

#### `apps/chat`
Wrapper exposing `apps/cinny` as a Vento service.

#### `apps/launcher`
UI used by the Electron launcher. Vento launcher allows to download and run Vento releases.

### Communication Services

#### `apps/dendrite`
The Matrix server (Dendrite) launched with Vento. Provides:
- Federated messaging
- App Service bridge for agent integration
- Direct messaging between users and agents

Configuration lives in `data/dendrite/dendrite.yaml`.

### AI Services

#### `apps/llama`
Local AI inference server using llama.cpp. Vento allows to choose between:
- **Cloud AI**: OpenAI GPT-4, etc.
- **Local LLMs**: Gemma 3, LLaMA, etc.

apps/llama is used when the user selects the option to use local llm.

Models are stored in `data/models/*.gguf`.

#### `apps/mcp`
MCP (Model Context Protocol) server exposing agent state and actions through the MCP protocol (stdin/stdout). Lets MCP clients introspect Vento agents or run actions in vento agents.

**Exposes:**
- **Tools**: `{board}_chat` (talk to agent), `{board}_{action}` (execute actions)
- **Resources**: `vento://boards/{board}/values/{card}` (read value cards)

### Clients

#### `apps/clients/go`
Cross-platform client (Windows, Linux, macOS) to enroll computers. Written in Go with:
- System information gathering
- Screenshot/webcam capture capabilities
- Shell command execution
- MQTT communication

Also used locally by `apps/agent`. Built automatically by the CI and downloaded automatically when starting Vento.

#### `apps/clients/expo`
Expo/React Native mobile client (mainly Android) to enroll smartphones. Features:
- Camera/photo access
- GPS location
- Notifications
- Device sensors

#### `apps/clients/python`
Raspberry Pi client exposing GPIOs and hardware functions as a Vento agent.

### Other Services

#### `apps/cli`
Interactive command-line interface for controlling Vento.

Usage: `yarn vento <command>`

#### `apps/python`
Legacy Python virtual-environment runner for user-defined Python APIs. Disabled by default; may be revived or removed.

---

## Packages

Internal packages that provide shared functionality across the monorepo.

| Package | Description |
|---------|-------------|
| `packages/app` | Application-level code: bundles, chatbots, layout components, providers, masks, workspaces. Contains `bundles/coreApis.ts`, `bundles/coreContext.ts` that aggregate all extensions. |
| `packages/config` | Configuration schemas and base config (`AppConfig`, `BaseConfig`). |
| `packages/protobase` | Core data models and utilities: `ProtoModel`, `ProtoSchema`, `ProtoCollection`, `ProtoAI`, event system, logging. |
| `packages/protodevice` | Device/ESP32 components and node definitions for visual programming. |
| `packages/protoflow` | Visual flow editor components (React Flow based). |
| `packages/protolib` | UI component library with 250+ React components, admin panel features, helpers. |
| `packages/protonode` | Node.js utilities: API handler, MQTT client, service token management, file operations. |
| `packages/protopy` | Python utilities for Vento Python APIs: auth, events. |
| `packages/ui` | Low-level UI primitives (Tamagui-based). |
| `packages/visualui` | Visual UI editor components. |

---

## Commands

### Boot Commands

| Command | Description |
|---------|-------------|
| `yarn start` | Start Vento. After boot, it listens on `localhost:8000`. Runs prepare first. |
| `yarn start-fast` | Skip initialization and go straight to boot. Used by developers and the Electron launcher. |
| `yarn dev` | Start Vento in development mode (hot-reload for `apps/core`). |
| `yarn dev-fast` | Dev mode but skipping initialization. |

### Process Management

| Command | Description |
|---------|-------------|
| `yarn status` | Show status of all running processes. |
| `yarn stop` | Stop all Vento processes gracefully. |
| `yarn kill` | Alias for `yarn stop`. |
| `yarn restart` | Restart all processes. |
| `yarn logs` | View process logs. |
| `yarn monit` | Monitor processes. |

### Development Commands

| Command | Description |
|---------|-------------|
| `yarn add-user` | Create a new admin user. |
| `yarn enable-ui-dev` | Enable Next.js development mode for frontend apps. |
| `yarn disable-ui-dev` | Disable UI dev mode (use static builds). |
| `yarn build` | Build all packages. |
| `yarn clean` | Clean build artifacts. |
| `yarn fix` | Fix dependency issues with manypkg. |

### Client Commands

| Command | Description |
|---------|-------------|
| `yarn build-agent` | Build the Go client for current platform. |
| `yarn download-agent` | Download pre-built Go client from releases. |
| `yarn update-agent` | Force re-download Go client. |
| `yarn setup-agent` | Setup local agent configuration. |

### Electron Launcher

| Command | Description |
|---------|-------------|
| `yarn launcher` | Run Electron launcher. |
| `yarn launcher-dev` | Run launcher in development mode. |
| `yarn launcher-package-win` | Package launcher for Windows. |
| `yarn launcher-package-mac` | Package launcher for macOS. |
| `yarn launcher-package-linux` | Package launcher for Linux. |

### Utility Commands

| Command | Description |
|---------|-------------|
| `yarn update` | Update Vento (pull, update UI, update clients). |
| `yarn assets` | Run assets management scripts. |
| `yarn python` | Run Python virtual environment. |
| `yarn download-binaries` | Download required binaries (Node, Dendrite, etc). |

---

## Development

### Service Architecture

Each Vento app that runs as a service must have:

1. **`services.js`** - Declares the service and its routes:
```javascript
const services = [
    {
        "name": "core",
        "description": "Core services",
        "route": (req) => {
            if (req.url.startsWith('/api/core/')) {
                return 'http://localhost:8000'
            }
        }
    }
]
module.exports = services;
```

2. **`service.config.js`** - Process manager configuration:
```javascript
module.exports = {
    apps: [{
        name: 'core',
        script: 'src/index.ts',
        interpreter: 'node',
        interpreter_args: '--import tsx',
        cwd: currentDir,
        env: { NODE_ENV: 'production' },
        autorestart: true,
        kill_timeout: 5000,
        // ... more PM2-style options
    }]
};
```

### Process Manager

The custom process manager (`scripts/start.js`) replaces PM2 and provides:
- Automatic restart on crash with exponential backoff
- Colored console output per service
- Log rotation to `logs/raw/`
- Graceful shutdown with cleanup hooks (important for GPU resources)
- State persistence in `data/system/processes.json`

### UI Development

Next.js frontends (`apps/adminpanel`, `apps/cinny`, `apps/launcher`) are disabled by default.

Users normally do not run Next.js servers; instead they use precompiled HTML downloaded from GitHub Releases.

Vento serves static HTML from `data/pages/`.

To enable frontend development:
```bash
yarn enable-ui-dev
yarn dev
```

This routes requests to Next.js dev servers instead of static HTML.

### Routing

Services that claim HTTP routes must declare them in their `services.js`:

| Route | Service |
|-------|---------|
| `/api/core/v1/*` | `apps/core` |
| `/api/v1/*` | `apps/api` |
| `/workspace/*` | `apps/adminpanel` |
| `/chat/*` | `apps/chat` (Cinny) |
| `/public/*` | Static files from `data/public/` |
| `/websocket` | WebSocket endpoint (core) |

---

## Boards

Internally, Vento agents are managed as **Vento boards**.

Boards are handled by the APIs under `extensions/boards/` and are the fundamental abstraction of Vento.

### Board Schema

```typescript
BoardSchema = {
    name: string,        // Lowercase, alphanumeric with underscores
    layouts: any,        // UI layout configuration
    cards: Card[],       // Array of cards
    rules: string[],     // Board-level rules
}
```

### Board Files

Each board consists of multiple files in `data/boards/`:

| File | Description |
|------|-------------|
| `{board}.json` | Board metadata and card definitions |
| `{board}.js` | Main board code (run function) |
| `{board}_ui.js` | UI-specific card definitions |
| `{board}/` | Directory with individual card code files |

### Board Templates

Board templates in `data/templates/boards/` provide starting points:

| Template | Description |
|----------|-------------|
| `blank` | Empty board |
| `ai agent` | AI-powered agent with chat |
| `chatgpt` | ChatGPT integration |
| `rule-based agent` | Rule-based automation |
| `smart ai agent` | Advanced AI with multiple capabilities |

---

## Cards

A board is composed of **cards**. Each card is either a Value Card or an Action Card.

### Card Schema

```typescript
CardSchema = {
    name: string,           // Card identifier
    label: string?,         // Display label
    type: 'value' | 'action',
    settings: any?,         // Card-specific settings
    description: string?,   // Human-readable description
    rules: string[]?,       // Card-level rules
    params: Record<string, any>?, // Input parameters
    content: string?,       // Card code content
}
```

### Value Card
- Pure computation, no side effects
- Runs automatically when the board changes
- Maintains an always-updated reduced value
- Access via `states.{cardName}` in code

### Action Card
- Can trigger side effects, execute other cards, or access `context.*` functions
- Action cards also expose the last returned value as their own value
- May be triggered by:
  - API calls: `POST /api/core/v1/boards/{board}/actions/{action}`
  - Agent input: `POST /api/agents/v1/{board}/agent_input`
  - Vento events
  - Other cards/automations
- Some contain queues and support building full state machines

### Card Code Structure

Cards are stored as `.js` files in `data/boards/{board}/`:

```javascript
// data/boards/myboard/my_action.js
const { boardConnect, getRoot, exec } = require('protonode')
const { Protofy, getLogger } = require('protobase')

const run = Protofy("code", async ({ context, states, board, params }) => {
    const logger = getLogger()
    
    // Access params
    const { message } = params
    
    // Use context functions
    const response = await context.chatgpt.prompt({
        message: message,
        model: 'gpt-4o-mini'
    })
    
    // Return value becomes card's value
    return response
})

boardConnect(run)
```

### Card Layers

Cards may specify a **layer**, defining visibility in the UI:
- Default layer shows in main view
- Other layers can be hidden/shown by user preference

### Special Cards

| Card Name | Purpose |
|-----------|---------|
| `agent_input` | Entry point for agent chat messages |
| `reply` | Agent response output |
| `current_request` | Stores current request context |

---

## Autopilot

Boards can define an **autopilot**: a rule-based mini-automaton.

Autopilot rules follow the pattern: "on {event}, execute {action}".

Each autopilot runs in a dedicated Node.js process to maintain CPU stability.

Configuration is in `extensions/autopilot/`.

---

## `context.*`

Code inside action cards **cannot** use `require` or `import` directly.

Instead, they access capabilities through `context.*` functions, which are injected by extensions.

### How Context Works

1. Extensions export functions in `extensions/{name}/coreContext/index.ts`
2. `packages/app/bundles/coreContext.ts` aggregates all coreContext exports
3. Context is passed to card execution as `context.{extensionName}.{function}`

### Available Context Functions

| Namespace | Functions | Description |
|-----------|-----------|-------------|
| `context.chatgpt` | `prompt`, `chatGPTSession`, `getSystemPrompt`, `processResponse` | OpenAI GPT integration |
| `context.llama` | `prompt`, `llamaChat`, `llamaListModels`, `llamaStatus`, `llamaPreload` | Local LLM inference |
| `context.boards` | `setVar`, `getVar`, `hasVar`, `clearVar`, `getStatesByType`, `processAgentResponse` | Board state management |
| `context.events` | `emit`, `on`, `once` | Event system |
| `context.apis` | `getServiceToken`, `fetch` | API utilities |
| `context.keys` | `getKey`, `setKey` | Secret management |
| `context.files` | `read`, `write`, `list`, `delete` | File operations |
| `context.databases` | `get`, `set`, `query` | Database operations |
| `context.html` | `render` | HTML template rendering |
| `context.state` | `get`, `set`, `subscribe` | Global state |
| `context.automations` | `run`, `schedule` | Automation execution |

### Example: Using ChatGPT Context

```javascript
const run = Protofy("code", async ({ context, params }) => {
    // Get API key from keys extension
    const apiKey = await context.keys.getKey({ key: 'OPENAI_API_KEY' })
    
    // Call ChatGPT
    const response = await context.chatgpt.prompt({
        message: params.userMessage,
        model: 'gpt-4o-mini',
        conversation: params.history || []
    })
    
    return response
})
```

### Example: Using Local LLM

```javascript
const run = Protofy("code", async ({ context, params }) => {
    // List available models
    const models = await context.llama.llamaListModels()
    
    // Use local model
    const response = await context.llama.prompt({
        message: params.query,
        model: 'gemma-3-12b-it-Q4_1' // model name without .gguf
    })
    
    return response
})
```

---

## Extensions

Extensions enhance Vento by adding screens, APIs, context functions, or dependencies.

### Extension Structure

```
extensions/{name}/
├── package.json           # Dependencies (optional)
├── coreApis.ts           # API routes for apps/core
├── coreContext/
│   └── index.ts          # context.{name}.* functions
├── adminPages.tsx        # Admin panel pages
├── networkOption.tsx     # Network "Add" menu options
├── masks/                # Visual editor masks
├── cards/                # Card type definitions (JSON)
└── ...
```

### Key Extension Files

| Path | Purpose |
|------|---------|
| `coreApis.ts` | Registers API routes with Express app |
| `coreContext/index.ts` | Provides `context.{name}.*` functions |
| `adminPages.tsx` | Registers pages in admin panel |
| `networkOption.tsx` | Adds options to network "+ Add" menu |
| `cardMasks/` | Visual programming node definitions |
| `cards/*.json` | Pre-defined card templates |

### Creating an Extension

1. Create directory: `extensions/myextension/`

2. Add `package.json`:
```json
{
  "name": "@extensions/myextension",
  "version": "1.0.0",
  "dependencies": {}
}
```

3. Add `coreContext/index.ts`:
```typescript
import { getLogger } from 'protobase';

export const myFunction = async (options: {
    param1: string,
    done?: (result) => void,
    error?: (err) => void
}) => {
    const { param1, done = (r) => r, error = () => {} } = options;
    
    try {
        const result = // ... do something
        done(result);
        return result;
    } catch (err) {
        error(err);
        throw err;
    }
}

export default {
    myFunction
}
```

4. Extension is auto-discovered and loaded on next restart.

### Notable Extensions

| Extension | Description |
|-----------|-------------|
| `boards` | Board management, cards, rules |
| `chatgpt` | OpenAI integration |
| `llama` | Local LLM (llama.cpp) |
| `events` | Event system |
| `keys` | API keys and secrets |
| `devices` | Device management |
| `esphome` | ESP32/ESPHome integration |
| `automations` | User-defined automations |
| `files` | File management |
| `databases` | Database operations |
| `users` | User management |
| `matrix` | Matrix protocol integration |
| `statemachines` | State machine support |
| `flow` / `flow2` | Visual flow editor |

---

## Data Directory

The `data/` directory contains all user-generated and runtime content.

| Path | Description |
|------|-------------|
| `data/boards/` | Board definitions and code |
| `data/cards/` | Card templates and instances |
| `data/databases/` | SQLite database files |
| `data/automations/` | User automation definitions |
| `data/dendrite/` | Matrix server data |
| `data/devices/` | Device configurations |
| `data/keys/` | API keys and secrets |
| `data/models/` | AI model files (*.gguf) |
| `data/pages/` | Static frontend builds |
| `data/prompts/` | AI prompt templates (*.tpl) |
| `data/public/` | Public static assets |
| `data/settings/` | System settings |
| `data/system/` | Process state, runtime data |
| `data/templates/` | Board and component templates |
| `data/themes/` | UI themes (CSS + JSON) |
| `data/tmp/` | Temporary files |

---

## API Reference

### Core API (`/api/core/v1/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/boards` | GET | List all boards |
| `/boards/{name}` | GET | Get board details |
| `/boards/{name}` | POST | Create board |
| `/boards/{name}` | PUT | Update board |
| `/boards/{name}` | DELETE | Delete board |
| `/boards/{name}/actions/{action}` | POST | Execute action card |
| `/boards/{name}/cards/{card}` | GET | Get card value |

### Agent API (`/api/agents/v1/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/{board}/agent_input` | POST | Send message to agent |

### Event System

Events flow through MQTT and the event extension:

```javascript
// Emit event
await context.events.emit({
    path: 'devices/mydevice/online',
    from: 'core',
    user: 'system',
    payload: { ip: '192.168.1.100' }
})

// Listen for events (in automations)
context.events.on('devices/*/online', (event) => {
    console.log('Device came online:', event.payload)
})
```

---

## AI Integration

### Cloud AI (ChatGPT)

Configure in Settings or via `data/settings/ai.*` files.

```javascript
// In card code
const response = await context.chatgpt.prompt({
    message: 'Hello!',
    model: 'gpt-4o-mini',  // or 'gpt-4o', 'gpt-4-turbo'
    images: [],            // Optional: image URLs or base64
    files: [],             // Optional: file paths
    conversation: []       // Optional: message history
})
```

### Local AI (LLaMA)

1. Download model: Place `.gguf` file in `data/models/`
2. Download llama-server: `node scripts/download-llama.js`
3. Use in code:

```javascript
// Preload model (optional, for faster first response)
await context.llama.llamaPreload('gemma-3-12b-it-Q4_1')

// Query
const response = await context.llama.prompt({
    message: 'Hello!',
    model: 'gemma-3-12b-it-Q4_1'
})

// Check status
const status = await context.llama.llamaStatus()
// { serverRunning: true, modelLoaded: 'gemma-3-12b-it-Q4_1', ... }
```

### AI Settings Files

| File | Description |
|------|-------------|
| `data/settings/ai.enabled` | AI feature flag |
| `data/settings/ai.provider` | `openai` or `local` |
| `data/settings/ai.localmodel` | Default local model name |

---

## MCP Protocol

The MCP server (`apps/mcp`) exposes Vento to AI assistants.

### Configuration (for Cursor, Claude Desktop, etc.)

```json
{
  "mcpServers": {
    "vento": {
      "command": "node",
      "args": ["path/to/ventisco/apps/mcp/dist/index.js"]
    }
  }
}
```

### Exposed Tools

For each board, MCP exposes:
- `{board}_chat` - Send message to agent
- `{board}_{action}` - Execute specific action

### Exposed Resources

- `vento://boards/{board}/values/{card}` - Read value cards

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | production/development |
| `FULL_DEV` | 0 | Enable hot-reload for core |
| `ADMIN_API_URL` | http://localhost:8000 | Core API URL |
| `WEBSOCKET_URL` | http://localhost:3003 | WebSocket URL |
| `LLAMA_SERVER_PORT` | 8788 | Local LLM server port |
| `LLAMA_GPU_LAYERS` | -1 | GPU layers for LLM (-1 = auto) |
| `LLAMA_CTX_SIZE` | 8192 | Context size for LLM |
| `OPENAI_API_KEY` | - | OpenAI API key (or use keys extension) |

---

## Coding Conventions

### TypeScript/JavaScript

- Use TypeScript for new code in `apps/` and `packages/`
- Card code uses plain JavaScript (no imports)
- Use `getLogger()` from protobase for logging
- Handle errors with try/catch and proper logging

### Naming

- Boards: lowercase with underscores (`my_board`)
- Cards: lowercase with underscores (`my_action`)
- Extensions: lowercase (`myextension`)
- API routes: lowercase, kebab-case or slashes

### Context Functions

Always follow this pattern:

```typescript
export const myFunction = async (options: {
    requiredParam: string,
    optionalParam?: number,
    done?: (result) => void,
    error?: (err) => void
}) => {
    const {
        requiredParam,
        optionalParam = 10,
        done = (r) => r,
        error = () => {}
    } = options;
    
    try {
        // Implementation
        const result = await doSomething(requiredParam, optionalParam);
        done(result);
        return result;
    } catch (err) {
        error(err);
        throw err;
    }
}
```

### Prompt Templates

AI prompts live in `data/prompts/*.tpl`:

```tpl
You are a helpful assistant for {system_name}.

Current context:
{context}

User request:
{request}

Respond in {language}.
```

---

## Troubleshooting

### GPU/LLM Issues

If llama-server crashes or causes system issues:
1. Run `node scripts/download-llama.js` to get latest binary
2. Check `data/models/` has valid `.gguf` files
3. Reduce GPU layers: `LLAMA_GPU_LAYERS=20` in environment
4. Check logs in `logs/raw/core*.log`

### Process Won't Stop

```bash
yarn stop
# or if stuck:
yarn kill
```

### Database Issues

Databases are in `data/databases/`. To reset:
1. Stop Vento
2. Delete specific `.db` file
3. Restart Vento (recreates automatically)

### UI Not Loading

1. Check `data/pages/` exists and has content
2. Run `yarn update-ui` to re-download
3. Or `yarn enable-ui-dev` for development

---

## Quick Reference

```bash
# Start Vento
yarn start

# Development mode
yarn dev

# Stop everything
yarn stop

# Check status
yarn status

# Add admin user
yarn add-user

# Update everything
yarn update

# Build Go agent
yarn build-agent
```

**URLs:**
- Admin Panel: http://localhost:8000/workspace/
- API: http://localhost:8000/api/core/v1/
- WebSocket: ws://localhost:8000/websocket

