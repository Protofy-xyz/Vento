import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAgent } from './src/hooks/useAgent';

export default function App() {
  const { state, connect, disconnect } = useAgent();
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (state.host && !host) {
      setHost(state.host);
    }
    if (state.username && !username) {
      setUsername(state.username);
    }
  }, [state.host, state.username, host, username]);

  const isConnecting = state.status === 'connecting';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      {state.status !== 'connected' ? (
        <View style={styles.form}>
          <Text style={styles.title}>Vento Mobile Agent</Text>
          <TextInput
            style={styles.input}
            placeholder="Vento host (e.g. http://localhost:8000)"
            autoCapitalize="none"
            autoCorrect={false}
            value={host}
            onChangeText={setHost}
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button title={isConnecting ? 'Connecting...' : 'Connect'} onPress={() => connect({ host, username, password })} disabled={isConnecting} />
          {state.error && <Text style={styles.error}>{state.error}</Text>}
        </View>
      ) : (
        <View style={styles.dashboard}>
          <View style={styles.header}>
            <View>
              <Text style={styles.label}>Device</Text>
              <Text style={styles.value}>{state.deviceName}</Text>
            </View>
            <Button title="Disconnect" onPress={disconnect} />
          </View>
          <Text style={styles.label}>Logs</Text>
          <ScrollView style={styles.logContainer}>
            {state.logs.length === 0 && <Text style={styles.muted}>Waiting for events...</Text>}
            {state.logs.map((log, idx) => (
              <Text key={`${log}-${idx}`} style={styles.log}>
                {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}
      {isConnecting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    paddingHorizontal: 16,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
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
  dashboard: {
    flex: 1,
    paddingTop: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 4,
  },
  value: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  logContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#111',
  },
  log: {
    color: '#d1d5db',
    fontSize: 12,
    marginBottom: 4,
  },
  muted: {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
