import type { SubsystemDefinition } from './types';

const SET_COLOR_ENDPOINT = '/screen/actions/set_color';
const SET_HTML_ENDPOINT = '/screen/actions/set_html';
const SET_TEXT_ENDPOINT = '/screen/actions/set_text';
const SET_TEXT_COLOR_ENDPOINT = '/screen/actions/set_text_color';
const SET_TEXT_SIZE_ENDPOINT = '/screen/actions/set_text_size';
const TOUCH_ENDPOINT = '/screen/monitors/touch';
const HTML_NAME_ENDPOINT = '/screen/monitors/html_name';

// HTML content state
export interface ScreenHtmlState {
  html: string;
  name: string;
}

// Global screen state callbacks
let screenHtmlCallback: ((state: ScreenHtmlState | null) => void) | null = null;
let screenColorCallback: ((color: string | null) => void) | null = null;
let screenTextCallback: ((text: string | null) => void) | null = null;
let screenTextColorCallback: ((color: string | null) => void) | null = null;
let screenTextSizeCallback: ((size: number | null) => void) | null = null;

// Touch data publisher
let touchPublisher: ((data: TouchData) => void) | null = null;

// HTML name monitor publisher
let htmlNamePublisher: ((name: string | null) => void) | null = null;

// Current HTML name for monitoring
let currentHtmlName: string | null = null;

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

export function registerScreenHtmlCallback(cb: ((state: ScreenHtmlState | null) => void) | null) {
  screenHtmlCallback = cb;
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

export function registerHtmlNamePublisher(publisher: ((name: string | null) => void) | null) {
  htmlNamePublisher = publisher;
}

// Helper to generate HTML for a solid color
function generateColorHtml(color: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { background-color: ${color}; }
  </style>
</head>
<body></body>
</html>`;
}

// Internal function to set HTML and update monitor
function setScreenHtml(html: string, name: string) {
  currentHtmlName = name;
  
  if (screenHtmlCallback) {
    screenHtmlCallback({ html, name });
  }
  
  // Publish html_name change
  if (htmlNamePublisher) {
    htmlNamePublisher(name);
  }
}

// Internal function to reset screen
function resetScreen() {
  currentHtmlName = null;
  
  if (screenHtmlCallback) {
    screenHtmlCallback(null);
  }
  
  if (screenColorCallback) {
    screenColorCallback(null);
  }
  
  // Publish html_name change
  if (htmlNamePublisher) {
    htmlNamePublisher(null);
  }
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
            color: '$blue10',
            order: 47,
          },
        },
        // No boot, no interval - published on touch events from App
      },
      {
        descriptor: {
          name: 'html_name',
          label: 'Current HTML',
          description: 'Name of the currently displayed HTML',
          endpoint: HTML_NAME_ENDPOINT,
          connectionType: 'mqtt',
          cardProps: {
            icon: 'code',
            color: '$purple10',
            order: 48,
          },
        },
        boot: async (publish) => {
          // Publish current state on boot
          await publish({ name: currentHtmlName });
        },
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
            order: 49,
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
              resetScreen();
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
            
            // Generate HTML for the color and set it
            const html = generateColorHtml(color);
            const name = `color_${color.replace('#', '')}.html`;
            setScreenHtml(html, name);
            
            // Also update the legacy color callback for backwards compatibility
            if (screenColorCallback) {
              screenColorCallback(color);
            }
            
            await reply({ status: 'ok', color, html_name: name });
          } catch (err: any) {
            console.error('[screen] error:', err);
            await reply({ error: err?.message ?? 'failed to set color' });
          }
        },
      },
      {
        descriptor: {
          name: 'set_html',
          label: 'Set screen HTML',
          description: 'Displays custom HTML content on screen',
          endpoint: SET_HTML_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              html: {
                type: 'string',
                description: 'HTML content to display (or "reset" to clear)',
              },
              name: {
                type: 'string',
                description: 'Name/identifier for the HTML (for monitoring)',
                default: 'index.html',
              },
            },
          },
          cardProps: {
            icon: 'code',
            color: '$purple10',
            order: 50,
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            let html: string | null = null;
            let name: string = 'index.html';
            
            // Parse payload
            try {
              const parsed = JSON.parse(payload);
              html = parsed.html ?? null;
              name = parsed.name ?? 'index.html';
            } catch {
              html = payload.trim();
            }

            // Handle reset
            if (html === 'reset' || html === 'clear' || html === '' || html === null) {
              console.log('[screen] resetting HTML');
              resetScreen();
              await reply({ status: 'reset' });
              return;
            }

            console.log('[screen] setting HTML:', name);
            
            // Clear any previous color override since we're showing custom HTML
            if (screenColorCallback) {
              screenColorCallback(null);
            }
            
            setScreenHtml(html, name);
            
            await reply({ status: 'ok', name });
          } catch (err: any) {
            console.error('[screen] error:', err);
            await reply({ error: err?.message ?? 'failed to set HTML' });
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
            order: 51,
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
            icon: 'pencil',
            color: '$green10',
            order: 52,
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
            order: 53,
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
