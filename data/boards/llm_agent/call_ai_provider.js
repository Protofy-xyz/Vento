await executeAction({ name: "agent_input.skip"})

// Obtener el provider y modelo local por defecto desde settings
const defaultProvider = await context.settings.get({ key: 'ai.provider' }) ?? 'llama'
const defaultLocalModel = await context.settings.get({ key: 'ai.localmodel' }) ?? 'gemma3-12b'

console.log('call_ai_provider: defaultProvider from settings:', defaultProvider, 'type:', typeof defaultProvider)

const prompt = params.prompt
const provider = board?.["current_request"]?.["params"]?.["provider"] ?? params.provider ?? defaultProvider
const model = board?.["current_request"]?.["params"]?.["model"] ?? params.model

console.log('call_ai_provider: final provider:', provider, 'type:', typeof provider)

// if the provider is skip or not set, return an error
if (provider === 'skip' || !provider) {
  return {
    error: true,
    response: "No AI provider configured. Please go to Settings to configure your AI provider."
  }
} 

if (provider === 'llama') {
  // Use the llama extension with local GGUF models
  reply = await context.llama.llamaPrompt({
    message: prompt,
    model: model ?? defaultLocalModel
  });
} else if (provider === 'chatgpt') {
  reply = await context.chatgpt.chatGPTPrompt({
    message: prompt,
    model: model ?? "gpt-4.1"
  });

  let raw = reply

  let content = reply?.[0]

  if (reply?.isError) {
    console.error("Error calling AI provider:", reply.data.error.message)
    content = "// Error: " + reply.data.error.message
  }

  reply = {
    choices: [
      {
        message: {
          content
        }
      }
    ]
  }

  if (!content) {
    reply["raw"] = raw
  }
} else if (provider === 'lmstudio') {
  reply = await context.lmstudio.chatWithModel(prompt, model)
} else {
  // Unknown provider
  reply = {
    choices: [
      {
        message: {
          content: `Unknown AI provider: ${provider}`
        }
      }
    ],
    error: true
  }
}

await executeAction({
  name: "reply", params: {
    resquestId: params.requestId, // the id of the request to reply
    response: reply, // the response to send
  }
})
return {reply, provider, model}