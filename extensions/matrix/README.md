# Matrix Application Service Extension

This extension connects Vento agents to Matrix via an **Application Service**. Each agent appears as a real Matrix user that you can message directly.

## How it works

- Each Vento agent with `agent_input` becomes a Matrix user: `@_vento_agentname:vento.local`
- Users can mention agents in rooms or DM them directly
- The appservice receives events from Dendrite and routes them to the appropriate agent
- Responses are sent back as the agent user

## Agent users

Agents appear with the prefix `_vento_`:
- `@_vento_llm_agent:vento.local`
- `@_vento_smart_assistant:vento.local`
- etc.

## Usage

In any Matrix room with the agent, or in a DM:

```
@_vento_llm_agent What is the capital of France?
llm_agent: help me with something
```

## Configuration

The appservice is configured in `data/dendrite/vento-appservice.yaml` and loaded by Dendrite automatically.

**Tokens** are generated automatically when Dendrite is prepared:
- Stored in `data/dendrite/appservice-tokens.json`
- `as_token`: Used by the appservice to authenticate with Dendrite
- `hs_token`: Used by Dendrite to authenticate with the appservice

Tokens are auto-generated on first run - no manual configuration needed.

## API Endpoints

### Appservice endpoints (called by Dendrite)

- `PUT /api/core/v1/matrix/appservice/transactions/:txnId` - Receive events
- `GET /api/core/v1/matrix/appservice/users/:userId` - User query
- `GET /api/core/v1/matrix/appservice/rooms/:roomAlias` - Room query

### Admin endpoints

- `GET /api/core/v1/matrix/status` - Appservice status
- `POST /api/core/v1/matrix/sync` - Force agent sync
- `GET /api/core/v1/matrix/agents` - List agents

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Matrix Client  │────▶│    Dendrite      │────▶│   Appservice    │
│  (Cinny, etc)   │◀────│  (vento.local)   │◀────│  (extension)    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                              Virtual Users:              │
                         @_vento_agent1:vento.local       ▼
                         @_vento_agent2:vento.local   ┌─────────────────┐
                                                      │  Vento Agents   │
                                                      │  /api/agents/v1 │
                                                      └─────────────────┘
```

## Files

- `data/dendrite/vento-appservice.yaml` - Appservice registration
- `data/dendrite/dendrite.yaml` - Dendrite config (loads appservice)
- `extensions/matrix/bridge.ts` - Appservice logic
- `extensions/matrix/coreApis.ts` - HTTP endpoints
