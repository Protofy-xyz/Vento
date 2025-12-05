---
sidebar_position: 1
---

# Installation

Get Vento up and running on your system.

## Option 1: Download the Launcher (Recommended)

The easiest way to use Vento is downloading the Electron launcher from the official website:

**[Download Vento](https://vento.build/#download)**

Available for:
- Windows
- macOS
- Linux (coming soon)

### What is the Vento Launcher?

The Vento Launcher is a desktop application that wraps Vento into a single downloadable executable. It's the recommended way to use Vento for most users.

**Features:**
- **One-click install** - Download and run, no terminal required
- **Automatic updates** - Stay up to date effortlessly
- **System tray integration** - Runs in the background
- **Auto user creation** - Creates a user without password and logs in automatically
- **Release management** - Download and switch between Vento versions

### How it works

1. Download the launcher from [vento.build](https://vento.build/#download)
2. Run the installer
3. The launcher downloads the latest Vento release
4. Vento starts and the UI opens directly in the launcher window
5. You're ready to go — no browser or localhost access needed

## Option 2: Run from Source

For developers who want to modify Vento or contribute to the project.

### Prerequisites

- **Node.js 18+** (Node.js 20 recommended)
- **Yarn** package manager
- **Git**

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/protofy-xyz/protofy.git vento
cd vento
```

#### 2. Install Dependencies

```bash
yarn
```

This will install all dependencies for the monorepo, including all apps and packages.

#### 3. Create a User

When running from source, you must create a user before starting:

```bash
yarn add-user <username> <password> <type>
```

**Parameters:**
- `username` - Login name
- `password` - User password
- `type` - User type: `admin`, `user`, or `device`

**Examples:**
```bash
# Create an admin user
yarn add-user admin mypassword admin

# Create a regular user
yarn add-user john secret123 user
```

#### 4. Start Vento

```bash
yarn start
```

On first run, Vento will:
1. Download required binaries (Go agent, Dendrite matrix server)
2. Initialize databases
3. Create default configuration
4. Start all services

#### 5. Access the UI

Open [http://localhost:8000/workspace](http://localhost:8000/workspace) in your browser and login with the user you created.

## Updating Vento

To update Vento to the latest version:

```bash
yarn update
```

This command:
1. Updates the Go agent
2. Downloads latest UI builds
3. Updates Android client
4. Pulls latest changes from git

## Commands Reference

| Command | Description |
|---------|-------------|
| `yarn start` | Start Vento (runs prepare first) |
| `yarn start-fast` | Start without initialization |
| `yarn dev` | Development mode with hot-reload |
| `yarn stop` | Stop all services |
| `yarn status` | Show running processes |
| `yarn add-user` | Create a new user |
| `yarn update` | Update Vento to latest version |

## Troubleshooting

### Port Already in Use

If port 8000 is busy, Vento will fail to start. Kill any existing processes:

```bash
yarn stop
```

### Database Issues

To reset the database, stop Vento and delete the database files:

```bash
yarn stop
rm -rf data/databases/*
yarn start
```

### Missing Binaries

If the Go agent or other binaries are missing:

```bash
yarn download-agent
yarn download-binaries
```
