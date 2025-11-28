import { style } from '@vanilla-extract/css';
import { config } from 'folds';

export const SplashScreen = style({
  minHeight: '100%',
  // Usar variables de Tamagui directamente para evitar flash
  backgroundColor: 'var(--background, var(--bgContent, #1A1A1A))',
  color: 'var(--color, #F2F2F2)',
});

export const SplashScreenFooter = style({
  padding: config.space.S400,
});
