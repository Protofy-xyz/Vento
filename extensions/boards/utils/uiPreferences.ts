import { BoardViewModePreference } from "BoardControlsContext";

export type UIPreferences = {
  viewMode?: BoardViewModePreference;
  layer?: string;
};


const STORAGE_PREFIX = 'board-ui-pref:';
const VIEW_MODES = new Set<BoardViewModePreference>(['ui', 'board', 'graph']);

const hasWindow = () => typeof window !== 'undefined' && !!window.localStorage;
const prefKey = (boardName: string) => `${STORAGE_PREFIX}${boardName}`;

const safeParse = (value: string | null): UIPreferences => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

export const isUIPreferenceMode = (mode?: string): mode is BoardViewModePreference =>
  !!mode && VIEW_MODES.has(mode as BoardViewModePreference);

export const getUIPreferences = (boardName?: string): UIPreferences => {
  if (!boardName || !hasWindow()) return {};
  return safeParse(window.localStorage.getItem(prefKey(boardName)));
};

export const setUIPreferences = (boardName: string, prefs: UIPreferences) => {
  if (!boardName || !hasWindow()) return;
  try {
    window.localStorage.setItem(prefKey(boardName), JSON.stringify(prefs));
  } catch {
    // noop
  }
};

export const mergeUIPreferences = (boardName: string, updates: Partial<UIPreferences>) => {
  if (!boardName || !hasWindow()) return;
  const current = getUIPreferences(boardName);
  setUIPreferences(boardName, { ...current, ...updates });
};
