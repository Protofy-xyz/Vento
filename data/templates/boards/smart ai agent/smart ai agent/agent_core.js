let visibleActions = params.full_board_view ? ['*'] : params.actions
let invisibleActions = [ ...params.invisible_actions, name ]
let visibleStates = params.full_board_view ? ['*'] : params.values
let invisibleStates = [ ...params.invisible_values, name ]

const filteredActions = boardActions.filter(action => {
  const name = action.name
  if (visibleActions.includes('*')) {
    return !invisibleActions.includes(name)
  }
  return visibleActions.includes(name) && !invisibleActions.includes(name)
}).map(action => {
  let {html, description, ...rest} = action
  if(description.startsWith('Actions can perform tasks, automate processes, and enhance user interactions')) {
    description = 'generic action with no description'
  }
  return {
    description,
    ...rest
  }
})

const filteredStates = Object.fromEntries(
  Object.entries(board).filter(([key, value]) => {
    if (visibleStates.includes('*')) {
      return !invisibleStates.includes(key)
    }
    return visibleStates.includes(key) && !invisibleStates.includes(key)
  })
)

const boardActionsHtml = context.ai.objectToHTML(
  filteredActions,
  'Available Actions',
  { parseJsonStrings: true }
)

const boardStatesHtml = context.ai.objectToHTML(
  filteredStates,
  'Board States',
  { parseJsonStrings: true }
)

const promptHtml = context.ai.htmlBox(
  `<p style="margin:0;font-size:15px;color:#ffffff;">${params.prompt}
  The following actions have been executed: ${board?.["agent_prepare"]}</p>`,
  '💬 User Prompt',
  { accent: true }
)

const instructionsExecution = context.ai.htmlBox(`
<p>You are an AI agent inside <strong style="color:#0a84ff;">Vento</strong>, an AI agent platform.</p>
<p>The agent is managed through a <strong>board</strong> composed of <em>states</em> and <em>actions</em>.</p>
<p>Your mission is to generate a JSON response in this format:</p>
<pre style="background:#2c2c2e;color:#0a84ff;padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;margin:8px 0;border:1px solid #3a3a3c;">
{
  "response": "your message in markdown format",
  "actions": [
    { "name": "action name", "params": { "key": "value" } }
  ]
}
</pre>
<ul style="margin:8px 0;padding-left:20px;color:#e5e5e7;">
<li>The <strong>response</strong> will be shown to the user</li>
<li>The <strong>actions</strong> array can be empty if no actions needed</li>
<li>Always use the action <strong>name</strong>, never the key, or id, just the name</li>
<li>Use <strong style="color:#0a84ff;">Board States</strong> to answer questions</li>
<li>If something is unavailable, suggest extending the board</li>
</ul>
`, '📋 Instructions')

const instructionsReadOnly = context.ai.htmlBox(`
<p>You are an assistant providing answers about an agent's state.</p>
<p>Use the <strong style="color:#0a84ff;">Board States</strong> to answer questions.</p>
<p>Answer in plain language, in the same language as the prompt.</p>
<p>Your answer will be sent to a human. Please don't use json or other things except markdown</p>
`, '📋 Instructions')

const message_prompt = params.allow_execution 
  ? `${instructionsExecution}\n${boardActionsHtml}\n${params.allow_read ? boardStatesHtml : ''}\n${promptHtml}`
  : `${instructionsReadOnly}\n${boardStatesHtml}\n${promptHtml}`

if(params.debug) return message_prompt
const response = await context.ai.prompt({
  message: message_prompt,
  conversation: await context.ai.getSystemPrompt({
    prompt: `You can analyze images provided in the same user turn. 
Do NOT claim you cannot see images. 
Answer following the JSON contract only (no code fences).`,
  }),
  images: await context.boards.getStatesByType({
    board: filteredStates,
    type: "frame",
    key: "frame",
  }),
  files: await context.boards.getStatesByType({
    board: filteredStates,
    type: "file",
    key: "path",
  }),
});
if(params.allow_execution) {
  return context.ai.processResponse({
    response: response,
    execute_action: execute_action,
  });
} 
return response