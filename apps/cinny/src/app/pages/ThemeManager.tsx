import React, { ReactNode, useEffect } from 'react';
import { configClass, varsClass } from 'folds';
import {
  ThemeContextProvider,
  useActiveTheme,
  useTamaguiThemeClass,
} from '../hooks/useTheme';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';

export function UnAuthRouteThemeManager() {
  const activeTheme = useActiveTheme();
  
  // Aplicar clase de Tamagui al HTML
  useTamaguiThemeClass(activeTheme);

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);
    document.body.classList.add(...activeTheme.classNames);
  }, [activeTheme]);

  return null;
}

export function AuthRouteThemeManager({ children }: { children: ReactNode }) {
  const activeTheme = useActiveTheme();
  const [monochromeMode] = useSetting(settingsAtom, 'monochromeMode');

  // Aplicar clase de Tamagui al HTML
  useTamaguiThemeClass(activeTheme);

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);

    document.body.classList.add(...activeTheme.classNames);

    if (monochromeMode) {
      document.body.style.filter = 'grayscale(1)';
    } else {
      document.body.style.filter = '';
    }
  }, [activeTheme, monochromeMode]);

  return <ThemeContextProvider value={activeTheme}>{children}</ThemeContextProvider>;
}
