---
sidebar_position: 3
---

# Commands Reference

Complete reference of Vento commands.

## Boot Commands

| Command | Description |
|---------|-------------|
| `yarn start` | Start Vento (runs `prepare-dev` first) |
| `yarn start-fast` | Start without running `prepare-dev` |
| `yarn dev` | Development mode with hot-reload (runs `prepare-dev` first) |
| `yarn dev-fast` | Dev mode without running `prepare-dev` |

### The `prepare-dev` Phase

When you run `yarn start` or `yarn dev` (without `-fast`), Vento executes a **prepare-dev** phase before starting services. Each service can define a `prepare-dev` script in its `package.json`.

**What happens during `prepare-dev`:**
1. Runs the root `prepare.js` (downloads static pages, clients, etc.)
2. Builds all packages (`yarn build`)
3. Runs `yarn prepare-dev` in each workspace that defines it

**What services typically do in `prepare-dev`:**
- Initialize required directories
- Generate configuration files (e.g., `TOKEN_SECRET` in `.env`)
- Download dependencies or compile assets if needed
- Perform any one-time setup required before the service runs

**When to use `-fast` variants:**
- After your first successful start (environment is already configured)
- During rapid development when you don't need re-initialization
- The Electron launcher uses `-fast` because it handles setup separately

**Example: Defining `prepare-dev` in a service:**

In `apps/myservice/package.json`:
```json
{
  "scripts": {
    "prepare-dev": "node prepare.js"
  }
}
```

Services that define `prepare-dev`:
- `apps/core` - Generates JWT secret
- `apps/adminpanel` - Compiles Next.js to static HTML if needed
- `apps/dendrite` - Initializes Matrix server config
- `apps/chat` - Setup chat service

## Process Management

| Command | Description |
|---------|-------------|
| `yarn status` | Show status of all processes |
| `yarn stop` | Stop all services gracefully |
| `yarn kill` | Alias for `yarn stop` |
| `yarn restart` | Restart all processes |
| `yarn logs` | View process logs |
| `yarn monit` | Monitor processes |

## User Management

### Create User

```bash
yarn add-user <username> <password> <type>
```

**Parameters:**
- `username` - Login name
- `password` - User password  
- `type` - User type: `admin`, `user`, or `device`

**Examples:**
```bash
yarn add-user admin mypassword admin
yarn add-user john secret123 user
yarn add-user sensor1 devicepass device
```

## Update

| Command | Description |
|---------|-------------|
| `yarn update` | Update Vento (agent, UI, pull latest) |
| `yarn update-agent` | Update only the Go agent |
| `yarn update-ui` | Update only the UI builds |

## Development

| Command | Description |
|---------|-------------|
| `yarn enable-ui-dev` | Enable Next.js dev mode |
| `yarn disable-ui-dev` | Use static builds |
| `yarn build` | Build all packages |
| `yarn clean` | Clean build artifacts |
| `yarn fix` | Fix dependency issues |

## Client Management

| Command | Description |
|---------|-------------|
| `yarn build-agent` | Build Go client for current platform |
| `yarn download-agent` | Download pre-built Go client |
| `yarn update-agent` | Force re-download client |
| `yarn setup-agent` | Setup local agent config |

## Utilities

| Command | Description |
|---------|-------------|
| `yarn update` | Update Vento (pull, update UI) |
| `yarn assets` | Run assets management |
| `yarn download-binaries` | Download all binaries |

## CLI Usage

Interactive CLI:

```bash
yarn vento <command>
```

### Available CLI Commands

```bash
yarn vento status   # Show status
yarn vento start    # Start services
yarn vento stop     # Stop services
yarn vento logs     # View logs
```

## Development Mode

For active development with hot-reload:

```bash
# Enable UI development
yarn enable-ui-dev

# Start in dev mode
yarn dev

# When done, disable UI dev
yarn disable-ui-dev
```

## Service Logs

View logs in real-time:

```bash
# All logs
yarn logs

# Specific service
tail -f logs/core.log
tail -f logs/api.log
tail -f logs/adminpanel.log
```

Raw logs are in `logs/raw/`.

