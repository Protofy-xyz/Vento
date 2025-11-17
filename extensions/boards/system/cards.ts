import { addCard } from "@extensions/cards/coreContext/addCard";
import { addAction } from '@extensions/actions/coreContext/addAction';
import { getServiceToken } from "protonode";

export const registerCards = async () => {
    addCard({
        group: 'board',
        tag: "memory",
        id: 'board_job_queue',
        templateName: "Job Queue",
        name: "job_queue",
        emitEvent: true,
        defaults: {
            "width": 3,
            "height": 16,
            "icon": "file-stack",
            "name": "job_queue",
            "description": "A job queue with a list of pending jobs and a current job",
            "type": "action",
            "editorOptions": {},
            "displayResponse": true,
            "params": {
                "job": "",
                "action": "action to perform in the job queue: push, remove, reset, next"
            },
            "configParams": {
                "job": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "string"
                },
                "action": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "string"
                }
            },
            "presets": {
                "next": {
                    "description": "move the current job to the next job",
                    "configParams": {
                        "action": {
                            "defaultValue": "next"
                        }
                    }
                },
                "reset": {
                    "description": "resets the queue state to empty and skip curret job",
                    "configParams": {
                        "action": {
                            "defaultValue": "clear"
                        }
                    }
                },
                "remove": {
                    "description": "remove the element with the given index from the job queue",
                    "configParams": {
                        "action": {
                            "defaultValue": "remove"
                        },
                        "item": {
                            "visible": true,
                            "defaultValue": 0,
                            "type": "number"
                        }
                    }
                },
                "push": {
                    "params": {
                        "job": "job to push"
                    },
                    "description": "Adds a new job",
                    "configParams": {
                        "action": {
                            "defaultValue": "push"
                        },
                        "job": {
                            "visible": true,
                            "defaultValue": "",
                            "type": "string"
                        }
                    }
                }
            },
            "tokens": {},
            "displayButton": false,
            "rulesCode": "if (params.action == \"reset\") {\n  return { items: [], current: undefined };\n} else if (params.action == \"next\") {\n  return {\n    items: (Array.isArray(board[name]?.items) ? board[name].items : []).slice(\n      1\n    ),\n    current: board[name].items[0],\n  };\n} else if (params.action == \"remove\") {\n  const queue = Array.isArray(board[name]?.items) ? board[name].items : [];\n  const index = parseInt(params.index, 10);\n  return {\n    items: queue.slice(0, index).concat(queue.slice(index + 1)),\n    current: board[name]?.current,\n  };\n} else if (params.action == \"clear\") {\n  return { items: [], current: board[name].current };\n} else {\n  const item = {\n    time: new Date().toISOString(),\n    data: params.job\n  };\n\n  if (board[name]?.current) {\n    return {\n      items: (Array.isArray(board[name]?.items)\n        ? board[name].items\n        : []\n      ).concat([item]),\n      current: board[name]?.current,\n    };\n  }\n  return {\n    items: Array.isArray(board[name]?.items) ? board[name].items : [],\n    current: item,\n  };\n}\n",
            "html": "//@card/react\nfunction Widget(props) {\n  return (\n    <ViewList\n      enableManualPop={true}\n      current={props?.value?.current}\n      emptyMessageProps={{\n        fontSize: \"$6\",\n        fontWeight: \"600\"\n      }}\n      // emptyMode=\"wait\"\n      emptyMessage=\"Empty job list\" \n      items={props?.value?.items} \n      onPop={(items) => execute_action(props.name, {action: 'next'})}\n      onClear={(items) => execute_action(props.name, {action: 'reset'})}\n      onPush={(item) => execute_action(props.name, {action: 'push', job: item})}\n      onDeleteItem={(item, index) => execute_action(props.name, {action: 'remove', index})} \n    />\n  );\n}\n",
        }
    })

    addCard({
        group: 'board',
        tag: "net",
        id: 'board_net_apicall',
        templateName: "Call an API",
        name: "api_call",
        emitEvent: true,
        defaults: {
            width: 3,
            height: 10,
            icon: "globe",
            type: "action",
            name: "API Call",
            displayResponse: true,
            displayIcon: false,
            params: {
                url: "http endpoint to call",
                method: "method for the call: get or post",
                body: "when using post, the body for the request"
            },
            configParams: {
                url: {
                    visible: true,
                    defaultValue: "",
                    type: "any"
                },
                method: {
                    visible: true,
                    defaultValue: "get",
                    type: "string"
                },
                body: {
                    visible: true,
                    defaultValue: "",
                    type: "string"
                }
            },
            description: "Actions can perform tasks, automate processes, and enhance user interactions. It can also trigger other action-type cards on the board.\n\n  #### Key Features\n  - Run actions from rules.\n  - Chain/trigger other action cards.\n  - Parameterized execution.\n  - Customize parameters.\n  - Customize the card view (UI/render).",
            rulesCode: "return await context.apis.fetch(params.method ?? 'get', params.url, params.body)",
            html: "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n\n  const content = <YStack f={1} ai=\"center\" jc=\"center\" width=\"100%\">\n      {card.icon && card.displayIcon !== false && (\n          <Icon name={card.icon} size={48} color={card.color}/>\n      )}\n      {card.displayResponse !== false && (\n          <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? \"N/A\"} />\n      )}\n  </YStack>\n\n  return (\n      <Tinted>\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n          <ActionCard data={card}>\n            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}\n          </ActionCard>\n        </ProtoThemeProvider>\n      </Tinted>\n  );\n}\n"
        }
    })

    addCard({
        group: 'board',
        tag: "net",
        id: 'board_net_loadpage',
        templateName: "Loads a Web Page",
        name: "load_page",
        emitEvent: true,
        defaults: {
            width: 3,
            height: 10,
            icon: "globe",
            type: "action",
            name: "Load Web Page",
            displayResponse: true,
            displayIcon: false,
            params: {
                url: "http endpoint to call",
                method: "method for the call: get or post",
                body: "when using post, the body for the request"
            },
            configParams: {
                url: {
                    visible: true,
                    defaultValue: "",
                    type: "any"
                },
                method: {
                    visible: false,
                    defaultValue: "get",
                    type: "string"
                },
                body: {
                    visible: false,
                    defaultValue: "",
                    type: "string"
                }
            },
            description: "Actions can perform tasks, automate processes, and enhance user interactions. It can also trigger other action-type cards on the board.\n\n  #### Key Features\n  - Run actions from rules.\n  - Chain/trigger other action cards.\n  - Parameterized execution.\n  - Customize parameters.\n  - Customize the card view (UI/render).",
            rulesCode: "return await context.apis.fetch(params.method ?? 'get', params.url, params.body)",
            html: "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n\n  const content = <YStack f={1} ai=\"center\" jc=\"center\" width=\"100%\">\n      {card.icon && card.displayIcon !== false && (\n          <Icon name={card.icon} size={48} color={card.color}/>\n      )}\n      {card.displayResponse !== false && (\n          <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? \"N/A\"} />\n      )}\n  </YStack>\n\n  return (\n      <Tinted>\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n          <ActionCard data={card}>\n            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}\n          </ActionCard>\n        </ProtoThemeProvider>\n      </Tinted>\n  );\n}\n"
        }
    })

    addCard({
        group: 'board',
        tag: "agents",
        id: 'board_agents_call',
        templateName: "Call an Agent",
        name: "call",
        emitEvent: true,
        defaults: {
            width: 2,
            height: 10,
            icon: "bot-message-square",
            type: "action",
            name: "agent_call",
            displayResponse: true,
            displayIcon: true,
            params: {
                agent: "board name where the target agent is located",
                name: "name of the agent",
                message: "message to send to the agent"
            },
            configParams: {
                agent: {
                    visible: true,
                    defaultValue: "",
                    type: "string",
                    selector: "agents" 
                },
                name: {
                    visible: false,
                    defaultValue: "agent_input",
                    type: "string"
                },
                message: {
                    visible: true,
                    defaultValue: "",
                    type: "string"
                }
            },
            description: "Actions can perform tasks, automate processes, and enhance user interactions. It can also trigger other action-type cards on the board.\n\n  #### Key Features\n  - Run actions from rules.\n  - Chain/trigger other action cards.\n  - Parameterized execution.\n  - Customize parameters.\n  - Customize the card view (UI/render).",
            rulesCode: "const { agent: reqBoardName, name: reqName, ...reqParams } = params;\r\n\r\nconst queryString = new URLSearchParams({\r\n  ...reqParams,\r\n  token\r\n}).toString();\r\n\r\nreturn await context.apis.fetch(\r\n  'get',\r\n  `/api/agents/v1/${reqBoardName}/${reqName}?${queryString}`\r\n);",
            html: "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n\n  const content = <YStack f={1}  mt={\"20px\"} ai=\"center\" jc=\"center\" width=\"100%\">\n      {card.icon && card.displayIcon !== false && (\n          <Icon name={card.icon} size={48} color={card.color}/>\n      )}\n      {card.displayResponse !== false && (\n          <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? \"N/A\"} />\n      )}\n  </YStack>\n\n  return (\n      <Tinted>\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n          <ActionCard data={card}>\n            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}\n          </ActionCard>\n        </ProtoThemeProvider>\n      </Tinted>\n  );\n}\n"
        }
    })

    addCard({
        group: 'board',
        tag: "grid",
        id: 'board_grid_interactive',
        templateName: "Interactive Grid",
        name: "interactive_grid",
        emitEvent: true,
        defaults: {
            width: 4,
            height: 12,
            icon: "grid-3x3",
            type: "action",
            name: "interactive_grid",
            displayResponse: true,
            displayIcon: true,
            params: {
                grid: "2D array representing the grid state",
                rows: "number of grid rows",
                columns: "number of grid columns",
                action: "create | update"
            },
            configParams: {
                grid: {
                    visible: false,
                    defaultValue: "",
                    type: "array"
                },
                rows: {
                    visible: true,
                    defaultValue: "8",
                    type: "number"
                },
                columns: {
                    visible: true,
                    defaultValue: "8",
                    type: "number"
                },
                action: {
                    visible: false,
                    defaultValue: "create",
                    type: "string"
                }
            },
            description: "Actions can perform tasks, automate processes, and enhance user interactions. It can also trigger other action-type cards on the board.\n\n  #### Key Features\n  - Run actions from rules.\n  - Chain/trigger other action cards.\n  - Parameterized execution.\n  - Customize parameters.\n  - Customize the card view (UI/render).",
            rulesCode: "if (params.action == \"create\") {\n\n    return Array.from({ length: params.rows }, () =>\n        Array.from({ length: params.columns }, () => ({ value: \"false\" }))\n    )\n\n} else if (params.action == \"update\") {\n    return params.grid\n}",
            html: "//@card/react\n\nfunction Widget(card) {\n  if (card?.value?.length > 0) {\n    return <InteractiveGrid\n      onChange={(data) => execute_action(card.name, { grid: data })}\n      data={card.value}\n    />\n  } else {\n    return <Tinted>\n      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n        <ActionCard data={card}>\n          <ParamsForm data={card}>\n            <YStack flex={1} jc=\"center\" ai=\"center\" gap=\"$5\">\n            {card.icon && card.displayIcon !== false && (\n          <Icon name={card.icon} size={48} color={card.color}/>\n      )}\n              <Text maw=\"320px\" textAlign=\"center\">Add the number of rows and columns you want and click \"Create\" to create a grid</Text>\n            </YStack>\n          </ParamsForm>\n        </ActionCard>\n      </ProtoThemeProvider>\n    </Tinted>\n  }\n}\n",
        }
    })

    addCard({
        group: 'board',
        tag: "blank",
        id: 'board_blank',
        templateName: "Blank Card",
        name: "blank",
        emitEvent: true,
        defaults: {
            width: 2,
            height: 6,
            icon: "square-dashed",
            type: "value",
            name: "blank",
            displayResponse: true,
            displayIcon: false,
            displayTitle: false,
            autoResponsive: false,
            params: {},
            configParams: {},
            description: "Blank card for layout purposes.",
            rulesCode: "",
            html: "//@card/react\n\nfunction Widget(card) {\n  return (\n      <Tinted>\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n            <YStack f={1} height=\"100%\" ai=\"center\" jc=\"center\" width=\"100%\">\n           \n            </YStack>\n        </ProtoThemeProvider>\n      </Tinted>\n  );\n}\n\n",
        }
    })


    addCard({
        group: 'board',
        tag: "agent",
        id: 'board_agent_create',
        templateName: "Create New Agent",
        name: "create",
        emitEvent: true,
        defaults: {
            width: 3,
            height: 10,
            icon: "bot",
            type: "action",
            name: "create agent",
            displayResponse: true,
            displayIcon: false,
            params: {
                url: "http endpoint to call",
                method: "method for the call: get or post",
                name: "name of the agent to create",
                template: "template to use"
            },
            configParams: {
                url: {
                    visible: false,
                    defaultValue: "/api/core/v1/import/board",
                    type: "any"
                },
                method: {
                    visible: false,
                    defaultValue: "post",
                    type: "string"
                },
                name: {
                    visible: true,
                    defaultValue: "",
                    type: "string"
                },
                template: {
                    visible: true,
                    defaultValue: "smart ai agent",
                    type: "string"
                }
            },
            description: "Create a new agent given the agent name and the template",
            layer: "base",
            rulesCode: "// return {\r\n//     url: params.url + '?token='+token,\r\n//     name: params.name,\r\n//     template: 'smart ai agent'\r\n// }\r\nreturn await context.apis.fetch(params.method ?? 'get', params.url + '?token='+token, {\r\n    name: params.name,\r\n    template: {id: params.template}\r\n})",
            html: "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n\n  const content = <YStack f={1} ai=\"center\" jc=\"center\" width=\"100%\">\n      {card.icon && card.displayIcon !== false && (\n          <Icon name={card.icon} size={48} color={card.color}/>\n      )}\n      {card.displayResponse !== false && (\n          <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? \"N/A\"} />\n      )}\n  </YStack>\n\n  return (\n      <Tinted>\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n          <ActionCard data={card}>\n            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}\n          </ActionCard>\n        </ProtoThemeProvider>\n      </Tinted>\n  );\n}\n"
        }
    })


    addCard({
        group: 'board',
        tag: "agents",
        id: 'board_agents_input',
        templateName: "Agent Input to receive agent calls",
        name: "input",
        emitEvent: true,
        defaults: {
            width: 3,
            height: 25,
            icon: "globe",
            name: "agent_input",
            description: "A job queue with a list of pending jobs and a current job",
            type: "action",
            editorOptions: {},
            displayResponse: true,
            graphOrder: 1000,
            params: {
                item: "",
                action: "action to perform in the queue: push, pop, clear",
                response: ""
            },
            configParams: {
                item: {
                    visible: true,
                    defaultValue: "",
                    type: "string"
                },
                action: {
                    visible: true,
                    defaultValue: "",
                    type: "string"
                },
                response: {
                    visible: true,
                    defaultValue: "",
                    type: "string"
                }
            },
            presets: {
                reply: {
                    description: "Sends a reply to the current job and makes the next item (if any) the current job. The reply should be specified in the response param",
                    configParams: {
                        action: {
                            visible: false,
                            defaultValue: "reply"
                        },
                        item: {
                            visible: false
                        },
                        response: {
                            visible: true
                        }
                    }
                },
                skip: {
                    description: "Skips the current job. Do not use unless you know what you are doing.",
                    configParams: {
                        action: {
                            defaultValue: "skip"
                        }
                    }
                },
                reset: {
                    description: "resets the queue state to empty and skip curret job",
                    configParams: {
                        action: {
                            defaultValue: "clear"
                        }
                    }
                },
                remove: {
                    description: "remove the element with the given index from the job queue",
                    configParams: {
                        action: {
                            defaultValue: "remove"
                        },
                        item: {
                            visible: true,
                            defaultValue: 0,
                            type: "number"
                        }
                    }
                },
                push: {
                    params: {
                        item: "item to push"
                    },
                    description: "Adds a new job",
                    configParams: {
                        action: {
                            defaultValue: "push"
                        },
                        item: {
                            visible: true,
                            defaultValue: "",
                            type: "string"
                        }
                    }
                }
            },
            enableAgentInputMode: true,
            tokens: {},
            displayButton: false,
            manualAPIResponse: true,
            rulesCode: "if (params.action == \"reset\") {\n  return { items: [], current: undefined };\n} else if (params.action == \"skip\") {\n  return {\n    items: (Array.isArray(board[name]?.items) ? board[name].items : []).slice(\n      1\n    ),\n    current: board[name].items[0],\n  };\n} else if (params.action == \"remove\") {\n  const queue = Array.isArray(board[name]?.items) ? board[name].items : [];\n  const index = parseInt(params.index, 10);\n  return {\n    items: queue.slice(0, index).concat(queue.slice(index + 1)),\n    current: board[name]?.current,\n  };\n} else if (params.action == \"clear\") {\n  return { items: [], current: board[name].current };\n} else if (params.action == \"reply\") {\n  //reply to current job\n  const job = board[name].current;\n  if (!job) {\n    throw \"Unable to send reply: There is not current job to reply to\";\n  }\n  const res = context.boards.getVar(\"job_\" + job.id, true);\n  if (!res) {\n    throw \"Unable to send reply: Empty res object in current job.\";\n  }\n  res.send(params.response);\n  return {\n    items: (Array.isArray(board[name]?.items) ? board[name].items : []).slice(\n      1\n    ),\n    current: board[name].items[0],\n  };\n} else {\n  const genUID = (l = 16) => {\n    const t = Date.now().toString(36);\n    const r =\n      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);\n    let out = \"\";\n    for (let i = 0; i < l; i++)\n      out += (i % 2 ? t : r)[i % (i % 2 ? t.length : r.length)];\n    return out;\n  };\n  const uid = genUID(16);\n  context.boards.setVar(\"job_\" + uid, res);\n  const item = {\n    id: uid,\n    time: new Date().toISOString(),\n    ua: req.get(\"User-Agent\"),\n    params: req.query,\n    path: params.path,\n  };\n\n  if (board[name]?.current) {\n    return {\n      items: (Array.isArray(board[name]?.items)\n        ? board[name].items\n        : []\n      ).concat([item]),\n      current: board[name]?.current,\n    };\n  }\n  return {\n    items: Array.isArray(board[name]?.items) ? board[name].items : [],\n    current: item,\n  };\n}\n",
            html: "//@card/react\nfunction Widget(props) {\n  return (\n    <ViewList\n      onReply={(item, response) => execute_action(props.name, {action: 'reply', response: response})}\n      enableReply={true}\n      enableManualPop={true}\n      current={props?.value?.current}\n      emptyMessageProps={{\n        fontSize: \"$6\",\n        fontWeight: \"600\"\n      }}\n      emptyDescription={<YStack>\n        <Paragraph color=\"$color10\" mt={\"$2\"} fontSize={\"$4\"}>\n          <a style={{}} target=\"_new\" href={'/api/agents/v1/'+window?.board?.name+'/'+props?.name}>{'Open agent link'}</a>\n        </Paragraph>\n      </YStack>  \n      }\n      // emptyMode=\"wait\"\n      emptyMessage=\"Empty agent job queue\"\n      disableManualPush={true}\n      items={props?.value?.items} \n      onPop={(items) => execute_action(props.name, {action: 'skip'})}\n      onClear={(items) => execute_action(props.name, {action: 'reset'})}\n      onPush={(item) => execute_action(props.name, {action: 'push', item})}\n      onDeleteItem={(item, index) => execute_action(props.name, {action: 'remove', index})} \n    />\n  );\n}\n",
            value: {
                items: []
            }
        }
    })





    addCard({
        group: 'board',
        tag: "http",
        id: 'board_http_endpoint',
        templateName: "HTTP Endpoint",
        name: "endpoint",
        emitEvent: true,
        defaults: {
            "width": 4,
            "height": 20,
            "icon": "globe",
            "name": "http_endpoint",
            "description": "A job queue with a list of pending jobs and a current job",
            "type": "action",
            "editorOptions": {},
            "displayResponse": true,
            "params": {
                "item": "",
                "action": "action to perform in the queue: push, pop, clear",
                "path": "agent path",
                "response": ""
            },
            "configParams": {
                "item": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "string"
                },
                "action": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "string"
                },
                "path": {
                    "visible": true,
                    "defaultValue": "/demo",
                    "type": "string"
                },
                "response": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "string"
                }
            },
            "presets": {
                "reply": {
                    "description": "Sends a reply to the current job and makes the next item (if any) the current job. The reply should be specified in the response param",
                    "configParams": {
                        "action": {
                            "visible": false,
                            "defaultValue": "reply"
                        },
                        "item": {
                            "visible": false
                        },
                        "response": {
                            "visible": true
                        }
                    }
                },
                "skip": {
                    "description": "Skips the current job. Do not use unless you know what you are doing.",
                    "configParams": {
                        "action": {
                            "defaultValue": "skip"
                        }
                    }
                },
                "reset": {
                    "description": "resets the queue state to empty and skip curret job",
                    "configParams": {
                        "action": {
                            "defaultValue": "clear"
                        }
                    }
                },
                "remove": {
                    "description": "remove the element with the given index from the job queue",
                    "configParams": {
                        "action": {
                            "defaultValue": "remove"
                        },
                        "item": {
                            "visible": true,
                            "defaultValue": 0,
                            "type": "number"
                        }
                    }
                },
                "push": {
                    "params": {
                        "item": "item to push"
                    },
                    "description": "Adds a new job",
                    "configParams": {
                        "action": {
                            "defaultValue": "push"
                        },
                        "item": {
                            "visible": true,
                            "defaultValue": "",
                            "type": "string"
                        }
                    }
                }
            },
            "tokens": {},
            "displayButton": false,
            "manualAPIResponse": true,
            "enableCustomRunPath": false,
            "enableCustomRunPathInputParam": true,
            "customRunPathInputParam": "path",
            "customRunPath": "/web",
            "adminAccess": false,
            "rulesCode": "if (params.action == \"reset\") {\n  return { items: [], current: undefined };\n} else if (params.action == \"skip\") {\n  return {\n    items: (Array.isArray(board[name]?.items) ? board[name].items : []).slice(\n      1\n    ),\n    current: board[name].items[0],\n  };\n} else if (params.action == \"remove\") {\n  const queue = Array.isArray(board[name]?.items) ? board[name].items : [];\n  const index = parseInt(params.index, 10);\n  return {\n    items: queue.slice(0, index).concat(queue.slice(index + 1)),\n    current: board[name]?.current,\n  };\n} else if (params.action == \"clear\") {\n  return { items: [], current: board[name].current };\n} else if (params.action == \"reply\") {\n  //reply to current job\n  const job = board[name].current;\n  if (!job) {\n    throw \"Unable to send reply: There is not current job to reply to\";\n  }\n  const res = context.boards.getVar(\"job_\" + job.id, true);\n  if (!res) {\n    throw \"Unable to send reply: Empty res object in current job.\";\n  }\n  res.send(params.response);\n  return {\n    items: (Array.isArray(board[name]?.items) ? board[name].items : []).slice(\n      1\n    ),\n    current: board[name].items[0],\n  };\n} else {\n  const genUID = (l = 16) => {\n    const t = Date.now().toString(36);\n    const r =\n      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);\n    let out = \"\";\n    for (let i = 0; i < l; i++)\n      out += (i % 2 ? t : r)[i % (i % 2 ? t.length : r.length)];\n    return out;\n  };\n  const uid = genUID(16);\n  context.boards.setVar(\"job_\" + uid, res);\n  const item = {\n    id: uid,\n    time: new Date().toISOString(),\n    ua: req.get(\"User-Agent\"),\n    params: req.query,\n    path: params.path,\n  };\n\n  if (board[name]?.current) {\n    return {\n      items: (Array.isArray(board[name]?.items)\n        ? board[name].items\n        : []\n      ).concat([item]),\n      current: board[name]?.current,\n    };\n  }\n  return {\n    items: Array.isArray(board[name]?.items) ? board[name].items : [],\n    current: item,\n  };\n}\n",
            "html": "//@card/react\nfunction Widget(props) {\n  return (\n    <ViewList\n      onReply={(item, response) => execute_action(props.name, {action: 'reply', response: response})}\n      enableReply={true}\n      enableManualPop={true}\n      current={props?.value?.current}\n      emptyMessageProps={{\n        fontSize: \"$6\",\n        fontWeight: \"600\"\n      }}\n      // emptyMode=\"wait\"\n      emptyMessage=\"Empty requests list\"\n      emptyDescription={<YStack>\n        <Paragraph color=\"$color10\" mt={\"$2\"} fontSize={\"$4\"}>\n          <a style={{}} target=\"_new\" href={props.configParams?.path.defaultValue}>{props.configParams?.path.defaultValue}</a>\n        </Paragraph>\n      </YStack>  \n      }\n      disableManualPush={true}\n      items={props?.value?.items} \n      onPop={(items) => execute_action(props.name, {action: 'skip'})}\n      onClear={(items) => execute_action(props.name, {action: 'reset'})}\n      onPush={(item) => execute_action(props.name, {action: 'push', item})}\n      onDeleteItem={(item, index) => execute_action(props.name, {action: 'remove', index})} \n    />\n  );\n}\n",
            "publicRun": true
        }
    })
    addCard({
        group: 'board',
        tag: "iframe",
        id: 'board_iframe_show',
        templateName: "Display a link in an iframe",
        name: "show",
        defaults: {
            width: 4,
            height: 12,
            name: "Frame",
            icon: "monitor-stop",
            description: "Display a link in an iframe",
            type: 'value',
            rulesCode: "return {\n  frame: \"\", //url to display\n  type: \"frame\",\n};\n",
            html: "\n// data contains: data.value, data.icon and data.color\nreturn card({\n  content: iframe({ src: `${data.value.frame}` }),\n  padding: '3px'\n});\n",
            editorOptions: {
                // defaultTab: "value"
            },
        },
        emitEvent: true
    });

    addCard({
        group: 'board',
        tag: 'youtube',
        id: 'youtube',
        templateName: 'Display a YouTube video',
        name: 'board_youtube',
        defaults: {
            width: 3,
            height: 8,
            name: 'YouTube Video',
            icon: 'youtube',
            description: 'Embed a YouTube video from a URL',
            type: 'value',
            html: `
// data contains: data.value, data.icon and data.color
return card({
  content: youtubeEmbed({ url: \`\${data.value}\` }),
  padding: '3px'
});
`,
            editorOptions: {
                // defaultTab: "value"
            },
        },
        emitEvent: true
    });

    addCard({
        group: 'board',
        tag: 'html',
        id: 'html',
        templateName: 'Display HTML',
        name: 'board_html',
        defaults: {
            id: 'value_html',
            width: 4,
            height: 18,
            icon: "scan-text",
            type: "value",
            name: "html",
            displayIcon: false,
            rulesCode: "<!DOCTYPE html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n    <meta name=\"color-scheme\" content=\"light dark\">\n    <title>Vento</title>\n    <meta name=\"description\" content=\"Agent Platform\">\n    <link\n      rel=\"stylesheet\"\n      href=\"/public/pico/css/pico.classless.min.css\"\n    >\n  </head>\n\n  <body>\n    <header>\n      <hgroup>\n        <h1>Vento</h1>\n        <p>Agent Plataform</p>\n      </hgroup>\n    </header>\n    <main>\n      <section id=\"typography\">\n        <h2>Typography</h2>\n        <p>\n          Aliquam lobortis vitae nibh nec rhoncus. Morbi mattis neque eget efficitur feugiat.\n          Vivamus porta nunc a erat mattis, mattis feugiat turpis pretium. Quisque sed tristique\n          felis.\n        </p>\n\n        <blockquote>\n          \"Maecenas vehicula metus tellus, vitae congue turpis hendrerit non. Nam at dui sit amet\n          ipsum cursus ornare.\"\n          <footer>\n            <cite>- Phasellus eget lacinia</cite>\n          </footer>\n        </blockquote>\n\n        <h3>Lists</h3>\n        <ul>\n          <li>Aliquam lobortis lacus eu libero ornare facilisis.</li>\n          <li>Nam et magna at libero scelerisque egestas.</li>\n          <li>Suspendisse id nisl ut leo finibus vehicula quis eu ex.</li>\n          <li>Proin ultricies turpis et volutpat vehicula.</li>\n        </ul>\n      </section>\n    </main>\n    <footer>\n      <small>\n        Built with <a href=\"https://protofy.xyz/vento\">Vento</a>\n        <a href=\"https://github.com/Protofy-xyz/Vento\">Github</a>\n      </small>\n    </footer>\n    <script src=\"/public/pico/js/minimal-theme-switcher.js\"></script>\n  </body>\n</html>",
            html: "//@card/react\nfunction Widget(card) {\nreturn <Html data={card.value} readOnly={true}/>\n}\n",
            value: "\n<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\"\n\"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n<html xmlns=\"http://www.w3.org/1999/xhtml\">\n<head>\n  <title>Title of document</title>\n</head>\n<body>\n\n  some content here...\n\n</body>\n</html>\n"
        },
        emitEvent: true
    })

    addCard({
        group: 'board',
        tag: 'html',
        id: 'html_action',
        templateName: 'Action with HTML output',
        name: 'board_html_action',
        defaults: {
            autorun: true,
            id: 'action_html',
            width: 4,
            height: 18,
            icon: "scan-text",
            type: "action",
            name: "html",
            displayIcon: false,
            rulesCode: "<!DOCTYPE html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n    <meta name=\"color-scheme\" content=\"light dark\">\n    <title>Vento</title>\n    <meta name=\"description\" content=\"Agent Platform\">\n    <link\n      rel=\"stylesheet\"\n      href=\"/public/pico/css/pico.classless.min.css\"\n    >\n  </head>\n\n  <body>\n    <header>\n      <hgroup>\n        <h1>Vento</h1>\n        <p>Agent Plataform</p>\n      </hgroup>\n    </header>\n    <main>\n      <section id=\"typography\">\n        <h2>Typography</h2>\n        <p>\n          Aliquam lobortis vitae nibh nec rhoncus. Morbi mattis neque eget efficitur feugiat.\n          Vivamus porta nunc a erat mattis, mattis feugiat turpis pretium. Quisque sed tristique\n          felis.\n        </p>\n\n        <blockquote>\n          \"Maecenas vehicula metus tellus, vitae congue turpis hendrerit non. Nam at dui sit amet\n          ipsum cursus ornare.\"\n          <footer>\n            <cite>- Phasellus eget lacinia</cite>\n          </footer>\n        </blockquote>\n\n        <h3>Lists</h3>\n        <ul>\n          <li>Aliquam lobortis lacus eu libero ornare facilisis.</li>\n          <li>Nam et magna at libero scelerisque egestas.</li>\n          <li>Suspendisse id nisl ut leo finibus vehicula quis eu ex.</li>\n          <li>Proin ultricies turpis et volutpat vehicula.</li>\n        </ul>\n      </section>\n    </main>\n    <footer>\n      <small>\n        Built with <a href=\"https://protofy.xyz/vento\">Vento</a>\n        <a href=\"https://github.com/Protofy-xyz/Vento\">Github</a>\n      </small>\n    </footer>\n    <script src=\"/public/pico/js/minimal-theme-switcher.js\"></script>\n  </body>\n</html>",
            html: "//@card/react\nfunction Widget(card) {\nreturn <Html data={card.value} readOnly={true}/>\n}\n",
            value: "\n<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\"\n\"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n<html xmlns=\"http://www.w3.org/1999/xhtml\">\n<head>\n  <title>Title of document</title>\n</head>\n<body>\n\n  some content here...\n\n</body>\n</html>\n"
        },
        emitEvent: true
    })

    addCard({
        group: 'board',
        tag: 'html',
        id: 'edit_html',
        templateName: 'Edit HTML',
        name: 'board_html_edit_html',
        defaults: {
            id: 'edit_html',
            width: 4,
            height: 18,
            htmlDisplay: true,
            icon: "scan-text",
            type: "action",
            name: "html",
            displayIcon: false,
            rulesCode: "if (userParams.editedValue) {\n  return userParams.editedValue;\n} else {\n  return userParams.state;\n}\n",
            html: "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n\n  const content = <YStack f={1} mt={\"20px\"} ai=\"center\" jc=\"center\" width=\"100%\">\n    {card.icon && card.displayIcon !== false && (\n      <Icon name={card.icon} size={48} color={card.color} />\n    )}\n    {card.displayResponse !== false && (\n      <CardValue\n        mode={card.markdownDisplay? \"markdown\" : card.htmlDisplay ? 'html' : 'normal'}\n        value={value}\n        readOnly={false}\n        executeActionOnEdit={(val) => { executeAction(card.name, { editedValue: val }) }}\n      />\n    )}\n  </YStack>\n\n  return (\n    <Tinted>\n      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n        <ActionCard data={card}>\n          {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}\n        </ActionCard>\n      </ProtoThemeProvider>\n    </Tinted>\n  );\n}\n",
            value: "\n<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\"\n\"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n<html xmlns=\"http://www.w3.org/1999/xhtml\">\n<head>\n  <title>Title of document</title>\n</head>\n<body>\n\n  some content here...\n\n</body>\n</html>\n",
            params: {
                "editedValue": "",
                "state": ""
            },
            configParams: {
                "editedValue": {
                    "visible": false,
                    "defaultValue": "",
                    "type": "string"
                },
                "state": {
                    "visible": false,
                    "defaultValue": "",
                    "type": "string"
                }
            },
            displayButton: true,
            buttonLabel: "Refresh from state",
        },
        emitEvent: true
    })

    // addCard({
    //     group: 'board',
    //     tag: 'html',
    //     id: 'html_action_low',
    //     templateName: 'Action with Low Code HTML output',
    //     name: 'board_html_low_code_action',
    //     defaults: {
    //         autorun: true,
    //         id: 'action_html',
    //         width: 4,
    //         height: 18,
    //         icon: "scan-text",
    //         type: "action",
    //         name: "html",
    //         displayIcon: false,
    //         rulesCode: "return await context.html.html({\n  content: [\n    await context.html.head({\n      content: [\n        await context.html.title({\n          content: \"Vento\",\n        }),\n      ],\n    }),\n    await context.html.body({\n      content: [\n        await context.html.header({\n          content: await context.html.hgroup({\n            content: [\n              await context.html.h1({\n                content: \"Vento\",\n              }),\n              await context.html.p({\n                content: \"Agent Platform\",\n              }),\n            ],\n          }),\n        }),\n        await context.html.main({\n          content: await context.html.section({\n            content: [\n              await context.html.h4({\n                content: \"lorem ipsum\",\n              }),\n              await context.html.p({\n                content: \"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur non varius tortor, hendrerit ullamcorper tellus. Nulla sit amet purus ac ex condimentum laoreet finibus pulvinar urna. Quisque mattis leo sodales, dapibus odio sed, sollicitudin sapien. Donec eget diam et libero egestas ultrices sit amet vel sapien. Maecenas eu neque diam. Fusce bibendum euismod neque non accumsan. Nam quis sodales felis. Donec sem nisi, maximus non aliquam vitae, sollicitudin cursus elit.\",\n              }),\n            ],\n          }),\n        }),\n      ],\n    }),\n  ],\n});\n",
    //         html: "return iframeCard(data.value, data.domId)\n",
    //         value: "\n<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\"\n\"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n<html xmlns=\"http://www.w3.org/1999/xhtml\">\n<head>\n  <title>Title of document</title>\n</head>\n<body>\n\n  some content here...\n\n</body>\n</html>\n"
    //     },
    //     emitEvent: true
    // })

    addCard({
        group: 'board',
        tag: "image",
        id: 'image',
        templateName: "Display an image",
        name: "board_image",
        defaults: {
            width: 1,
            height: 4,
            name: "Image",
            icon: "image",
            description: "Display an image that scales without distortion",
            type: 'value',
            rulesCode: "return params.url",
            params: {
                "url": "image url"
            },
            configParams: {
                "url": {
                    "visible": true,
                    "defaultValue": "/public/vento-logo.png",
                    "type": "string"
                }
            },
            html: "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n\n  return (\n      <Tinted>\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n          <ActionCard data={card}>\n            <img style={{width: \"100%\", height: \"100%\", objectFit: \"contain\"}} src={value}/>\n          </ActionCard>\n        </ProtoThemeProvider>\n      </Tinted>\n  );\n}\n",
            editorOptions: {
                // defaultTab: "value"
            },
        },
        emitEvent: true
    });



    addCard({
        group: 'board',
        tag: 'markdown',
        id: 'board_markdown_editor',
        templateName: 'Markdown text editor',
        name: 'board_markdown_editor',
        defaults: {
            width: 3,
            height: 12,
            name: 'Markdown Editor',
            icon: 'file-text',
            markdownDisplay: true,
            displayIcon: false,
            displayResponse: true,
            description: 'Render and edit formatted Markdown',
            type: 'action',
            rulesCode: "if (userParams.editedValue) {\n  return userParams.editedValue;\n} else {\n  return userParams.state;\n}\n",
            html: "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n\n  const content = <YStack f={1}  mt={\"20px\"} ai=\"center\" jc=\"center\" width=\"100%\">\n      {card.icon && card.displayIcon !== false && (\n          <Icon name={card.icon} size={48} color={card.color}/>\n      )}\n      {card.displayResponse !== false && (\n          <CardValue mode={card.markdownDisplay ? 'markdown' : 'normal'} value={value ?? \"N/A\"} readOnly={false} executeActionOnEdit={(val)=>{executeAction(card.name,{editedValue: val})}} />\n      )}\n  </YStack>\n\n  return (\n      <Tinted>\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n          <ActionCard data={card}>\n            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}\n          </ActionCard>\n        </ProtoThemeProvider>\n      </Tinted>\n  );\n}\n",
            // editorOptions: {
            //     hiddenTabs: [
            //         "rules",
            //         "params"
            //     ]
            // },
            params: {
                editedValue: "New edited value",
                state: "Set state name"
            },
            configParams: {
                editedValue: {
                    visible: false,
                    defaultValue: "",
                    type: "string"
                },
                state: {
                    visible: false,
                    defaultValue: "",
                    type: "string"
                }
            },
            displayButton: true,
            buttonLabel: "Refresh from state",
        },
        emitEvent: true
    });

    addCard({
        group: 'board',
        tag: 'markdown',
        id: 'board_markdown',
        templateName: 'Display markdown text',
        name: 'board_markdown',
        defaults: {
            width: 3,
            height: 12,
            name: 'Markdown Display',
            icon: 'file-text',
            description: 'Render formatted markdown using ReactMarkdown',
            type: 'value',
            html: "//@react\nreturn markdown(data, true)",
            rulesCode: "return `# h1 Heading 8-)\n## h2 Heading\n### h3 Heading\n#### h4 Heading\n##### h5 Heading\n###### h6 Heading\n\n## Tables\n\n| Option | Description |\n| ------ | ----------- |\n| data   | path to data files to supply the data that will be passed into templates. |\n| engine | engine to be used for processing templates. Handlebars is the default. |\n| ext    | extension to be used for dest files. |\n\nRight aligned columns\n\n| Option | Description |\n| ------:| -----------:|\n| data   | path to data files to supply the data that will be passed into templates. |\n| engine | engine to be used for processing templates. Handlebars is the default. |\n| ext    | extension to be used for dest files. |`",
            editorOptions: {},
        },
        emitEvent: true
    });

    addCard({
        group: 'board',
        tag: 'filebrowser',
        id: 'board_filebrowser',
        templateName: 'File Browser',
        name: 'view',
        defaults: {
            width: 5.5,
            height: 16,
            name: 'File Browser',
            icon: 'folder-search',
            description: 'Render a file browser',
            type: 'action',
            html: "// @card/react\r\n\r\nfunction Widget(card) {\r\n  const data = card?.value ?? {}\r\n\r\n  const onFileActionEvent = async (event) => {\r\n    if (event.id == \"refresh_files\" && event.payload.path) {\r\n      await execute_action(card.name, {\r\n        path: event.payload.path\r\n      })\r\n    }\r\n  }\r\n\r\n  const content = <YStack f={1}  pt={\"20px\"} ai=\"center\" jc=\"center\" width=\"100%\">\r\n        {card.icon && card.displayIcon !== false && (\r\n            <Icon name={card.icon} size={48} color={card.color}/>\r\n        )}\r\n        {card.displayResponse !== false && (\r\n            <CardValue mode={card.markdownDisplay ? 'markdown' : 'normal'} value={card?.value ?? \"N/A\"} />\r\n        )}\r\n  </YStack>\r\n\r\n  return (\r\n    <div className=\"no-drag\" style={{\r\n      height: \"100%\",\r\n      padding: \"1em\",\r\n      overflow: \"auto\",\r\n      fontFamily: \"sans-serif\",\r\n      fontSize: \"14px\",\r\n      display: \"flex\",\r\n      color: \"var(--color)\"\r\n    }}>\r\n      <Tinted>\r\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\r\n          <YStack f={1}>\r\n            <YStack f={1}>\r\n              <FileBrowser initialPath={data.path} explorer={{onFileActionEvent}}/>\r\n            </YStack>\r\n            <YStack>\r\n              <ActionCard data={card}>\r\n                {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}\r\n              </ActionCard>\r\n            </YStack>\r\n          </YStack>\r\n        </ProtoThemeProvider>\r\n      </Tinted>\r\n    </div>\r\n  );\r\n}",
            rulesCode: "const data = {\n  list: await execute_action(\"/api/core/v1/files\", userParams),\n  path: userParams.path,\n};\n\nreturn data;\n",
            displayResponse: false,
            displayIcon: false,
            params: {
                path: "path to browse (default: /)"
            },
            configParams: {
                path: {
                    "visible": true,
                    "defaultValue": "/",
                    "type": "string"
                }
            },
            editorOptions: {
                // defaultTab: "value"
            },
        },
        emitEvent: true
    });

    addCard({
        group: 'memory',
        tag: 'object',
        id: 'memory_interactive_object',
        templateName: 'Interactive object',
        name: 'interactive',
        defaults: {
            name: 'object',
            icon: 'file-stack',
            width: 2,
            height: 12,
            description: 'Interactive object',
            type: 'action',
            editorOptions: {
                // defaultTab: "value"
            },
            html: "reactCard(`\n  function Widget(props) {\n    console.log('react object widget: ', props.value)\n    return (\n      <Tinted>\n        <ViewObject\n          object={props.value}\n          onAdd={(key, value) => execute_action('${data.name}', { action: 'set', key, value })}\n          onValueEdit={(key, value) => execute_action('${data.name}', { action: 'set', key, value })}\n          onKeyDelete={(key) => execute_action('${data.name}', { action: 'delete', key })}\n          onKeyEdit={(oldKey, newKey) => execute_action('${data.name}', { action: 'rename', oldKey, newKey })}\n          onClear={() => execute_action('${data.name}', { action: 'reset' })}\n        />\n      </Tinted>\n    );\n  }\n`, data.domId, data)",
            displayResponse: true,
            rulesCode: "if (params.action === 'reset' || params.action === 'clear') {\r\n  return {};\r\n} else if (params.action === 'set') {\r\n  const key = params.key\r\n  const value = params.value\r\n  return { ...(board?.[name] ?? {}), [key]: value }\r\n} else if (params.action === 'delete') {\r\n  const newObj = { ...(board?.[name] ?? {}) }\r\n  delete newObj[params.key]\r\n  return newObj\r\n} else if (params.action === 'rename') {\r\n  const oldKey = params.oldKey\r\n  const newKey = params.newKey\r\n  const obj = { ...(board?.[name] ?? {}) }\r\n  if (oldKey !== newKey && obj[oldKey] !== undefined && obj[newKey] === undefined) {\r\n    obj[newKey] = obj[oldKey]\r\n    delete obj[oldKey]\r\n  }\r\n  return obj\r\n} else {\r\n  return board?.[name] ?? {}\r\n}",
            params: {
                key: "key",
                value: "value",
                action: "action to perform in the object: set, delete, rename, reset or clear"
            },
            configParams: {
                key: {
                    visible: true,
                    defaultValue: ""
                },
                value: {
                    visible: true,
                    defaultValue: ""
                },
                action: {
                    visible: true,
                    defaultValue: ""
                }
            },
            displayButton: false
        },
        emitEvent: true
    });

    addCard({
        group: 'memory',
        tag: 'queue',
        id: 'board_interactive_queue',
        templateName: 'Queue of items',
        name: 'interactive',
        defaults: {
            name: 'queue',
            icon: 'file-stack',
            width: 2,
            height: 12,
            description: 'Interactive queue of items',
            type: 'action',
            editorOptions: {
                // defaultTab: "value"
            },
            html: "//@card/react\nfunction Widget(props) {\n  return (\n          <ViewList \n            items={props.value} \n            onClear={(items) => execute_action(props.name, {action: 'clear'})}\n            onPush={(item) => execute_action(props.name, {action: 'push', item})}\n            onDeleteItem={(item, index) => execute_action(props.name, {action: 'remove', index})} \n          />\n  );\n}\n",
            displayResponse: true,
            rulesCode: "if (params.action == 'reset') {\r\n    return [];\r\n} else if (params.action == 'pop') {\r\n    return (Array.isArray(board?.[name]) ? board?.[name] : []).slice(1);\r\n} else if (params.action == 'remove') {\r\n    const queue = Array.isArray(board?.[name]) ? board[name] : [];\r\n    const index = parseInt(params.index, 10);\r\n    return queue.slice(0, index).concat(queue.slice(index + 1));\r\n} else if(params.action == 'clear') {\r\n    return []\r\n} else {\r\n    return (Array.isArray(board?.[name]) ? board?.[name] : []).concat([params.item]);\r\n}",
            params: {
                item: "",
                action: "action to perform in the queue: push, pop, clear"
            },
            configParams: {
                item: {
                    visible: true,
                    defaultValue: ""
                },
                action: {
                    "visible": true,
                    "defaultValue": ""
                }
            },
            presets: {
                pop: {
                    description: "removes the oldest element from the queue",
                    configParams: {
                        action: {
                            defaultValue: "pop"
                        }
                    }
                },
                reset: {
                    description: "resets the queue state to empty",
                    configParams: {
                        action: {
                            defaultValue: "clear"
                        }
                    }
                },
                remove: {
                    description: "remove the element with the given index from the queue",
                    configParams: {
                        action: {
                            defaultValue: "remove"
                        },
                        item: {
                            visible: true,
                            defaultValue: 0,
                            type: "number"
                        }
                    }
                },
                push: {
                    params: {
                        item: "item to push"
                    },
                    description: "adds an element to the queue",
                    configParams: {
                        action: {
                            defaultValue: "push"
                        },
                        item: {
                            visible: true,
                            defaultValue: "",
                            type: "string"
                        }
                    }
                }
            },
            displayButton: false
        },
        emitEvent: true
    });


    addCard({
        group: 'memory',
        tag: 'matrix',
        id: 'board_interactive_matrix',
        templateName: 'Matrix grid',
        name: 'interactive',
        defaults: {
            name: 'matrix',
            icon: 'grid-3x3',
            width: 4,
            height: 12,
            description: "# Matrix / Grid\r\n\r\nCreates and manipulates bi-dimensional grids. The grid is stored as a bidimensional\r\narray where the first level is the row, and second level is the column.\r\n\r\n## Accessing a specific position given row and column\r\n\r\n```js\r\nmatrix[row][column]\r\n```\r\n\r\n## Actions\r\n\r\n### `reset`\r\n\r\nCreates a new matrix with the given dimensions and initializes all cells with a value.\r\n\r\n**Parameters:**\r\n\r\n* `action`: `\"reset\"`\r\n* `width`: number of columns (must be a positive integer)\r\n* `height`: number of rows (must be a positive integer)\r\n* `value`: initial value for all cells\r\n\r\n**Example:**\r\n\r\n```json\r\n{\r\n  \"action\": \"reset\",\r\n  \"width\": 3,\r\n  \"height\": 3,\r\n  \"value\": \"\"\r\n}\r\n```\r\n\r\n**Effect:**\r\nResets the matrix to a 3×3 grid with all cells initialized to an empty string (`\"\"`).\r\n\r\n---\r\n\r\n### `setCell`\r\n\r\nSets a specific cell at position `(x, y)` to the given value.\r\nCoordinates are 0-based: `x` is the column index, `y` is the row index.\r\n\r\n**Parameters:**\r\n\r\n* `action`: `\"setCell\"`\r\n* `x`: column index\r\n* `y`: row index\r\n* `value`: value to set in the specified cell\r\n\r\n**Example:**\r\n\r\n```json\r\n{\r\n  \"action\": \"setCell\",\r\n  \"x\": 1,\r\n  \"y\": 2,\r\n  \"value\": \"X\"\r\n}\r\n```\r\n\r\n**Effect:**\r\nSets the value `\"X\"` in the cell located at column 1, row 2.",
            type: 'action',
            editorOptions: {
                // defaultTab: "value"
            },
            "rulesCode": "const matrix = board?.[name];\r\n\r\nif (params.action === 'reset') {\r\n  const width = params.width;\r\n  const height = params.height;\r\n  const initialValue = params.value;\r\n\r\n  if (!Number.isInteger(width) || width <= 0 ||\r\n      !Number.isInteger(height) || height <= 0) {\r\n    throw new TypeError('matrix reset error: width and height should positive numbers');\r\n  }\r\n\r\n  // Nueva matriz de height x width\r\n  return Array.from({ length: height }, () =>\r\n    Array.from({ length: width }, () => initialValue)\r\n  );\r\n} else {\r\n  if (!Array.isArray(matrix)) {\r\n    throw new Error('matrix set error: cannot set a value in an empty matrix');\r\n  }\r\n\r\n  const posX = params.x;\r\n  const posY = params.y;\r\n  const val = params.value;\r\n\r\n  if (!Number.isInteger(posY) || posY < 0 || posY >= matrix.length) {\r\n    throw new RangeError(`matrix set error: y out of range: ${posY}`);\r\n  }\r\n  const row = matrix[posY];\r\n  if (!Array.isArray(row)) {\r\n    throw new TypeError(`matrix set error: invalud row`);\r\n  }\r\n  if (!Number.isInteger(posX) || posX < 0 || posX >= row.length) {\r\n    throw new RangeError(`matrix set error x out of range: ${posX}`);\r\n  }\r\n\r\n  // Copia inmutable y set\r\n  const next = matrix.map(r => r.slice());\r\n  next[posY][posX] = val;\r\n  return next;\r\n}",
            "html": "//@card/react\n\nfunction MatrixTable({ data }) {\n  const rows = Array.isArray(data) ? data : []\n  const maxCols = rows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0)\n\n  const wrapStyle = {\n    width: '100%',\n    height: '100%',\n    overflow: 'auto',\n  }\n  const tableStyle = {\n    borderCollapse: 'collapse',\n    width: '100%',\n    height: '100%',\n  }\n  const cellStyle = {\n    border: '1px solid #ccc',\n    padding: '6px 8px',\n    textAlign: 'center',\n  }\n\n  return (\n    <div style={wrapStyle}>\n      <table style={tableStyle}>\n        <tbody>\n          {rows.map((row, rIdx) => (\n            <tr key={rIdx}>\n              {Array.from({ length: maxCols }).map((_, cIdx) => {\n                const v = Array.isArray(row) ? row[cIdx] : undefined\n                const text = v == null ? '' : String(v)\n                return <td key={cIdx} style={cellStyle}><CardValue value={text ?? \"\"} /></td>\n              })}\n            </tr>\n          ))}\n        </tbody>\n      </table>\n    </div>\n  )\n}\n\nfunction Widget(card) {\n  const value = card.value;\n  const isMatrix = Array.isArray(value) && value.every(r => Array.isArray(r));\n  const fullHeight = value !== undefined && typeof value !== \"string\" && typeof value !== \"number\" && typeof value !== \"boolean\";\n\n  const content = (\n    <YStack f={1} h=\"100%\" miH={0} mt={fullHeight ? \"20px\" : \"0px\"} ai=\"stretch\" jc=\"flex-start\" width=\"100%\">\n      {card.icon && card.displayIcon !== false && (\n        <Icon name={card.icon} size={48} color={card.color} />\n      )}\n\n      {card.displayResponse !== false && (\n        isMatrix ? (\n          <YStack f={1} miH={0} width=\"100%\">\n            <MatrixTable data={value} />\n          </YStack>\n        ) : (\n          <YStack f={1} miH={0} width=\"100%\"><h1>{value !== undefined ? String(value) : 'Empty table'}</h1></YStack>\n        )\n      )}\n    </YStack>\n  );\n\n  return (\n    <Tinted>\n      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n        <ActionCard data={card} style={{ height: '100%'}}>\n          {card.displayButton !== false ? (\n            <ParamsForm data={card} style={{ height: '100%' }}>\n              {content}\n            </ParamsForm>\n          ) : (\n            card.displayResponse !== false && content\n          )}\n        </ActionCard>\n      </ProtoThemeProvider>\n    </Tinted>\n  );\n}",
            displayResponse: true,
            "params": {
                "x": "position  x only needed when using setCell",
                "y": "position y only needed when using setCell",
                "action": "reset or setCell",
                "value": "initialization value when using reset, value for cell when using setCell",
                "width": "width of the matrix: needed for reset",
                "height": "height of the matrix: needed for reset"
            },
            "configParams": {
                "x": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "number"
                },
                "y": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "number"
                },
                "action": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "string"
                },
                "value": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "string"
                },
                "width": {
                    "visible": true,
                    "defaultValue": "3",
                    "type": "number"
                },
                "height": {
                    "visible": true,
                    "defaultValue": "3",
                    "type": "number"
                }
            },
            displayButton: true,
            displayIcon: false
        },
        emitEvent: true
    });


    addCard({
        group: 'board',
        tag: "react",
        id: 'board_react',
        templateName: "Display a React component",
        name: "show",
        defaults: {
            width: 2,
            height: 8,
            name: "React",
            icon: "table-properties",
            description: "Display a React component",
            type: 'value',
            html: "reactCard(`\n  function Widget() {\n    return (\n        <Tinted>\n          <View className=\"no-drag\">\n            {/* you can use data.value here to access the value */}\n            <center><Text>Hello from react</Text></center>\n          </View>\n        </Tinted>\n    );\n  }\n\n`, data.domId)\n"
        },
        emitEvent: true
    })

    addCard({
        group: 'board',
        tag: "table",
        id: 'board_table_show',
        templateName: "Display an array of objects in a table",
        name: "show",
        defaults: {
            width: 3,
            height: 10,
            name: "Table",
            icon: "table-properties",
            description: "Display an array of objects in a table",
            type: 'value',
            html: "\n//data contains: data.value, data.icon and data.color\nreturn card({\n    content: cardTable(data.value), padding: '3px'\n});\n",
            rulesCode: "return [{name: \"protofito\", age: 20}, {name: \"protofita\", age: 19}, {name: \"bad protofito\", age: 10}]",
        },
        emitEvent: true
    })

    addAction({
        group: 'board',
        name: 'resetgroup',
        url: "/api/core/v1/board/cardresetgroup",
        tag: 'card',
        description: "Resets the values of groups of cards in the board",
        params: {
            included: "array of cards to include, or * for all",
            excluded: "array of cards to exclude"
        },
        emitEvent: true,
        receiveBoard: true,
        token: await getServiceToken()
    })

    addCard({
        group: 'board',
        tag: 'card',
        id: 'board_resetgroup',
        templateName: 'Reset card group values',
        name: 'board_resetgroup',
        defaults: {
            type: "action",
            icon: 'message-square-text',
            name: 'card reset group',
            description: 'Reset the values of a group of cards in the board',
            params: {
                included: "array of cards to include, or * for all",
                excluded: "array of cards to exclude"
            },
            configParams: {
                included: {
                    visible: true,
                    defaultValue: "[\"*\"]",
                    type: "array"
                },
                excluded: {
                    visible: true,
                    defaultValue: "[\"\"]",
                    type: "array"
                }
            },
            rulesCode: `return await execute_action("/api/core/v1/board/cardresetgroup", userParams)`,
            displayResponse: true,
            buttonLabel: "Reset all",
            displayIcon: false
        },
        emitEvent: true,
        token: await getServiceToken()
    })

    addAction({
        group: 'board',
        name: 'reset',
        url: "/api/core/v1/board/cardreset",
        tag: 'card',
        description: "Resets the value of a card in the board",
        params: {
            name: "the name of the card to reset"
        },
        emitEvent: true,
        receiveBoard: true,
        token: await getServiceToken()
    })

    addCard({
        group: 'board',
        tag: 'card',
        id: 'board_reset',
        templateName: 'Reset card value',
        name: 'board_reset',
        defaults: {
            type: "action",
            icon: 'message-square-text',
            name: 'card reset',
            description: 'Reset the value of a card in the board',
            params: {
                name: "Name of the card to reset"
            },
            configParams: {
                name: {
                    visible: true,
                    defaultValue: "",
                    type: "string"
                }
            },
            rulesCode: `return await execute_action("/api/core/v1/board/cardreset", userParams)`,
            displayResponse: true,
            buttonLabel: "Reset card",
            displayIcon: false
        },
        emitEvent: true,
        token: await getServiceToken()
    })

    addCard({
        group: 'board',
        tag: "map",
        id: 'board_map_route',
        templateName: "Display a route on a map",
        name: "route",
        defaults: {
            width: 3,
            height: 10,
            name: "Display route",
            icon: "table-properties",
            description: "Display a route on a map",
            type: 'value',
            html: "const html = `<!doctype html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-8\"/>\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>\n<link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css\"/>\n<style>\n  html,body,#map{height:100%;margin:0}\n</style>\n</head>\n<body>\n<div id=\"map\"></div>\n\n<script src=\"https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js\"></script>\n<script>\n  (function(){\n    var center = [41.3947846,2.1939663];\n    var zoom = 14;\n    var routeCoords = ${JSON.stringify(data.value)}\n\n    var map = L.map('map').setView(center, zoom);\n    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {\n      maxZoom: 19,\n      attribution: '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors'\n    }).addTo(map);\n\n   \n    if (routeCoords && routeCoords.length > 0) {\n      if(routeCoords.length>1){\n        var line = L.polyline(routeCoords, { weight: 5, opacity: 0.9 }).addTo(map);\n      }\n      if (routeCoords.length > 0) {\n        L.marker(routeCoords[0]).addTo(map).bindPopup('Start');\n        \n        if(routeCoords.length>0){\n          map.fitBounds(line.getBounds(), { padding: [20,20] });\n          L.marker(routeCoords[routeCoords.length - 1]).addTo(map).bindPopup('End');\n        }\n      }\n    }\n  })();\n</script>\n</body>\n</html>`;\n\nreturn iframeCard(html, data.domId)",
            rulesCode: "return [[41.3947846,2.1939663],[41.403644, 2.174444]]",
        },
        emitEvent: true
    })
}
