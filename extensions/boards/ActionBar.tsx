import { X, Save, Plus, Pause, Play, Workflow, Settings, Presentation, LayoutDashboard, Book, Code, UserPen, Bot, Undo, Redo, FileClock, Layers, Activity, Diamond, } from 'lucide-react';
import { useBoardControls } from './BoardControlsContext';
import { ActionBarButton, ActionBarSelector } from 'protolib/components/ActionBarWidget';
import { Separator } from '@my/ui';
import { useSubscription } from 'protolib/lib/mqtt';
import { useEffect, useRef, useState } from 'react';
import { useBoardVersions } from './utils/versions';
import { useSearchParams } from 'next/navigation';
import { useBoardLayer, useBoardVersion, useLayers } from './store/boardStore';

const AutopilotButton = ({ generateEvent, autopilot }) => <ActionBarButton
  tooltipText={autopilot ? "Pause Autopilot" : "Play Autopilot"}
  beating={autopilot}
  fill={true}
  Icon={autopilot ? Pause : Play}
  iconProps={{ ml: autopilot ? 0 : 2, fill: "var(--bgPanel)", color: "var(--bgPanel)" }}
  onPress={() => generateEvent({ type: "toggle-autopilot" })}
  hoverStyle={{ scale: 1.05 }}
  bc={autopilot ? 'var(--color8)' : "var(--color)"}
  br={"$20"}
/>

const ModeMenu = ({ viewMode, setViewMode }: {
  viewMode: 'board' | 'ui' | 'json' | 'graph';
  setViewMode: (m: 'board' | 'ui' | 'json' | 'graph') => void;
}) => {

  const modes = [
    { key: 'graph', label: 'Graph', icon: Workflow },
    { key: 'board', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'ui', label: 'Presentation', icon: Presentation },
  ];

  const CurrentIcon =
    viewMode === 'ui' ? Presentation : viewMode === 'graph' ? Workflow : LayoutDashboard;

  return <ActionBarSelector
    options={modes}
    onValueChange={(mode) => {
      setViewMode(mode);
    }}
    value={viewMode}
    tooltipText="View mode"
    Icon={CurrentIcon}
  />
};

const LayersButton = ({ layers, activeLayer, setActiveLayer }) => {

  if (!layers || layers.length <= 1) return null;

  return <ActionBarSelector
    options={layers.map((layer) => ({ key: layer, icon: Diamond }))}
    onValueChange={(layer) => setActiveLayer(layer)}
    value={activeLayer}
    tooltipText="Layers"
    Icon={Layers}
  />
};

const LogsButton = ({ selected, onPress, showDot }: { selected: boolean; onPress: () => void; showDot: boolean }) => (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <ActionBarButton tooltipText="Logs" selected={selected} Icon={Activity} onPress={onPress} />
    {showDot && (
      <span
        aria-label="hay errores recientes"
        style={{
          position: 'absolute',
          top: 2,
          right: 2,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'red',
          boxShadow: '0 0 0 2px var(--bgPanel)',
        }}
      />
    )}
  </div>
);

function useBoardId() {
  let param: string | null = null;
  try {
    const sp = useSearchParams?.();
    param = sp?.get('board') ?? null;
  } catch {
    // noop
  }
  const [id, setId] = useState<string | null>(param);
  useEffect(() => {
    if (param !== null) return;
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setId(sp.get('board'));
  }, [param]);
  return id;
}

const getActionBar = (generateEvent) => {
  const boardId = useBoardId();
  const [boardVersion] = useBoardVersion();
  const [layers] = useLayers();
  const [activeLayer, setActiveLayer] = useBoardLayer();
  console.log("ActionBar - layers:", layers);
  const current = boardVersion

  const { canUndo, canRedo, undo, redo, goToVersion } = useBoardVersions(boardId || undefined);
  //console.log("*********ActionBar - boardId:", boardId, "canUndo:", canUndo, "canRedo:", canRedo, "currentVersion:", current);

  // Suscripción a errores nivel 50
  const coreError = useSubscription('logs/core/50');
  const apiError = useSubscription('logs/api/50');

  // Estado/temporizador del indicador
  const [showLogsDot, setShowLogsDot] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerDot = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowLogsDot(true);
    timeoutRef.current = setTimeout(() => setShowLogsDot(false), 10_000); // 10s
  };

  useEffect(() => {
    if (!coreError?.onMessage) return;
    const unsubscribe = coreError.onMessage((_msg: any) => {
      // cualquier mensaje en logs/core/50 es un error nivel 50
      triggerDot();
      // opcional: console.log("Core error message received:", _msg);
    });
    return () => unsubscribe?.();
  }, [coreError?.onMessage]);

  useEffect(() => {
    if (!apiError?.onMessage) return;
    const unsubscribe = apiError.onMessage((_msg: any) => {
      // cualquier mensaje en logs/api/50 es un error nivel 50
      triggerDot();
      // opcional: console.log("API error message received:", _msg);
    });
    return () => unsubscribe?.();
  }, [apiError?.onMessage]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  const [, setBoardVersion] = useBoardVersion();

  const { isJSONView, autopilot, setViewMode, viewMode, tabVisible } = useBoardControls();

  // Utils para no disparar atajos cuando escribes en inputs/textarea/etc.
  const isEditableTarget = (t: EventTarget | null) => {
    if (!(t instanceof HTMLElement)) return false;
    const tag = t.tagName.toLowerCase();
    if (t.isContentEditable) return true;
    if (['input', 'textarea', 'select'].includes(tag)) return true;
    // Evita capturar si el foco está en controles clicables/teclables
    if (tag === 'button' || tag === 'a' || t.getAttribute('role') === 'button' || t.getAttribute('role') === 'textbox') {
      return true;
    }
    return false;
  };

  // useEffect(() => {
  //   if (isJSONView) return;

  //   const onKeyDown = (e: KeyboardEvent) => {
  //     if (e.repeat) return;
  //     if (isEditableTarget(e.target)) return;

  //     if (e.code === 'Space' || e.key === ' ') {
  //       e.preventDefault(); // evita scroll de la página con espacio
  //       generateEvent({ type: 'toggle-autopilot' });
  //       return;
  //     }

  //     if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !e.altKey) {
  //       e.preventDefault();
  //       generateEvent({ type: 'open-add' });
  //       return;
  //     }
  //   };

  //   window.addEventListener('keydown', onKeyDown);
  //   return () => window.removeEventListener('keydown', onKeyDown);
  //   // deps: si cambian estas, re-registra el handler
  // }, [isJSONView, generateEvent]);

  const toggleUndoRedoButtons = true
  const undoRedoButtons = toggleUndoRedoButtons ? [<ActionBarButton
    tooltipText={canUndo ? `Undo${current != null ? ` (→ v${Number(current) - 1})` : ''}` : 'No Undo Available'}
    Icon={Undo}
    disabled={!boardId || !canUndo}
    onPress={async () => {
      try {
        await undo?.();
      } catch (e) { console.error(e); }
    }}
  />,
  <ActionBarButton
    tooltipText={canRedo ? `Redo${current != null ? ` (→ v${Number(current) + 1})` : ''}` : 'No Redo Available'}
    Icon={Redo}
    disabled={!boardId || !canRedo}
    onPress={async () => {
      try {
        await redo?.();
      } catch (e) { console.error(e); }
    }}
  />,
  ] : []

  const historyVersion = [<ActionBarButton
    tooltipText={tabVisible == "history" ? "Close History" : "Open History"}
    selected={tabVisible == "history"}
    Icon={FileClock}
    disabled={!boardId}
    onPress={() => generateEvent({ type: "toggle-history" })}
  />,
  ]
  const bars = {
    'JSONView': [
      <ActionBarButton Icon={X} iconProps={{ color: 'var(--gray9)' }} onPress={() => generateEvent({ type: "toggle-json" })} />,
      <ActionBarButton Icon={Save} onPress={() => generateEvent({ type: "save-json" })} />
    ],
    'BoardView': [
      <ActionBarButton tooltipText="Add" Icon={Plus} onPress={() => generateEvent({ type: "open-add" })} />,
      ...undoRedoButtons,
      ...historyVersion,
      <ActionBarButton tooltipText={tabVisible == "rules" ? "Close Automations" : "Open Automations"} selected={tabVisible == "rules"} Icon={Bot} onPress={() => generateEvent({ type: "toggle-rules" })} />,
      <AutopilotButton generateEvent={generateEvent} autopilot={autopilot} />,
      <ActionBarButton tooltipText={tabVisible == "states" ? "Close States" : "Open States"} selected={tabVisible == "states"} Icon={Book} onPress={() => generateEvent({ type: "toggle-states" })} />,
      <LogsButton selected={tabVisible == "logs"} showDot={showLogsDot} onPress={() => generateEvent({ type: "toggle-logs" })} />,
      <ActionBarButton tooltipText="Agent Settings" selected={tabVisible == "board-settings"} Icon={Settings} onPress={() => generateEvent({ type: "board-settings" })} />,
      <LayersButton layers={layers} activeLayer={activeLayer} setActiveLayer={setActiveLayer} />,
      <>
        <Separator vertical borderColor="var(--gray7)" h="30px" />
        <ModeMenu viewMode={viewMode} setViewMode={setViewMode} />
      </>,
    ],
    'uiView': [
      <ActionBarButton tooltipText="Code" selected={tabVisible == "uicode"} Icon={Code} onPress={() => generateEvent({ type: "toggle-uicode" })} />,
      <ActionBarButton tooltipText={"Visual UI (Beta)"} selected={tabVisible == "visualui"} Icon={UserPen} onPress={() => generateEvent({ type: "toggle-visualui" })} />,
      <ActionBarButton tooltipText={tabVisible == "states" ? "Close States" : "Open States"} selected={tabVisible == "states"} Icon={Book} onPress={() => generateEvent({ type: "toggle-states" })} />,
      <AutopilotButton generateEvent={generateEvent} autopilot={autopilot} />,
      <>
        <Separator vertical borderColor="var(--gray8)" h="30px" ml="$2.5" />
        <ModeMenu viewMode={viewMode} setViewMode={setViewMode} />
      </>,
    ]
  };

  return isJSONView
    ? bars['JSONView']
    : viewMode === 'ui' ? bars['uiView'] : bars['BoardView'];
};

export default getActionBar;
