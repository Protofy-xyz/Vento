# Go Agent

The Go agent connects Windows, Linux, and macOS computers to Vento.

## Features

- System information gathering
- Screenshot capture
- Webcam capture
- Shell command execution
- File system access
- Memory monitoring

## Installation

### Automatic (Recommended)

The Go agent is automatically downloaded when you start Vento:

```bash
yarn start
```

The binary is stored at:
- Windows: `bin/ventoagent.exe`
- Linux/macOS: `bin/ventoagent`

### Manual Download

```bash
yarn download-agent
```

### Build from Source

```bash
yarn build-agent
```

## Local Agent

By default, Vento starts a local Go agent via `apps/agent`:

1. Agent binary is launched with local config
2. Connects to MQTT broker at localhost
3. Appears as "computer" board in Network view

## Remote Deployment

To connect a remote computer:

1. Go to Network view → **+ Add** → **Desktop Agent**
2. Download the agent for target platform
3. Run on remote machine with connection URL

## Configuration

Agent config is stored in `data/agent-config.json`:

```json
{
  "mqtt_broker": "localhost:1883",
  "board_id": "computer",
  "token": "..."
}
```

## Available Actions

| Action | Description |
|--------|-------------|
| `shell` | Execute shell command |
| `screenshot` | Capture screen |
| `webcam` | Capture webcam photo |
| `read_file` | Read file contents |
| `write_file` | Write file |
| `list_dir` | List directory |

## Available Values

| Value | Description |
|-------|-------------|
| `system_info` | CPU, memory, disk info |
| `os` | Operating system |
| `hostname` | Computer name |
| `uptime` | System uptime |

