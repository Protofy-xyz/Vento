import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { VentoClient } from '../api/ventoClient';
import { MQTTManager } from '../mqttClient';
import { buildDevicePayload, buildSubsystems } from '../subsystems';
import type { SubsystemDefinition, UnsubscribeFn } from '../subsystems/types';
import { clearStoredConfig, loadStoredConfig, saveStoredConfig, type StoredConfig } from '../storage';
import { formatError, generateDeviceName } from '../utils';

type AgentStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface ConnectPayload {
  host: string;
  username: string;
  password?: string; // Optional if we have a stored token
  token?: string; // Use stored token instead of password
}

interface AgentState {
  status: AgentStatus;
  deviceName?: string;
  error?: string;
  logs: string[];
  host?: string;
  username?: string;
  token?: string;
}

interface AgentControls {
  state: AgentState;
  connect: (payload: ConnectPayload) => void;
  disconnect: () => void;
}

export function useAgent(): AgentControls {
  const [state, setState] = useState<AgentState>({ status: 'idle', logs: [] });
  const configRef = useRef<{
    host: string;
    username: string;
    token: string;
    deviceName: string;
    subsystems: SubsystemDefinition[];
  } | null>(null);
  const mqttRef = useRef<MQTTManager | null>(null);
  const cleanupRef = useRef<Array<UnsubscribeFn | ReturnType<typeof setInterval>>>([]);

  const appendLog = useCallback((entry: string) => {
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-100), `${new Date().toLocaleTimeString()} ${entry}`],
    }));
  }, []);

  const stopAgent = useCallback(() => {
    // Clean up all subscriptions and intervals
    for (const cleanup of cleanupRef.current) {
      if (typeof cleanup === 'function') {
        cleanup();
      } else {
        clearInterval(cleanup);
      }
    }
    cleanupRef.current = [];
    mqttRef.current?.disconnect();
    mqttRef.current = null;
    configRef.current = null;
    (globalThis as any).__ventoMqtt = null;
    deactivateKeepAwake('vento-mobile');
  }, []);

  const connect = useCallback(
    async ({ host, username, password, token: storedToken }: ConnectPayload) => {
      stopAgent();
      setState((prev) => ({ ...prev, status: 'connecting', error: undefined }));
      try {
        const client = new VentoClient(host);
        let token: string;
        
        const t0 = Date.now();
        if (storedToken) {
          // Use stored token - skip login
          appendLog('Using stored session');
          token = storedToken;
        } else if (password) {
          // Login with password
          appendLog('Authenticating user');
          token = await client.login(username, password);
          appendLog(`Login successful (${Date.now() - t0}ms)`);
        } else {
          throw new Error('No password or token provided');
        }

        const t1 = Date.now();
        const stored = (await loadStoredConfig()) ?? {};
        const deviceName = stored.deviceName ?? await generateDeviceName();
        const subsystems = buildSubsystems();
        actionHandlers.current = collectActionHandlers(subsystems);
        const payload = buildDevicePayload(deviceName, subsystems);
        appendLog(`Built payload (${Date.now() - t1}ms)`);

        const t2 = Date.now();
        appendLog('Ensuring device exists');
        const isNewDevice = await client.ensureDevice(token, payload);
        appendLog(`Device ensured (${Date.now() - t2}ms)`);
        if (isNewDevice) {
          const t3 = Date.now();
          appendLog('New device, registering actions...');
          await client.triggerRegisterActions(token);
          appendLog(`Actions registered (${Date.now() - t3}ms)`);
        }

        configRef.current = { host, username, token, deviceName, subsystems };
        await saveStoredConfig({ host, username, token, deviceName });

        const t4 = Date.now();
        const mqttUrl = buildMQTTUrl(host);
        appendLog(`Connecting MQTT...`);
        const mqtt = new MQTTManager();
        await mqtt.connect({
          hostUrl: mqttUrl,
          username,
          password: token,
          deviceName,
          onMessage: ({ subsystem, action, payload, requestId, reply }) => {
            const key = `${subsystem}:${action}`;
            const handler = actionHandlers.current.get(key);
            if (!handler) {
              appendLog(`Unhandled action ${key}`);
              return;
            }
            appendLog(`Action received ${key} ${payload}`);
            handler(payload, async (body) => {
              if (!requestId) return;
              await reply(body);
            });
          },
        });
        appendLog(`MQTT connected (${Date.now() - t4}ms)`);
        mqttRef.current = mqtt;
        // Expose MQTT globally for touch events
        (globalThis as any).__ventoMqtt = mqtt;

        const t5 = Date.now();
        appendLog('Publishing boot monitors...');
        await publishBootMonitors(deviceName, subsystems, mqtt);
        appendLog(`Boot monitors done (${Date.now() - t5}ms)`);
        startMonitors(deviceName, subsystems, mqtt, cleanupRef);
        await activateKeepAwakeAsync('vento-mobile');
        setState({
          status: 'connected',
          deviceName,
          logs: [],
          host,
          username,
          token,
        });
      } catch (err) {
        appendLog(`Error: ${formatError(err)}`);
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: formatError(err),
        }));
        stopAgent();
      }
    },
    [appendLog, stopAgent],
  );

  const disconnect = useCallback(async () => {
    stopAgent();
    setState((prev) => ({ ...prev, status: 'idle' }));
    await clearStoredConfig();
  }, [stopAgent]);

  useEffect(() => {
    loadStoredConfig().then((cfg) => {
      if (cfg && cfg.host && cfg.username && cfg.token) {
        // Auto-connect with stored credentials
        console.log('[agent] found stored config, auto-connecting...');
        connect({
          host: cfg.host,
          username: cfg.username,
          token: cfg.token,
        });
      } else if (cfg) {
        // Just populate the form
        setState((prev) => ({
          ...prev,
          host: cfg.host,
          username: cfg.username,
        }));
      }
    });
    return () => {
      stopAgent();
    };
  }, []);

  return useMemo(
    () => ({
      state,
      connect,
      disconnect,
    }),
    [state, connect, disconnect],
  );
}

const actionHandlers = {
  current: new Map<string, (payload: string, reply: (body: any) => Promise<void>) => void>(),
};

function collectActionHandlers(subsystems: SubsystemDefinition[]) {
  const map = new Map<string, (payload: string, reply: (body: any) => Promise<void>) => void>();
  for (const subsystem of subsystems) {
    for (const action of subsystem.actions) {
      map.set(`${subsystem.name}:${action.descriptor.name}`, action.handler);
      const legacyName = action.descriptor.name.startsWith('system_')
        ? action.descriptor.name.replace(/^system_/, '')
        : `system_${action.descriptor.name}`;
      map.set(`${subsystem.name}:${legacyName}`, action.handler);
    }
  }
  return map;
}

async function publishBootMonitors(deviceName: string, subsystems: SubsystemDefinition[], mqtt: MQTTManager) {
  // Collect all boot monitors
  const bootTasks: Array<{ endpoint: string; boot: () => Promise<any> }> = [];
  for (const subsystem of subsystems) {
    for (const monitor of subsystem.monitors) {
      if (!monitor.boot) continue;
      bootTasks.push({ endpoint: monitor.descriptor.endpoint, boot: monitor.boot });
    }
  }
  
  // Execute all boot monitors in parallel
  const results = await Promise.allSettled(
    bootTasks.map(async (task) => {
      const value = await task.boot();
      return { endpoint: task.endpoint, value };
    })
  );
  
  // Publish results
  for (const result of results) {
    if (result.status === 'fulfilled') {
      mqtt.publish(deviceName, result.value.endpoint, result.value.value);
    }
  }
}

// Serialize value for comparison
function serializeValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function startMonitors(
  deviceName: string,
  subsystems: SubsystemDefinition[],
  mqtt: MQTTManager,
  ref: MutableRefObject<Array<UnsubscribeFn | ReturnType<typeof setInterval>>>,
) {
  for (const subsystem of subsystems) {
    for (const monitor of subsystem.monitors) {
      // New subscription-based monitors
      if (monitor.subscribe) {
        const minInterval = monitor.minIntervalMs ?? 500;
        let lastValue = '';
        let lastEmitTime = 0;
        let pendingValue: any = null;
        let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

        const emit = (value: any) => {
          const serialized = serializeValue(value);
          
          // Skip if value hasn't changed
          if (serialized === lastValue) {
            return;
          }

          const now = Date.now();
          const timeSinceLastEmit = now - lastEmitTime;

          if (timeSinceLastEmit >= minInterval) {
            // Enough time has passed, emit immediately
            lastValue = serialized;
            lastEmitTime = now;
            mqtt.publish(deviceName, monitor.descriptor.endpoint, value);
          } else {
            // Throttle: schedule emission for later
            pendingValue = value;
            if (!pendingTimeout) {
              pendingTimeout = setTimeout(() => {
                pendingTimeout = null;
                if (pendingValue !== null) {
                  const newSerialized = serializeValue(pendingValue);
                  if (newSerialized !== lastValue) {
                    lastValue = newSerialized;
                    lastEmitTime = Date.now();
                    mqtt.publish(deviceName, monitor.descriptor.endpoint, pendingValue);
                  }
                  pendingValue = null;
                }
              }, minInterval - timeSinceLastEmit);
            }
          }
        };

        const unsubscribe = monitor.subscribe(emit);
        ref.current.push(() => {
          unsubscribe();
          if (pendingTimeout) {
            clearTimeout(pendingTimeout);
          }
        });
      }
      // Legacy polling-based monitors
      else if (monitor.intervalMs && monitor.producer) {
        let lastValue = '';
        const timer = setInterval(async () => {
          try {
            const value = await monitor.producer!();
            const serialized = serializeValue(value);
            
            // Only publish if value changed
            if (serialized !== lastValue) {
              lastValue = serialized;
              mqtt.publish(deviceName, monitor.descriptor.endpoint, value);
            }
          } catch (err) {
            console.warn('monitor publish failed', err);
          }
        }, monitor.intervalMs);
        ref.current.push(timer);
      }
    }
  }
}

function buildMQTTUrl(host: string) {
  try {
    const url = new URL(host);
    if (url.protocol === 'ws:' || url.protocol === 'wss:') {
      return url.toString();
    }
    const scheme = url.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${url.hostname}:${url.port || 8000}/websocket`;
  } catch {
    return 'ws://localhost:8000/websocket';
  }
}
