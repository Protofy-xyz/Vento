import { Audio } from 'expo-av';

import type { SubsystemDefinition } from './types';

const PLAY_ALARM_ENDPOINT = '/audio/actions/play_alarm';

export function buildAudioSubsystem(): SubsystemDefinition {
  return {
    name: 'audio',
    type: 'virtual',
    monitors: [],
    actions: [
      {
        descriptor: {
          name: 'play_alarm',
          label: 'Play alarm',
          description: 'Plays a system alarm sound',
          endpoint: PLAY_ALARM_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              duration: {
                type: 'number',
                description: 'Duration in seconds (default 2)',
                default: 2,
              },
            },
          },
          cardProps: {
            icon: 'bell',
            color: '$red10',
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            let duration = 2;
            
            try {
              const parsed = JSON.parse(payload);
              if (parsed.duration !== undefined) {
                duration = Math.max(0.5, Math.min(10, parseFloat(parsed.duration)));
              }
            } catch {}

            console.log('[audio] playing alarm for', duration, 'seconds');

            // Configure audio mode
            await Audio.setAudioModeAsync({
              playsInSilentModeIOS: true,
              staysActiveInBackground: false,
              shouldDuckAndroid: false,
            });

            // Create and play a beep sound using a generated tone
            const { sound } = await Audio.Sound.createAsync(
              // Use a system notification sound or generate a beep
              { uri: 'https://www.soundjay.com/buttons/beep-01a.mp3' },
              { shouldPlay: true, isLooping: true, volume: 1.0 }
            );

            // Stop after duration
            setTimeout(async () => {
              try {
                await sound.stopAsync();
                await sound.unloadAsync();
                console.log('[audio] alarm stopped');
              } catch (err) {
                console.warn('[audio] error stopping sound', err);
              }
            }, duration * 1000);

            await reply({ status: 'playing', duration });
          } catch (err: any) {
            console.error('[audio] error:', err);
            await reply({ error: err?.message ?? 'failed to play alarm' });
          }
        },
      },
    ],
  };
}

