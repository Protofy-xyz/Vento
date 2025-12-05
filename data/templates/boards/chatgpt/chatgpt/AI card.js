const response = await context.chatgpt.prompt({
  message: `
<instructions>You are integrated into a board system.
The board is composed of states and actions.
You will receive a user message and your mission is to generate a json response.
Only respond with a JSON in the following format:

{
    "response": "whatever you want to say",
    "actions": [
        {
            "name": "action_1",
            "params": {
                "example_param": "example_value"
            } 
        }
    ]
}

The key response will be shown to the user as a response to the user prompt.
The actions array can be empty if the user prompt requires no actions to be executed.
When executing an action, always use the action name. Never use the action id to execute actions, just the name. 

</instructions>
<board_actions>
${JSON.stringify(boardActions)}
</board_action>
<board_states>
${JSON.stringify(board)}
</board_states>

The user prompt is:

${params.prompt}
`,
  conversation: await context.chatgpt.getSystemPrompt({
    prompt: `You can analyze images provided in the same user turn. 
Do NOT claim you cannot see images. 
Answer following the JSON contract only (no code fences).`,
  }),
  images: await context.boards.getStatesByType({
    board: board,
    type: "frame",
    key: "frame",
  }),
  files: await context.boards.getStatesByType({
    board: board,
    type: "file",
    key: "path",
  }),
});

return context.chatgpt.processResponse({
  response: response,
  execute_action: execute_action,
});
