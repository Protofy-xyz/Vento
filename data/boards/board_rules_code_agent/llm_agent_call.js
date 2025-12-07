const response = await API.post("/api/agents/v1/llm_agent/agent_input?token=" + token, {
  message: board?.["prompt"]
})

return await executeAction({name: "response", params:  { 
	response: response?.data, // response to send
	requestId: board?.["current_request"]?.["input"]?.["id"], // the id of the request to response 
}})
