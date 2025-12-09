import { YStack, XStack, Spacer, ScrollView, useThemeName, Input, Text, Button, Paragraph, Label } from '@my/ui'
import { AlertDialog } from '../../components/AlertDialog';
import { Slides } from '../../components/Slides'
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionCardSettings } from '../autopilot/ActionCardSettings';
import { useProtoStates } from '@extensions/protomemdb/lib/useProtoStates'
import { Search, ScanEye, Rocket } from "@tamagui/lucide-icons";
import { Tinted } from '../Tinted';
import { PublicIcon } from '../IconSelect';
import { useThemeSetting } from '@tamagui/next-theme'
import { v4 as uuidv4 } from 'uuid';
import { Markdown } from '../../components/Markdown';
import { useRemoteStateList } from '../../lib/useRemoteState';
import { CardModel } from '@extensions/cards/cardsSchemas';
import { API, getPendingResult } from 'protobase';

const SelectGrid = ({ children }) => {
  return <XStack jc="flex-start" ai="center" gap={25} flexWrap='wrap'>
    {children}
  </XStack>
}

const FirstSlide = ({ selected, setSelected, options, errors }) => {
  const themeName = useThemeName()
  const { resolvedTheme } = useThemeSetting()
  const darkMode = resolvedTheme == 'dark'
  const [search, setSearch] = useState('')
  const isAction = (option) => option.defaults?.type === 'action'
  const [selectedGroups, setSelectedGroups] = useState([]);
  const cardNameInputRef = useRef(null)

  // Extrae los grupos disponibles de las options
  const groups = useMemo(() => {
    options.sort((a, b) => {
      if (a.group && b.group) {
        return a.group.localeCompare(b.group);
      }
      return 0;
    });
    return [...new Set(options.map(o => o.group).filter(Boolean))];
  }, [options]);

  const toggleGroup = (group) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const getFilteredOptions = (options, search, selectedGroups) => {
    const lowerSearch = search.toLowerCase();
    return options.filter(opt => {
      const matchSearch = opt.templateName?.toLowerCase().includes(lowerSearch);
      const matchGroup = selectedGroups.length === 0 || selectedGroups.includes(opt.group);
      return matchSearch && matchGroup;
    });
  }

  const filteredOptions = useMemo(() => {
    return getFilteredOptions(options, search, selectedGroups);
  }, [options, search, selectedGroups]);

  const groupedOptions = useMemo(() => {
    return filteredOptions.reduce((acc, opt) => {
      const groupKey = opt.group ?? "__no_group__";
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(opt);
      return acc;
    }, {});
  }, [filteredOptions]);

  const onChangeSearch = (text) => {
    setSearch(text);
    const itemToSelect = getFilteredOptions(options, text, selectedGroups)?.[0];
    if (itemToSelect) {
      setSelected(itemToSelect);
    }
  }

  return (
    <XStack f={1} gap="$4" pb="$4">
      <YStack f={1}>
        <XStack pb={8} mb={5} position="relative">
          <Search pos="absolute" left="$3" top={14} size={16} pointerEvents="none" />
          <Input
            bg="$gray3"
            color="$gray12"
            paddingLeft="$7"
            bw={themeName === 'dark' ? 0 : 1}
            h="47px"
            boc={'$gray5'}
            w="100%"
            placeholder="search..."
            placeholderTextColor="$gray9"
            outlineColor="$gray8"
            value={search}
            onChangeText={onChangeSearch}
          />
        </XStack>
        <XStack gap="$2" mb="$4" flexWrap="wrap">
          <Tinted>
            {groups.map((group) => {
              const isActive = selectedGroups.includes(group);
              return (
                <Button
                  key={group}
                  onPress={() => toggleGroup(group)}
                  size="$3"
                  style={{
                    backgroundColor: isActive ? 'var(--color4)' : 'var(--gray3)',
                    borderColor: isActive ? 'var(--color7)' : 'var(--gray5)',
                    borderWidth: '1px',
                    borderRadius: "$10",
                    color: isActive ? '$color' : 'inherit',
                  }}
                >
                  {group}
                </Button>
              );
            })}
          </Tinted>
        </XStack>

        <XStack flex={1} gap="$3">
          <Tinted>
            <ScrollView>
              {Object.entries(groupedOptions).map(([group, options]) => (
                <YStack key={group} mb="$3">
                  {group !== "__no_group__" && (
                    <>
                      <Text fontSize="$5" fontWeight="600" mb="$2">{group}</Text>
                    </>
                  )}

                  <SelectGrid>
                    {options.map((option) => (
                      <XStack
                        height={70}
                        key={option.id}
                        width="calc(50% - 12.5px)"
                        $gtLg={{ width: "calc(33% - 17px)" }}
                        gap={"$2"}
                        p={"$2"}
                        px={"$3"}
                        cursor="pointer"
                        onPress={() => {
                          setSelected(option)
                          cardNameInputRef.current?.focus()
                        }}
                        borderRadius={"$3"}
                        ai="center"
                        bw={"1px"}
                        boc={selected?.id === option.id ? "$gray8" : "$gray5"}
                        bc={selected?.id === option.id ? "$gray5" : "$gray2"}
                        hoverStyle={{ bc: "$color4", boc: "$color7" }}
                      >
                        <YStack
                          br={isAction(option) ? "$10" : "$2"}
                          p={"$2.5"}
                          bc={
                            option?.defaults?.color
                              ? option?.defaults?.color
                              : isAction(option)
                                ? "$yellow8"
                                : "$blue8"
                          }
                        >
                          <PublicIcon
                            name={option.defaults.icon}
                            color="var(--color)"
                            size={20}
                          />
                        </YStack>
                        <Text ml="$2" fontSize="$4">{option.templateName}</Text>
                      </XStack>
                    ))}
                  </SelectGrid>
                </YStack>
              ))}
            </ScrollView>
          </Tinted>

        </XStack>
      </YStack>
      <YStack
        width={500}
        height={"100%"}
        cursor="pointer"
        gap="$3"
      >
        <YStack
          flex={1} w="100%" h="100%" jc="flex-start"
          ai="center" px="$2" gap="$3" overflow='scroll'
          bw={1} bc="$gray3" br="$3" p="$4" boc={"$gray6"}
          px="$6" overflowX="hidden"
        >
          <XStack gap="$2" ai="center" jc="center">
            <XStack mah={20} mt="-8px">
              <PublicIcon
                name={selected.defaults.icon}
                color="var(--color)"
                size={20}
              />
            </XStack>
            <Text fontSize="$7" fontWeight="600" mb="$2" textAlign='center'>{selected.name}</Text>
          </XStack>
          <YStack w="100%">
            <Label alignSelf="flex-start" ml={"$3"} h={"$3.5"} color="$gray9" size="$5">
              Name
            </Label>
            <Input
              bg="$gray6"
              placeholder={selected.defaults?.name ?? "Card name"}
              placeholderTextColor={"$gray10"}
              outlineColor="$gray8"
              w="100%"
              ref={cardNameInputRef}
              onChangeText={(value) => {
                setSelected(prev => {
                  return { ...prev, defaults: { ...prev.defaults, customName: value && value.length ? value : null } }
                })
              }}
            />
            {errors?.length > 0 ?
              <YStack>
                {errors.map((error, index) => (
                  <Paragraph key={"err" + index} color="$red9" fontSize="$4">{error}</Paragraph>
                ))}
              </YStack>
              : <></>
            }
          </YStack>
          <YStack w="100%" pt="$5">
            <Label alignSelf="flex-start" ml={"$3"} h={"$3.5"} color="$gray9" size="$5">
              Description
            </Label>
            <Markdown readOnly={true} copyToClipboardEnabled={false} data={selected.defaults?.description ?? "No description provided for this card"} />
          </YStack>
        </YStack>
      </YStack>
    </XStack>
  )
}

const iconTable = {
  'value': 'tag',
  'action': 'zap'
}

const SecondSlide = ({ remountKey, card, board, states, icons, actions, setCard, errors }) => {
  return (
    <YStack mb="$4" marginTop="$-5" marginHorizontal="$-6" f={1}>
      <ActionCardSettings
        key={remountKey}
        mode="create"
        board={board}
        states={states}
        icons={icons}
        card={card}
        actions={actions}
        onEdit={(data) => setCard(data)}
        errors={errors}
      />
    </YStack>
  )
}

const typeCodes = {
  value: `//@card/react

function Widget(card) {
  const value = card.value;
  return (
      <Tinted>
        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
            <YStack f={1} height="100%" ai="center" jc="center" width="100%">
                {card.icon && card.displayIcon !== false && (
                    <Icon name={card.icon} size={48} color={card.color}/>
                )}
                {card.displayResponse !== false && (
                    <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? "N/A"} />
                )}
            </YStack>
        </ProtoThemeProvider>
      </Tinted>
  );
}

`,
  action: `//@card/react

function Widget(card) {
  const value = card.value;

  const content = <YStack f={1} ai="center" jc="center" width="100%">
      {card.icon && card.displayIcon !== false && (
          <Icon name={card.icon} size={48} color={card.color}/>
      )}
      {card.displayResponse !== false && (
          <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? "N/A"} />
      )}
  </YStack>

  return (
      <Tinted>
        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
          <ActionCard data={card}>
            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}
          </ActionCard>
        </ProtoThemeProvider>
      </Tinted>
  );
}
`,

}

const extraCards = [
  {
    defaults: {
      type: 'action',
      name: 'action',
      width: 2,
      height: 7,
      displayResponse: true,
      icon: 'rocket',
      displayIcon: false,
      params: {
        input: "action input"
      },
      configParams: {
        input: {
          visible: true,
          defaultValue: "",
          type: "any"
        }
      },
      rulesCode: "return params.input",
      description: `Default description, edit this description to improve usability of this action`,
    },
    group: "base",
    tag: "cards",
    name: 'action',
    id: 'base.cards.action',
    templateName: 'Action',
  },
  {
    defaults: {
      width: 3,
      height: 18,
      type: 'action',
      name: 'AI Action',
      displayResponse: true,
      editRulesInLowCode: false,
      editRulesInNaturalLanguage: false,
      rulesCode: "let visibleActions = params.full_board_view ? ['*'] : params.actions\nlet invisibleActions = [ ...params.invisible_actions, name ]\nlet visibleStates = params.full_board_view ? ['*'] : params.values\nlet invisibleStates = [ ...params.invisible_values, name ]\n\nconst filteredActions = boardActions.filter(action => {\n  const name = action.name\n  if (visibleActions.includes('*')) {\n    return !invisibleActions.includes(name)\n  }\n  return visibleActions.includes(name) && !invisibleActions.includes(name)\n}).map(action => {\n  let {html, description, ...rest} = action\n  if(description.startsWith('Actions can perform tasks, automate processes, and enhance user interactions')) {\n    description = 'generic action with no description'\n  }\n  return {\n    description,\n    ...rest\n  }\n})\n\nconst filteredStates = Object.fromEntries(\n  Object.entries(board).filter(([key, value]) => {\n    if (visibleStates.includes('*')) {\n      return !invisibleStates.includes(key)\n    }\n    return visibleStates.includes(key) && !invisibleStates.includes(key)\n  })\n)\n\nconst boardActionsHtml = context.ai.objectToHTML(\n  filteredActions,\n  'Available Actions',\n  { parseJsonStrings: true }\n)\n\nconst boardStatesHtml = context.ai.objectToHTML(\n  filteredStates,\n  'Board States',\n  { parseJsonStrings: true }\n)\n\nconst promptHtml = context.ai.htmlBox(\n  `<p style=\"margin:0;font-size:15px;color:#ffffff;\">${params.prompt}</p>`,\n  '💬 User Prompt',\n  { accent: true }\n)\n\nconst instructionsExecution = context.ai.htmlBox(`\n<p>You are an AI agent inside <strong style=\"color:#0a84ff;\">Vento</strong>, an AI agent platform.</p>\n<p>The agent is managed through a <strong>board</strong> composed of <em>states</em> and <em>actions</em>.</p>\n<p>Your mission is to generate a JSON response in this format:</p>\n<pre style=\"background:#2c2c2e;color:#0a84ff;padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;margin:8px 0;border:1px solid #3a3a3c;\">\n{\n  \"response\": \"your message in markdown format\",\n  \"actions\": [\n    { \"name\": \"action_name\", \"params\": { \"key\": \"value\" } }\n  ]\n}\n</pre>\n<ul style=\"margin:8px 0;padding-left:20px;color:#e5e5e7;\">\n<li>The <strong>response</strong> will be shown to the user</li>\n<li>The <strong>actions</strong> array can be empty if no actions needed</li>\n<li>Always use the action <strong>name</strong>, never the id</li>\n<li>Use <strong style=\"color:#0a84ff;\">Board States</strong> to answer questions</li>\n<li>If something is unavailable, suggest extending the board</li>\n</ul>\n`, '📋 Instructions')\n\nconst instructionsReadOnly = context.ai.htmlBox(`\n<p>You are an assistant providing answers about an agent's state.</p>\n<p>Use the <strong style=\"color:#0a84ff;\">Board States</strong> to answer questions.</p>\n<p>Answer in plain language, in the same language as the prompt.</p>\n<p>If information is unavailable, suggest extending the board with more cards.</p>\n`, '📋 Instructions')\n\nconst message_prompt = params.allow_execution \n  ? `${instructionsExecution}\\n${boardActionsHtml}\\n${params.allow_read ? boardStatesHtml : ''}\\n${promptHtml}`\n  : `${instructionsReadOnly}\\n${boardStatesHtml}\\n${promptHtml}`\n\nif(params.debug) return message_prompt\nconst response = await context.chatgpt.prompt({\n  message: message_prompt,\n  conversation: await context.chatgpt.getSystemPrompt({\n    prompt: `You can analyze images provided in the same user turn. \nDo NOT claim you cannot see images. \nAnswer following the JSON contract only (no code fences).`,\n  }),\n  images: await context.boards.getStatesByType({\n    board: filteredStates,\n    type: \"frame\",\n    key: \"frame\",\n  }),\n  files: await context.boards.getStatesByType({\n    board: filteredStates,\n    type: \"file\",\n    key: \"path\",\n  }),\n});\nif(params.allow_execution) {\n  return context.chatgpt.processResponse({\n    response: response,\n    execute_action: execute_action,\n  });\n} \nreturn response\n",
      html: "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n  \n  // Auto-detect HTML content\n  const isHtmlContent = typeof value === 'string' && value.trim().startsWith('<');\n  const mode= card.markdownDisplay ? 'markdown' : (card.htmlDisplay || (typeof value === 'string' && value.trim().startsWith('<'))) ? 'html' : 'normal'\n\n  const content = <YStack f={1} mt={\"20px\"} ai=\"center\" jc=\"center\" width=\"100%\">\n      {card.icon && card.displayIcon !== false && (\n          <Icon name={card.icon} size={48} color={card.color}/>\n      )}\n      {card.displayResponse !== false && (\n          <CardValue mode={mode} value={value ?? \"N/A\"} />\n      )}\n  </YStack>\n\n  return (\n      <Tinted>\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n          <ActionCard data={card}>\n            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}\n          </ActionCard>\n        </ProtoThemeProvider>\n      </Tinted>\n  );\n}",
      params: {
        "prompt": "",
        "full_board_view": "Allows the AI to see the entire board",
        "allow_read": "Allows this AI action to read other card values",
        "values": "name of the cards for the AI to see",
        "invisible_values": "name of the cards the AI should not see",
        "allow_execution": "Allow this AI action to execute other actions",
        "actions": "name of the action cards visible for the AI to run",
        "invisible_actions": "name of the action cards the AI should not see ",
        "debug": "instead of running the AI, returns back the prompt for debugging purposes"
      },
      configParams: {
        "prompt": {
          "visible": true,
          "defaultValue": "",
          "type": "any"
        },
        full_board_view: {
          "visible": true,
          "defaultValue": "true",
          "type": "boolean"
        },
        allow_read: {
          "visible": true,
          "defaultValue": "true",
          "type": "boolean"
        },
        values: {
          "visible": true,
          "defaultValue": "[]",
          "type": "array",
          "cardSelector": true,
          "cardSelectorType": "value",
          "visibility": {
            "mode": "all",
            "fields": [
              "full_board_view",
              "allow_read"
            ],
            "values": [
              false,
              true
            ]
          }
        },
        invisible_values: {
          "visible": true,
          "defaultValue": "[]",
          "type": "array",
          "cardSelector": true,
          "cardSelectorType": "value",
          "visibility": {
            "mode": "all",
            "fields": [
              "full_board_view",
              "allow_read"
            ],
            "values": [
              false,
              true
            ]
          }
        },
        allow_execution: {
          "visible": true,
          "defaultValue": "true",
          "type": "boolean"
        },
        actions: {
          "visible": true,
          "defaultValue": "[]",
          "type": "array",
          "cardSelector": true,
          "cardSelectorType": "action",
          "visibility": {
            "mode": "all",
            "fields": [
              "full_board_view",
              "allow_execution"
            ],
            "values": [
              false,
              true
            ]
          }
        },
        invisible_actions: {
          "visible": true,
          "defaultValue": "[]",
          "type": "array",
          "cardSelector": true,
          "cardSelectorType": "action",
          "visibility": {
            "mode": "all",
            "fields": [
              "full_board_view",
              "allow_execution"
            ],
            "values": [
              false,
              true
            ]
          }
        },
        debug: {
          "visible": true,
          "defaultValue": "false",
          "type": "boolean"
        }
      },
      description: `Execute actions and answer questions using AI.

   #### Key Features
  - Run actions based on AI.
  - Chain/trigger other action cards.
  - Parameterized execution.
  - Customize parameters.
  - Customize the card view (UI/render).`,
      displayIcon: false,
      displayButton: true,
      displayButtonIcon: true,
      icon: 'sparkles'
    },
    name: 'aiaction',
    id: 'base.cards.aiaction',
    templateName: 'AI Action',
    group: "base",
    tag: "cards",
  },
  {
    defaults: {
      type: 'value',
      name: 'value',
      width: 2,
      height: 7,
      icon: 'scan-eye',
      description: `Default description, edit this description to improve usability of this value`,
      params: {
        input: "input to observe"
      },
      configParams: {
        input: {
          visible: true,
          defaultValue: "",
          type: "any"
        }
      },
      rulesCode: "return params.input;\n",
    },
    name: 'Value',
    id: 'base.cards.value',
    group: "base",
    tag: "cards",
    templateName: 'Value',
  }
]

function flattenTree(obj, currentGroup = null) {
  let leaves = [];

  function traverse(node, group) {
    if (node && typeof node === 'object') {
      if (node.name) {
        leaves.push({ ...node, group: group }); // añade el grupo a cada hoja
      } else {
        for (const [key, value] of Object.entries(node)) {
          traverse(value, group ?? key); // el primer nivel se considera grupo
        }
      }
    }
  }

  traverse(obj, currentGroup);
  return leaves;
}

const fetch = async (fn) => {
  const data = await API.get({ url: '/api/core/v1/cards' })
  fn(data)
}

const useCards = (extraCards = []) => {
  const [_items, setItems] = useRemoteStateList(getPendingResult('pending'), fetch, 'notifications/card/#', CardModel, true);
  return [...extraCards, ...(_items?.data?.items ?? [])]
}

const makeDefaultCard = (tpl) => ({
  key: "key",
  width: tpl?.defaults?.type === 'value' ? 1 : 2,
  height: tpl?.defaults?.type === 'value' ? 4 : 6,
  icon: iconTable[tpl?.defaults?.type],
  html: typeCodes[tpl?.defaults?.type],
  ...tpl?.defaults,
})

function generateVersionatedName(name, existing) {
  const set = existing instanceof Set ? existing : new Set(existing);
  if (!set.has(name)) return name; // if doesn't exist, keep it

  // separate extension (doesn't count .env as extension)
  const i = name.lastIndexOf('.');
  const ext = i > 0 ? name.slice(i) : '';
  const base0 = i > 0 ? name.slice(0, i) : name;

  // only " base NUM" format at the end
  const m = /^(.*?)(?: (\d+))?$/.exec(base0);
  const base = m[1];
  let n = m[2] ? +m[2] : 1; // if no number -> start at 1 so first ++ is 2

  let candidate;
  do candidate = `${base} ${++n}${ext}`;
  while (set.has(candidate));

  return candidate;
}

export const CardSelector = ({ defaults = {}, board, addOpened, setAddOpened, onFinish, states, icons, actions, errors }) => {
  const cards = useCards(extraCards)

  const [selectedCard, setSelectedCard] = useState(null)
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [remountKey, setRemountKey] = useState(uuidv4())

  useEffect(() => {
    if (cards?.length && !selectedCard) {
      setSelectedCard(cards[0])
    }
  }, [cards, selectedCard])

  useEffect(() => {
    if (!selectedCard) return
    setCard(makeDefaultCard(selectedCard))
    setRemountKey(uuidv4())
  }, [selectedCard])

  useEffect(() => {
    if (!addOpened) return
    const tpl = selectedCard ?? cards?.[0]
    if (tpl) {
      setCard(makeDefaultCard(tpl))
    }
    setRemountKey(uuidv4())
  }, [addOpened])

  return <AlertDialog
    integratedChat
    p="$2"
    pt="$5"
    pl="$5"
    setOpen={setAddOpened}
    open={addOpened}
    hideAccept
    description=""
  >
    <YStack f={1} jc="center" ai="center">
      <XStack f={1} mr="$5">
        <Slides
          hideHeader={true}
          styles={{ f: 1, w: "90vw", maw: 1400, h: "90vh", mah: 1200 }}
          lastButtonCaption="Create"
          disabled={loading || !card}
          onFinish={async () => {
            setLoading(true)
            try {
              const existingNames = board?.cards.map(c => c.name) ?? []
              card["name"] = card.customName ?? generateVersionatedName(card.name, existingNames)
              await onFinish(card)
              setAddOpened(false)
            } catch (e) {
              console.error("Error creating card: ", e)
            }
            setLoading(false)
          }}
          slides={[
            {
              name: "Create new card",
              component: (
                <FirstSlide options={cards} selected={selectedCard} setSelected={setSelectedCard} errors={errors} />
              ),
            },
            // {
            //   name: "Configure your card",
            //   component: card ? (
            //     <SecondSlide remountKey={remountKey} board={board} states={states} icons={icons} actions={actions} card={card} setCard={setCard} errors={errors} />
            //   ) : null,
            // },
          ]}
        />
      </XStack>
    </YStack>
  </AlertDialog>
}