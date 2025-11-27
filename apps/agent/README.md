# 🤖 Vento Agent Service

Runs the Vento Agent as a PM2-managed service. The agent connects your machine to Vento, monitors system resources, and executes actions received via MQTT.

## Prerequisites

1. **Download the agent binary**:
   ```bash
   yarn download-agent
   ```

2. **Configure the agent**:
   ```bash
   yarn workspace agent setup
   ```
   Or run the setup script directly:
   ```bash
   node apps/agent/setup.js
   ```

## How it works

1. The `download-agent` script downloads the correct binary for your platform to `bin/ventoagent`
2. The setup script runs the agent once to configure credentials (saved to `data/agent-config.json`)
3. PM2 automatically starts the agent as a service when Vento starts

## Configuration

The agent configuration is stored in `data/agent-config.json`:

```json
{
  "host": "http://localhost:8000",
  "username": "admin",
  "token": "eyJhbGci...",
  "device_name": "desktop_abc123",
  "monitor_interval_seconds": 30
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VENTO_AGENT_HOST` | Override the Vento host URL |
| `VENTO_AGENT_TOKEN` | Provide token directly (headless mode) |
| `VENTO_AGENT_DISABLED` | Set to `true` to disable the agent |

## Headless Setup

For automated/scripted setup without prompts:

```bash
# Run agent with token directly
./bin/ventoagent -host http://localhost:8000 -token YOUR_TOKEN -config data/agent-config.json -once
```

Or set environment variables:
```bash
export VENTO_AGENT_HOST=http://localhost:8000
export VENTO_AGENT_TOKEN=YOUR_TOKEN
yarn start
```

## Service Management

The agent runs as part of the PM2 ecosystem:

```bash
# Check status
pm2 status

# View logs
pm2 logs agent-dev

# Restart
pm2 restart agent-dev

# Stop
pm2 stop agent-dev
```

## Troubleshooting

### Agent not starting

1. Check if binary exists: `ls bin/ventoagent*`
2. Check if configured: `cat data/agent-config.json`
3. Run setup: `yarn workspace agent setup`

### Connection errors

1. Verify Vento is running: `curl http://localhost:8000/api/core/v1/boards`
2. Check token is valid
3. Re-run setup to get a new token

### Logs

Agent logs are in:
- `logs/raw/agent-dev.stdout.log`
- `logs/raw/agent-dev.stderr.log`

