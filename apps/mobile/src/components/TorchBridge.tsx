import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Camera, CameraView } from 'expo-camera';

import { registerTorchController, type TorchState } from '../torch/controller';

export function TorchBridge() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [torchState, setTorchState] = useState<'off' | 'on'>('off');

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  useEffect(() => {
    if (!hasPermission) {
      registerTorchController(null);
      return;
    }
    registerTorchController(async (state: TorchState) => {
      setTorchState(state);
    });
    return () => registerTorchController(null);
  }, [hasPermission]);

  if (!hasPermission) {
    return null;
  }
  if (Platform.OS === 'ios') {
    return null;
  }

  return (
    <View style={styles.hiddenContainer}>
      <CameraView
        ref={cameraRef}
        style={styles.hiddenCamera}
        facing={resolveCameraType()}
        torch={torchState}
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
  },
  hiddenCamera: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});

function resolveCameraType(): 'front' | 'back' {
  const constants = (Camera as any)?.Constants;
  if (constants?.Type?.front && constants?.Type?.back) {
    return constants.Type.back;
  }
  return 'back';
}

