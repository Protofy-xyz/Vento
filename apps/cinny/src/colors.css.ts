import { createTheme } from '@vanilla-extract/css';
import { color } from 'folds';

// Tema base que usa variables CSS de Tamagui
// En Tamagui: --color1 a --color12 son los colores del tema (purple, blue, etc.)
// --background, --backgroundHover, etc. son los fondos
const ventoThemeBase = {
  Background: {
    Container: 'var(--bgContent, var(--background, #1A1A1A))',
    ContainerHover: 'var(--backgroundHover, #262626)',
    ContainerActive: 'var(--backgroundPress, #333333)',
    ContainerLine: 'var(--borderColor, #404040)',
    OnContainer: 'var(--color, #F2F2F2)',
  },

  Surface: {
    Container: 'var(--bgPanel, var(--backgroundHover, #262626))',
    ContainerHover: 'var(--backgroundPress, #333333)',
    ContainerActive: 'var(--backgroundFocus, #404040)',
    ContainerLine: 'var(--borderColorHover, #4D4D4D)',
    OnContainer: 'var(--color, #F2F2F2)',
  },

  SurfaceVariant: {
    Container: 'var(--bgPanel, #353244)',
    ContainerHover: 'var(--bgContent, #292636)',
    ContainerActive: 'var(--backgroundPress, #333333)',
    ContainerLine: 'var(--borderColor, #404040)',
    OnContainer: 'var(--color, #F2F2F2)',
  },

  Primary: {
    Main: 'var(--color9, #BDB6EC)',
    MainHover: 'var(--color10, #B2AAE9)',
    MainActive: 'var(--color8, #ADA3E8)',
    MainLine: 'var(--color7, #A79DE6)',
    OnMain: 'var(--color1, #2C2843)',
    Container: 'var(--color4, #413C65)',
    ContainerHover: 'var(--color5, #494370)',
    ContainerActive: 'var(--color6, #50497B)',
    ContainerLine: 'var(--color7, #575086)',
    OnContainer: 'var(--color12, #E3E1F7)',
  },

  Secondary: {
    Main: 'var(--color, #FFFFFF)',
    MainHover: 'var(--colorHover, #E5E5E5)',
    MainActive: 'var(--colorPress, #D9D9D9)',
    MainLine: 'var(--color11, #CCCCCC)',
    OnMain: 'var(--background, #1A1A1A)',
    Container: 'var(--backgroundFocus, #404040)',
    ContainerHover: 'var(--backgroundPress, #4D4D4D)',
    ContainerActive: 'var(--backgroundHover, #595959)',
    ContainerLine: 'var(--borderColor, #666666)',
    OnContainer: 'var(--color, #F2F2F2)',
  },

  Success: {
    Main: 'var(--green9, #85E0BA)',
    MainHover: 'var(--green10, #70DBAF)',
    MainActive: 'var(--green8, #66D9A9)',
    MainLine: 'var(--green7, #5CD6A3)',
    OnMain: 'var(--green1, #0F3D2A)',
    Container: 'var(--green4, #175C3F)',
    ContainerHover: 'var(--green5, #1A6646)',
    ContainerActive: 'var(--green6, #1C704D)',
    ContainerLine: 'var(--green7, #1F7A54)',
    OnContainer: 'var(--green12, #CCF2E2)',
  },

  Warning: {
    Main: 'var(--orange9, #E3BA91)',
    MainHover: 'var(--orange10, #DFAF7E)',
    MainActive: 'var(--orange8, #DDA975)',
    MainLine: 'var(--orange7, #DAA36C)',
    OnMain: 'var(--orange1, #3F2A15)',
    Container: 'var(--orange4, #5E3F20)',
    ContainerHover: 'var(--orange5, #694624)',
    ContainerActive: 'var(--orange6, #734D27)',
    ContainerLine: 'var(--orange7, #7D542B)',
    OnContainer: 'var(--orange12, #F3E2D1)',
  },

  Critical: {
    Main: 'var(--red9, #E69D9D)',
    MainHover: 'var(--red10, #E28D8D)',
    MainActive: 'var(--red8, #E08585)',
    MainLine: 'var(--red7, #DE7D7D)',
    OnMain: 'var(--red1, #401C1C)',
    Container: 'var(--red4, #602929)',
    ContainerHover: 'var(--red5, #6B2E2E)',
    ContainerActive: 'var(--red6, #763333)',
    ContainerLine: 'var(--red7, #803737)',
    OnContainer: 'var(--red12, #F5D6D6)',
  },

  Other: {
    FocusRing: 'var(--shadowColorFocus, rgba(255, 255, 255, 0.5))',
    Shadow: 'var(--shadowColor, rgba(0, 0, 0, 1))',
    Overlay: 'rgba(0, 0, 0, 0.8)',
  },
};

// Tema Vento Dark
export const ventoDarkTheme = createTheme(color, ventoThemeBase);

// Tema Vento Light - mismas variables, Tamagui se encarga de los valores
export const ventoLightTheme = createTheme(color, ventoThemeBase);
