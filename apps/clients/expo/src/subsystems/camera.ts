import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';

import type { SubsystemDefinition } from './types';
import { frameTemplate } from './cardTemplates';

const TAKE_PICTURE_ENDPOINT = '/camera/actions/take_picture';
const LAST_CAPTURE_ENDPOINT = '/camera/monitors/last_capture';

export function buildCameraSubsystem(): SubsystemDefinition {
  return {
    name: 'camera',
    type: 'virtual',
    monitors: [
      {
        descriptor: {
          name: 'last_capture',
          label: 'Last Frame',
          description: 'Last captured photo from Camera',
          endpoint: LAST_CAPTURE_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'camera',
            color: '$blue10',
            order: 110,
            html: frameTemplate,
          },
        },
        boot: async () => {
          return {
            type: 'frame',
            status: 'ready',
            platform: 'vento-mobile',
          };
        },
      },
    ],
    actions: [
      {
        descriptor: {
          name: 'take_picture',
          label: 'Take Picture',
          description: 'Capture a photo from Camera',
          endpoint: TAKE_PICTURE_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              quality: {
                type: 'number',
                description: 'JPEG quality (1-100)',
                default: 85,
              },
            },
          },
          cardProps: {
            icon: 'camera',
            color: '$blue10',
            order: 111,
          },
          mode: 'request-reply',
          replyTimeoutMs: 30000,
        },
        handler: takePictureHandler,
      },
    ],
  };
}

// Global camera reference, upload function, and monitor publisher
let cameraRef: CameraView | null = null;
let uploadFunction: ((localUri: string, quality: number) => Promise<{ path: string; imageUrl: string }>) | null = null;
let monitorPublisher: ((value: any) => void) | null = null;

export function registerCameraRef(ref: CameraView | null) {
  cameraRef = ref;
}

export function registerUploadFunction(fn: ((localUri: string, quality: number) => Promise<{ path: string; imageUrl: string }>) | null) {
  uploadFunction = fn;
}

export function registerMonitorPublisher(fn: ((value: any) => void) | null) {
  monitorPublisher = fn;
}

export function getLastCaptureEndpoint() {
  return LAST_CAPTURE_ENDPOINT;
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

    // Parse quality (1-100 range, matching Go client)
    let qualityPercent = 85; // default
    try {
      const parsed = JSON.parse(payload);
      if (parsed.quality !== undefined) {
        qualityPercent = Math.max(1, Math.min(100, parseInt(parsed.quality, 10)));
      }
    } catch {}

    // Convert to 0-1 range for expo-camera
    const quality = qualityPercent / 100;

    console.log('[camera] taking picture with quality', qualityPercent);
    const photo = await cameraRef.takePictureAsync({ quality });

    if (!photo || !photo.uri) {
      await reply({ error: 'failed to capture photo' });
      return;
    }

    console.log('[camera] photo captured:', photo.uri);
    console.log('[camera] uploading to Vento...');

    const { path: remotePath, imageUrl } = await uploadFunction(photo.uri, quality);

    console.log('[camera] uploaded to:', remotePath);

    // Clean up local file
    try {
      await FileSystem.deleteAsync(photo.uri, { idempotent: true });
    } catch (err) {
      console.warn('[camera] failed to delete local file', err);
    }

    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds (matching Go)
    const result = {
      type: 'frame',
      frame: remotePath,
      imageUrl: imageUrl,
      key: timestamp,
      width: photo.width,
      height: photo.height,
      timestamp: timestamp,
      camera: 'Camera',
    };

    // Publish to the last_capture monitor
    if (monitorPublisher) {
      console.log('[camera] publishing to last_capture monitor');
      monitorPublisher(result);
    }

    await reply(result);
  } catch (err: any) {
    console.error('[camera] error taking picture', err);
    await reply({ error: err?.message ?? 'unknown error' });
  }
}

