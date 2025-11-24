import type { SubsystemDefinition } from './types';

const SET_COLOR_ENDPOINT = '/screen/actions/set_color';

// Global screen color state
let screenColorCallback: ((color: string | null) => void) | null = null;

export function registerScreenColorCallback(cb: ((color: string | null) => void) | null) {
  screenColorCallback = cb;
}

export function buildScreenSubsystem(): SubsystemDefinition {
  return {
    name: 'screen',
    type: 'virtual',
    monitors: [],
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
    ],
  };
}

