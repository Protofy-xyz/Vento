/* eslint-disable import/first */

// 1. Leer tema de URL
const THEME_STORAGE_KEY = 'vento_theme_preference';
const urlParams = new URLSearchParams(window.location.search);
const themeParam = urlParams.get('theme');
if (themeParam === 'light' || themeParam === 'dark') {
  localStorage.setItem(THEME_STORAGE_KEY, themeParam === 'light' ? 'vento-light-theme' : 'vento-dark-theme');
}

// 2. Determinar tema
const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
const systemIsDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
const isDarkTheme = storedTheme === 'vento-light-theme' ? false : 
                    storedTheme === 'vento-dark-theme' ? true : 
                    systemIsDark;

import React from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';

// 3. Importar tema de Vento PRIMERO
import { ventoDarkTheme, ventoLightTheme } from './colors.css';
import { onDarkFontWeight, onLightFontWeight } from './config.css';
import { configClass, varsClass } from 'folds';

// 4. Aplicar clases del tema al HTML (no body) para que tengan prioridad sobre :root de Folds
const themeClasses = isDarkTheme 
  ? ['vento-theme', ventoDarkTheme, onDarkFontWeight, 'prism-dark']
  : ['vento-theme', ventoLightTheme, onLightFontWeight, 'prism-light'];
document.documentElement.classList.add(configClass, varsClass, ...themeClasses);
document.body.classList.add(configClass, varsClass, ...themeClasses);

// 5. Marcar como listo para mostrar (quita visibility: hidden del HTML)
document.documentElement.classList.add('vento-ready');

// 5. AHORA importar CSS de Folds y fonts (el tema ya está en el body)
import '@fontsource/inter/variable.css';
import 'folds/dist/style.css';
import './index.css';

enableMapSet();

import { trimTrailingSlash } from './app/utils/common';
import App from './app/pages/App';
import './app/i18n';

// Register Service Worker
if ('serviceWorker' in navigator) {
  const swUrl =
    import.meta.env.MODE === 'production'
      ? `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`
      : `/dev-sw.js?dev-sw`;

  navigator.serviceWorker.register(swUrl);
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'token' && event.data?.responseKey) {
      // Get the token for SW.
      const token = localStorage.getItem('cinny_access_token') ?? undefined;
      event.source!.postMessage({
        responseKey: event.data.responseKey,
        token,
      });
    }
  });
}

const mountApp = () => {
  const rootContainer = document.getElementById('root');

  if (rootContainer === null) {
    console.error('Root container element not found!');
    return;
  }

  const root = createRoot(rootContainer);
  root.render(<App />);
  
  // Notificar al parent (si estamos en un iframe) que Cinny ha cargado
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'cinny-ready' }, '*');
  }
};

mountApp();
