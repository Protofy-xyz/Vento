import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Camera, CameraView } from 'expo-camera';

import { registerTorchController, type TorchState } from '../torch/controller';

export function TorchBridge() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [torchState, setTorchState] = useState<'off' | 'on'>('off');

  useEffect(() => {
    console.log('[torch] requesting camera permission...');
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      console.log('[torch] permission status:', status);
      setHasPermission(status === 'granted');
    });
  }, []);

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

