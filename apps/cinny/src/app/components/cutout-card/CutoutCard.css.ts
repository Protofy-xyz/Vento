import { style } from '@vanilla-extract/css';
import { config } from 'folds';

export const CutoutCard = style({
  borderRadius: config.radii.R300,
  borderWidth: config.borderWidth.B300,
  overflow: 'hidden',
});
