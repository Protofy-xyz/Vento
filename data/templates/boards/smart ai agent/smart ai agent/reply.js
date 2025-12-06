
if(params.reset) await executeAction({name: "reset"})
await executeAction({name: "agent_input", params: {action:'reply', response: params.response}})
return 'ok'