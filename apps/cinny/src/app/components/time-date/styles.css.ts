import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const PickerMenu = style({
  padding: config.space.S200,
});
export const PickerContainer = style({
  maxHeight: toRem(250),
});
export const PickerColumnLabel = style({
  padding: config.space.S200,
});
export const PickerColumnContent = style({
  padding: config.space.S200,
  paddingRight: 0,
});
