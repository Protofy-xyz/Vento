import * as Haptics from 'expo-haptics';

import type { SubsystemDefinition } from './types';

const VIBRATE_SINGLE_ENDPOINT = '/haptics/actions/vibrate_single';
const VIBRATE_DOUBLE_ENDPOINT = '/haptics/actions/vibrate_double';

export function buildHapticsSubsystem(): SubsystemDefinition {
  return {
    name: 'haptics',
    type: 'virtual',
    monitors: [],
    actions: [
      {
        descriptor: {
          name: 'vibrate_single',
          label: 'Single vibration',
          description: 'Triggers a single vibration',
          endpoint: VIBRATE_SINGLE_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'none',
          },
          cardProps: {
            icon: 'vibrate',
            color: '$purple10',
            order: 57,
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            console.log('[haptics] single vibration');
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await reply({ status: 'ok' });
          } catch (err: any) {
            console.error('[haptics] error:', err);
            await reply({ error: err?.message ?? 'vibration failed' });
          }
        },
      },
      {
        descriptor: {
          name: 'vibrate_double',
          label: 'Double vibration',
          description: 'Triggers a double vibration (tup tup)',
          endpoint: VIBRATE_DOUBLE_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'none',
          },
          cardProps: {
            icon: 'vibrate',
            color: '$orange10',
            order: 58,
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            console.log('[haptics] double vibration');
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await new Promise((resolve) => setTimeout(resolve, 150));
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await reply({ status: 'ok' });
          } catch (err: any) {
            console.error('[haptics] error:', err);
            await reply({ error: err?.message ?? 'vibration failed' });
          }
        },
      },
    ],
  };
}

