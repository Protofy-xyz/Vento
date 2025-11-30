import * as Brightness from 'expo-brightness';

import type { SubsystemDefinition } from './types';

const BRIGHTNESS_LEVEL_ENDPOINT = '/brightness/monitors/level';
const SET_BRIGHTNESS_ENDPOINT = '/brightness/actions/set_level';

export function buildBrightnessSubsystem(): SubsystemDefinition {
  return {
    name: 'brightness',
    type: 'virtual',
    monitors: [
      {
        descriptor: {
          name: 'level',
          label: 'Brightness level',
          description: 'Current screen brightness (0-100%)',
          units: '%',
          endpoint: BRIGHTNESS_LEVEL_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'sun',
            color: '$yellow10',
            order: 54,
          },
        },
        boot: async () => {
          try {
            const brightness = await Brightness.getBrightnessAsync();
            return Math.round(brightness * 100);
          } catch {
            return 'unavailable';
          }
        },
        // No native events for brightness changes, use slow polling
        intervalMs: 10000,
        producer: async () => {
          try {
            const brightness = await Brightness.getBrightnessAsync();
            return Math.round(brightness * 100);
          } catch {
            return 'unavailable';
          }
        },
      },
    ],
    actions: [
      {
        descriptor: {
          name: 'set_level',
          label: 'Set brightness',
          description: 'Changes the screen brightness (0-100)',
          endpoint: SET_BRIGHTNESS_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              level: {
                type: 'number',
                description: 'Brightness level (0-100)',
                default: 50,
              },
            },
          },
          cardProps: {
            icon: 'sun',
            color: '$yellow10',
            order: 55,
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            let level = 50;
            
            try {
              const parsed = JSON.parse(payload);
              level = parsed.level ?? parseFloat(parsed);
            } catch {
              level = parseFloat(payload.trim());
            }

            if (isNaN(level)) {
              await reply({ error: 'Invalid brightness level' });
              return;
            }

            level = Math.max(0, Math.min(100, level));
            const brightness = level / 100;

            console.log('[brightness] setting to', level, '%');
            
            // Request permissions first
            const { status } = await Brightness.requestPermissionsAsync();
            if (status !== 'granted') {
              await reply({ error: 'Brightness permission denied' });
              return;
            }

            await Brightness.setBrightnessAsync(brightness);
            await reply({ status: 'ok', level });
          } catch (err: any) {
            console.error('[brightness] error:', err);
            await reply({ error: err?.message ?? 'failed to set brightness' });
          }
        },
      },
    ],
  };
}

