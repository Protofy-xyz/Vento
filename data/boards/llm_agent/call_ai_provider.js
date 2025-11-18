await executeAction({ name: "agent_input.skip"})


const prompt = params.prompt
const provider = params.provider
const model = params.model

if (provider === 'chatgpt') {
  reply = await context.chatgpt.chatGPTPrompt({
    message: prompt,
    model: model ?? "gpt-4.1"
  });

  let raw = reply

  let content = reply?.[0]

  if (reply?.isError) {
    console.error("Error calling AI provider:", reply.data.error.message)
    content = "// Error: " + reply.data.error.message
    // logger.error(`Error on calling AI ${provider} provider: ${reply.data.error.message}`)
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
} else {
  reply = await context.lmstudio.chatWithModel(prompt, model)
}

await executeAction({
  name: "reply", params: {
    resquestId: params.requestId, // the id of the request to reply
    response: reply, // the response to send
  }
})

return reply