await executeAction({ name: "agent_input.skip"})

// Obtener el provider y modelo local por defecto desde settings
const defaultProvider = await context.settings.get({ key: 'ai.provider' }) ?? 'skip'
const defaultLocalModel = await context.settings.get({ key: 'ai.localmodel' }) ?? ''

logger.info('**************************************Default provider: ', defaultProvider)

let {provider, model, ...llmParams} = params

// Primero intentar obtener del request, luego de params, luego del default
const requestProvider = board?.["current_request"]?.["params"]?.["provider"]
const requestModel = board?.["current_request"]?.["params"]?.["model"]

// Usar el provider del request si existe y no es 'default', sino usar el de params, sino el default
provider = (requestProvider && requestProvider !== 'default') 
  ? requestProvider 
  : (params.provider && params.provider !== 'default') 
    ? params.provider 
    : defaultProvider

// Usar el modelo del request si existe y no es 'default', sino usar el de params, sino el default
model = (requestModel && requestModel !== 'default') 
  ? requestModel 
  : (params.model && params.model !== 'default') 
    ? params.model 
    : defaultLocalModel


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
    ...llmParams,
    model: model || defaultLocalModel
  });
} else if (provider === 'chatgpt') {
  reply = await context.chatgpt.chatGPTPrompt({
    ...llmParams,
    model: model || "gpt-5.1"
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