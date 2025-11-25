import * as Linking from 'expo-linking';

import type { SubsystemDefinition } from './types';

const OPEN_URL_ENDPOINT = '/linking/actions/open_url';
const OPEN_SETTINGS_ENDPOINT = '/linking/actions/open_settings';

export function buildLinkingSubsystem(): SubsystemDefinition {
  return {
    name: 'linking',
    type: 'virtual',
    monitors: [],
    actions: [
      {
        descriptor: {
          name: 'open_url',
          label: 'Open URL',
          description: 'Opens a URL in the default browser or app',
          endpoint: OPEN_URL_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              url: {
                type: 'string',
                description: 'URL to open (http://, https://, tel:, mailto:, etc.)',
                default: 'https://google.com',
              },
            },
          },
          cardProps: {
            icon: 'external-link',
            color: '$blue10',
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            let url = '';

            try {
              const parsed = JSON.parse(payload);
              url = parsed.url ?? parsed;
            } catch {
              url = payload.trim();
            }

            if (!url) {
              await reply({ error: 'No URL provided' });
              return;
            }

            console.log('[linking] opening URL:', url);
            
            const canOpen = await Linking.canOpenURL(url);
            if (!canOpen) {
              await reply({ error: 'Cannot open this URL' });
              return;
            }

            await Linking.openURL(url);
            await reply({ status: 'opened', url });
          } catch (err: any) {
            console.error('[linking] error:', err);
            await reply({ error: err?.message ?? 'failed to open URL' });
          }
        },
      },
      {
        descriptor: {
          name: 'open_settings',
          label: 'Open settings',
          description: 'Opens the device settings app',
          endpoint: OPEN_SETTINGS_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'none',
          },
          cardProps: {
            icon: 'settings',
            color: '$gray10',
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            console.log('[linking] opening settings');
            await Linking.openSettings();
            await reply({ status: 'opened' });
          } catch (err: any) {
            console.error('[linking] error:', err);
            await reply({ error: err?.message ?? 'failed to open settings' });
          }
        },
      },
    ],
  };
}

