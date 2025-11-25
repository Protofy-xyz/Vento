import type { SubsystemDefinition } from './types';

const SET_COLOR_ENDPOINT = '/screen/actions/set_color';
const SET_TEXT_ENDPOINT = '/screen/actions/set_text';
const SET_TEXT_COLOR_ENDPOINT = '/screen/actions/set_text_color';
const SET_TEXT_SIZE_ENDPOINT = '/screen/actions/set_text_size';
const TOUCH_ENDPOINT = '/screen/monitors/touch';

// Global screen state callbacks
let screenColorCallback: ((color: string | null) => void) | null = null;
let screenTextCallback: ((text: string | null) => void) | null = null;
let screenTextColorCallback: ((color: string | null) => void) | null = null;
let screenTextSizeCallback: ((size: number | null) => void) | null = null;

// Touch data publisher
let touchPublisher: ((data: TouchData) => void) | null = null;

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface TouchData {
  fingers: number;
  points: TouchPoint[];
}

export function registerTouchPublisher(publisher: ((data: TouchData) => void) | null) {
  touchPublisher = publisher;
}

export function publishTouch(data: TouchData) {
  if (touchPublisher) {
    touchPublisher(data);
  }
}

export function registerScreenColorCallback(cb: ((color: string | null) => void) | null) {
  screenColorCallback = cb;
}

export function registerScreenTextCallback(cb: ((text: string | null) => void) | null) {
  screenTextCallback = cb;
}

export function registerScreenTextColorCallback(cb: ((color: string | null) => void) | null) {
  screenTextColorCallback = cb;
}

export function registerScreenTextSizeCallback(cb: ((size: number | null) => void) | null) {
  screenTextSizeCallback = cb;
}

export function buildScreenSubsystem(): SubsystemDefinition {
  return {
    name: 'screen',
    type: 'virtual',
    monitors: [
      {
        descriptor: {
          name: 'touch',
          label: 'Touch input',
          description: 'Current touch points on screen',
          endpoint: TOUCH_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'hand',
            color: '$cyan10',
          },
        },
        // No boot, no interval - published on touch events from App
      },
    ],
    actions: [
      {
        descriptor: {
          name: 'set_color',
          label: 'Set screen color',
          description: 'Changes the screen background to a specific color (hex)',
          endpoint: SET_COLOR_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              color: {
                type: 'string',
                description: 'Hex color (e.g. #FF0000 for red, or "reset" to clear)',
                default: '#FF0000',
              },
            },
          },
          cardProps: {
            icon: 'palette',
            color: '$pink10',
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            let color: string | null = null;
            
            // Parse payload
            try {
              const parsed = JSON.parse(payload);
              color = parsed.color || parsed;
            } catch {
              color = payload.trim();
            }

            // Handle reset
            if (color === 'reset' || color === 'clear' || color === '') {
              console.log('[screen] resetting color');
              if (screenColorCallback) {
                screenColorCallback(null);
              }
              await reply({ status: 'reset' });
              return;
            }

            // Validate hex color
            if (!color.startsWith('#')) {
              color = '#' + color;
            }
            
            if (!/^#[0-9A-Fa-f]{6}$/.test(color) && !/^#[0-9A-Fa-f]{3}$/.test(color)) {
              await reply({ error: 'Invalid hex color format. Use #RRGGBB or #RGB' });
              return;
            }

            console.log('[screen] setting color to', color);
            if (screenColorCallback) {
              screenColorCallback(color);
            }
            await reply({ status: 'ok', color });
          } catch (err: any) {
            console.error('[screen] error:', err);
            await reply({ error: err?.message ?? 'failed to set color' });
          }
        },
      },
      {
        descriptor: {
          name: 'set_text',
          label: 'Set screen text',
          description: 'Changes the text displayed on blank screen',
          endpoint: SET_TEXT_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              text: {
                type: 'string',
                description: 'Text to display (or "reset" to restore default)',
                default: 'Hello!',
              },
            },
          },
          cardProps: {
            icon: 'type',
            color: '$blue10',
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            let text: string | null = null;
            
            try {
              const parsed = JSON.parse(payload);
              text = parsed.text ?? parsed;
            } catch {
              text = payload.trim();
            }

            if (text === 'reset' || text === 'clear' || text === '') {
              console.log('[screen] resetting text');
              if (screenTextCallback) {
                screenTextCallback(null);
              }
              await reply({ status: 'reset' });
              return;
            }

            console.log('[screen] setting text to', text);
            if (screenTextCallback) {
              screenTextCallback(text);
            }
            await reply({ status: 'ok', text });
          } catch (err: any) {
            console.error('[screen] error:', err);
            await reply({ error: err?.message ?? 'failed to set text' });
          }
        },
      },
      {
        descriptor: {
          name: 'set_text_color',
          label: 'Set text color',
          description: 'Changes the color of the screen text (hex)',
          endpoint: SET_TEXT_COLOR_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              color: {
                type: 'string',
                description: 'Hex color (e.g. #FF0000 for red, or "reset" to clear)',
                default: '#FF0000',
              },
            },
          },
          cardProps: {
            icon: 'edit-3',
            color: '$green10',
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            let color: string | null = null;
            
            try {
              const parsed = JSON.parse(payload);
              color = parsed.color || parsed;
            } catch {
              color = payload.trim();
            }

            if (color === 'reset' || color === 'clear' || color === '') {
              console.log('[screen] resetting text color');
              if (screenTextColorCallback) {
                screenTextColorCallback(null);
              }
              await reply({ status: 'reset' });
              return;
            }

            if (!color.startsWith('#')) {
              color = '#' + color;
            }
            
            if (!/^#[0-9A-Fa-f]{6}$/.test(color) && !/^#[0-9A-Fa-f]{3}$/.test(color)) {
              await reply({ error: 'Invalid hex color format. Use #RRGGBB or #RGB' });
              return;
            }

            console.log('[screen] setting text color to', color);
            if (screenTextColorCallback) {
              screenTextColorCallback(color);
            }
            await reply({ status: 'ok', color });
          } catch (err: any) {
            console.error('[screen] error:', err);
            await reply({ error: err?.message ?? 'failed to set text color' });
          }
        },
      },
      {
        descriptor: {
          name: 'set_text_size',
          label: 'Set text size',
          description: 'Changes the font size of the screen text',
          endpoint: SET_TEXT_SIZE_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              size: {
                type: 'number',
                description: 'Font size in pixels (8-200, or 0 to reset)',
                default: 24,
              },
            },
          },
          cardProps: {
            icon: 'maximize-2',
            color: '$orange10',
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            let size: number | null = null;
            
            try {
              const parsed = JSON.parse(payload);
              size = parsed.size ?? parseFloat(parsed);
            } catch {
              size = parseFloat(payload.trim());
            }

            if (size === 0 || isNaN(size as number)) {
              console.log('[screen] resetting text size');
              if (screenTextSizeCallback) {
                screenTextSizeCallback(null);
              }
              await reply({ status: 'reset' });
              return;
            }

            size = Math.max(8, Math.min(200, size as number));

            console.log('[screen] setting text size to', size);
            if (screenTextSizeCallback) {
              screenTextSizeCallback(size);
            }
            await reply({ status: 'ok', size });
          } catch (err: any) {
            console.error('[screen] error:', err);
            await reply({ error: err?.message ?? 'failed to set text size' });
          }
        },
      },
    ],
  };
}

