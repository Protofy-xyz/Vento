import { createContext, useContext, useEffect, useState } from 'react';
import { configClass, varsClass } from 'folds';
import { onDarkFontWeight, onLightFontWeight } from '../../config.css';
import { ventoDarkTheme, ventoLightTheme } from '../../colors.css';

export enum ThemeKind {
  Light = 'light',
  Dark = 'dark',
}

export type Theme = {
  id: string;
  kind: ThemeKind;
  classNames: string[];
  tamaguiClass: string; // Clase para activar variables de Tamagui
};

// Tema Vento Dark - Hereda colores de Tamagui
export const VentoDarkTheme: Theme = {
  id: 'vento-dark',
  kind: ThemeKind.Dark,
  classNames: ['vento-theme', ventoDarkTheme, onDarkFontWeight, 'prism-dark'],
  tamaguiClass: 't_dark',
};

// Tema Vento Light - Hereda colores de Tamagui
export const VentoLightTheme: Theme = {
  id: 'vento-light',
  kind: ThemeKind.Light,
  classNames: ['vento-theme', ventoLightTheme, onLightFontWeight, 'prism-light'],
  tamaguiClass: 't_light',
};

const THEME_STORAGE_KEY = 'vento_theme_preference';

// Detectar tema del sistema via media query
function getSystemTheme(): ThemeKind {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? ThemeKind.Dark 
      : ThemeKind.Light;
  }
  return ThemeKind.Dark;
}

// Leer tema de URL, localStorage, o sistema
function getStoredTheme(): ThemeKind {
  if (typeof window !== 'undefined') {
    // Primero revisar URL
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    
    if (themeParam === 'light' || themeParam === 'dark') {
      // Guardar preferencia
      localStorage.setItem(THEME_STORAGE_KEY, themeParam);
      return themeParam === 'light' ? ThemeKind.Light : ThemeKind.Dark;
    }
    
    // Si no hay param, revisar localStorage
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light') return ThemeKind.Light;
    if (stored === 'dark') return ThemeKind.Dark;
    
    // Si no hay nada guardado, usar tema del sistema
    return getSystemTheme();
  }
  
  return ThemeKind.Dark;
}

// Función para aplicar tema al DOM
function applyThemeToDOM(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove('t_dark', 't_light');
  html.classList.add(theme.tamaguiClass);
  
  // También actualizar body classes
  document.body.className = '';
  document.body.classList.add(configClass, varsClass);
  document.body.classList.add(...theme.classNames);
}

// Global theme state con listeners
let currentThemeKind: ThemeKind = typeof window !== 'undefined' ? getStoredTheme() : ThemeKind.Dark;
const themeListeners = new Set<(theme: ThemeKind) => void>();

function setGlobalTheme(newTheme: ThemeKind) {
  currentThemeKind = newTheme;
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  themeListeners.forEach(listener => listener(newTheme));
}

// Escuchar mensajes de Vento una sola vez (global)
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type === 'vento-theme-change') {
      const newTheme = event.data.theme === 'light' ? ThemeKind.Light : ThemeKind.Dark;
      setGlobalTheme(newTheme);
      applyThemeToDOM(newTheme === ThemeKind.Light ? VentoLightTheme : VentoDarkTheme);
    }
  });
}

export const useThemes = (): Theme[] => [VentoDarkTheme, VentoLightTheme];

export const useThemeNames = (): Record<string, string> => ({
  [VentoDarkTheme.id]: 'Vento Dark',
  [VentoLightTheme.id]: 'Vento Light',
});

export const useSystemThemeKind = (): ThemeKind => getStoredTheme();

export const useActiveTheme = (): Theme => {
  const [themeKind, setThemeKind] = useState<ThemeKind>(currentThemeKind);
  
  // Suscribirse a cambios globales de tema
  useEffect(() => {
    const listener = (newTheme: ThemeKind) => {
      setThemeKind(newTheme);
    };
    themeListeners.add(listener);
    return () => {
      themeListeners.delete(listener);
    };
  }, []);
  
  return themeKind === ThemeKind.Light ? VentoLightTheme : VentoDarkTheme;
};

// Hook para aplicar clase de Tamagui al HTML
export const useTamaguiThemeClass = (theme: Theme) => {
  useEffect(() => {
    const html = document.documentElement;
    // Limpiar clases anteriores de Tamagui
    html.classList.remove('t_dark', 't_light');
    // Añadir la clase correcta
    html.classList.add(theme.tamaguiClass);
  }, [theme]);
};

const ThemeContext = createContext<Theme | null>(null);
export const ThemeContextProvider = ThemeContext.Provider;

export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('No theme provided!');
  }

  return theme;
};
