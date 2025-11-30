import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';

import type { SubsystemDefinition } from './types';

const TAKE_PICTURE_ENDPOINT = '/camera/actions/take_picture';

export function buildCameraSubsystem(): SubsystemDefinition {
  return {
    name: 'camera',
    type: 'virtual',
    monitors: [],
    actions: [
      {
        descriptor: {
          name: 'take_picture',
          label: 'Take picture',
          description: 'Captures a photo and uploads it to Vento',
          endpoint: TAKE_PICTURE_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              quality: {
                type: 'number',
                description: 'Image quality (0-1)',
                default: 0.8,
              },
            },
          },
          cardProps: {
            icon: 'camera',
            color: '$blue10',
            order: 68,
          },
          mode: 'request-reply',
          replyTimeoutMs: 30000,
        },
        handler: takePictureHandler,
      },
    ],
  };
}

// Global camera reference and upload function
let cameraRef: CameraView | null = null;
let uploadFunction: ((localUri: string, quality: number) => Promise<string>) | null = null;

export function registerCameraRef(ref: CameraView | null) {
  cameraRef = ref;
}

export function registerUploadFunction(fn: ((localUri: string, quality: number) => Promise<string>) | null) {
  uploadFunction = fn;
}

async function takePictureHandler(payload: string, reply: (body: any) => Promise<void>) {
  try {
    if (!cameraRef) {
      await reply({ error: 'camera not available' });
      return;
    }

    if (!uploadFunction) {
      await reply({ error: 'upload function not registered' });
      return;
    }

    let quality = 0.8;
    try {
      const parsed = JSON.parse(payload);
      if (parsed.quality !== undefined) {
        quality = Math.max(0, Math.min(1, parseFloat(parsed.quality)));
      }
    } catch {}

    console.log('[camera] taking picture with quality', quality);
    const photo = await cameraRef.takePictureAsync({ quality });

    if (!photo || !photo.uri) {
      await reply({ error: 'failed to capture photo' });
      return;
    }

    console.log('[camera] photo captured:', photo.uri);
    console.log('[camera] uploading to Vento...');

    const remotePath = await uploadFunction(photo.uri, quality);

    console.log('[camera] uploaded to:', remotePath);

    // Clean up local file
    try {
      await FileSystem.deleteAsync(photo.uri, { idempotent: true });
    } catch (err) {
      console.warn('[camera] failed to delete local file', err);
    }

    await reply({ path: remotePath });
  } catch (err: any) {
    console.error('[camera] error taking picture', err);
    await reply({ error: err?.message ?? 'unknown error' });
  }
}

