import { style } from '@vanilla-extract/css';
import { toRem } from 'folds';

export const BackgroundDotPattern = style({
  // Usar variables de Tamagui directamente para evitar flash
  backgroundImage: `radial-gradient(var(--backgroundPress, #333333) ${toRem(2)}, var(--background, #1A1A1A) ${toRem(2)})`,
  backgroundSize: `${toRem(40)} ${toRem(40)}`,
});
