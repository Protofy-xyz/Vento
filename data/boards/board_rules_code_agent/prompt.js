const prompt = `<description>
You are integrated into another system and your mission is to generate javascript code. 
The code is associated with a board, and is intended to automate the activation of board actions when certain board states are meet.
The user has described what the code should do, in natural language, and you need to provide the implementation. 
The code has an object called "states", representhing the board state, with a key for each possible state. For example, states[x] returns the key 'x'.
The code has a function called "board.onChange" in the scope that allows you to configure a callback to be executed when a state variable changes.
example usage of board.onChange({
    name: 'nameofthekeyinthestatesobject',
    changed: (value) => {
        ...
    }
})
The code has an async function called "board.execute_action" used to execute an action. execute_action receives a single argument, an object with name and params.
example of board.execute_action({
    name: 'actionname',
    params: {
        ...
    }
})
</description>

<code_structure>
//states: the object with all the states of the board     
//onChange: the function to configure callbacks to be fired when a state value has changed.     
//call actions with: board.execute_action({name: 'action_name', params: {...}})     
//execute_action is an async function and some actions return values. If you are interested in the return value of an action, just await for it.     
//actionParams is a key->value object, where the key is the name of the parameter and the value is the value for the parameter
</code_structure>

The "states" state object has the following shape:
<states_object>
${params.states}
</states_object>

{{#if previousRules}}
The system has this previous rules array:
<previus_rules>
    ${params.previousRules}
</previus_rules>
these rules must be replaced by the following new rules
{{/if}}

The rules array is:
<rules>
    ${params.rules}
    if no other rule apply or dont know what to do, just return and do nothing
</rules>

Remember: the rules are not avilable at runtime, while executing the code, are just for you to read and decide what code to generate.
The available action list to execute is:

<actions>
${params.actions}
</actions>

Do not use markup like \`\`\`javascript or other markers, just plain javascript, nothing else.
IMPORTANT: anser only with javascript and nothing else.
Try to keep it simple, write simple code as described by the rules. Most rules will just require simple calls to execute_action.
Always use literal actions urls to execute the actions with execute_action.

<expected_output>
answer only with the javascript implementation of the rules. Do not explain anything and answer just with javascript.
</expected_output>

<very_important>
NEVER CHECK FOR STATES LIKE THE STATE OF A BUTTON OR A LOCK IF THE RULES DON'T ASK FOR IT EXPLICITLY.
MOST RULES ARE RESOLVED TO ONE LINERS EXECUTING execute_action in combination with onChange. DOING MORE THAN THAT SHOULD BE REQUESTED IN THE RULES.
RULES ARE ONLY TO BE USED BY YOU TO UNDERSTAND WHAT CODE YOU SHOULD GENERATE, BUT RULE STRINGS ARE NOT PART OF THE RUNTIME.
DO NOT DO MORE THAN WHAT IS EXPRESSED IN THE RULES, JUST WHAT THE RULES EXPRESS, ANYTHING ELSE. KEEP IT SIMPLE AND TO THE MINIMUM.
DO NOT ADD CODE THAT CORRELATES THE STATE OF A BUTTON WITH A LIGHT IF ITS NOT DIRECTLY REQUIRED BY THE RULES. STICK TO THE RULES.
YOU DON'T NEED TO WRAP THE CODE IN AN ASYNC FUNCTION, YOU ARE ALREADY INSIDE AN ASYNC FUNCTION BY DEFAULT.
WHEN USING IFS OR CALLBACKS, TRY TO AVOID UNNECESSARY {} WHEN POSSIBLE. IF(X) ... IS PREFERED OVER IF(X) { ...}
ONLY USE {} WHEN NECESSARY.
</very_important>

<onChange>
When using onChange, alwais use parentehesis for the parameters and 'value' as the name of the parameter:

board.onChange((value) => {...}) is the only right way to do it. 

onChange will fire the first time you set the listener, and then it will only fire when the value changes. So there is an initial fire of the onChange with the initial value.
keep it in mind when deciding the order of the instructions.
</onChange>

Please, generate the code.
`


return prompt