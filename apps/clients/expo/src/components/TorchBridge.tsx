import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { registerTorchController, type TorchState } from '../torch/controller';

export function TorchBridge() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [torchState, setTorchState] = useState<'off' | 'on'>('off');
  const hasPermission = permission?.granted ?? false;

  useEffect(() => {
    console.log('[torch] permission status:', permission?.status);
    if (!permission) {
      console.log('[torch] requesting camera permission...');
      requestPermission();
    } else if (!permission.granted && permission.canAskAgain) {
      console.log('[torch] permission not granted, requesting again...');
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    console.log('[torch] hasPermission:', hasPermission);
    if (!hasPermission) {
      registerTorchController(null);
      return;
    }
    registerTorchController(async (state: TorchState) => {
      console.log('[torch] ✅ setting torch to:', state);
      setTorchState(state);
    });
    return () => registerTorchController(null);
  }, [hasPermission]);

  useEffect(() => {
    console.log('[torch] state changed to:', torchState);
  }, [torchState]);

  if (!hasPermission) {
    console.log('[torch] no permission, not rendering camera');
    return null;
  }

  console.log('[torch] rendering camera with torch:', torchState);

  return (
    <View style={styles.hiddenContainer}>
      <CameraView
        ref={cameraRef}
        style={styles.hiddenCamera}
        facing="back"
        enableTorch={torchState === 'on'}
      />
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

