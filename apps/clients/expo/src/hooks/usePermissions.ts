import { useCallback, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';

export type PermissionStatus = 'pending' | 'granted' | 'denied';

export interface PermissionsState {
  camera: PermissionStatus;
  microphone: PermissionStatus;
  location: PermissionStatus;
  allGranted: boolean;
}

export function usePermissions() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [state, setState] = useState<PermissionsState>({
    camera: 'pending',
    microphone: 'pending',
    location: 'pending',
    allGranted: false,
  });

  const requestAllPermissions = useCallback(async () => {
    console.log('[permissions] Requesting all permissions...');

    // Camera
    let cameraStatus: PermissionStatus = 'pending';
    try {
      if (!cameraPermission?.granted) {
        console.log('[permissions] Requesting camera...');
        const result = await requestCameraPermission();
        cameraStatus = result?.granted ? 'granted' : 'denied';
        console.log('[permissions] Camera:', cameraStatus);
      } else {
        cameraStatus = 'granted';
      }
    } catch (err) {
      console.log('[permissions] Camera error:', err);
      cameraStatus = 'denied';
    }

    // Microphone
    let micStatus: PermissionStatus = 'pending';
    try {
      console.log('[permissions] Requesting microphone...');
      const { status } = await Audio.requestPermissionsAsync();
      micStatus = status === 'granted' ? 'granted' : 'denied';
      console.log('[permissions] Microphone:', micStatus);
    } catch (err) {
      console.log('[permissions] Microphone error:', err);
      micStatus = 'denied';
    }

    // Location (needed for BLE on Android)
    let locationStatus: PermissionStatus = 'pending';
    try {
      console.log('[permissions] Requesting location...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      locationStatus = status === 'granted' ? 'granted' : 'denied';
      console.log('[permissions] Location:', locationStatus);
    } catch (err) {
      console.log('[permissions] Location error:', err);
      locationStatus = 'denied';
    }

    // Android-specific: Bluetooth permissions for Android 12+
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      try {
        console.log('[permissions] Requesting Bluetooth (Android 12+)...');
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
      } catch (err) {
        console.log('[permissions] Bluetooth error:', err);
      }
    }

    const allGranted = cameraStatus === 'granted' && micStatus === 'granted' && locationStatus === 'granted';

    setState({
      camera: cameraStatus,
      microphone: micStatus,
      location: locationStatus,
      allGranted,
    });

    console.log('[permissions] Final state:', { camera: cameraStatus, microphone: micStatus, location: locationStatus, allGranted });

    return allGranted;
  }, [cameraPermission, requestCameraPermission]);

  return {
    state,
    requestAllPermissions,
  };
}

