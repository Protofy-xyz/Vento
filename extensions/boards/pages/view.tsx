import { Copy, Plus, Settings, X, Book, Activity, Bot, Presentation, FileClock } from '@tamagui/lucide-icons'
import { API, getPendingResult, set } from 'protobase'
import { AdminPage } from "protolib/components/AdminPage"
import { useIsAdmin } from "protolib/lib/useIsAdmin"
import ErrorMessage from "protolib/components/ErrorMessage"
import { YStack, XStack, Paragraph, Button as TamaButton, Dialog, Theme, Spinner, Stack, H1, H3, Button } from '@my/ui'
import { computeLayout } from '@extensions/autopilot/layout';
import { DashboardGrid, gridSizes, getCurrentBreakPoint } from 'protolib/components/DashboardGrid';
import { LogPanel } from 'protolib/components/LogPanel';
import { AlertDialog } from 'protolib/components/AlertDialog';
import { CenterCard, HTMLView } from '@extensions/services/widgets'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEffectOnce, useUpdateEffect } from 'usehooks-ts'
import { Tinted } from 'protolib/components/Tinted'
import { useProtoStates } from '@extensions/protomemdb/lib/useProtoStates'
import { CardSelector } from 'protolib/components/board/CardSelector'
import { ActionCardSettings } from 'protolib/components/autopilot/ActionCardSettings'
import { useThemeSetting } from '@tamagui/next-theme'
import { Monaco } from 'protolib/components/Monaco'
import { IconContainer } from 'protolib/components/IconContainer'
import { usePageParams } from 'protolib/next'
import { usePendingEffect } from 'protolib/lib/usePendingEffect'
import { createParam } from 'solito'
import { AsyncView } from 'protolib/components/AsyncView'
import { Center } from 'protolib/components/Center'
import dynamic from 'next/dynamic'
import { BoardControlsProvider, useBoardControls } from '../BoardControlsContext'
import { BoardSettingsEditor } from '../components/BoardSettingsEditor'
import { JSONView } from 'protolib/components/JSONView'
import { FloatingWindow } from '../components/FloatingWindow'
import { useAtom } from 'protolib/lib/Atom'
import { AppState } from 'protolib/components/AdminPanel'
import { useLog } from '@extensions/logs/hooks/useLog'
import { useBoardLayer, useBoardVersion, useBoardVersionId, useLayers } from '@extensions/boards/store/boardStore'
import { useBoardVisualUI } from '../useBoardVisualUI'
import { scrollToAndHighlight } from '../utils/animations'
import { useAtom as useJotaiAtom } from 'jotai'
import { itemsAtom, automationInfoAtom, uiCodeInfoAtom, reloadBoard } from '../utils/viewUtils'
import { ActionCard } from '../components/ActionCard'
import { VersionTimeline } from '../VersionTimeline'
import { useBoardVersions, latestVersion } from '../utils/versions'
import { GraphView } from './graphView'
import { useEventEffect } from '@extensions/events/hooks'
import { getUIPreferences, mergeUIPreferences } from '../utils/uiPreferences'

const defaultCardMethod: "post" | "get" = 'post'

class ValidationError extends Error {
  errors: string[];

  constructor(errors: string[]) {
    super(errors.join('\n'));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

const saveBoard = async (boardId, data, setBoardVersion?, refresh?, opts = { bumpVersion: true }) => {
  if (__currentBoardVersion !== data.version) {
    console.error("Cannot save board, the board version has changed, please refresh the board.")
    return
  }

  try {
    if (opts.bumpVersion) {
      if (!data.version) {
        data.version = 1
      } else {
        const last = await latestVersion(boardId);
        data.version = last + 1;
      }
      data.savedAt = Date.now()
    }
    await API.post(`/api/core/v1/boards/${boardId}`, data);
    if (opts.bumpVersion && refresh) {
      refresh();
    }
    setBoardVersion && setBoardVersion(data.version)
  } catch (error) {
    console.error("Error saving board:", error);
  }
};

const checkCard = async (cards, newCard) => {
  const errors = []
  //console.log("cards: ", cards)
  //console.log("newCard: ", newCard)
  const existingCard = cards.find(item => item.name === newCard.name && item.key !== newCard.key);
  if (existingCard) {
    console.error('A card with the same name already exists')
    errors.push('A card with the same name already exists')
  }
  if (newCard.name === '') {
    console.error('Card name cannot be empty')
    errors.push('Card name cannot be empty')
  }
  const regex = /^[a-zA-Z0-9-_ ]*$/;
  if (!regex.test(newCard.name)) {
    console.error("Invalid name, only letters, numbers, spaces, - and _ are allowed.")
    errors.push("Invalid name, only letters, numbers, spaces, - and _ are allowed.")
  }
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
}

const generate_random_id = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const { useParams } = createParam()

const RulesSideMenu = dynamic(() => import('protolib/components/autopilot/RulesSideMenu').then(mod => mod.RulesSideMenu), { ssr: false })
const UISideMenu = dynamic(() => import('protolib/components/autopilot/UISideMenu').then(mod => mod.UISideMenu), { ssr: false })


const FileWidget = dynamic<any>(() =>
  import('protolib/adminpanel/features/components/FilesWidget').then(module => module.FileWidget),
  { loading: () => <Tinted><Center><Spinner size='small' color="$color7" scale={4} /></Center></Tinted> }
);

const getExecuteAction = (board, rawActions) => {
  const actions = []
  const flatten = (obj, path) => {
    if (obj.url) {
      actions.push({ ...obj, path: path })
    } else {
      for (const key in obj) {
        flatten(obj[key], path + '/' + key)
      }
    }
  }
  flatten(rawActions, '')

  return async (url_or_name, params = {}) => {
    console.log('Executing action: ', url_or_name, params);
    const action = actions.find(a => a.url === url_or_name || (a.name === url_or_name && a.path == '/boards/' + board + '/' + a.name));
    if (!action) {
      console.error('Action not found: ', url_or_name);
      return;
    }

    console.log('Action: ', action)

    if (action.receiveBoard) {
      params.board = board.name
    }
    //check if the action has configParams and if it does, check if the param is visible
    //if the param is not visible, hardcode the param value to the value in the configParams defaultValue
    if (action.configParams) {
      for (const param in action.configParams) {
        if (action.configParams[param]?.visible === false && action.configParams[param]?.defaultValue != '') {
          params[param] = action.configParams[param].defaultValue
        }
      }
    }

    if (action.method === 'post') {
      let { token, ...data } = params;
      //console.log('url: ', action.url+'?token='+token)
      const response = await API.post(action.url, data);
      if (response.isError) {
        throw new Error(JSON.stringify(response.error || 'Error executing action'));
      }
      return response.data
    } else {
      const paramsStr = Object.keys(params).map(k => k + '=' + params[k]).join('&');
      //console.log('url: ', action.url+'?token='+token+'&'+paramsStr)
      const response = await API.get(action.url + '?' + paramsStr);
      if (response.isError) {
        throw new Error(JSON.stringify(response.error || 'Error executing action'));
      }
      return response.data
    }
  }
}

const BoardStateView = ({ board }) => {
  const states = useProtoStates({}, 'states/boards/' + board.name + '/#', 'states')
  const data = states?.boards?.[board.name]
  return <XStack p={"$4"} flex={1} flexDirection="column" gap="$4" overflow="auto">
    {data && <JSONView src={data ?? {}} />}
    {!data && <Center>
      <Paragraph size="$8" o={0.4}>No states found for this board</Paragraph>
    </Center>}
  </XStack>
}

const MAX_BUFFER_MSG = 1000
const FloatingArea = ({ tabVisible, setTabVisible, board, automationInfo, boardRef, actions, states, uicodeInfo, setUICodeInfo, onEditBoard }) => {
  const { panelSide, setPanelSide } = useBoardControls() || {};
  const [logs, setLogs] = useState([])
  useLog((log) => {
    setLogs(prev => {
      const newBuffer = [log, ...prev]
      if (newBuffer.length > MAX_BUFFER_MSG) {
        return newBuffer.slice(0, MAX_BUFFER_MSG)
      }
      return newBuffer
    })
  })

  const showHistory = true
  const tabs = {
    "states": {
      "label": "States",
      "icon": Book,
      "content": <BoardStateView board={board} />
    },
    "rules": {
      "label": "Automation",
      "icon": Bot,
      "content": <XStack flex={1} padding={"$3"}>
        {automationInfo && <RulesSideMenu
          automationInfo={automationInfo}
          boardRef={boardRef}
          board={board}
          actions={actions}
          states={states}
        />}
      </XStack>
    },
    "uicode": {
      "label": "Presentation",
      "icon": Presentation,
      "content": <>
        {uicodeInfo && <UISideMenu
          onChange={(code) => {
            setUICodeInfo({ code });
          }}
          uiCode={uicodeInfo}
          boardRef={boardRef}
          board={board}
          actions={actions}
          states={states}
        />}
      </>
    },
    "logs": {
      "label": "Logs (" + logs.length + ")",
      "icon": Activity,
      "content": <LogPanel AppState={AppState} logs={logs} setLogs={setLogs} />
    },
    ...(showHistory && {
      history: {
        label: "History",
        icon: FileClock,
        content: <VersionTimeline boardId={board.name} />
      }
    }),
    "board-settings": {
      "label": "Settings",
      "icon": Settings,
      "content": <BoardSettingsEditor
        board={board}
        onSave={(updatedBoard) => {
          boardRef.current = updatedBoard;
          onEditBoard();
        }}
      />
    }
  }

  return <FloatingWindow
    key={`fw-${panelSide}`}
    visible={Object.keys(tabs).includes(tabVisible)}
    selectedTab={tabVisible}
    onChangeTab={setTabVisible}
    tabs={tabs}
    side={panelSide}
    onToggleSide={() => setPanelSide(panelSide === 'right' ? 'left' : 'right')}
    leftAnchorSelector="#app-sidemenu"
    leftAnchorGap={40}
  />
}



export const Board = ({ board, icons, forceViewMode = undefined }: { board: any, icons: any[], forceViewMode?: 'ui' | 'board' | 'graph' }) => {
  let {
    addOpened,
    setAddOpened,
    tabVisible,
    setTabVisible,
    viewMode
  } = useBoardControls() ?? {};

  const effectiveView: 'ui' | 'board' | 'graph' =
    (forceViewMode ?? viewMode ?? 'ui') as 'ui' | 'board' | 'graph';

  window['board'] = board;

  const breakpointCancelRef = useRef(null) as any
  const dedupRef = useRef() as any
  const initialized = useRef(false)

  const [items, setItems] = useState(board.cards && board.cards.length ? board.cards : []);
  const [boardCode, setBoardCode] = useState(JSON.stringify(board))
  const [graphLayout, setGraphLayout] = useState(board?.graphLayout ?? {});
  const graphLayoutRef = useRef(graphLayout);
  const layoutsEqual = useCallback((a: any, b: any) => {
    if (a === b) return true;
    if (!a || !b) return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      const av = a[k]; const bv = b[k];
      if (!bv) return false;
      if (av.x !== bv.x || av.y !== bv.y || av.layer !== bv.layer || av.parent !== bv.parent || av.type !== bv.type) return false;
    }
    return true;
  }, []);

  useEffect(() => {
    setItems(board.cards && board.cards.length ? board.cards : []);
    setBoardCode(JSON.stringify(board));
    if (!layoutsEqual(graphLayoutRef.current, board?.graphLayout ?? {})) {
      setGraphLayout(board?.graphLayout ?? {});
      graphLayoutRef.current = board?.graphLayout ?? {};
    }
    window['board'] = board;
  }, [board, layoutsEqual])

  const [availableLayers, setLayers] = useLayers();
  const [activeLayer, setActiveLayer] = useBoardLayer();
  const persistLayerBoardRef = useRef<string | null>(null);
  const activeLayerRef = useRef(activeLayer);
  activeLayerRef.current = activeLayer;

  useEffect(() => {
    const set = new Set<string>(["base"]);               // 👈 siempre incluimos base
    for (const c of items) set.add(c.layer ?? "base");

    const sorted = Array.from(set).sort((a, b) =>
      a === "base" ? -1 : b === "base" ? 1 : a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    setLayers(sorted);
  }, [items, setLayers]);

  const [globalItems, setGlobalItems] = useJotaiAtom(itemsAtom)
  const [automationInfo, setAutomationInfo] = useJotaiAtom(automationInfoAtom);
  const [uicodeInfo, setUICodeInfo] = useJotaiAtom(uiCodeInfoAtom);
  if (!initialized.current) {
    setItems(board.cards && board.cards.length ? board.cards : [])
    setAutomationInfo(null)
    setUICodeInfo(null)
    initialized.current = true
  }

  const [isDeleting, setIsDeleting] = useState(false)
  const [isApiDetails, setIsApiDetails] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [currentCard, setCurrentCard] = useState(null)
  const [editedCard, setEditedCard] = useState(null)
  const [editCode, setEditCode] = useState('')

  const [hasChanges, setHasChanges] = useState(false);

  const [errors, setErrors] = useState<string[]>([])
  // const initialBreakPoint = useInitialBreakpoint()
  const breakpointRef = useRef('') as any
  const { query, removeReplace, push } = usePageParams({})
  const isJSONView = query.json == 'true'
  const [appState, setAppState] = useAtom(AppState)

  const [tab, setTab] = useState('config')

  const [addKey, setAddKey] = useState(0)

  const { resolvedTheme } = useThemeSetting()



  const visualui = useBoardVisualUI({
    boardID: tabVisible == "visualui" ? board.name : null,
    onDismiss: () => setTabVisible(""),
    onAfterSave: ({ code }) => {
      setUICodeInfo({ code })
      setTabVisible("")
    },
  })

  const states = useProtoStates({}, 'states/boards/' + board.name + '/#', 'states')


  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const nextDuplicatedName = (existingNames: string[], currentName: string) => {
    const base = currentName.replace(/(?:\s*_)?\d+$/, '');
    const re = new RegExp(`^${escapeRegExp(base)}(?:_(\\d+))?$`);

    const maxN = existingNames.reduce((max, name) => {
      const m = name.match(re);
      if (!m) return max;
      const n = m[1] ? parseInt(m[1], 10) : 1;
      return Math.max(max, n);
    }, 0);

    return `${base}_${maxN + 1}`;
  };

  useEffect(() => {
    if (globalItems && globalItems.length) {
      setItems(globalItems)
    }
  }, [globalItems])

  useUpdateEffect(() => {
    if (addOpened) {
      setErrors([]);
    }
  }, [addOpened]);

  useUpdateEffect(() => {
    if (isEditing) {
      setErrors([]);
    }
  }, [isEditing]);

  const [boardVersion, setBoardVersion] = useBoardVersion()
  const { refresh } = useBoardVersions(board.name);
  const boardRef = useRef(board)

  //@ts-ignore store the states in the window object to be used in the cards htmls
  window['protoStates'] = states

  //@ts-ignore 
  window['protoBoardName'] = board.name

  //@ts-ignore emit an event to notify the states have changed
  window.dispatchEvent(new CustomEvent('protoStates:update', { detail: { board: board.name } }))

  //@ts-ignore store the actions in the window object to be used in the cards htmls
  const actions = useProtoStates({}, 'actions/boards/' + board.name + '/#', 'actions')
  window['protoActions'] = actions

  const getParsedJSON = (rawJson) => {
    let result = rawJson
    try {
      const parsed = JSON.parse(rawJson)
      result = JSON.stringify(parsed, null, 2)
    } catch (err) { }

    return result
  }

  useEffect(() => {
    window['executeAction'] = async (card, params) => {
      return await window['onRunListeners'][card](card, params);
    };

    window['executeActionForm'] = async (event, card) => {
      //This allows to call the action from <ActtionRunner />
      event.preventDefault();
      const formData = new FormData(event.target);
      const params = Object.fromEntries(formData['entries']());

      const cleanedParams = {};
      for (const key in params) {
        if (params[key] || params[key] === "0") {
          cleanedParams[key] = params[key];
        }
      }

      return await window['onRunListeners'][card](card, cleanedParams);
    };

  }, [])

  useEffect(() => {
    window['execute_action'] = getExecuteAction(board.name, actions)
    window['setCardData'] = (cardId, key, value) => {
      setItems(prevItems => {
        const card = prevItems.some(item => item.key === cardId);
        if (card) {
          const newItems = prevItems.map(item => {
            if (item.key === cardId) {
              return { ...item, [key]: value };
            }
            return item;
          });

          board.cards = newItems;
          saveBoard(board.name, board, setBoardVersion, refresh)
          return newItems;
        } else {
          console.error('Card not found:', cardId);
          return prevItems;
        }
      })
    }
  }, [actions])

  useEffectOnce(() => {
    reloadBoard(board.name, setItems, setBoardVersion, setAutomationInfo, setUICodeInfo)
  })

  useEffect(() => {
    boardRef.current.cards = items
  }, [items])

  useEffect(() => {
    boardRef.current.graphLayout = graphLayout
    graphLayoutRef.current = graphLayout
  }, [graphLayout])

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    if (!board?.name) return;
    const preferredLayer = getUIPreferences(board.name).layer;
    const targetLayer =
      preferredLayer && availableLayers.includes(preferredLayer) ? preferredLayer : 'base';
    const currentLayer = activeLayerRef.current;
    if (!targetLayer || targetLayer === currentLayer) return;
    setActiveLayer(targetLayer);
  }, [board?.name, availableLayers, setActiveLayer]);

  useEffect(() => {
    if (!board?.name || !activeLayer) return;
    const boardChanged = persistLayerBoardRef.current !== board.name;
    persistLayerBoardRef.current = board.name;
    if (boardChanged) return;
    const storedLayer = getUIPreferences(board.name).layer ?? 'base';
    if (storedLayer === activeLayer) return;
    mergeUIPreferences(board.name, { layer: activeLayer });
  }, [board?.name, activeLayer]);


  const deleteCard = async (card) => {
    const newItems = items.filter(item => item.key != card.key)
    // if (newItems.length == 0) newItems.push(addCard) // non necessary
    setItems(newItems)
    boardRef.current.cards = newItems
    await saveBoard(board.name, boardRef.current, setBoardVersion, refresh)
    setIsDeleting(false)
    setCurrentCard(null)
  }

  const deleteCardsByName = useCallback(async (targets: string[]) => {
    if (!targets.length) return;

    const newItems = items.filter((item) => !targets.includes(item.name));
    if (newItems.length === items.length) return;

    setItems(newItems);
    boardRef.current.cards = newItems;

    const nextLayout = { ...(graphLayoutRef.current || {}) };
    let layoutChanged = false;
    targets.forEach((name) => {
      if (nextLayout[name]) {
        delete nextLayout[name];
        layoutChanged = true;
      }
    });
    if (layoutChanged) {
      setGraphLayout(nextLayout);
      graphLayoutRef.current = nextLayout;
      boardRef.current.graphLayout = nextLayout;
    }

    await saveBoard(board.name, boardRef.current, setBoardVersion, refresh);
  }, [items, board.name, setBoardVersion, refresh]);

  const layouts = useMemo(() => {
    // return {
    //   lg: computeLayout(items, { totalCols: 24, normalW: 8, normalH: 6, doubleW: 8, doubleH: 6 }, { layout: board?.layouts?.lg }),
    //   md: computeLayout(items, { totalCols: 24, normalW: 10, normalH: 6, doubleW: 10, doubleH: 6 }, { layout: board?.layouts?.md }),
    //   sm: computeLayout(items, { totalCols: 2, normalW: 2, normalH: 6, doubleW: 2, doubleH: 6 }, { layout: board?.layouts?.sm }),
    //   xs: computeLayout(items, { totalCols: 1, normalW: 1, normalH: 6, doubleW: 1, doubleH: 6 }, { layout: board?.layouts?.sm }),
    // }
    const lyt = {}
    Object.keys(gridSizes).forEach(key => {
      lyt[key] = computeLayout(items || [], gridSizes[key], { layout: boardRef.current?.layouts[key] ?? board?.layouts[key] });
    });
    return lyt
  }, [items, board?.layouts])

  boardRef.current.layouts = layouts

  const addWidget = async (card) => {
    try {
      await checkCard(boardRef.current?.cards, card)
      setErrors([]); // Clear errors if validation passes
    } catch (e) {
      if (e instanceof ValidationError) {
        setErrors(e.errors);
      } else {
        console.error('Error checking card:', e);
        setErrors(['An unexpected error occurred while checking the card.']);
      }
      throw new Error(e)
    }

    const uniqueKey = card.type + '_' + Date.now();
    const newCard = { ...card, key: uniqueKey, layer: card.layer ?? activeLayer }
    const newItems = [...boardRef.current?.cards, newCard].filter(item => item.key !== 'addwidget');
    setItems(newItems)
    boardRef.current.cards = newItems;
    await saveBoard(board.name, boardRef.current, setBoardVersion, refresh);

    // animate to the bottom
    setTimeout(() => {
      scrollToAndHighlight(document.getElementById(uniqueKey), {
        duration: 1300,
        color: 'var(--color6)',
        ring: 2,
      });
    }, 500);
  };

  const setCardContent = (key, content) => {
    setItems(prevItems => {
      try {
        const newItems = prevItems.map(item => {
          if (item.key === key || item.name === key) {
            return { ...item, ...content };
          }
          return item;
        });
        boardRef.current.cards = newItems
        return newItems
      } catch (err) {
        return prevItems
      }
    })

    saveBoard(board.name, boardRef.current, setBoardVersion, refresh);
  }

  const onEditBoard = async () => {
    try {
      await saveBoard(board.name, boardRef.current, setBoardVersion, refresh)
    } catch (err) {
      alert('Error editing board')
    }
  }

  const persistGraphLayout = useCallback((nextLayout) => {
    const safeLayout = nextLayout || {};
    if (layoutsEqual(safeLayout, graphLayoutRef.current)) return;
    graphLayoutRef.current = safeLayout;
    setGraphLayout(safeLayout);
    boardRef.current.graphLayout = safeLayout;
    saveBoard(board.name, boardRef.current, setBoardVersion, refresh, { bumpVersion: false });
  }, [board.name, setBoardVersion, refresh, layoutsEqual]);

  //fill items with react content, addWidget should be the last item
  const cards = (items || []).map((item) => {
    if (item.type == 'addWidget') {
      return {
        ...item,
        content: <CenterCard title={"Add new card"} id={item.key}>
          <YStack alignItems="center" justifyContent="center" f={1} width="100%" opacity={1}>
            <YStack
              bc={"$gray7"}
              f={1}
              w={"100%"}
              p="$2"
              pressStyle={{ bg: '$gray8' }}
              borderRadius="$5"
              hoverStyle={{ opacity: 0.75 }}
              alignItems='center'
              justifyContent='center'
              className="no-drag"
              cursor="pointer"
              bw={1}
              onPress={() => setAddOpened(true)}
            >
              <Plus col={"$gray10"} size={60} />
            </YStack>
          </YStack>
        </CenterCard>
      }
    } else {
      return {
        ...item,
        content: <ActionCard
          board={board}
          data={item}
          states={states?.boards?.[board.name]?.[item.name]}
          html={item.html}
          displayResponse={item.displayResponse}
          name={item.name}
          color={item.color}
          icon={item.icon ? (item.html ? item.icon : '/public/icons/' + item.icon + '.svg') : undefined}
          id={item.key}
          title={item.name}
          params={item.params}
          containerProps={item.containerProps}
          onCopy={() => {
            const newName = nextDuplicatedName(
              boardRef.current.cards.map(c => c.name),
              item.name
            );

            const newCard = {
              ...item,
              key: item.key.replace(/_vento_copy_.+$/, '') + '_vento_copy_' + generate_random_id(),
              name: newName
            };
            const newItems = [...boardRef.current.cards, newCard].filter(i => i.key !== 'addwidget');
            boardRef.current.cards = newItems;
            // duplicate also the item layout to respect size and position
            Object.keys(boardRef.current.layouts || {}).forEach(bp => {
              if (boardRef.current.layouts[bp]) {
                boardRef.current.layouts[bp].push({
                  ...boardRef.current.layouts[bp].find(l => l.i === item.key),
                  i: newCard.key,
                })
              }
            })
            setItems(newItems);
            saveBoard(board.name, boardRef.current, setBoardVersion, refresh);
          }}
          onDelete={() => {
            setIsDeleting(true);
            setCurrentCard(item);
          }}
          onEdit={(tab) => {
            setTab(tab)
            setIsEditing(true);
            setCurrentCard(item);
            setEditedCard(item);
          }}
          onDetails={() => {
            setCurrentCard(item);
            setIsApiDetails(true);
            const url = `/api/core/v1/boards/${board.name}/actions/${item.name}`;
          }}
          onEditCode={() => {
            setEditCode(item.sourceFile)
          }}

          setData={(data, id) => {
            setCardContent(id, data)
            console.log('setData called with:', data, id);
          }}

          value={states?.boards?.[board.name]?.[item.name] ?? undefined}
          onRun={async (name, params) => {
            if (defaultCardMethod === 'post') {
              return (await API.post(`/api/core/v1/boards/${board.name}/actions/${name}`, params)).data;
            } else {
              const paramsStr = Object.keys(params ?? {}).map(key => key + '=' + encodeURIComponent(params[key])).join('&');
              return (await API.get(`/api/core/v1/boards/${board.name}/actions/${name}?${paramsStr}`)).data;
            }
          }}
        />
      };
    }
  })

  const params = currentCard?.params || {};
  const configParams = currentCard?.configParams || {};
  const executeActionURL = document?.location?.origin + `/api/core/v1/boards/${board.name}/cards/${currentCard?.name}/run?${Object.keys(params ?? {}).map(key => key + '=' + encodeURIComponent(configParams[key]?.defaultValue || params[key])).join('&')}&token=${currentCard?.tokens?.run || ''}`
  const getValueURL = document?.location?.origin + `/api/core/v1/boards/${board.name}/cards/${currentCard?.name}?token=${currentCard?.tokens?.read || ''}`;
  const hasTokens = currentCard?.tokens && Object.keys(currentCard.tokens).length > 0;
  const apiInfo = (
    <Stack>

      {hasTokens ? (
        <YStack space="$4">
          <Paragraph fontSize="$4" mb="$2">
            To read card content, use the following API endpoint:
          </Paragraph>
          <XStack
            ai="center"
            jc="space-between"
            p="$3"
            br="$4"
            backgroundColor="$backgroundStrong"
            gap="$3"
          >
            <Paragraph fontFamily="monospace" fontSize="$2" selectable>
              {getValueURL}
            </Paragraph>
            <TamaButton
              size="$2"
              chromeless
              icon={Copy}
              onPress={() => navigator.clipboard.writeText(getValueURL)}
            />
          </XStack>

          <Paragraph fontSize="$4" mt="$4" mb="$2">
            To execute the card, use:
          </Paragraph>
          <XStack
            ai="center"
            jc="space-between"
            p="$3"
            br="$4"
            backgroundColor="$backgroundStrong"
            gap="$3"
          >
            <Paragraph
              fontFamily="monospace"
              fontSize="$2"
              selectable
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {executeActionURL}
            </Paragraph>
            <TamaButton
              size="$2"
              chromeless
              icon={Copy}
              onPress={() =>
                navigator.clipboard.writeText(executeActionURL)
              }
            />
          </XStack>

        </YStack>
      ) : (
        <Paragraph fontSize="$4" mb="$2">
          This card does not have API access enabled.
        </Paragraph>
      )}
    </Stack>
  );

  const saveCard = async () => {
    const newItems = items.map(item =>
      item.key === currentCard.key ? editedCard : item
    );

    try {
      await checkCard(newItems, editedCard);
      setErrors([]);
      setItems(newItems);
      boardRef.current.cards = newItems;
      await saveBoard(board.name, boardRef.current, setBoardVersion, refresh);
      setCurrentCard(editedCard);
      setEditedCard(editedCard);
      setHasChanges(false);
    } catch (e) {
      if (e instanceof ValidationError) {
        setErrors(e.errors);
      } else {
        console.error('Error checking card:', e);
        setErrors(['An unexpected error occurred while checking the card.']);
      }
    }
  };


  const closeEdition = () => {
    setIsEditing(false);
    setCurrentCard(null);
    setEditedCard(null);
    setErrors([]);
    setHasChanges(false);
  }

  const closeDialog = (
    <AlertDialog
      open={showUnsavedDialog}
      setOpen={setShowUnsavedDialog}
      title="Unsaved changes"
      description="You have unsaved changes. Do you want to save them before closing?"
      hideAccept
    >
      <YStack width="100%" ai="center" gap="$4" mt="$3">
        <XStack gap="$3" jc="center" width="100%">
          <Button flex={1} onPress={() => setShowUnsavedDialog(false)}>
            Cancel
          </Button>

          <Button flex={1} onPress={() => { setShowUnsavedDialog(false); closeEdition(); }} borderRadius="$4" >
            Don't Save
          </Button>

          <Tinted>
            <Button flex={1} color="white" backgroundColor="$color6" borderRadius="$4" onPress={async () => { await saveCard(); setShowUnsavedDialog(false); closeEdition(); }}  >
              Save
            </Button>
          </Tinted>

        </XStack>
      </YStack>
    </AlertDialog>)

  const isGraphView = effectiveView === 'graph'

  return (
    <YStack flex={1} backgroundImage={board?.settings?.backgroundImage ? `url(${board.settings.backgroundImage})` : undefined} backgroundSize='cover' backgroundPosition='center'>

      <CardSelector key={addKey} board={board} addOpened={addOpened} setAddOpened={setAddOpened} onFinish={addWidget} states={states} icons={icons} actions={actions} errors={errors} />
      {closeDialog}
      <AlertDialog
        acceptButtonProps={{ color: "white", backgroundColor: "$red9" }}
        p="$5"
        acceptCaption="Delete"
        setOpen={setIsDeleting}
        open={isDeleting}
        onAccept={async (seter) => {
          await deleteCard(currentCard)
        }}
        acceptTint="red"
        title={`Delete "${currentCard?.name}"`}
        description={"Are you sure you want to delete this card?"}
      >
      </AlertDialog>

      <AlertDialog
        acceptButtonProps={{ color: "white", backgroundColor: "$color6" }}
        p="$5"
        acceptCaption="Close"
        setOpen={setIsApiDetails}
        open={isApiDetails}
        onAccept={() => setIsApiDetails(false)}
        title={`Api Details for "${currentCard?.name}"`}
        description={apiInfo}
      />
      <Theme reset>
        <Dialog
          modal
          open={isEditing}
          onOpenChange={(open) => {
            if (!open) {
              const hasRealChanges =
                editedCard && currentCard &&
                JSON.stringify(editedCard) !== JSON.stringify(currentCard);
              if (hasRealChanges) {
                setShowUnsavedDialog(true);
              } else {
                closeEdition();
              }
            } else {
              setIsEditing(true);
            }
          }}
        >
          <Dialog.Portal zIndex={100000} overflow='hidden'>
            <Dialog.Overlay />
            <Dialog.Content
              bordered
              elevate
              animateOnly={['transform', 'opacity']}
              enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
              exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
              gap="$4"
              p="$0"
              w={"90vw"}
              bc="$bgContent"
              h={"95vh"}
              maw={1600}
            >
              <ActionCardSettings
                board={board}
                actions={actions}
                states={states}
                icons={icons}
                card={currentCard}
                tab={tab}
                onSave={saveCard}
                onEdit={(data) => {
                  setEditedCard(data);
                  setHasChanges(true);
                }}
                onClose={() => {
                  saveCard()
                  closeEdition();
                }}
                errors={errors}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      </Theme>

      <Theme reset>
        <Dialog modal open={editCode} onOpenChange={setEditCode}>
          <Dialog.Portal zIndex={100000} overflow='hidden'>
            <Dialog.Overlay />
            <Dialog.Content
              bordered
              elevate
              animateOnly={['transform', 'opacity']}
              enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
              exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
              gap="$4"
              w={"90vw"}
              h={"95vh"}
              maw={1600}
            >
              <FileWidget
                masksPath={'/workspace/actions'}
                id={"file-widget-" + editCode}
                hideCloseIcon={false}
                isModified={true}
                setIsModified={() => { }}
                icons={[
                  <IconContainer onPress={() => {
                    setEditCode('')
                  }}>
                    <X color="var(--color)" size={"$1"} />
                  </IconContainer>
                ]}
                currentFileName={editCode.split && editCode.split('/').pop()}
                currentFile={editCode}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      </Theme>

      <XStack f={1}>
        <YStack f={1}>
          {
            isJSONView
              ? <Monaco
                language='json'
                darkMode={resolvedTheme === 'dark'}
                sourceCode={getParsedJSON(boardCode)}
                onChange={setBoardCode}
                options={{
                  formatOnPaste: true,
                  formatOnType: true
                }}
              />
              : isGraphView ? <GraphView
                cards={cards}
                layout={graphLayout}
                onLayoutChange={persistGraphLayout}
                activeLayer={activeLayer}
                onSelectLayer={(layer) => setActiveLayer(layer)}
                onDeleteNodes={deleteCardsByName}
              /> : <YStack f={1} p={"$6"}>{cards.length > 0 && items !== null ? <DashboardGrid
                extraScrollSpace={50}
                items={cards}
                settings={board.settings}
                layouts={boardRef.current.layouts}
                onWidthChange={(newLayoutWidth) => {
                  breakpointRef.current = getCurrentBreakPoint(newLayoutWidth)
                }}
                onLayoutChange={(layout, layouts) => {
                  if (breakpointCancelRef.current == breakpointRef.current) {
                    breakpointCancelRef.current = null
                    return
                  }

                  //small dedup to avoid multiple saves in a short time
                  if (JSON.stringify(boardRef.current.layouts[breakpointRef.current]) == JSON.stringify(layout)) {
                    return
                  }

                  clearTimeout(dedupRef.current)
                  dedupRef.current = setTimeout(() => {
                    const bp = breakpointRef.current;
                    const prev = boardRef.current.layouts[bp] || [];
                    const next = layout;
                    const merged = [
                      ...prev.filter((oldItem) => !next.find((newItem) => newItem.i === oldItem.i)),
                      ...next,
                    ];
                    boardRef.current.layouts[bp] = merged;


                    saveBoard(board.name, boardRef.current, setBoardVersion, refresh, { bumpVersion: false })
                  }, 100)
                }}
                onBreakpointChange={(bp) => {
                  clearInterval(dedupRef.current)
                  console.log('Breakpoint changed to: ', bp)
                  breakpointRef.current = bp
                  //after changing breakpoint a onLaoutChange is triggered but its not necessary to save the layout
                  breakpointCancelRef.current = bp
                  setTimeout(() => {
                    breakpointCancelRef.current = null //reset the cancel flag after 1 second
                  }, 1000)
                }}
              /> : (items !== null ? <YStack f={1} top={-100} ai="center" jc="center" gap="$5" o={0.1} className="no-drag">
                {/* <Scan size="$15" /> */}
                <H1>{board.name} is empty</H1>
                <H3>Click on the + button to add a new card</H3>
              </YStack> : null)}</YStack>
          }
        </YStack>
        <HTMLView
          style={{
            display: effectiveView === 'ui' ? 'block' : 'none',
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--bgContent)',
          }}
          html={uicodeInfo?.code ?? ''}
          data={{ board, state: states?.boards?.[board.name] }}
          setData={(data) => console.log('set data from board', data)}
        />
        <FloatingArea tabVisible={tabVisible} setTabVisible={setTabVisible} board={board} automationInfo={automationInfo} boardRef={boardRef} actions={actions} states={states} uicodeInfo={uicodeInfo} setUICodeInfo={setUICodeInfo} onEditBoard={onEditBoard} />
        <YStack
          position={"fixed" as any}
          left={0}
          height="100vh"
          width="100vw"
          display={tabVisible === 'visualui' ? 'flex' : 'none'}
        >
          {visualui}
        </YStack>
      </XStack>
    </YStack>
  )
}

const BoardViewLoader = ({ workspace, boardData, iconsData, params, pageSession }) => {
  //console.log('BoardViewLoader', boardData, iconsData, params)
  return <AsyncView ready={boardData.status != 'loading' && iconsData.status != 'loading'}>
    <BoardControlsProvider board={boardData?.data} autopilotRunning={boardData?.data?.autopilot} boardName={params.board} >
      <BoardViewAdmin
        params={params}
        pageSession={pageSession}
        workspace={workspace}
        boardData={boardData}
        iconsData={iconsData}
      />
    </BoardControlsProvider>
  </AsyncView>
}

let __currentBoardVersion = null //hack to prevent setTImeouts in the board to affect past loaded boards when switching between versions

export const BoardViewAdmin = ({ params, pageSession, workspace, boardData, iconsData }) => {
  const {
    toggleJson,
    saveJson,
    toggleAutopilot,
    openAdd,
    setTabVisible,
    tabVisible,
    viewMode,
    setViewMode
  } = useBoardControls();

  const setModeAndHash = (mode: 'ui' | 'board' | 'graph') => {
    setViewMode(mode); // el efecto de arriba sincroniza el hash
  };

  const [boardVersionId] = useBoardVersionId();

  const onFloatingBarEvent = (event) => {
    if (event.type === 'toggle-rules') {
      setTabVisible(tabVisible === 'rules' ? "" : 'rules');
    }
    if (event.type === 'toggle-history') {
      setTabVisible(tabVisible === 'history' ? "" : 'history');
    }
    if (event.type === 'toggle-logs') {
      setTabVisible(tabVisible === 'logs' ? "" : 'logs');
    }
    if (event.type === 'toggle-states') {
      setTabVisible(tabVisible === 'states' ? "" : 'states');
    }
    if (event.type === 'toggle-uicode') {
      setTabVisible(tabVisible === 'uicode' ? "" : 'uicode');
    }
    if (event.type === 'toggle-visualui') {
      setTabVisible(tabVisible === 'visualui' ? "" : 'visualui');
    }
    if (event.type === 'toggle-json') {
      toggleJson();
    }
    if (event.type === 'save-json') {
      saveJson();
    }
    if (event.type === 'toggle-autopilot') {
      toggleAutopilot();
    }
    if (event.type === 'open-add') {
      openAdd();
    }
    if (event.type === 'board-settings') {
      setTabVisible(tabVisible === 'board-settings' ? "" : 'board-settings');
    }
    if (event.type === 'mode-ui') setModeAndHash('ui');
    if (event.type === 'mode-board') setModeAndHash('board');
    if (event.type === 'mode-graph') setModeAndHash('graph');
  }

  __currentBoardVersion = boardData?.data?.version

  if (params?.mode === 'ui') {
    if (boardData.status == 'error') {
      return <ErrorMessage
        msg="Error loading board"
        details={boardData.error.error}
      />
    }
    if (boardData.status == 'loaded') {
      return <Board forceViewMode={'ui'} key={boardData?.data?.name + '_' + boardVersionId} board={boardData.data} icons={iconsData.data?.icons} />;
    }
    return null;
  }

  return <AdminPage
    title={params.board + " board"}
    workspace={workspace}
    pageSession={pageSession}
    onActionBarEvent={onFloatingBarEvent}
    actionBar={{ visible: tabVisible != 'visualui' && params?.mode !== 'ui' }}
  >
    {boardData.status == 'error' && <ErrorMessage
      msg="Error loading board"
      details={boardData.error.error}
    />}
    {boardData.status == 'loaded' && <Board forceViewMode={params.view} key={boardData?.data?.name + '_' + boardVersionId} board={boardData.data} icons={iconsData.data?.icons} />}
  </AdminPage>
}

export const BoardView = ({ workspace, pageState, initialItems, itemData, pageSession, extraData, board, icons }: any) => {
  const { params } = useParams()
  const [boardData, setBoardData] = useState(board ?? getPendingResult('pending'))
  const { refresh } = useBoardVersions(params.board)
  const [boardVersionId] = useBoardVersionId();

  const versionChanged = async () => {
    __currentBoardVersion = null
    if (boardVersionId) {
      const result = await API.get({ url: `/api/core/v1/boards/${params.board}/` })
      if (!result.isError) {
        setBoardData(result)
      }
    }
  }

  useUpdateEffect(() => {
    versionChanged()
  }, [boardVersionId])

  usePendingEffect((s) => { API.get({ url: `/api/core/v1/boards/${params.board}/` }, s) }, setBoardData, board)
  useEffect(() => {
    refresh(true)
  }, [params.board])

  const [iconsData, setIconsData] = useState(icons ?? getPendingResult('pending'))
  usePendingEffect((s) => { API.get({ url: `/api/core/v1/icons` }, s) }, setIconsData, icons)
  useIsAdmin(() => '/workspace/auth/login?return=' + document?.location?.pathname + (document?.location?.search ?? ''))

  useEventEffect((payload, msg) => {
    const boardInfo = msg?.parsed?.payload?.data
    console.log('Received board update event for board: ', boardInfo.name)
    setBoardData({
      status: 'loaded',
      data: boardInfo
    })
  }, { path: 'boards/update/' + params.board })

  return (
    <BoardViewLoader
      workspace={workspace}
      boardData={boardData}
      iconsData={iconsData}
      params={params}
      pageSession={pageSession}
    />
  )
}
