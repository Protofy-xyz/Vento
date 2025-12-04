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

### Card JSON Schema

Cards can be defined as JSON templates in `extensions/*/cards/*.json`:

```json
{
  "id": "storage_mymodel_create",
  "name": "create",
  "group": "storages",
  "tag": "mymodel",
  "templateName": "Create mymodel in the storage",
  "defaults": {
    "name": "create mymodel",
    "type": "action",
    "description": "Creates a mymodel given its content",
    "icon": "file-plus",
    "width": 2,
    "height": 8,
    "displayResponse": true,
    "displayButton": true,
    "displayIcon": true,
    "params": {
      "name": "Name of the item",
      "value": "Value to store"
    },
    "configParams": {
      "name": { "visible": true, "defaultValue": "", "type": "string" },
      "value": { "visible": true, "defaultValue": "", "type": "json" }
    },
    "presets": {
      "quick-create": {
        "description": "Create with default values",
        "configParams": { "name": { "defaultValue": "default" } }
      }
    },
    "rulesCode": "return execute_action('/api/v1/actions/mymodel/create', userParams)",
    "html": "//@card/react\nfunction Widget(card) { ... }"
  }
}
```

**Card Fields:**

| Field | Description |
|-------|-------------|
| `type` | `action` or `value` |
| `name` | Display name |
| `description` | For AI context |
| `icon` | Lucide icon name |
| `width`/`height` | Grid units |
| `params` | Input parameters |
| `configParams` | Parameter configuration |
| `presets` | Named parameter presets |
| `rulesCode` | JavaScript execution code |
| `html` | Custom HTML/React rendering |
| `displayResponse` | Show return value |
| `displayButton` | Show run button |
| `displayIcon` | Show icon |
| `manualAPIResponse` | Control HTTP response manually |
| `enableAgentInputMode` | Accept agent inputs |

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
| `context.events` | `emit`, `on`, `onEvent`, `emitEvent`, `getLastEvent` | Event system |
| `context.apis` | `getServiceToken`, `fetch` | API utilities |
| `context.keys` | `getKey`, `setKey` | Secret management |
| `context.files` | `read`, `write`, `list`, `delete` | File operations |
| `context.databases` | `get`, `set`, `query` | Database operations |
| `context.html` | `render` | HTML template rendering |
| `context.state` | `get`, `set`, `subscribe` | Global state |
| `context.automations` | `automation`, `createSchedule`, `createPeriodicSchedule`, `scheduleJob` | Task scheduling |
| `context.statemachines` | `spawnStateMachine`, `emitToStateMachine`, `getStateMachine`, `stateMachineFilter`, `onStateMachineEvent` | State machine management |
| `context.actions` | `add`, `execute` | Action registration |
| `context.cards` | `add` | Card registration |
| `context.flow2` | `switch`, `forEach`, `filter`, `map`, `split`, `join`, `push`, `jsonParse`, `toJson`, `addObjectKey` | Flow utilities |

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

## Automations & Scheduling

The automations extension (`extensions/automations/`) provides task scheduling and automation registration.

### Creating Automations

Automations are defined in `data/automations/` and expose custom API endpoints.

```javascript
// In data/automations/myTask.ts
import { Protofy } from 'protobase'
import APIContext from 'app/bundles/context'

export default Protofy("code", async (app, context: typeof APIContext) => {
    // Register automation with scheduling
    await context.automations.automation({
        name: 'daily-report',
        app: app,
        description: 'Generate daily report',
        automationParams: {
            email: { description: 'Email to send report to' }
        },
        onRun: async (params, res) => {
            // Your automation logic here
            console.log('Running daily report for', params.email)
        }
    })
})
```

### Scheduling Tasks

```javascript
// One-time schedule (specific date/time)
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
    'monday,wednesday,friday'  // days
)

// Advanced scheduling with job control
const job = context.automations.scheduleJob({
    name: 'backup-job',
    hours: 2,
    minutes: 0,
    days: 'sunday',
    callback: async () => { ... },
    autoStart: true,
    runOnInit: false   // Run immediately on creation
})
// job.stop() / job.start() for control
```

### Automation Registration

When you call `context.automations.automation()`, it:
1. Registers the automation in `/api/core/v1/automations`
2. Creates an action at `/api/v1/automations/{name}`
3. Adds a card for AI agents to use

---

## Network Options (+ Add Menu)

The network view has a "+ Add" button that shows options for adding elements to your Vento network.

### Available Network Options

| Option | Extension | Description |
|--------|-----------|-------------|
| Android Device | `extensions/android` | Connect Android phones via APK |
| Desktop Agent | `extensions/desktop` | Windows/macOS/Linux agents |
| ESP32 Device | `extensions/esphome` | IoT devices with ESPHome |
| Raspberry Pi Agent | `extensions/raspberrypi` | GPIO control for RPi |
| Data Object | `extensions/objects` | Create data storage objects |
| Virtual Agent | `extensions/boards` | AI-powered virtual agents |
| Task | `extensions/apis` | Custom API endpoints |

### Creating a Network Option

To add a new option to the "+ Add" menu:

1. Create `extensions/myextension/networkOption.tsx`:

```tsx
import type { NetworkOption } from '../network/options'

const MyWizard = ({ onCreated, onBack }) => {
    // Your wizard UI here
    return (
        <YStack>
            {/* Configuration steps */}
            <Button onPress={() => onCreated({ name: 'mydevice' })}>
                Create
            </Button>
        </YStack>
    )
}

export const myOption: NetworkOption = {
    id: 'myoption',
    name: 'My Device Type',
    description: 'Add my custom device',
    icon: 'box',
    Component: MyWizard
}
```

2. Register in `extensions/network/options/index.ts`:

```typescript
import { myOption } from '../../myextension/networkOption'

export const networkOptions: NetworkOption[] = [
    // ... other options
    myOption,
]
```

---

## Board Templates

When creating a virtual agent, you can choose from templates in `data/templates/boards/`:

| Template | Description |
|----------|-------------|
| `blank` | Empty board with no cards |
| `ai agent` | Basic AI agent with chat |
| `chatgpt` | ChatGPT integration agent |
| `rule-based agent` | Automation rules without AI |
| `smart ai agent` | Advanced AI with multiple capabilities |

### Template Structure

Each template folder contains:
- `{name}.json` - Board configuration and cards
- `{name}.js` - Board code
- `{name}_ui.js` - UI-specific card code
- `README.md` - Template description

---

## Card HTML Rendering

Cards can have custom HTML/React rendering via the `html` field. Two modes are supported:

### React Mode (`//@card/react`)

Renders React components directly in the DOM:

```javascript
// Card html field:
//@card/react

function Widget(card) {
  const value = card.value;
  
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} ai="center" jc="center">
          <Icon name={card.icon} size={48} color={card.color}/>
          <CardValue value={value ?? "N/A"} />
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
```

### IFrame Mode (`//@card/reactframe`)

Renders in an isolated iframe (better for complex/external libraries):

```javascript
// Card html field:
//@card/reactframe

function Widget(props) {
  // props contains card data
  // execute_action() is available for calling board actions
  
  return (
    <div>
      <button onClick={() => execute_action('my_action', { param: 'value' })}>
        Run Action
      </button>
    </div>
  );
}
```

### Available Components in Card HTML

| Component | Description |
|-----------|-------------|
| `Tinted` | Applies theme tinting |
| `ProtoThemeProvider` | Theme context |
| `YStack`, `XStack` | Flex containers |
| `Icon` | Icon renderer |
| `CardValue` | Display card value |
| `ActionCard` | Action card wrapper |
| `ParamsForm` | Form for action params |
| `StorageView` | Object storage viewer |
| `Markdown` | Markdown editor |
| `FileBrowser` | File browser |

### ViewLib Helpers (`extensions/boards/viewLib.js`)

Available helpers for card HTML:

```javascript
// Create card container
card({ content: '...', style: '', padding: '10px' })

// Render icon
icon({ name: 'search', size: 48, color: 'var(--color7)' })

// Display JSON as collapsible tree
jsonToDiv(data, indent, expandedDepth)

// Create data table
cardTable(dataArray)

// Display card value
cardValue({ value: '...', style: '' })

// Action card with params form
cardAction({ data: card, content: '...' })

// YouTube embed
youtubeEmbed({ url: 'https://...' })

// Image
boardImage({ src: '...', alt: '', style: '' })

// IFrame
iframe({ src: 'https://...' })

// Get board states
getStates()

// Get board actions
getActions()

// Get storage data
getStorage(modelName, key, defaultValue)
```

---

## Prompt Templates

AI prompts are stored in `data/prompts/*.tpl`:

| Template | Purpose |
|----------|---------|
| `agentRules.tpl` | Main agent system prompt |
| `actionRules.tpl` | Action card prompt rules |
| `valueRules.tpl` | Value card prompt rules |
| `aiSearch.tpl` | AI-powered search queries |
| `llm.tpl` / `llmv2.tpl` | Local LLM prompts |
| `explainActions.tpl` | Action explanation |
| `componentGenerator.tpl` | UI component generation |

### Prompt Template Variables

Templates use `{variable}` syntax:
```tpl
You are an assistant for {system_name}.
Current context: {context}
User request: {request}
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
aU
---

## Technical Deep Dive

### Authentication & Tokens

**Token Generation:**
```typescript
// packages/protobase/src/crypt.ts
import jwt from 'jsonwebtoken';

// Tokens require TOKEN_SECRET environment variable
export const genToken = (data, options = { expiresIn: '3600000s' }) => {
    return jwt.sign(data, process.env.TOKEN_SECRET, options);
}

export const verifyToken = (token) => {
    return jwt.verify(token, process.env.TOKEN_SECRET);
}
```

**Service Token** (for internal API calls):
```typescript
// System-level token with admin privileges
const token = getServiceToken()
// Returns: jwt.sign({id:'system', type:'system', admin:true}, TOKEN_SECRET)
```

**Session Structure:**
```typescript
type SessionDataType = {
    user: {
        admin: boolean,
        id: string,          // 'guest' if not logged in
        type: 'user' | 'guest' | 'device' | 'system',
        permissions: string[]
    },
    token: string,
    loggedIn: boolean
}
```

**API Handler Pattern:**
```typescript
// packages/protonode/src/lib/handler.ts
import { handler } from 'protonode';

// Auto-extracts session from cookies/query params
app.get('/my-endpoint', handler(async (req, res, session, next) => {
    if (!session.user.admin) {
        res.status(401).send({error: "Unauthorized"})
        return
    }
    // ... handle request
}))
```

### MQTT Broker

The core runs an **Aedes MQTT broker** on port 1883 with WebSocket support on 3003.

**Ports:**
- `1883` - MQTT TCP (for local agents)
- `3003` - WebSocket (`/websocket` path for browser clients)

**Client Connection:**
```typescript
import { getMQTTClient } from 'protonode';

const mqtt = getMQTTClient('myservice', getServiceToken());
mqtt.subscribe('notifications/#');
mqtt.on('message', (topic, message) => {
    // Handle message
});
mqtt.publish('my/topic', JSON.stringify(data));
```

**Topic Conventions:**
- `notifications/event/create/{path}` - Event notifications
- `notifications/{model}/{action}/{id}` - Model changes
- `devices/{deviceId}/status` - Device status updates

### Database (ProtoDB)

Vento uses **SQLite** by default with an abstract `ProtoDB` class for potential backends.

**Database Location:** `data/databases/{name}`

**API Pattern:**
```typescript
import { connectDB } from 'app/bundles/storageProviders';

const db = await connectDB('mydata');
await db.put('key', JSON.stringify(value));
const data = await db.get('key');
await db.del('key');

// Iteration
const iterator = db.iterator();
for await (const [key, value] of iterator) {
    // Process entries
}
```

### Event System

**Event Schema:**
```typescript
{
    path: string,        // Hierarchical: 'devices/esp32/online'
    from: string,        // Source: 'core', 'api', etc.
    user: string,        // User ID or 'system'
    payload: object,     // Event-specific data
    ephemeral?: boolean, // If true, not stored in DB
    created: string      // ISO timestamp
}
```

**Emit Event:**
```typescript
import { generateEvent } from 'protobase';

await generateEvent({
    path: 'services/core/start',
    from: 'core',
    user: 'system',
    payload: { port: 8000 }
}, getServiceToken());
```

**Subscribe to Events (in extension):**
```typescript
// Via MQTT topic
topicSub(mqtt, 'notifications/event/create/#', (message, topic) => {
    const event = JSON.parse(message);
    // Handle event
});
```

### boardConnect Function

Cards execute via `boardConnect`, which manages IPC with the main process:

```typescript
// packages/protonode/src/lib/boardConnect.ts
const { boardConnect } = require('protonode')

const run = Protofy("code", async ({ context, states, board, params }) => {
    // 'states' contains all board card values
    // 'board' provides: { onChange, execute_action, log, id }
    // 'context' has all extension functions
    // 'params' are the card's input parameters
    
    return result; // Becomes card's value
})

boardConnect(run)
```

**board Object Methods:**
```javascript
// Watch for state changes
board.onChange({ name: 'some_card', changed: (newValue) => {
    console.log('Card changed:', newValue);
}});

// Execute another action
await board.execute_action({
    name: 'other_action',
    params: { key: 'value' },
    done: (result) => {},
    error: (err) => {}
});

// Log with board prefix
board.log('Message'); // Outputs: "Board log [boardId]: Message"
```

### Parameter Resolution

Card params support **state references** (values from other cards):

```javascript
// In card config, params can reference board state:
{
    "message": "board.current_request"  // Resolves to card value
}

// Supported patterns:
"board.cardName"           // Direct card value
"board?.cardName"          // Optional chaining
"board['cardName']"        // Bracket notation
"board.cardName.nested"    // Nested properties
```

**Type Casting:**
- `string`, `number`, `boolean` - Standard JS types
- `json` - JSON.parse()
- `array` - JSON.parse() expecting array
- `state` - Resolve and stringify board state

### API Client (Internal)

```typescript
import { API } from 'protobase';

// GET request (with auto-retry)
const result = await API.get('/api/core/v1/boards?token=' + token);
if (result.isError) {
    console.error(result.error);
    return;
}
console.log(result.data);

// POST request
const result = await API.post('/api/core/v1/boards', boardData);
```

**PendingResult Shape:**
```typescript
{
    isLoading: boolean,
    isLoaded: boolean,
    isError: boolean,
    data: any,
    error: any
}
```

### Protofy Annotation

`Protofy()` is a **no-op annotation** used for code analysis and tooling:

```typescript
// packages/protobase/src/Protofy.ts
export const Protofy = (type, x) => x;

// Used in schemas for admin panel features
export const BoardSchema = Schema.object(Protofy("schema", {
    name: z.string().id(),
    // ...
}));

// Used in card code
const run = Protofy("code", async ({ context }) => {
    // ...
});

// Used for feature flags
Protofy("features", { "adminPage": "/boards" });
```

### Masks (Visual Programming Nodes)

Masks define how functions appear in the visual editor:

```typescript
// extensions/chatgpt/cardMasks/boardPrompt.tsx
import { buildAutoMask, MaskDefinition } from 'protolib/components/GenericMask';

const promptMask: MaskDefinition = {
    from: 'Board',                    // Category
    id: 'chatgpt.prompt',             // Unique identifier
    title: 'ChatGPT Prompt',          // Display name
    category: 'AI',
    keywords: ['ai', 'llm', 'chatgpt'],
    context: 'context.chatgpt.prompt', // Actual function path
    icon: 'sparkles',
    params: {
        message: {
            type: 'input',
            label: 'Message',
            initialValue: { value: '', kind: 'StringLiteral' }
        },
        done: {
            type: 'output',
            label: 'Done',
            vars: ['response']    // Output variables
        },
        error: {
            type: 'output',
            label: 'Error',
            vars: ['err']
        }
    }
};

export default buildAutoMask(promptMask);
```

### Keys Extension

Secure storage for API keys and secrets:

```typescript
// Get key (falls back to env var, then defaultValue)
const apiKey = await context.keys.getKey({
    key: 'OPENAI_API_KEY',
    token: getServiceToken(),  // Optional, auto-resolved
    defaultValue: undefined    // Fallback if not found
});

// Keys are stored in data/keys/ as encrypted files
// Accessible via /api/core/v1/keys/{keyName}
```

### Logging

Uses **Pino** logger with multiple transports:

```typescript
import { getLogger } from 'protobase';

const logger = getLogger();

// Levels: fatal, error, warn, info, debug, trace
logger.info({ userId: 123 }, 'User logged in');
logger.error({ error: err }, 'Something failed');
logger.debug('Detailed debug info');
```

**Log Destinations:**
- Console (pino-pretty, colored)
- File (`logs/{serviceName}.log`)
- MQTT (for remote monitoring)

### File Paths

```typescript
import { getRoot } from 'protonode';

// Returns project root (default: '../../' from apps/)
const root = getRoot();
// Can be overridden with FILES_ROOT env var

// Common paths
const modelsDir = path.join(getRoot(), 'data', 'models');
const boardsDir = path.join(getRoot(), 'data', 'boards');
```

### TypeScript Configuration

Key `tsconfig.json` settings:
```json
{
    "compilerOptions": {
        "jsx": "react-native",     // For React Native compatibility
        "moduleResolution": "node",
        "strictNullChecks": false, // Relaxed null checks
        "target": "ESNext"
    }
}
```

**Path Aliases** (via yarn workspaces):
- `protobase` → `packages/protobase`
- `protonode` → `packages/protonode`
- `@extensions/*` → `extensions/*`
- `app/*` → `packages/app/*`

### Flow2 Context Functions

Additional utility functions for flow programming:

```typescript
import flow2 from '@extensions/flow2/context';

// Available functions:
flow2.switch(value, cases)      // Switch/case
flow2.forEach(array, callback)  // Iterate
flow2.filter(array, predicate)  // Filter
flow2.map(array, transform)     // Map
flow2.split(string, delimiter)  // Split string
flow2.join(array, delimiter)    // Join to string
flow2.push(array, item)         // Push to array
flow2.jsonParse(string)         // Parse JSON
flow2.toJson(object)            // Stringify
flow2.addObjectKey(obj, k, v)   // Add key to object
```

### Process Agent Response

For AI agents that return structured actions:

```typescript
import { processAgentResponse } from 'protonode';

// AI response format expected:
// ```json
// { "response": "...", "actions": [{ "name": "...", "params": {...} }] }
// ```

const result = await processAgentResponse({
    response: aiResponse,
    execute_action: async (name, params) => {
        // Execute the action and return result
        return await board.execute_action({ name, params });
    },
    done: (processed) => {
        // { response, executedActions, approvals }
    }
});
```

### Common Gotchas

1. **TOKEN_SECRET Required**: JWT tokens won't work without `TOKEN_SECRET` env var
2. **No require/import in Cards**: Card code runs in isolated context, use `context.*`
3. **Board Names**: Must be lowercase with underscores only (`/^[a-z0-9_]+$/`)
4. **Hot Reload**: Needs `FULL_DEV=1` for `apps/core` file watching
5. **GPU Cleanup**: LLM processes need proper shutdown to avoid Windows crashes
6. **Static Pages**: UI served from `data/pages/` unless dev mode enabled
7. **MQTT Auth**: Disabled by default, enable with `ENABLE_MQTT_AUTH=true`
8. **Node Version**: Requires Node.js >= 18.0.0

---

## Object System (AutoAPI + DataView)

Vento provides a powerful object system that automatically generates CRUD APIs from Zod schemas and creates matching admin panel interfaces. This system combines:

- **AutoAPI**: Generates REST endpoints with pagination, search, filtering, and real-time MQTT notifications
- **DataView**: React component that renders CRUD interfaces with automatic real-time updates
- **ProtoModel**: Base class for data models with validation, serialization, and transformations

### How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Zod Schema    │────▶│    AutoAPI      │────▶│  REST Endpoints │
│  (ProtoModel)   │     │  (generateApi)  │     │   /api/v1/...   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │ MQTT
                        │    DataView     │◀─────────────┤ notifications
                        │   (Frontend)    │              │
                        └─────────────────┘              │
                                ▲                        │
                                └────────────────────────┘
```

### Creating Objects via Admin UI (Recommended)

The easiest way to create objects is through the Vento admin panel:

1. Go to `/workspace/objects` or click **"+ Add" → "Data Object"** in the network view
2. Enter object name and define fields using the visual editor
3. Click **"Create Object"**

**What Vento auto-generates:**

| Generated Item | Location | Purpose |
|----------------|----------|---------|
| Schema file | `data/objects/{name}.ts` | Zod schema + ProtoModel class |
| AutoAPI | `data/automations/{name}.ts` | REST endpoints with CRUD |
| Board | `data/boards/{name}_object/` | Cards for AI agent interaction |
| Admin page | `/workspace/objects/view?object={name}Model` | DataView UI for CRUD |

**The object immediately appears in:**
- `/workspace/objects` - List of all objects
- `/workspace/objects/view?object={name}Model` - CRUD interface for that object
- API at `/api/v1/{name}` - Full REST endpoints

### Field Types in Visual Editor

When creating objects in the UI, you can choose:

| Type | Description |
|------|-------------|
| `string` | Text field |
| `number` | Numeric field |
| `boolean` | True/false |
| `array` | List of items |
| `object` | Nested object |
| `record` | Key-value map |
| `date` | Date picker |
| `relation` | Link to another object |

### Field Modifiers in Visual Editor

| Modifier | Description |
|----------|-------------|
| `id` | Primary key |
| `search` | Enable search |
| `optional` | Not required |
| `email` | Email validation |
| `color` | Color picker |
| `file` | File upload |
| `datePicker` | Date selector |
| `textArea` | Multi-line text |
| `label` | Display label |
| `hint` | Help text |
| `static` | Cannot change after creation |
| `min/max` | Value limits |
| `secret` | Hidden/masked |
| `picker` | Dropdown selection |
| `location` | GPS coordinates |

### Storage Options

When creating an object, you can choose:
- **Default Provider** - SQLite database (default)
- **Google Sheets** - Store data in a Google Spreadsheet
- **JSON File** - Store as local JSON file

### Creating Objects Manually (Advanced)

For more control, you can create objects manually:

1. **Define the Schema** (`data/objects/myobject.ts`):

```typescript
import { Protofy, Schema, BaseSchema, ProtoModel, SessionDataType, z } from 'protobase'

Protofy("features", {
    "AutoAPI": true,  // Enable automatic API generation
    "adminPage": "/objects/view?object=myobjectModel"
})

export const BasemyobjectSchema = Schema.object(Protofy("schema", {
    // Define your fields here using Zod
    name: z.string().id().search(),           // .id() marks as primary key
    email: z.string().search(),               // .search() enables full-text search
    status: z.enum(['active', 'inactive']),
    created: z.string().generate(() => new Date().toISOString()).indexed()
}))

// Extend with base fields if no custom id
const hasId = Object.keys(BasemyobjectSchema.shape).some(key => BasemyobjectSchema.shape[key]._def.id)
export const myobjectSchema = Schema.object({
    ...(!hasId ? BaseSchema.shape : {}),
    ...BasemyobjectSchema.shape
});

export type myobjectType = z.infer<typeof myobjectSchema>;

export class myobjectModel extends ProtoModel<myobjectModel> {
    constructor(data: myobjectType, session?: SessionDataType) {
        super(data, myobjectSchema, session, "myobject");
    }

    public static getApiOptions() {
        return Protofy("api", {
            "name": "myobject",
            "prefix": "/api/v1/"
        })
    }

    protected static _newInstance(data: any, session?: SessionDataType): myobjectModel {
        return new myobjectModel(data, session);
    }

    static load(data: any, session?: SessionDataType): myobjectModel {
        return this._newInstance(data, session);
    }
}
```

### Schema Field Modifiers

| Modifier | Description |
|----------|-------------|
| `.id()` | Marks field as primary key |
| `.search()` | Enables full-text search on this field |
| `.indexed()` | Creates database index for faster queries |
| `.static()` | Field cannot be changed after creation |
| `.hidden()` | Not shown in admin UI |
| `.generate(fn)` | Auto-generate value on create |
| `.secret()` | Masked in UI (for passwords, keys) |
| `.display(['add', 'edit'])` | Control when field appears in forms |
| `.groupIndex(name, fn)` | Group records by this field |
| `.linkTo(model)` | Create foreign key relationship |

### AutoAPI Options

```typescript
AutoAPI({
    modelName: 'myobject',           // API path: /api/v1/myobject
    modelType: myobjectModel,        // The ProtoModel class
    prefix: '/api/v1/',              // API prefix
    dbName: 'myobject',              // Database name (default: modelName)
    
    // Operations to enable
    operations: ['create', 'read', 'update', 'delete', 'list'],
    
    // Require admin for specific operations
    requiresAdmin: ['delete'],       // or ['*'] for all
    
    // Pagination
    itemsPerPage: 25,
    defaultOrderBy: 'created',
    defaultOrderDirection: 'desc',
    
    // Lifecycle hooks
    onBeforeCreate: async (data, session, req) => data,
    onAfterCreate: async (data, session, req) => data,
    onBeforeRead: async (data, session, req) => data,
    onAfterRead: async (data, session, req) => data,
    onBeforeUpdate: async (data, session, req) => data,
    onAfterUpdate: async (data, session, req) => data,
    onBeforeDelete: async (data, session, req) => data,
    onAfterDelete: async (data, session, req) => data,
    onBeforeList: async (data, session, req) => data,
    onAfterList: async (data, session, req) => data,
    
    // Events
    disableEvents: false,            // Emit events on CRUD
    ephemeralEvents: false,          // Don't persist events
    
    // Advanced
    allowUpsert: false,              // Allow create to update if exists
    skipDatabaseIndexes: false,      // Skip index creation
    single: false,                   // Single entity (not a list)
})
```

### Generated API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/{model}` | GET | List items (paginated, searchable) |
| `/api/v1/{model}` | POST | Create item |
| `/api/v1/{model}/:id` | GET | Read single item |
| `/api/v1/{model}/:id` | POST | Update item |
| `/api/v1/{model}/:id/delete` | GET | Delete item |

**Query Parameters for List:**
- `page` - Page number (0-indexed)
- `itemsPerPage` - Items per page
- `search` - Full-text search query
- `orderBy` - Field to sort by
- `orderDirection` - `asc` or `desc`
- `filter[field]` - Filter by field value
- `all=true` - Return all items (no pagination)

### MQTT Notifications

AutoAPI automatically publishes MQTT messages on CRUD operations:

```
notifications/{modelName}/create/{id}
notifications/{modelName}/update/{id}
notifications/{modelName}/delete/{id}
```

**Payload:**
```json
{
    "id": "item-id",
    "data": { /* full item data */ }
}
```

### DataView Component

DataView is a React component that renders a complete CRUD interface:

```tsx
import { DataView } from 'protolib/components/DataView'
import { myobjectModel } from '@/objects/myobject'

export default function MyObjectPage() {
    return (
        <DataView
            model={myobjectModel}
            sourceUrl="/api/v1/myobject"
            name="myobject"
            
            // Customization
            defaultView="list"           // 'list' | 'grid' | 'raw' | 'map'
            hideAdd={false}
            hideSearch={false}
            hideFilters={true}
            hidePagination={false}
            
            // Callbacks
            onEdit={(data) => data}
            onDelete={(data) => data}
            onAdd={(data) => data}
            
            // Custom fields
            extraFields={{
                customField: {
                    component: (item) => <MyCustomComponent data={item} />
                }
            }}
        />
    )
}
```

**DataView Features:**
- **Auto-refresh**: Subscribes to MQTT notifications and updates in real-time
- **Multiple Views**: List, Grid, Raw JSON, Map (for geo data)
- **Pagination**: Built-in with page navigation
- **Search**: Full-text and AI-powered search
- **Filters**: Custom filter components
- **CRUD Dialogs**: Add/Edit forms generated from schema
- **Selection**: Multi-select for bulk operations

### Real-Time Updates (useRemoteStateList)

DataView uses `useRemoteStateList` hook for real-time updates:

```typescript
import { useRemoteStateList } from 'protolib/lib/useRemoteState'

const [items, setItems] = useRemoteStateList(
    initialItems,                    // Initial data
    fetchFn,                         // Fetch function
    'notifications/mymodel/#',       // MQTT topic pattern
    myobjectModel,                   // Model class
    quickRefresh,                    // Quick refresh mode
    disableNotifications,            // Disable real-time
    debounceMs                       // Debounce interval
)
```

### Object Boards

When you create an object with AutoAPI enabled, Vento automatically creates:
1. A board named `{objectname}_object`
2. Cards for CRUD operations (list, create, read, update, delete)
3. Proper parameter configurations

This allows AI agents to interact with your objects via natural language.

### ProtoModel Methods

```typescript
// Static methods
myobjectModel.load(data)              // Create instance from data
myobjectModel.unserialize(json)       // Parse from JSON string
myobjectModel.getIdField()            // Get primary key field name
myobjectModel.getApiEndPoint()        // Get API URL
myobjectModel.getNotificationsTopic() // Get MQTT topic
myobjectModel.linkTo(displayKey)      // Create linkable schema

// Instance methods
instance.getId()                       // Get primary key value
instance.getData()                     // Get all data
instance.get(key, defaultValue)        // Get field value
instance.create()                      // Validate and prepare for creation
instance.update(newModel)              // Merge with new data
instance.validate()                    // Validate against schema
instance.serialize()                   // Convert to JSON string
instance.read()                        // Get data for reading
instance.list(search, session, ...)   // Filter for listing
```

### Example: Creating Object via UI

1. Go to `/workspace/objects`
2. Click **"+ Add"**
3. Enter name: `products`
4. Add fields:
   - `sku` (string, modifiers: `id`, `search`)
   - `name` (string, modifiers: `search`)
   - `price` (number)
   - `category` (string, modifiers: `search`)
   - `stock` (number)
5. Click **"Create Object"**

**Result:**
- Schema created at `data/objects/products.ts`
- API created at `data/automations/products.ts`
- Board created at `data/boards/products_object/`
- Admin UI at `/workspace/objects/view?object=productsModel`
- REST API at `/api/v1/products`
- Real-time MQTT notifications on changes
- AI agents can manage products via natural language

### Example: Manual Object Creation (Advanced)

For custom logic, create files manually:

**1. Schema** (`data/objects/products.ts`):
```typescript
export const BaseProductsSchema = Schema.object(Protofy("schema", {
    sku: z.string().id().search(),
    name: z.string().search(),
    price: z.number(),
    category: z.string().search().groupIndex("category"),
    stock: z.number().indexed(),
    active: z.boolean().generate(() => true)
}))
```

**2. API with custom hooks** (`data/automations/products.ts`):
```typescript
import { AutoAPI, AutoActions } from 'protonode'
import { ProductsModel } from '../objects/products'

const { name, prefix } = ProductsModel.getApiOptions()

export default async (app, context) => {
    // AutoAPI generates CRUD endpoints
    AutoAPI({
        modelName: name,
        modelType: ProductsModel,
        prefix: prefix,
        requiresAdmin: ['delete'],
        onBeforeCreate: async (data) => ({
            ...data,
            created: new Date().toISOString()
        })
    })(app, context)
    
    // AutoActions generates board cards
    AutoActions({
        modelName: name,
        modelType: ProductsModel,
        prefix: prefix,
        object: 'products'
    })(app, context)
    
    // Add custom endpoints
    app.get('/api/v1/products/low-stock', (req, res) => {
        // Custom logic here
    })
}
```

### Object Admin Pages

Objects are managed through:

| URL | Purpose |
|-----|---------|
| `/workspace/objects` | List all objects, create new ones |
| `/workspace/objects/view?object={name}Model` | DataView CRUD for specific object |

The pages are defined in:
- `apps/adminpanel/pages/objects/index.tsx` - Object list
- `apps/adminpanel/pages/objects/view.tsx` - Object DataView
- `extensions/objects/adminPages.tsx` - Page logic and configuration

### AutoActions (AI Agent Integration)

When you create an object, `AutoActions` (`packages/protonode/src/lib/generateActions.ts`) automatically generates:

1. **Board Cards** - For the board at `data/boards/{name}_object/`:

| Card | Type | Description |
|------|------|-------------|
| `exists` | action | Check if item exists by id |
| `read` | action | Read item by id |
| `create` | action | Create new item |
| `update` | action | Update field of existing item |
| `delete` | action | Delete item by id |
| `list` | action | List/search items with pagination |
| `search` | action | AI-powered natural language search |
| `table` | value | Displays last entries as a table |
| `lastCreated` | value | Last created item |
| `lastUpdated` | value | Last updated item |
| `totalItems` | value | Total count of items |

2. **Action Endpoints** - Under `/api/v1/actions/{modelName}/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/exists` | GET | Check existence |
| `/read` | GET | Read single item |
| `/create` | POST | Create item |
| `/update` | GET | Update item field |
| `/delete` | GET | Delete item |
| `/list` | GET | List/search items |

3. **State Tracking** - In `states.storages.{modelName}`:

```javascript
// Available state values
states.storages.{modelName}.total        // Total item count
states.storages.{modelName}.lastEntries  // Recent items
states.storages.{modelName}.lastCreated  // Last created item
states.storages.{modelName}.lastUpdated  // Last updated item
states.storages.{modelName}.lastCreatedId // ID of last created
states.storages.{modelName}.lastUpdatedId // ID of last updated
states.storages.{modelName}.lastDeletedId // ID of last deleted
```

### How AI Agents Interact with Objects

AI agents can manage objects through:

1. **Natural Language** - Via the `list` card with `action` parameter:
   ```
   "Create a product named iPhone with price 999"
   → Executes create action with params {name: "iPhone", price: 999}
   ```

2. **Direct Action Calls** - Via action endpoints:
   ```javascript
   // In card code
   return execute_action("/api/v1/actions/products/create", {
       name: "iPhone",
       price: 999
   })
   ```

3. **AI Search** - Via `search` card with `ai_mode: true`:
   ```
   "Find all products under $100"
   → Uses AI to translate to search query
   ```

### Template Files

When creating an object, Vento uses templates from `extensions/apis/templates/`:

| Template | Use Case |
|----------|----------|
| `automatic-crud.tpl` | Default SQLite storage |
| `automatic-crud-storage.tpl` | Alternative storage backends |
| `automatic-crud-google-sheet.tpl` | Google Sheets storage |

**Template structure** (`automatic-crud.tpl`):
```typescript
import { AutoActions, AutoAPI, getAuth, getServiceToken } from 'protonode'
import { {{modelName}} } from '../objects/{{object}}'

const {name, prefix} = {{modelName}}.getApiOptions()

// Creates CRUD endpoints at /api/v1/{name}
const {{codeName}}API = AutoAPI({
    modelName: name,
    modelType: {{modelName}},
    prefix: prefix
})

// Creates action endpoints and board cards
const {{codeName}}Actions = AutoActions({
    modelName: name,
    modelType: {{modelName}},
    prefix: prefix,
    object: '{{object}}'
})

export default async (app, context) => {
    {{codeName}}API(app, context)
    {{codeName}}Actions(app, context)
}
```

### Complete Object Creation Flow

When you create an object via the UI, the following happens internally:

```
User creates object "products" with fields
          │
          ▼
┌─────────────────────────────────────────────┐
│ 1. Schema Generation                        │
│    POST /api/core/v1/objects               │
│    → Creates data/objects/products.ts       │
│    → Uses extensions/objects/templateSchema.tpl │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 2. API Generation                           │
│    POST /api/core/v1/apis                   │
│    → Creates data/automations/products.ts   │
│    → Uses extensions/apis/templates/*.tpl   │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 3. Board Generation                         │
│    POST /api/core/v1/import/board          │
│    → Creates data/boards/products_object/   │
│    → Uses 'smart ai agent' template        │
│    → Adds CRUD cards via getObjectCardDefinitions() │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 4. Available Immediately:                   │
│    • /workspace/objects/view?object=productsModel │
│    • /api/v1/products (CRUD endpoints)     │
│    • /api/v1/actions/products/* (action endpoints) │
│    • products_object board with cards      │
│    • MQTT notifications on changes         │
└─────────────────────────────────────────────┘
```

### Bidirectional Deletion

Objects and their boards are linked:

| Action | Result |
|--------|--------|
| Delete object | Also deletes `{name}_object` board |
| Delete `{name}_object` board | Also deletes the object |

This is handled by:
- Object deletion: `coreApis.ts` → `db.del()` → calls board delete API
- Board deletion: Event listener on `boards/delete/#` → deletes object

### Key Files for Object System

| File | Purpose |
|------|---------|
| `extensions/objects/coreApis.ts` | Object CRUD API and board auto-creation |
| `extensions/objects/objectsSchemas.ts` | ObjectModel schema definition |
| `extensions/objects/adminPages.tsx` | Admin panel pages for objects |
| `extensions/objects/networkOption.tsx` | "Add Object" wizard |
| `extensions/objects/templateSchema.tpl` | Template for new object .ts files |
| `extensions/apis/templates/automatic-crud.tpl` | Template for AutoAPI .ts files |
| `packages/protonode/src/lib/generateApi.ts` | AutoAPI implementation |
| `packages/protonode/src/lib/generateActions.ts` | AutoActions implementation |
| `packages/protolib/components/DataView.tsx` | Frontend CRUD component |

### ObjectModel.getSourceCode()

When saving an object, `ObjectModel.getSourceCode()` converts the visual field definitions to TypeScript:

```javascript
// Input (from UI):
{
  name: "products",
  keys: {
    sku: { type: "string", modifiers: [{ name: "id" }, { name: "search" }] },
    name: { type: "string", modifiers: [{ name: "search" }] },
    price: { type: "number" }
  }
}

// Output (TypeScript):
{
    sku: z.string().id().search(),
    name: z.string().search(),
    price: z.number()
}
```

This is then inserted into the schema template to create the final `.ts` file.

