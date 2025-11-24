import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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

import { useAgent } from './src/hooks/useAgent';
import { TorchBridge } from './src/components/TorchBridge';
import { CameraBridge } from './src/components/CameraBridge';
import { CameraPreview } from './src/components/CameraPreview';
import { registerScreenColorCallback } from './src/subsystems/screen';

type ScreenMode = 'blank' | 'camera' | 'logs';

export default function App() {
  const { state, connect, disconnect } = useAgent();
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [screenMode, setScreenMode] = useState<ScreenMode>('blank');
  const [overrideColor, setOverrideColor] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Register screen color callback
  useEffect(() => {
    registerScreenColorCallback(setOverrideColor);
    return () => registerScreenColorCallback(null);
  }, []);

  useEffect(() => {
    if (state.host && !host) {
      setHost(state.host);
    }
    if (state.username && !username) {
      setUsername(state.username);
    }
  }, [state.host, state.username, host, username]);

  // Keep screen awake while connected
  useEffect(() => {
    if (state.status === 'connected') {
      activateKeepAwakeAsync('vento-app');
    } else {
      deactivateKeepAwake('vento-app');
    }
    return () => {
      deactivateKeepAwake('vento-app');
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
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Blank mode - just the background */}
      {screenMode === 'blank' && (
        <Pressable style={styles.blankScreen} onPress={() => setScreenMode('logs')}>
          <Text style={[styles.blankHint, { color: mutedColor }]}>Tap to show controls</Text>
        </Pressable>
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
