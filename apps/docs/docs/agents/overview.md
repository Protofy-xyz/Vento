# Device Agents Overview

Vento can connect to physical devices through specialized agents. Each agent type connects different hardware to the Vento network.

## Available Agents

| Agent | Platform | Features |
|-------|----------|----------|
| **Go Agent** | Windows, Linux, macOS | File system, shell, screenshots, system info |
| **Android App** | Android | Camera, GPS, sensors, notifications, TTS |
| **Python Agent** | Raspberry Pi | GPIO control, sensors |
| **ESP32** | ESPHome | Sensors, relays, switches, PWM |

## Adding Devices

### Via Network View

1. Click Vento logo to open Network view
2. Click **+ Add**
3. Select device type
4. Follow the wizard

### Device Types

| Option | Description |
|--------|-------------|
| **Android Device** | Connect Android phones via APK |
| **Desktop Agent** | Windows/macOS/Linux computers |
| **ESP32 Device** | IoT devices with ESPHome |
| **Raspberry Pi Agent** | GPIO control for RPi |

## Communication

All agents communicate via MQTT:
- **Port 1883**: TCP for local agents
- **Port 3003**: WebSocket for browsers
- **Topic conventions**: `devices/{id}/status`, `devices/{id}/action`

## Auto-Discovery

ESP32 devices support Home Assistant compatible auto-discovery:
1. Flash ESP32 with ESPHome firmware
2. Device connects to MQTT broker
3. Vento discovers and creates board automatically

