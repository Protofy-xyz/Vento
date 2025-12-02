import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';

import { registerCameraRef, registerUploadFunction, registerMonitorPublisher, getLastCaptureEndpoint } from '../subsystems/camera';

interface CameraBridgeProps {
  ventoHost: string;
  token: string;
  deviceName?: string;
}

export function CameraBridge({ ventoHost, token, deviceName }: CameraBridgeProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const hasPermission = permission?.granted ?? false;

  useEffect(() => {
    console.log('[camera] permission status:', permission?.status);
    if (!permission) {
      console.log('[camera] requesting camera permission...');
      requestPermission();
    } else if (!permission.granted && permission.canAskAgain) {
      console.log('[camera] permission not granted, requesting again...');
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!hasPermission || !cameraRef.current) {
      registerCameraRef(null);
      registerUploadFunction(null);
      registerMonitorPublisher(null);
      return;
    }

    console.log('[camera] registering camera ref and upload function');
    registerCameraRef(cameraRef.current);
    registerUploadFunction(async (localUri: string, quality: number) => {
      return await uploadPhoto(ventoHost, token, localUri, quality);
    });

    // Register monitor publisher if we have deviceName and MQTT client
    if (deviceName) {
      registerMonitorPublisher((value: any) => {
        const mqtt = (globalThis as any).__ventoMqtt;
        if (mqtt) {
          mqtt.publish(deviceName, getLastCaptureEndpoint(), value);
        }
      });
    }

    return () => {
      registerCameraRef(null);
      registerUploadFunction(null);
      registerMonitorPublisher(null);
    };
  }, [hasPermission, ventoHost, token, deviceName]);

  if (!hasPermission) {
    console.log('[camera] no permission, not rendering camera');
    return null;
  }

  console.log('[camera] rendering camera');

  return (
    <View style={styles.hiddenContainer}>
      <CameraView ref={cameraRef} style={styles.hiddenCamera} facing="back" />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  hiddenCamera: {
    width: 1,
    height: 1,
  },
});

async function uploadPhoto(
  ventoHost: string,
  token: string,
  localUri: string,
  quality: number,
): Promise<{ path: string; imageUrl: string }> {
  const timestamp = Date.now();
  const filename = `photo_${timestamp}.jpg`;
  const uploadUrl = `${ventoHost}/api/core/v1/files/data/tmp?token=${token}`;
  
  console.log('[camera] uploading to:', uploadUrl);
  console.log('[camera] local uri:', localUri);
  console.log('[camera] filename:', filename);

  try {
    // Create FormData with file URI (React Native way)
    // This sets the filename correctly in the multipart form (matching Go client behavior)
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      type: 'image/jpeg',
      name: filename,
    } as any);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    console.log('[camera] upload status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    // Parse server response to get actual path (matching Go client behavior)
    let path = `data/tmp/${filename}`; // fallback
    try {
      const responseData = await response.json();
      console.log('[camera] upload response:', JSON.stringify(responseData));
      if (responseData.path) {
        path = responseData.path;
      }
    } catch {
      console.warn('[camera] could not parse upload response, using fallback path');
    }

    console.log('[camera] using path:', path);
    const imageUrl = `${ventoHost}/api/core/v1/files/${path}?key=${timestamp}`;
    
    return { path, imageUrl };
  } catch (err: any) {
    console.error('[camera] upload error details:', err);
    throw err;
  }
}

