# Vento Agent

`ventoagent` is a cross-platform Go agent that connects a machine (Raspberry Pi, Linux, macOS, Windows) to Vento/Protofy. It:

- Manages authentication against `/api/core/v1/auth/login`.
- Persists and reuses tokens in `config.json`.
- Ensures a Vento device exists (creates one with default monitors/actions if needed).
- Connects to the MQTT broker on the same host (port `1883`) using the username + token.
- Publishes memory metrics (total/used RAM) and listens for the `print` action that writes data to stdout.

## Project layout

```
apps/clients/go
├── cmd/ventoagent      # CLI entrypoint
├── internal/agent       # device bootstrap + orchestrates subsystems
├── internal/config      # config persistence + prompting helpers
├── internal/subsystems  # copy-and-paste templates for monitors/actions
├── internal/vento       # HTTP + MQTT helpers and device spec
├── go.mod
└── README.md
```

## Getting started

1. **Configure** – run the binary once. If `config.json` does not exist, the agent asks for `host`, `user`, and `password` (stdin/CLI flags). The file is saved in the current working directory.
2. **Login** – the agent hits `/api/core/v1/auth/login`, stores the returned token, and uses it for future runs.
3. **Device onboarding** – on the first run a random `device_name` (prefixed with `ventoagent-`) is created. If no device exists in Vento, the agent POSTs to `/api/core/v1/devices`.
4. **MQTT session** – the agent connects to the broker on `${host}:1883` with MQTT user = Vento username, password = token.
5. **Runtime** – every subsystem defined under `internal/subsystems` is started:
   - `system_memory.go`: declares two monitors (one boot-time, one interval-based) that publish RAM.
   - `stdout_print.go`: declares an action handler that prints MQTT payloads.
   Each subsystem file returns a `Definition` (monitors + actions + scheduler). Add as many files as you need; intervals are set per monitor.

### CLI flags

```
ventoagent \
  -config config.json \
  -host http://localhost:8000 \
  -user admin \
  -password secret \
  -device my-go-agent \
  -interval 15 \
  -token <existing-token> \
  -skip-register-actions \
  -once
```

| Flag | Description |
|------|-------------|
| `-config` | Path to config file (default: `config.json`) |
| `-host` | Vento host URL (e.g., `http://localhost:8000`) |
| `-user` | Vento username |
| `-password` | Vento password (prompts if empty) |
| `-device` | Device name override |
| `-interval` | Monitor interval in seconds |
| `-token` | Existing Vento token (skips login) |
| `-skip-register-actions` | Don't trigger `/devices/registerActions` |
| `-once` | Run monitors once and exit |
| `-no-tray` | Disable system tray icon (Windows only) |

Flags override values stored in `config.json`. Leaving the password empty triggers an interactive prompt.

### System Tray (Windows & macOS)

On Windows and macOS, the agent displays a system tray icon that shows the connection status:

- 🟢 **Green circle**: Connected to Vento server
- 🟡 **Yellow circle**: Connecting...
- ⚫ **Gray/Red circle**: Disconnected

The tray menu shows:
- Connection status
- Server URL
- Device name
- Quit option

To disable the system tray, use the `-no-tray` flag.

### Headless mode

When both `-host` and `-token` are provided via CLI, the agent runs in **headless mode**:
- No interactive prompts (username, password)
- No config file modifications
- Goes directly to connecting

This is useful for automation, scripts, or running from the Vento CLI:

```bash
# Run agent without any prompts
ventoagent -host http://localhost:8000 -token eyJhbGci...

# From Vento CLI, you could integrate like:
yarn vento run myboard_start_agent -p '{"host": "http://localhost:8000", "token": "..."}'
```

### Config file example

```json
{
  "host": "http://localhost:8000",
  "username": "admin",
  "token": "eyJhbGci...snip...",
  "device_name": "ventoagent-12fc9b3a",
  "monitor_interval_seconds": 30
}
```

## Building

Ensure Go ≥1.21 is installed, then from `apps/clients/go`:

```
go mod tidy
go build ./cmd/ventoagent
```

To cross-compile:

```
GOOS=linux GOARCH=arm64 go build -o ventoagent-linux-arm64 ./cmd/ventoagent
GOOS=windows GOARCH=amd64 go build -o ventoagent.exe ./cmd/ventoagent
GOOS=darwin GOARCH=amd64 go build -o ventoagent-darwin ./cmd/ventoagent
```

## Extending monitors/actions

1. Duplicate `internal/subsystems/system_memory.go` (monitor example) or `internal/subsystems/stdout_print.go` (action example).
2. Rename the file/type and implement the `Build` method:
   - Define your monitors inside `Monitors` with optional `Boot` publisher and a per-monitor `Interval` + `Tick` to stream values.
   - Define your actions inside `Actions` with a handler that receives the raw payload.
3. Add the new template to the slice inside `internal/subsystems/set.go`.

That’s it—no changes are needed in the agent core. You can have dozens of subsystems, each with bespoke monitors/actions/intervals, and the runtime wires them automatically.

All runtime code lives inside `apps/clients/go` as requested, so it can be vendored independently from the rest of the monorepo.

