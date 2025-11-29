import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as NavigationBar from 'expo-navigation-bar';

import { useAgent } from './src/hooks/useAgent';
import { usePermissions } from './src/hooks/usePermissions';
import { TorchBridge } from './src/components/TorchBridge';
import { CameraBridge } from './src/components/CameraBridge';
import { CameraPreview } from './src/components/CameraPreview';
import {
  registerScreenColorCallback,
  registerScreenTextCallback,
  registerScreenTextColorCallback,
  registerScreenTextSizeCallback,
  registerTouchPublisher,
  type TouchData,
} from './src/subsystems/screen';
import { MQTTManager } from './src/mqttClient';

type ScreenMode = 'blank' | 'camera' | 'logs';

export default function App() {
  const { state, connect, disconnect } = useAgent();
  const { state: permissions, requestAllPermissions } = usePermissions();
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [screenMode, setScreenMode] = useState<ScreenMode>('blank');
  const [overrideColor, setOverrideColor] = useState<string | null>(null);
  const [overrideText, setOverrideText] = useState<string | null>(null);
  const [overrideTextColor, setOverrideTextColor] = useState<string | null>(null);
  const [overrideTextSize, setOverrideTextSize] = useState<number | null>(null);
  const [permissionsRequested, setPermissionsRequested] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Request permissions on app start (only once)
  useEffect(() => {
    let mounted = true;
    
    const doRequest = async () => {
      console.log('[App] Requesting permissions on startup...');
      await requestAllPermissions();
      if (mounted) {
        setPermissionsRequested(true);
        console.log('[App] Permissions requested');
      }
    };
    
    if (!permissionsRequested) {
      doRequest();
    }
    
    return () => { mounted = false; };
  }, []); // Empty deps - run only once on mount

  // Register screen callbacks
  useEffect(() => {
    registerScreenColorCallback(setOverrideColor);
    registerScreenTextCallback(setOverrideText);
    registerScreenTextColorCallback(setOverrideTextColor);
    registerScreenTextSizeCallback(setOverrideTextSize);
    return () => {
      registerScreenColorCallback(null);
      registerScreenTextCallback(null);
      registerScreenTextColorCallback(null);
      registerScreenTextSizeCallback(null);
    };
  }, []);

  // Touch handler - publishes touch data via MQTT
  const handleTouch = useCallback(
    (touches: any[]) => {
      if (!state.deviceName) return;
      
      const touchData: TouchData = {
        fingers: touches.length,
        points: Array.from(touches).map((t: any, i: number) => ({
          id: t.identifier ?? i,
          x: Math.round(t.pageX),
          y: Math.round(t.pageY),
        })),
      };
      
      // Publish via the global mqtt instance
      if ((globalThis as any).__ventoMqtt && state.deviceName) {
        const mqtt = (globalThis as any).__ventoMqtt as MQTTManager;
        mqtt.publish(state.deviceName, '/screen/monitors/touch', touchData);
      }
    },
    [state.deviceName],
  );

  useEffect(() => {
    if (state.host && !host) {
      setHost(state.host);
    }
    if (state.username && !username) {
      setUsername(state.username);
    }
  }, [state.host, state.username, host, username]);

  // Keep screen awake and go fullscreen while connected
  useEffect(() => {
    if (state.status === 'connected') {
      activateKeepAwakeAsync('vento-app');
      // Hide navigation bar for fullscreen (Android only)
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
    } else {
      deactivateKeepAwake('vento-app');
      // Show navigation bar again
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    }
    return () => {
      deactivateKeepAwake('vento-app');
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    };
  }, [state.status]);

  const isConnecting = state.status === 'connecting';
  const isConnected = state.status === 'connected';

  const backgroundColor = overrideColor ?? (isDark ? '#000' : '#fff');
  const textColor = isDark ? '#fff' : '#000';
  const mutedColor = isDark ? '#666' : '#999';

  // Login screen
  if (!isConnected) {
    return (
      <View style={[styles.container, { backgroundColor: '#0b0b0f' }]}>
        <StatusBar style="light" />
        <View style={styles.form}>
          <Text style={styles.title}>Vento Mobile Agent</Text>
          <TextInput
            style={styles.input}
            placeholder="Vento host (e.g. http://localhost:8000)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            value={host}
            onChangeText={setHost}
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button
            title={isConnecting ? 'Connecting...' : 'Connect'}
            onPress={() => connect({ host, username, password })}
            disabled={isConnecting}
          />
          {state.error && <Text style={styles.error}>{state.error}</Text>}
          
          {/* Permission status */}
          <View style={styles.permissionsRow}>
            <Text style={[styles.permissionItem, { color: permissions.camera === 'granted' ? '#4ade80' : '#f87171' }]}>
              📷 {permissions.camera === 'granted' ? '✓' : '✗'}
            </Text>
            <Text style={[styles.permissionItem, { color: permissions.microphone === 'granted' ? '#4ade80' : '#f87171' }]}>
              🎤 {permissions.microphone === 'granted' ? '✓' : '✗'}
            </Text>
            <Text style={[styles.permissionItem, { color: permissions.location === 'granted' ? '#4ade80' : '#f87171' }]}>
              📍 {permissions.location === 'granted' ? '✓' : '✗'}
            </Text>
          </View>
          {!permissions.allGranted && permissionsRequested && (
            <Pressable onPress={requestAllPermissions} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>Grant Permissions</Text>
            </Pressable>
          )}
        </View>
        {isConnecting && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      </View>
    );
  }

  // Connected - show mode-based UI
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} hidden={screenMode === 'blank'} />

      {/* Blank mode - touch surface with menu button */}
      {screenMode === 'blank' && (
        <>
          <View
            style={styles.blankScreen}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleTouch(e.nativeEvent.touches)}
            onResponderMove={(e) => handleTouch(e.nativeEvent.touches)}
            onResponderRelease={() => handleTouch([])}
            onResponderTerminate={() => handleTouch([])}
          >
            <Text
              style={[
                styles.blankHint,
                {
                  color: overrideTextColor ?? mutedColor,
                  fontSize: overrideTextSize ?? 14,
                },
              ]}
            >
              {overrideText ?? ''}
            </Text>
          </View>
          {/* Menu button in top right corner - outside touch view */}
          <Pressable style={styles.menuButton} onPress={() => setScreenMode('logs')}>
            <Text style={styles.menuButtonText}>☰</Text>
          </Pressable>
        </>
      )}

      {/* Camera preview mode */}
      {screenMode === 'camera' && (
        <View style={styles.cameraContainer}>
          <CameraPreview />
          <View style={styles.cameraOverlay}>
            <Pressable style={styles.closeButton} onPress={() => setScreenMode('blank')}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Logs mode */}
      {screenMode === 'logs' && (
        <View style={styles.logsContainer}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.label, { color: mutedColor }]}>Device</Text>
              <Text style={[styles.value, { color: textColor }]}>{state.deviceName}</Text>
            </View>
            <Button title="Disconnect" onPress={disconnect} color="#ff6b6b" />
          </View>

          <View style={styles.modeButtons}>
            <Pressable
              style={[styles.modeButton, { backgroundColor: isDark ? '#222' : '#eee' }]}
              onPress={() => setScreenMode('blank')}
            >
              <Text style={[styles.modeButtonText, { color: textColor }]}>Blank</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, { backgroundColor: isDark ? '#222' : '#eee' }]}
              onPress={() => setScreenMode('camera')}
            >
              <Text style={[styles.modeButtonText, { color: textColor }]}>Camera</Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { color: mutedColor }]}>Logs</Text>
          <ScrollView style={[styles.logContainer, { borderColor: isDark ? '#333' : '#ddd' }]}>
            {state.logs.length === 0 && (
              <Text style={[styles.muted, { color: mutedColor }]}>Waiting for events...</Text>
            )}
            {state.logs.map((log, idx) => (
              <Text key={`${log}-${idx}`} style={[styles.log, { color: textColor }]}>
                {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Hidden bridges - ALWAYS mounted when connected, regardless of screen mode */}
      <View style={styles.hiddenBridges}>
        <TorchBridge />
        {state.host && state.token && <CameraBridge ventoHost={state.host} token={state.token} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    backgroundColor: '#1d1d24',
  },
  error: {
    color: '#ff6b6b',
    textAlign: 'center',
  },
  permissionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  permissionItem: {
    fontSize: 16,
  },
  permissionButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  // Blank mode
  blankScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blankHint: {
    fontSize: 14,
    opacity: 0.5,
  },
  menuButton: {
    position: 'absolute',
    top: 40,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 20,
    color: 'rgba(128, 128, 128, 0.8)',
  },

  // Camera mode
  cameraContainer: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  // Logs mode
  logsContainer: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '500',
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  logContainer: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  log: {
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  muted: {
    fontStyle: 'italic',
  },
  hiddenBridges: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
