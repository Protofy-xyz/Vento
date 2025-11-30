import { Audio } from 'expo-av';
import type { SubsystemDefinition, EmitFn, UnsubscribeFn } from './types';

export function buildMicrophoneSubsystem(): SubsystemDefinition {
  return {
    name: 'microphone',
    type: 'virtual',
    monitors: [
      {
        descriptor: {
          name: 'decibels',
          label: 'Sound Level',
          description: 'Current ambient sound level in decibels',
          units: 'dB',
          endpoint: '/microphone/monitors/decibels',
          connectionType: 'mqtt',
          cardProps: { color: '$orange10', icon: 'mic', order: 65 },
          ephemeral: true,
        },
        subscribe: subscribeMicrophone,
        minIntervalMs: 200, // Max 5 updates per second
      },
    ],
    actions: [
      {
        descriptor: {
          name: 'start',
          label: 'Start Listening',
          description: 'Start microphone sound level monitoring',
          endpoint: '/microphone/actions/start',
          connectionType: 'mqtt',
          payload: { type: 'none' },
          cardProps: { icon: 'mic', order: 66 },
        },
        handler: async (_payload, reply) => {
          // Microphone starts automatically via subscribe
          await reply({ status: 'started' });
        },
      },
      {
        descriptor: {
          name: 'stop',
          label: 'Stop Listening',
          description: 'Stop microphone sound level monitoring',
          endpoint: '/microphone/actions/stop',
          connectionType: 'mqtt',
          payload: { type: 'none' },
          cardProps: { icon: 'mic-off', order: 67 },
        },
        handler: async (_payload, reply) => {
          // Microphone stops when unsubscribed
          await reply({ status: 'stopped' });
        },
      },
    ],
  };
}

function subscribeMicrophone(emit: EmitFn): UnsubscribeFn {
  let recording: Audio.Recording | null = null;
  let stopped = false;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function start() {
    try {
      console.log('[microphone] requesting permissions...');
      const permResponse = await Audio.requestPermissionsAsync();
      
      if (permResponse.status !== 'granted') {
        console.log('[microphone] permission denied, status:', permResponse.status);
        emit({ error: 'permission-denied' });
        return;
      }

      console.log('[microphone] permission granted');

      if (stopped) return;

      console.log('[microphone] setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      if (stopped) return;

      console.log('[microphone] creating recording with createAsync...');
      
      // Use the modern API: Audio.Recording.createAsync()
      const { recording: rec } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
          isMeteringEnabled: true,
        },
        undefined, // onRecordingStatusUpdate
        100 // progressUpdateIntervalMillis
      );

      if (stopped) {
        await rec.stopAndUnloadAsync();
        return;
      }

      recording = rec;
      console.log('[microphone] recording started');

      // Poll for metering values
      pollInterval = setInterval(async () => {
        if (!recording || stopped) return;
        try {
          const status = await recording.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            // metering is typically -160 to 0 dB
            const db = Math.max(0, Math.round((status.metering ?? -160) + 160));
            emit(db);
          }
        } catch (err) {
          // Recording might have been stopped
          console.log('[microphone] error getting status:', err);
        }
      }, 100);

    } catch (err: any) {
      console.log('[microphone] error starting:', err?.message ?? err);
      emit({ error: 'failed-to-start', details: err?.message });
    }
  }

  async function stop() {
    stopped = true;
    
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }

    if (recording) {
      try {
        console.log('[microphone] stopping recording...');
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
        console.log('[microphone] stopped');
      } catch (err) {
        console.log('[microphone] error stopping:', err);
      }
      recording = null;
    }
  }

  // Start recording
  start();

  // Return cleanup function
  return () => {
    stop();
  };
}
