import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';

import { registerCameraRef, registerUploadFunction } from '../subsystems/camera';

interface CameraBridgeProps {
  ventoHost: string;
  token: string;
}

export function CameraBridge({ ventoHost, token }: CameraBridgeProps) {
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
      return;
    }

    console.log('[camera] registering camera ref and upload function');
    registerCameraRef(cameraRef.current);
    registerUploadFunction(async (localUri: string, quality: number) => {
      return await uploadPhoto(ventoHost, token, localUri, quality);
    });

    return () => {
      registerCameraRef(null);
      registerUploadFunction(null);
    };
  }, [hasPermission, ventoHost, token]);

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
): Promise<string> {
  const filename = `photo_${Date.now()}.jpg`;
  const uploadUrl = `${ventoHost}/api/core/v1/files/data/tmp?token=${token}`;
  
  console.log('[camera] uploading to:', uploadUrl);
  console.log('[camera] local uri:', localUri);
  console.log('[camera] filename:', filename);

  try {
    // Use FileSystem.uploadAsync with explicit upload type value
    // MULTIPART = 1 in expo-file-system
    const uploadResult = await FileSystem.uploadAsync(uploadUrl, localUri, {
      httpMethod: 'POST',
      uploadType: 1 as any, // FileSystemUploadType.MULTIPART = 1
      fieldName: 'file',
      mimeType: 'image/jpeg',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      parameters: {
        filename: filename,
      },
    });

    console.log('[camera] upload status:', uploadResult.status);
    console.log('[camera] upload body:', uploadResult.body);

    if (uploadResult.status !== 200) {
      throw new Error(`Upload failed: ${uploadResult.status} ${uploadResult.body}`);
    }

    // Return path relative to data/
    return `data/tmp/${filename}`;
  } catch (err: any) {
    console.error('[camera] upload error details:', err);
    throw err;
  }
}

