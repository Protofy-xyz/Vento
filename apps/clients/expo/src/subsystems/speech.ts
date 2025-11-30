import * as Speech from 'expo-speech';

import type { SubsystemDefinition } from './types';

const SPEAK_ENDPOINT = '/speech/actions/speak';
const STOP_ENDPOINT = '/speech/actions/stop';

export function buildSpeechSubsystem(): SubsystemDefinition {
  return {
    name: 'speech',
    type: 'virtual',
    monitors: [],
    actions: [
      {
        descriptor: {
          name: 'speak',
          label: 'Text to speech',
          description: 'Makes the device speak the given text',
          endpoint: SPEAK_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              text: {
                type: 'string',
                description: 'Text to speak',
                default: 'Hello from Vento!',
              },
              language: {
                type: 'string',
                description: 'Language code (e.g. en, es, fr)',
                default: 'en',
              },
              pitch: {
                type: 'number',
                description: 'Voice pitch (0.5-2.0)',
                default: 1.0,
              },
              rate: {
                type: 'number',
                description: 'Speech rate (0.5-2.0)',
                default: 1.0,
              },
            },
          },
          cardProps: {
            icon: 'volume-2',
            color: '$cyan10',
            order: 59,
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            let text = 'Hello from Vento!';
            let language = 'en';
            let pitch = 1.0;
            let rate = 1.0;

            try {
              const parsed = JSON.parse(payload);
              text = parsed.text ?? text;
              language = parsed.language ?? language;
              pitch = parsed.pitch ?? pitch;
              rate = parsed.rate ?? rate;
            } catch {
              text = payload.trim() || text;
            }

            pitch = Math.max(0.5, Math.min(2.0, pitch));
            rate = Math.max(0.5, Math.min(2.0, rate));

            console.log('[speech] speaking:', text);

            Speech.speak(text, {
              language,
              pitch,
              rate,
              onDone: () => console.log('[speech] done'),
              onError: (err) => console.error('[speech] error:', err),
            });

            await reply({ status: 'speaking', text, language, pitch, rate });
          } catch (err: any) {
            console.error('[speech] error:', err);
            await reply({ error: err?.message ?? 'failed to speak' });
          }
        },
      },
      {
        descriptor: {
          name: 'stop',
          label: 'Stop speaking',
          description: 'Stops any ongoing speech',
          endpoint: STOP_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'none',
          },
          cardProps: {
            icon: 'volume-x',
            color: '$red10',
            order: 60,
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            console.log('[speech] stopping');
            Speech.stop();
            await reply({ status: 'stopped' });
          } catch (err: any) {
            console.error('[speech] error:', err);
            await reply({ error: err?.message ?? 'failed to stop' });
          }
        },
      },
    ],
  };
}

