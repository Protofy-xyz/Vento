let visibleActions = params.full_board_view ? ['*'] : params.actions
let invisibleActions = [name]
let visibleStates = params.full_board_view ? ['*'] : params.values
let invisibleStates = [ name, "agent_input", "reply", "reset", "agent_preare" ]


function objectToXML(obj, rootName = 'root', options = {}) {
  const {
    indent = '\t', 
    arrayItemNameOverrides = {
      board_actions: 'board_action',
      history: 'message', // ex. <history><message>...</message></history>
      actions: 'action'
    },
    parseJsonStrings = true
  } = options;

  function escapeXml(str) {
    return String(str).replace(/[<>&]/g, c => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;'
    }[c]));
  }

  function maybeParseJson(value) {
    if (!parseJsonStrings || typeof value !== 'string') return value;
    const s = value.trim();
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try { return JSON.parse(s); } catch {  }
    }
    return value;
  }

  function itemTagFor(parentKey) {
    if (arrayItemNameOverrides && arrayItemNameOverrides[parentKey]) {
      return arrayItemNameOverrides[parentKey];
    }

    if (typeof parentKey === 'string') {
      if (parentKey.endsWith('ies')) return parentKey.slice(0, -3) + 'y';
      if (parentKey.endsWith('s'))   return parentKey.slice(0, -1);
    }
    return 'item';
  }

  function convert(key, value, level) {
    value = maybeParseJson(value);

    const pad = indent.repeat(level);
    const padInner = indent.repeat(level + 1);

    if (value === null || value === undefined) {
      return `${pad}<${key}></${key}>\n`;
    }

    if (Array.isArray(value)) {
      const itemTag = itemTagFor(key);
      const children = value.map(item => convert(itemTag, item, level + 1)).join('');
      return `${pad}<${key}>\n${children}${pad}</${key}>\n`;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      const children = entries.map(([k, v]) => convert(k, v, level + 1)).join('');
      return `${pad}<${key}>\n${children}${pad}</${key}>\n`;
    }

    return `${pad}<${key}>${escapeXml(value)}</${key}>\n`;
  }

  const rootWrapped = convert(rootName, obj, 0);
  return rootWrapped.trim();
}

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

const boardActionsXml = objectToXML(
  filteredActions,
  'board_actions',
  {
    indent: '\t',
    arrayItemNameOverrides: { board_actions: 'board_action', history: 'message' },
    parseJsonStrings: true
  }
)

const boardStatesXml = objectToXML(
  filteredStates,
  'board_states',
  {
    indent: '\t',
    arrayItemNameOverrides: { history: 'message' },
    parseJsonStrings: true
  }
)

const promptXml = objectToXML(
  params.prompt,
  'prompt',
  {
    indent: '\t',
    parseJsonStrings: true
  }
)
const message_prompt = params.allow_execution ? `
<instructions>You are an AI agent inside an AI agent platform called Vento.
The agent is managed through a board and the board is composed of states and actions.
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
If the user request an action or an information not available, tell the user there is no card available to perform this action / get this information and suggest the user to extend the board with more cards.
When executing an action, always use the action name. Never use the action id to execute actions, just the name. 
When answering questions or providing information, you need to use the board_states to get the relevant information.
if the user asks what do you see, you can tell the user what board_states do you see and what board_actions do you see. make sure to use the ocrrect names for states and actions.
each <board_states> entry is a key -> value entry, so: <x>y</x> inside <board_states> means "the state named x has the value y"

</instructions>

${boardActionsXml}
${boardStatesXml}

<prompt>
${JSON.stringify(params.prompt)}
</prompt>
` : `
<instructions>You are an assistant providing answers related to the state of an agent. 
The agent is managed through a board.
When answering questions or providing information, you need to use the board_states to get the relevant information.
Answer in plain language, in the same language the <prompt> is written.
If the user request an information not available, tell the user there is no card available to this information and suggest the user to extend the board with more cards.
if the user asks what do you see, you can tell the user what board_states do you see. Make sure to use the correct state names.
each <board_states> entry is a key -> value entry, so: <x>y</x> inside <board_states> means "the state named x has the value y"
</instructions>

${boardStatesXml}

${promptXml}
`

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
