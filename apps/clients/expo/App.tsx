import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Linking,
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
import { CameraView, useCameraPermissions } from 'expo-camera';

import { useAgent } from './src/hooks/useAgent';
import { usePermissions } from './src/hooks/usePermissions';
import { TorchBridge } from './src/components/TorchBridge';
import { CameraBridge } from './src/components/CameraBridge';
import { CameraPreview } from './src/components/CameraPreview';
import {
  registerScreenColorCallback,
  registerScreenHtmlCallback,
  registerScreenTextCallback,
  registerScreenTextColorCallback,
  registerScreenTextSizeCallback,
  registerTouchPublisher,
  registerHtmlNamePublisher,
  type TouchData,
  type ScreenHtmlState,
} from './src/subsystems/screen';
import { WebView } from 'react-native-webview';
import { MQTTManager } from './src/mqttClient';

type ScreenMode = 'blank' | 'camera' | 'logs';
type LoginMode = 'choose' | 'scan' | 'manual';

// Parse vento:// URL scheme
function parseVentoUrl(url: string): { host: string; user: string; token: string } | null {
  try {
    // vento://connect?host=xxx&user=xxx&token=xxx
    if (!url.startsWith('vento://connect')) {
      return null;
    }
    const urlObj = new URL(url);
    const host = urlObj.searchParams.get('host');
    const user = urlObj.searchParams.get('user');
    const token = urlObj.searchParams.get('token');
    
    if (host && user && token) {
      return { host, user, token };
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const { state, connect, disconnect } = useAgent();
  const { state: permissions, requestAllPermissions } = usePermissions();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [screenMode, setScreenMode] = useState<ScreenMode>('blank');
  const [loginMode, setLoginMode] = useState<LoginMode>('choose');
  const [overrideColor, setOverrideColor] = useState<string | null>(null);
  const [overrideHtml, setOverrideHtml] = useState<ScreenHtmlState | null>(null);
  const [overrideText, setOverrideText] = useState<string | null>(null);
  const [overrideTextColor, setOverrideTextColor] = useState<string | null>(null);
  const [overrideTextSize, setOverrideTextSize] = useState<number | null>(null);
  const [permissionsRequested, setPermissionsRequested] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
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

  // Handle deep link (vento://) on app start
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const credentials = parseVentoUrl(event.url);
      if (credentials) {
        setHost(credentials.host);
        setUsername(credentials.user);
        setPassword(credentials.token);
        // Auto-connect
        connect({
          host: credentials.host,
          username: credentials.user,
          password: credentials.token,
        });
      }
    };

    // Check initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    });

    // Listen for URL changes
    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [connect]);

  // Register screen callbacks
  useEffect(() => {
    registerScreenColorCallback(setOverrideColor);
    registerScreenHtmlCallback(setOverrideHtml);
    registerScreenTextCallback(setOverrideText);
    registerScreenTextColorCallback(setOverrideTextColor);
    registerScreenTextSizeCallback(setOverrideTextSize);
    
    // Register html_name publisher for MQTT monitoring
    registerHtmlNamePublisher((name) => {
      if ((globalThis as any).__ventoMqtt && state.deviceName) {
        const mqtt = (globalThis as any).__ventoMqtt as MQTTManager;
        mqtt.publish(state.deviceName, '/screen/monitors/html_name', { name });
      }
    });
    
    return () => {
      registerScreenColorCallback(null);
      registerScreenHtmlCallback(null);
      registerScreenTextCallback(null);
      registerScreenTextColorCallback(null);
      registerScreenTextSizeCallback(null);
      registerHtmlNamePublisher(null);
    };
  }, [state.deviceName]);

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

  const handleQrScanned = useCallback(({ data }: { data: string }) => {
    setScanError(null);
    const credentials = parseVentoUrl(data);
    if (credentials) {
      setHost(credentials.host);
      setUsername(credentials.user);
      setPassword(credentials.token);
      setLoginMode('choose');
      // Auto-connect
      connect({
        host: credentials.host,
        username: credentials.user,
        password: credentials.token,
      });
    } else {
      setScanError('Invalid QR code. Please scan a Vento connection QR.');
    }
  }, [connect]);

  const isConnecting = state.status === 'connecting';
  const isConnected = state.status === 'connected';

  const backgroundColor = overrideColor ?? (isDark ? '#000' : '#fff');
  const textColor = isDark ? '#fff' : '#000';
  const mutedColor = isDark ? '#666' : '#999';

  // Login screen
  if (!isConnected) {
    // Choose mode: Scan or Manual
    if (loginMode === 'choose') {
      return (
        <View style={[styles.container, { backgroundColor: '#0b0b0f' }]}>
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <View style={styles.chooseContainer}>
            <Text style={styles.title}>Vento Mobile Agent</Text>
            <Text style={styles.subtitle}>Choose how to connect</Text>
            
            <Pressable 
              style={styles.chooseButton}
              onPress={async () => {
                if (!cameraPermission?.granted) {
                  await requestCameraPermission();
                }
                setLoginMode('scan');
              }}
            >
              <Text style={styles.chooseButtonIcon}>📷</Text>
              <View style={styles.chooseButtonTextContainer}>
                <Text style={styles.chooseButtonTitle}>Scan to Connect</Text>
                <Text style={styles.chooseButtonDesc}>Scan QR code from Vento admin panel</Text>
              </View>
            </Pressable>

            <Pressable 
              style={[styles.chooseButton, styles.chooseButtonSecondary]}
              onPress={() => setLoginMode('manual')}
            >
              <Text style={styles.chooseButtonIcon}>⌨️</Text>
              <View style={styles.chooseButtonTextContainer}>
                <Text style={styles.chooseButtonTitle}>Connect Manually</Text>
                <Text style={styles.chooseButtonDesc}>Enter host, username and password</Text>
              </View>
            </Pressable>

            {/* Reconnect button - only shown if we have stored credentials */}
            {state.storedConfig?.host && state.storedConfig?.token && (
              <Pressable 
                style={[styles.chooseButton, styles.chooseButtonReconnect]}
                onPress={() => {
                  connect({
                    host: state.storedConfig!.host!,
                    username: state.storedConfig!.username!,
                    token: state.storedConfig!.token!,
                  });
                }}
              >
                <Text style={styles.chooseButtonIcon}>🔄</Text>
                <View style={styles.chooseButtonTextContainer}>
                  <Text style={styles.chooseButtonTitle}>Reconnect</Text>
                  <Text style={styles.chooseButtonDesc} numberOfLines={1}>
                    {state.storedConfig.username}@{state.storedConfig.host?.replace(/^https?:\/\//, '')}
                  </Text>
                </View>
              </Pressable>
            )}

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

    // Scan mode: QR Scanner
    if (loginMode === 'scan') {
      if (!cameraPermission?.granted) {
        return (
          <View style={[styles.container, { backgroundColor: '#0b0b0f' }]}>
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <View style={styles.form}>
              <Text style={styles.title}>Camera Permission Required</Text>
              <Text style={[styles.subtitle, { marginBottom: 20 }]}>
                Camera access is needed to scan QR codes
              </Text>
              <Button title="Grant Permission" onPress={requestCameraPermission} />
              <View style={{ height: 12 }} />
              <Button title="Back" onPress={() => setLoginMode('choose')} color="#666" />
            </View>
          </View>
        );
      }

      return (
        <View style={[styles.container, { backgroundColor: '#0b0b0f' }]}>
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleQrScanned}
          />
          
          {/* Overlay with scan frame */}
          <View style={styles.scanOverlay}>
            <View style={styles.scanHeader}>
              <Pressable onPress={() => setLoginMode('choose')} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
              </Pressable>
              <Text style={styles.scanTitle}>Scan QR Code</Text>
            </View>
            
            <View style={styles.scanFrameContainer}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanHint}>
                Point camera at Vento connection QR code
              </Text>
              {scanError && (
                <Text style={styles.scanError}>{scanError}</Text>
              )}
            </View>
          </View>
          
          {isConnecting && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{ color: '#fff', marginTop: 12 }}>Connecting...</Text>
            </View>
          )}
        </View>
      );
    }

    // Manual mode: Classic form
    return (
      <View style={[styles.container, { backgroundColor: '#0b0b0f' }]}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <View style={styles.form}>
          <Pressable onPress={() => setLoginMode('choose')} style={styles.backButtonForm}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          
          <Text style={styles.title}>Vento Mobile Agent</Text>
          <TextInput
            style={styles.input}
            placeholder="Vento host (e.g. http://192.168.1.100:8000)"
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
      <StatusBar style={isDark ? 'light' : 'dark'} hidden={screenMode === 'blank'} translucent backgroundColor="transparent" />

      {/* Blank mode - WebView or touch surface with menu button */}
      {screenMode === 'blank' && (
        <>
          {overrideHtml ? (
            // WebView mode - show HTML content
            <View
              style={styles.webviewContainer}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => handleTouch(e.nativeEvent.touches)}
              onResponderMove={(e) => handleTouch(e.nativeEvent.touches)}
              onResponderRelease={() => handleTouch([])}
              onResponderTerminate={() => handleTouch([])}
            >
              <WebView
                style={styles.webview}
                source={{ html: overrideHtml.html }}
                scrollEnabled={false}
                bounces={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                overScrollMode="never"
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['*']}
                allowsFullscreenVideo={true}
                mediaPlaybackRequiresUserAction={false}
              />
            </View>
          ) : (
            // Plain mode - simple touch surface
            <View
              style={styles.blankScreen}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => handleTouch(e.nativeEvent.touches)}
              onResponderMove={(e) => handleTouch(e.nativeEvent.touches)}
              onResponderRelease={() => handleTouch([])}
              onResponderTerminate={() => handleTouch([])}
            >
              {overrideText ? (
                <Text
                  style={[
                    styles.blankHint,
                    {
                      color: overrideTextColor ?? mutedColor,
                      fontSize: overrideTextSize ?? 14,
                    },
                  ]}
                >
                  {overrideText}
                </Text>
              ) : (
                <View style={styles.welcomeContainer}>
                  <Text style={styles.welcomeIcon}>✓</Text>
                  <Text style={styles.welcomeTitle}>Connected to Vento</Text>
                  <Text style={styles.welcomeSubtitle}>
                    This device is now part of your Vento network
                  </Text>
                  <Text style={styles.welcomeDevice}>{state.deviceName}</Text>
                  <Text style={styles.welcomeHint}>
                    Tap ☰ to view logs or disconnect
                  </Text>
                </View>
              )}
            </View>
          )}
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

      {/* Menu/Settings mode */}
      {screenMode === 'logs' && (
        <View style={styles.menuContainer}>
          {/* Header with close button */}
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Settings</Text>
            <Pressable 
              style={styles.menuCloseButton} 
              onPress={() => setScreenMode('blank')}
            >
              <Text style={styles.menuCloseButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.menuContent} showsVerticalScrollIndicator={false}>
            {/* Connection Info Section */}
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>Connection</Text>
              <View style={styles.menuCard}>
                <View style={styles.menuCardRow}>
                  <Text style={styles.menuCardLabel}>Status</Text>
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Connected</Text>
                  </View>
                </View>
                <View style={styles.menuCardDivider} />
                <View style={styles.menuCardRow}>
                  <Text style={styles.menuCardLabel}>Device ID</Text>
                  <Text style={styles.menuCardValue} numberOfLines={1}>{state.deviceName}</Text>
                </View>
                <View style={styles.menuCardDivider} />
                <View style={styles.menuCardRow}>
                  <Text style={styles.menuCardLabel}>Server</Text>
                  <Text style={styles.menuCardValue} numberOfLines={1}>
                    {state.host?.replace(/^https?:\/\//, '')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Screen Mode Section */}
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>Screen Mode</Text>
              <View style={styles.menuCard}>
                <Pressable
                  style={styles.menuOption}
                  onPress={() => setScreenMode('blank')}
                >
                  <Text style={styles.menuOptionIcon}>📱</Text>
                  <View style={styles.menuOptionContent}>
                    <Text style={styles.menuOptionTitle}>Home Screen</Text>
                    <Text style={styles.menuOptionDesc}>Show welcome or remote content</Text>
                  </View>
                  <Text style={styles.menuOptionArrow}>→</Text>
                </Pressable>
                <View style={styles.menuCardDivider} />
                <Pressable
                  style={styles.menuOption}
                  onPress={() => setScreenMode('camera')}
                >
                  <Text style={styles.menuOptionIcon}>📷</Text>
                  <View style={styles.menuOptionContent}>
                    <Text style={styles.menuOptionTitle}>Camera Preview</Text>
                    <Text style={styles.menuOptionDesc}>View live camera feed</Text>
                  </View>
                  <Text style={styles.menuOptionArrow}>→</Text>
                </Pressable>
              </View>
            </View>

            {/* Logs Section */}
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>Activity Log</Text>
              <View style={[styles.menuCard, styles.logsCard]}>
                {state.logs.length === 0 ? (
                  <Text style={styles.logsEmpty}>No activity yet</Text>
                ) : (
                  state.logs.slice(-10).map((log, idx) => (
                    <Text key={`${log}-${idx}`} style={styles.logEntry}>
                      {log}
                    </Text>
                  ))
                )}
              </View>
            </View>

            {/* Disconnect Section */}
            <View style={styles.menuSection}>
              <Pressable style={styles.disconnectButton} onPress={disconnect}>
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </Pressable>
              <Text style={styles.disconnectHint}>
                You can reconnect anytime from the home screen
              </Text>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Hidden bridges - ALWAYS mounted when connected, regardless of screen mode */}
      <View style={styles.hiddenBridges}>
        <TorchBridge />
        {state.host && state.token && (
          <CameraBridge ventoHost={state.host} token={state.token} deviceName={state.deviceName} />
        )}
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
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
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
    backgroundColor: 'rgba(0,0,0,0.7)',
  },

  // Choose mode styles
  chooseContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  chooseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d1d24',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  chooseButtonSecondary: {
    backgroundColor: '#141418',
    borderColor: '#222',
  },
  chooseButtonReconnect: {
    backgroundColor: '#1a2a1a',
    borderColor: '#2a4a2a',
  },
  chooseButtonIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  chooseButtonTextContainer: {
    flex: 1,
  },
  chooseButtonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  chooseButtonDesc: {
    fontSize: 14,
    color: '#888',
  },

  // Scan mode styles
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  scanHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  backButtonForm: {
    marginBottom: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  scanTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  scanFrameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  scanHint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  scanError: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
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
  welcomeContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  welcomeIcon: {
    fontSize: 48,
    color: '#4ade80',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  welcomeDevice: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
    backgroundColor: '#1d1d24',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 32,
  },
  welcomeHint: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
  },
  webviewContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
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

  // Menu/Settings mode
  menuContainer: {
    flex: 1,
    backgroundColor: '#0b0b0f',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1d24',
  },
  menuTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  menuCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1d1d24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCloseButtonText: {
    fontSize: 18,
    color: '#888',
    fontWeight: '600',
  },
  menuContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  menuSection: {
    marginTop: 24,
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: '#1d1d24',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuCardLabel: {
    fontSize: 15,
    color: '#888',
  },
  menuCardValue: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  menuCardDivider: {
    height: 1,
    backgroundColor: '#2a2a32',
    marginHorizontal: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2a1a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#4ade80',
    fontWeight: '600',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuOptionIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  menuOptionContent: {
    flex: 1,
  },
  menuOptionTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    marginBottom: 2,
  },
  menuOptionDesc: {
    fontSize: 13,
    color: '#666',
  },
  menuOptionArrow: {
    fontSize: 18,
    color: '#444',
  },
  logsCard: {
    padding: 16,
    maxHeight: 200,
  },
  logsEmpty: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  logEntry: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'monospace',
    marginBottom: 6,
    lineHeight: 18,
  },
  disconnectButton: {
    backgroundColor: '#2a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a2020',
  },
  disconnectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b6b',
  },
  disconnectHint: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 40,
  },
  hiddenBridges: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
