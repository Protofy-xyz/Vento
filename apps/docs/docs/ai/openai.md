# OpenAI Integration

Use OpenAI's GPT models for AI-powered agents.

## Setup

### 1. Get API Key

Get an API key from [OpenAI Platform](https://platform.openai.com).

### 2. Configure in Vento

**Via Settings UI:**
1. Go to `/workspace/settings` → **AI**
2. Select **OpenAI** provider
3. Enter API key
4. Choose model (e.g., `gpt-4o-mini`)

**Via Keys Extension:**
1. Go to `/workspace/keys`
2. Add key named `OPENAI_API_KEY`

## Usage in Cards

```javascript
const response = await context.chatgpt.prompt({
    message: 'Analyze this sensor data: ' + JSON.stringify(states),
    model: 'gpt-4o-mini',
    conversation: [] // optional history
})

return response
```

## Options

```javascript
context.chatgpt.prompt({
    message: string,           // User message
    model: string,             // 'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'
    images?: string[],         // Image URLs or base64
    files?: string[],          // File paths
    conversation?: Message[],  // Chat history
    systemPrompt?: string,     // Override system prompt
})
```

## Models

| Model | Use Case |
|-------|----------|
| `gpt-4o-mini` | Fast, cheap, good for most tasks |
| `gpt-4o` | Multimodal, best quality |
| `gpt-4-turbo` | Large context window |

## Vision

Send images for analysis:

```javascript
const response = await context.chatgpt.prompt({
    message: 'What do you see in this image?',
    model: 'gpt-4o',
    images: ['data:image/jpeg;base64,...']
})
```

## Conversation History

Maintain context across messages:

```javascript
const history = states.conversation || []

const response = await context.chatgpt.prompt({
    message: params.userMessage,
    model: 'gpt-4o-mini',
    conversation: history
})

// Update history
context.boards.setVar('conversation', [
    ...history,
    { role: 'user', content: params.userMessage },
    { role: 'assistant', content: response }
])
```

