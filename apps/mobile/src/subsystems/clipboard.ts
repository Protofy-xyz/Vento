import * as Clipboard from 'expo-clipboard';

import type { SubsystemDefinition } from './types';

const COPY_ENDPOINT = '/clipboard/actions/copy';
const READ_ENDPOINT = '/clipboard/actions/read';

export function buildClipboardSubsystem(): SubsystemDefinition {
  return {
    name: 'clipboard',
    type: 'virtual',
    monitors: [],
    actions: [
      {
        descriptor: {
          name: 'copy',
          label: 'Copy to clipboard',
          description: 'Copies text to the device clipboard',
          endpoint: COPY_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              text: {
                type: 'string',
                description: 'Text to copy',
                default: '',
              },
            },
          },
          cardProps: {
            icon: 'clipboard',
            color: '$indigo10',
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            let text = '';

            try {
              const parsed = JSON.parse(payload);
              text = parsed.text ?? parsed;
            } catch {
              text = payload.trim();
            }

            if (!text) {
              await reply({ error: 'No text provided' });
              return;
            }

            console.log('[clipboard] copying:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
            await Clipboard.setStringAsync(text);
            await reply({ status: 'copied', length: text.length });
          } catch (err: any) {
            console.error('[clipboard] error:', err);
            await reply({ error: err?.message ?? 'failed to copy' });
          }
        },
      },
      {
        descriptor: {
          name: 'read',
          label: 'Read clipboard',
          description: 'Reads the current clipboard content',
          endpoint: READ_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'none',
          },
          cardProps: {
            icon: 'file-text',
            color: '$teal10',
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            console.log('[clipboard] reading');
            const text = await Clipboard.getStringAsync();
            await reply({ text: text || '', length: text?.length ?? 0 });
          } catch (err: any) {
            console.error('[clipboard] error:', err);
            await reply({ error: err?.message ?? 'failed to read clipboard' });
          }
        },
      },
    ],
  };
}

