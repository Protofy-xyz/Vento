---
sidebar_position: 2
---

# Quick Start

Create your first AI agent in under 5 minutes.

## Create Your First Agent

### 1. Open the Network View

Click the **Vento logo** in the top-left corner to open the Network view. This shows all connected agents and devices.

### 2. Add a Virtual Agent

1. Click the **+ Add** button
2. Select **Virtual Agent**
3. Choose the **Smart AI Agent** template
4. Enter a name (e.g., `my_assistant`)
5. Click **Create**

### 3. Test Your Agent

Your agent is now ready! There are several ways to interact with it:

#### Visual Board (Easiest)

Click on your agent in the Network view to see its board. You'll see:
- **Action buttons** - Click to execute actions directly
- **State displays** - See current values in real-time
- **Parameter forms** - Fill in parameters and run actions

This is the most direct way to test and interact with your agent.

#### Chat

Open the chat sidebar and send a message to your agent using natural language.

#### Inter-Agent Communication

From another agent, use `agent_call` to communicate:

```javascript
// Call another agent from card code
const response = await context.agents.agent_call({
    agent: 'my_assistant',
    message: 'Hello from another agent!'
})
```

#### REST API (Advanced)

For programmatic access:

```bash
curl "http://localhost:8000/api/agents/v1/my_assistant/agent_input?message=hello"
```

## Understanding the Board

Click on your agent in the Network view to see its board. The board contains:

### Value Cards
Display information and computed values:
- `current_request` - Shows the current pending request
- Custom value cards you create

### Action Cards
Execute operations:
- `agent_input` - Receives messages and queues them
- `reply` - Sends responses back
- Custom action cards you create

## Adding Custom Cards

### Add a Value Card

1. Click **+ Add Card**
2. Select **Value** type
3. Enter name and description
4. Write the rules code:

```javascript
// Return the current time
return new Date().toISOString()
```

### Add an Action Card

1. Click **+ Add Card**
2. Select **Action** type
3. Define parameters:

```javascript
// Echo back the message
return `You said: ${params.message}`
```

## Connecting to AI

### Cloud AI (OpenAI)

1. Go to **Settings** > **AI**
2. Select **OpenAI** as provider
3. Enter your API key
4. Select a model (e.g., `gpt-4o-mini`)

### Local AI (LLaMA)

1. Download a model file (`.gguf`) to `data/models/`
2. Go to **Settings** > **AI**
3. Select **Local** as provider
4. Choose your model

## Next Steps

- [Boards & Cards](../boards/overview) - Deep dive into the board system
- [Connect Devices](../agents/overview) - Add ESP32, Android, or computer agents
- [Data Objects](../objects/overview) - Create data models with automatic APIs

