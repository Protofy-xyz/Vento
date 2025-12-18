await executeAction({ name: "agent_input.skip"})

// Obtener el provider y modelo local por defecto desde settings
let defaultProvider = await context.settings.get({ key: 'ai.provider' }) ?? 'skip'
let defaultLocalModel = await context.settings.get({ key: 'ai.localmodel' }) ?? ''

// Clean up values in case they have quotes (from file storage)
defaultProvider = String(defaultProvider).replace(/^"|"$/g, '')
defaultLocalModel = String(defaultLocalModel).replace(/^"|"$/g, '')

logger.info(`AI Provider settings - provider: "${defaultProvider}", localModel: "${defaultLocalModel}"`)

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

// Determine model based on provider - only use local model for llama provider
const getDefaultModelForProvider = (prov) => {
  if (prov === 'llama') return defaultLocalModel || 'gemma-3-4b-it-Q8_0'
  if (prov === 'chatgpt') return 'gpt-5.1'
  if (prov === 'lmstudio') return 'default'
  return ''
}

// Usar el modelo del request si existe y no es 'default', sino usar el de params, sino el default del provider
model = (requestModel && requestModel !== 'default') 
  ? requestModel 
  : (params.model && params.model !== 'default') 
    ? params.model 
    : getDefaultModelForProvider(provider)


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

  const content = context.ai.cleanCode(reply[0] ?? '')
  let raw = reply

  reply = {
    choices: [
      {
        message: {
          content
        }
      }
    ]
  }

  if(!content) {
    reply["raw"] = raw
  }
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
  const lmResult = await context.lmstudio.chatWithModel(llmParams.message, model)
  
  // Check if LMStudio returned an error
  if (lmResult?.error) {
    const errorDetails = lmResult.message || lmResult.rawError || 'Unknown LMStudio error'
    const tokenInfo = lmResult.estimatedTokens ? ` (~${lmResult.estimatedTokens} tokens)` : ''
    logger.error(`LMStudio error${tokenInfo}: ${errorDetails}`)
    reply = {
      choices: [
        {
          message: {
            content: ''
          }
        }
      ],
      error: true,
      errorMessage: lmResult.message
    }
  } else {
    const content = lmResult?.choices?.[0]?.message?.content ?? ''
    reply = {
      choices: [
        {
          message: {
            content: context.ai.cleanCode(content)
          }
        }
      ]
    }
    if (!content) {
      reply["raw"] = lmResult
    }
  }
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