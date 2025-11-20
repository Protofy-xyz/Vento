import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useTabVisible } from './store/boardStore';
import { API } from 'protobase'
import { getUIPreferences, isUIPreferenceMode, mergeUIPreferences, BoardControlMode } from './utils/uiPreferences'

type PanelSide = 'right' | 'left';
export type BoardViewModePreference = 'ui' | 'board' | 'graph';
export type BoardControlMode = BoardViewModePreference | 'json';


interface Controls {
  isJSONView: boolean;
  toggleJson: () => void;

  addOpened: boolean;
  openAdd: () => void;
  setAddOpened: (value: boolean) => void;

  autopilot: boolean;
  toggleAutopilot: () => void;

  setTabVisible: (value: string) => void;
  tabVisible: string;

  viewMode: BoardControlMode;
  setViewMode: (mode: BoardControlMode) => void;

  saveJson: () => void;

  panelSide: PanelSide;
  setPanelSide: (side: PanelSide) => void;
}
const CONTROL_MODES = new Set<BoardControlMode>(['ui', 'board', 'graph', 'json']);

export const isBoardControlMode = (mode?: string): mode is BoardControlMode =>
  !!mode && CONTROL_MODES.has(mode as BoardControlMode);

const BoardControlsContext = createContext<Controls | null>(null);
export const useBoardControls = () => useContext(BoardControlsContext)!;
export const BoardControlsProvider: React.FC<{
  boardName: string;
  children: React.ReactNode;
  board: any;
  mode?: BoardControlMode;
  addMenu?: 'open' | 'closed';
  dialog?: string;
  autopilotRunning?: boolean;
  rules?: 'open' | 'closed';
}> = ({
  boardName,
  children,
  board,
  mode = 'board',
  addMenu = 'closed',
  dialog = '',
  autopilotRunning = false,
  rules = 'closed',
}) => {
  const [isJSONView, setIsJSONView] = useState(mode === 'json');
  const [addOpened, setAddOpened] = useState(addMenu === 'open');
  const [autopilot, setAutopilot] = useState(autopilotRunning);
  const [tabVisible, setTabVisible] = useTabVisible();

  const isValid = (m: string): m is BoardControlMode => isBoardControlMode(m);

  const getHashMode = () => {
    if (typeof window === 'undefined') return null;
    const h = (window.location.hash || '').slice(1);
    return isValid(h) ? (h as BoardControlMode) : null;
  };

  const readInitialMode = () => {
    const hashMode = getHashMode();
    if (hashMode) return hashMode;
    const preferred = getUIPreferences(board?.name).viewMode;
    if (isUIPreferenceMode(preferred)) {
      return preferred;
    }
    return 'graph';
  };

  const [viewMode, setViewMode] = useState<BoardControlMode>(readInitialMode);

  const userForcedRef = useRef(false);
  const hashReadyRef = useRef(false);

  const [panelSide, setPanelSide] = useState<PanelSide>(
    (board?.settings?.panelSide as PanelSide) || 'right'
  );

  const toggleJson = () => setIsJSONView(v => !v);
  const openAdd = () => setAddOpened(true);

  useEffect(() => {
    if (!board?.name) return;
    hashReadyRef.current = false;
    const hashMode = getHashMode();
    if (hashMode) {
      userForcedRef.current = true;
      setViewMode(hashMode);
    } else {
      const preferred = getUIPreferences(board.name).viewMode;
      setViewMode(isUIPreferenceMode(preferred) ? preferred : 'graph');
    }
    hashReadyRef.current = true;
  }, [board?.name]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => {
      const h = (window.location.hash || '').slice(1);
      if (isValid(h)) {
        setViewMode(h as BoardControlMode);
        userForcedRef.current = true;
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!hashReadyRef.current || typeof window === 'undefined') return;
    const current = (window.location.hash || '').slice(1);
    if (current !== viewMode) {
      history.replaceState(null, '', `#${viewMode}`);
    }
  }, [viewMode]);

  useEffect(() => {
    if (!board?.name || !isUIPreferenceMode(viewMode)) return;
    const stored = getUIPreferences(board.name).viewMode;
    if (stored === viewMode) return;
    mergeUIPreferences(board.name, { viewMode });
  }, [board?.name, viewMode]);


  useEffect(() => {
    if (!board?.settings?.showBoardUIWhilePlaying) return;
    if (userForcedRef.current) return;
    setViewMode(autopilot ? 'ui' : 'board');
  }, [autopilot, board?.settings?.showBoardUIWhilePlaying]);

  const toggleAutopilot = useCallback(async () => {
    setAutopilot(v => !v);
    await API.get(`/api/core/v1/boards/${boardName}/autopilot/${!autopilot ? 'on' : 'off'}`);
    if (board?.settings?.showBoardUIOnPlay) {
      if (!autopilot) setViewMode('ui');
      if (autopilot) setViewMode('board');
    }
  }, [boardName, autopilot, board?.settings?.showBoardUIOnPlay]);

  const saveJson = () => {};

  return (
    <BoardControlsContext.Provider value={{
      isJSONView, toggleJson,
      addOpened, openAdd, setAddOpened,
      autopilot, toggleAutopilot,
      setTabVisible, tabVisible,
      viewMode, setViewMode,
      saveJson,
      panelSide, setPanelSide,
    }}>
      {children}
    </BoardControlsContext.Provider>
  );
};