---
sidebar_position: 1
---

# Introduction

Vento is a platform for creating **AI control networks** that automate physical devices and machines. It connects Large Language Models (LLMs) to sensors and actuators, enabling AI agents to observe the world, make decisions, and take action.

## What is Vento?

At its core, Vento provides:

- **Boards**: Visual dashboards composed of cards that represent sensors (values) and actuators (actions)
- **AI Agents**: LLM-powered decision loops that read states, evaluate rules, and trigger actions
- **Device Integration**: Native support for ESP32/ESPHome devices with MQTT autodiscovery
- **Cross-platform Agents**: Go, Python, and Android agents to connect any machine or mobile device

```
┌─────────────────────────────────────────────────────────────────┐
│                         VENTO BOARD                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   SENSORS    │  │   AI AGENT   │  │      ACTUATORS       │  │
│  │  (Values)    │──▶│   (LLM)     │──▶│     (Actions)       │  │
│  │              │  │              │  │                      │  │
│  │ • Temperature│  │ Read states  │  │ • Turn on pump       │  │
│  │ • Water level│  │ Apply rules  │  │ • Send notification  │  │
│  │ • Motion     │  │ Decide action│  │ • Control GPIO       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 🤖 Smart AI Agents

Create agents that use LLMs to make intelligent decisions. Agents receive a structured prompt with the current state of all sensors and available actions, then decide what to do next.

```javascript
// The AI sees your board state and available actions
{
  "board_states": { "water_level": 45, "pump_status": "off" },
  "board_actions": ["turn_pump_on", "turn_pump_off", "send_alert"]
}
// And responds with decisions
{
  "response": "Water level is low, turning on the pump",
  "actions": [{ "name": "turn_pump_on", "params": {} }]
}
```

### 📡 Device Integration

Native support for **ESP32** devices via ESPHome with automatic MQTT discovery. Devices appear in Vento automatically when they connect to the network.

- Home Assistant compatible discovery protocol
- Real-time sensor data via MQTT
- Instant action execution
- Visual device configuration

### 🖥️ Cross-Platform Agents

Connect any machine or mobile device to Vento:

| Platform | Agent | Features |
|----------|-------|----------|
| **Android** | Mobile App | Camera, microphone, sensors, GPS, notifications, text-to-speech |
| **Raspberry Pi** | Python | GPIO control, system monitoring |
| **Windows/Linux/macOS** | Go | File system, shell commands, memory monitoring |

### 📦 Data Objects

Create data models with automatic REST API generation. Define your schema visually, and Vento generates CRUD operations, validation, storage, and real-time UI updates.

### 🔌 MCP Integration

Vento exposes boards as tools for AI assistants via the Model Context Protocol (MCP). Use your boards from Claude Desktop, Cursor, or any MCP client.

## Use Cases

- **Industrial Automation**: Control manufacturing processes with AI that monitors sensors and adjusts equipment
- **Smart Home**: Create intelligent home automation that goes beyond simple rules
- **IoT Fleet Management**: Monitor and control distributed devices with centralized AI oversight
- **Agricultural Automation**: Manage irrigation, climate control, and monitoring systems
- **Mobile Workforce**: Deploy Android phones as intelligent sensors for field operations

## Next Steps

- [Installation](./getting-started/installation) - Get Vento up and running
- [Quick Start](./getting-started/quick-start) - Create your first agent
- [Architecture Overview](./architecture/overview) - Understand how Vento works
- [Boards & Cards](./boards/overview) - Learn the core abstractions
- [Data Objects](./objects/overview) - Create auto-generated CRUD APIs
- [Troubleshooting](./troubleshooting) - Common issues and solutions
