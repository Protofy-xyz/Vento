# Agent API

The Agent API provides endpoints for interacting with AI agents.

**Base URL:** `/api/agents/v1/`

## Send Message to Agent

Send a message to an agent and receive a response.

```http
POST /api/agents/v1/{board}/agent_input
Content-Type: application/json

{
  "message": "Hello, what can you do?"
}
```

**Or via query string:**
```http
GET /api/agents/v1/{board}/agent_input?message=Hello
```

### Response

```json
{
  "response": "I can help you with...",
  "actions": [
    {
      "name": "action_name",
      "params": {},
      "result": "action result"
    }
  ]
}
```

## How It Works

1. Message is queued in `agent_input` card
2. AI processes message with board context
3. AI decides on response and actions
4. Actions are executed
5. Response is returned

## Synchronous vs Asynchronous

**Synchronous (default):** Request waits for AI response
```http
POST /api/agents/v1/{board}/agent_input
{ "message": "..." }
```

**Asynchronous:** Message queued, returns immediately
```http
POST /api/agents/v1/{board}/agent_input?async=true
{ "message": "..." }
```

## Conversation Context

To maintain conversation history, include previous messages:

```json
{
  "message": "What about the second one?",
  "conversation": [
    { "role": "user", "content": "List available options" },
    { "role": "assistant", "content": "1. Option A\n2. Option B" }
  ]
}
```

## Parameters

Some agents accept additional parameters:

```json
{
  "message": "Process this order",
  "params": {
    "orderId": "ORD-123",
    "priority": "high"
  }
}
```

## Webhooks

Configure webhooks to receive responses asynchronously:

```json
{
  "message": "Process this",
  "webhookUrl": "https://your-server.com/callback"
}
```

