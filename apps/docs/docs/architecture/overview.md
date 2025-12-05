# Architecture Overview

Vento is a monorepo containing multiple services, packages, and extensions that work together to provide a complete AI automation platform.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              VENTO PLATFORM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │
│  │   Admin     │   │    Core     │   │    MQTT     │   │   Matrix    │  │
│  │   Panel     │   │    API      │   │   Broker    │   │   (Chat)    │  │
│  │  (Next.js)  │   │  (Express)  │   │  (Aedes)    │   │ (Dendrite)  │  │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └─────────────┘  │
│         │                 │                 │                            │
│         └────────────────┬┴─────────────────┘                            │
│                          │                                               │
│  ┌───────────────────────▼───────────────────────────────────────────┐  │
│  │                         BOARDS                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │  │  │
│  │  │  │  Value  │ │  Value  │ │ Action  │ │ Action  │    ...    │  │  │
│  │  │  │  Card   │ │  Card   │ │  Card   │ │  Card   │           │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                          │                                               │
└──────────────────────────┼───────────────────────────────────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     │           │         │         │           │
     ▼           ▼         ▼         ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  ESP32  │ │   Go    │ │ Python  │ │ Android │ │   MCP   │
│ ESPHome │ │  Agent  │ │  Agent  │ │   App   │ │ Clients │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

## Monorepo Structure

| Directory | Description |
|-----------|-------------|
| `apps/` | Vento services (core, adminpanel, api, etc.) |
| `apps/clients/` | Client agents (Go, Python, Expo/Android) |
| `packages/` | Shared libraries and components |
| `extensions/` | Modular extensions that add features |
| `data/` | User data, boards, databases, models |
| `bin/` | Downloaded binaries (Go agent, Dendrite) |
| `scripts/` | Utility scripts |

## Core Services

### `apps/core`
The heart of Vento. Handles:
- **HTTP Proxy** on port 8000 (all traffic routes through here)
- **MQTT Broker** for real-time device communication
- **Authentication** and session management
- **Board orchestration** and card execution
- **Extension loading** from `extensions/`

### `apps/adminpanel`
Next.js frontend served at `/workspace/`. Provides:
- Network topology view
- Board editor
- Device management
- Settings and configuration

### `apps/api`
User-defined API server. Loads automations from `data/automations/` enabling custom endpoints without modifying core.

### `apps/dendrite`
Matrix server for chat functionality. Agents appear as Matrix users, enabling natural language communication.

## Key Concepts

### Boards
Collections of cards that represent an agent's capabilities. Each board has:
- **Value Cards**: Read-only computed values (sensors, derived data)
- **Action Cards**: Executable operations (actuators, API calls)
- **Rules**: Agent behavior definitions

### Extensions
Modular plugins that add:
- New `context.*` functions for card code
- Admin panel pages
- API endpoints
- Network options (device types)

### Context System
Card code accesses capabilities via `context.*` functions injected by extensions:
- `context.chatgpt.prompt()` - AI completion
- `context.events.emitEvent()` - Publish events
- `context.keys.getKey()` - Retrieve secrets

## Data Flow

1. **Device → MQTT → Core**: Devices publish sensor data
2. **Core → Board**: Updates value cards with new data
3. **Board → AI**: Sends state to LLM for decision
4. **AI → Actions**: Executes decided actions
5. **Actions → MQTT → Device**: Commands sent to actuators

