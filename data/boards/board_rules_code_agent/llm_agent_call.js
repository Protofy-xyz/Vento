const response = await API.post("/api/agents/v1/llm_agent/agent_input?token=" + token, {
  message: board?.["prompt"]
})

// Check for HTTP errors from the API call
if (response?.isError || response?.error) {
  const errorMsg = response?.error?.message || response?.error || 'Error calling LLM agent'
  return await executeAction({name: "response", params: { 
    response: { error: true, errorMessage: errorMsg, choices: [{ message: { content: '' } }] },
    requestId: board?.["current_request"]?.["input"]?.["id"],
  }})
}

// Check for errors in the LLM response itself
const llmData = response?.data
if (llmData?.error === true || llmData?.errorMessage) {
  return await executeAction({name: "response", params: { 
    response: llmData, // Pass the error response through
    requestId: board?.["current_request"]?.["input"]?.["id"],
  }})
}

return await executeAction({name: "response", params:  { 
	response: llmData, // response to send
	requestId: board?.["current_request"]?.["input"]?.["id"], // the id of the request to response 
}})
