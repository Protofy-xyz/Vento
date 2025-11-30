<h1 align="center">
  <img height="60" src="https://raw.githubusercontent.com/Protofy-xyz/Protofy/assets/logo-protofy.png" alt="Vento">
  <br>
  Vento
</h1>

<h3 align="center">AI Control Networks for the Physical World</h3>

<p align="center">
  Build intelligent agents that sense, decide, and act on the real world
</p>

<p align="center">
  <a href="https://github.com/protofy-xyz/protofy/graphs/contributors">
    <img src="https://img.shields.io/github/contributors-anon/protofy-xyz/protofy?color=yellow&style=flat" alt="contributors">
  </a>
  <a href="https://discord.gg/VpeZxMFfYW">
    <img src="https://img.shields.io/badge/discord-7289da.svg?style=flat&logo=discord" alt="discord">
  </a>
</p>

---

## What is Vento?

Vento is an open-source platform for creating **AI control networks** that automate physical devices and machines. It connects Large Language Models (LLMs) to sensors and actuators, enabling AI agents to observe the world, make decisions, and take action.

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

---

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
| **Android** | Mobile App | Camera, microphone, sensors, GPS, notifications, text-to-speech, haptics |
| Raspberry Pi | Python | GPIO control, system monitoring |
| Windows/Linux/macOS | Go | File system, shell commands, memory monitoring |
| Any | All | MQTT integration, custom monitors/actions |

### 📱 Android as a Device

Turn any Android phone into a powerful IoT device. The Vento mobile app exposes your phone's hardware to AI agents:

- **Camera**: Take photos on demand, stream frames for computer vision
- **Microphone**: Record audio, enable voice commands
- **Sensors**: Accelerometer, gyroscope, magnetometer, light sensor
- **Location**: GPS coordinates for geo-aware automation
- **Notifications**: Send alerts and messages to the phone
- **Text-to-Speech**: Make the phone speak responses
- **Haptics**: Vibration feedback for alerts
- **Screen**: Control brightness, keep awake
- **Bluetooth**: Scan and interact with BLE devices

### 🎨 Visual Board Editor

Design control logic visually with the node-based board editor. Each board contains cards that can be:

- **Value Cards**: Display sensor data, computed values, or external state
- **Action Cards**: Execute commands, call APIs, or trigger device actions
- **Linked**: Chain cards together with pre/post execution hooks

### 🔌 MCP Integration

Vento exposes boards as tools for AI assistants via the Model Context Protocol (MCP):

- **Claude Desktop**: Chat with your boards directly
- **Cursor**: Use Vento actions from your IDE
- **Any MCP Client**: Full tool and resource support

### ⚙️ State Machines

Define complex control logic with visual state machines. Perfect for multi-step processes, approval workflows, or conditional automation.

### 📦 Data Objects

Create data models with automatic REST API generation. Define your schema, and Vento generates CRUD operations, validation, and storage.

---

## Quick Start

### Prerequisites

- Node.js 18+ 
- Yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/protofy-xyz/protofy.git vento
cd vento

# Install dependencies
yarn

# Start Vento
yarn dev
```

### Access the UI

Open [http://localhost:8000](http://localhost:8000) in your browser.

Default credentials:
- **Username**: `admin`
- **Password**: `admin`

### Create Your First Agent

1. Click the **Vento logo** to open the Network view
2. Click **Add** and select **Smart AI Agent**
3. Name your agent and click **Create**
4. Your agent is now ready to receive messages!

Access your agent at:
```
http://localhost:8000/api/agents/v1/{agent_name}/agent_input?message=hello
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              VENTO PLATFORM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │
│  │   Admin     │   │    Core     │   │    MQTT     │   │    Chat     │  │
│  │   Panel     │   │    API      │   │   Broker    │   │   Service   │  │
│  │  (Next.js)  │   │  (Express)  │   │  (Aedes)    │   │             │  │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └─────────────┘  │
│         │                 │                 │                            │
│         └────────────────┬┴─────────────────┘                            │
│                          │                                               │
│  ┌───────────────────────▼───────────────────────────────────────────┐  │
│  │                         BOARDS                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │  │  │
│  │  │  │  Value  │ │  Value  │ │ Action  │ │ Action  │           │  │  │
│  │  │  │  Card   │ │  Card   │ │  Card   │ │  Card   │    ...    │  │  │
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
     │           │           │           │           │
     ▼           ▼           ▼           ▼           ▼
┌───────────────────────────────────────────────────────────┐
│                      PHYSICAL WORLD                        │
│  Sensors, Motors, Relays, GPIO, Camera, Microphone, ...    │
└───────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Description |
|-----------|-------------|
| **Admin Panel** | Next.js web UI for managing boards, devices, and configuration |
| **Core API** | Express server handling REST endpoints and board logic |
| **MQTT Broker** | Aedes broker for real-time device communication |
| **Boards** | Collections of cards representing control logic |
| **Cards** | Individual units of state (values) or behavior (actions) |

### AI Decision Loop

When autopilot is enabled, the agent runs a continuous decision loop:

1. **Collect State**: Read all value cards and device sensors
2. **Build Prompt**: Generate XML representation of states and available actions
3. **Query LLM**: Send prompt to local LLM (via LM Studio) or cloud provider
4. **Parse Response**: Extract actions to execute from LLM response
5. **Execute Actions**: Trigger action cards with specified parameters
6. **Repeat**: Wait for state changes or timer, then loop

---

## Use Cases

### Industrial Automation
Control manufacturing processes with AI that monitors sensors, detects anomalies, and adjusts equipment in real-time.

### Smart Home
Create intelligent home automation that goes beyond simple rules—AI agents that understand context and make decisions.

### IoT Fleet Management
Monitor and control distributed devices with centralized AI oversight and automated responses.

### Agricultural Automation
Manage irrigation, climate control, and monitoring systems with AI that adapts to changing conditions.

### Mobile Workforce
Deploy Android phones as intelligent sensors—use cameras for visual inspection, microphones for audio monitoring, and GPS for location-aware automation. AI agents can request photos, speak instructions, or send notifications to field workers.

---

## Connecting Devices

### ESP32 with ESPHome

Integrated editor and flash system to connect ESP32 based devices to the vento network.

### Go Agent

```bash
cd apps/clients/go
go build ./cmd/ventoagent
./ventoagent -host http://localhost:8000 -user admin
```

### Python Agent (Raspberry Pi)

```bash
cd apps/clients/python
pip install -r requirements.txt
python main.py --host http://localhost:8000 --user admin
```

### Android App

Connect your Android phone in two simple steps:

1. **Download the App**: Open the Network view in Vento, click **Add** → **Android Device**, and scan the QR code to download the APK

2. **Connect to Vento**: Open the Vento app and scan the connection QR code to authenticate

Once connected, your Android device appears as a controllable device with all its sensors and actuators available to your AI agents.

**Example: AI-triggered photo capture**
```javascript
// Your AI agent can take photos from the connected Android
{
  "actions": [{
    "name": "android_camera_take_picture",
    "params": { "quality": 0.8 }
  }]
}
// Returns: { "path": "/uploads/photo_123.jpg" }
```

---

## MCP Integration

Connect AI assistants to your Vento boards:

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "vento": {
      "command": "npx",
      "args": ["tsx", "/path/to/vento/apps/mcp/src/index.ts"],
      "env": {
        "API_URL": "http://localhost:8000"
      }
    }
  }
}
```

Now you can ask Cursor to interact with your boards, read sensor values, and execute actions.


## Community

Join us on [Discord](https://discord.gg/VpeZxMFfYW) to:
- Ask questions and get help
- Share your builds and use cases
- Discuss ideas and feature requests
- Connect with other Vento users

---

## License

See the [LICENSE](LICENSE.md) file for details.

---

## Contributing

We welcome contributions! Please see our contributing guidelines and join the Discord to discuss your ideas.

---

<p align="center">
  <b>Vento</b> — Bridging AI and the Physical World
</p>
