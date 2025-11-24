import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { VentoClient } from '../api/ventoClient';
import { MQTTManager } from '../mqttClient';
import { buildDevicePayload, buildSubsystems } from '../subsystems';
import type { SubsystemDefinition } from '../subsystems/types';
import { clearStoredConfig, loadStoredConfig, saveStoredConfig, type StoredConfig } from '../storage';
import { formatError, generateDeviceName } from '../utils';

type AgentStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface ConnectPayload {
  host: string;
  username: string;
  password: string;
}

interface AgentState {
  status: AgentStatus;
  deviceName?: string;
  error?: string;
  logs: string[];
  host?: string;
  username?: string;
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
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const appendLog = useCallback((entry: string) => {
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-100), `${new Date().toLocaleTimeString()} ${entry}`],
    }));
  }, []);

  const stopAgent = useCallback(() => {
    intervalsRef.current.forEach(clearInterval);
    intervalsRef.current = [];
    mqttRef.current?.disconnect();
    mqttRef.current = null;
    configRef.current = null;
    deactivateKeepAwake('vento-mobile');
  }, []);

  const connect = useCallback(
    async ({ host, username, password }: ConnectPayload) => {
      stopAgent();
      setState((prev) => ({ ...prev, status: 'connecting', error: undefined }));
      try {
        const client = new VentoClient(host);
        appendLog('Authenticating user');
        const token = await client.login(username, password);
        appendLog('Login successful');

        const stored = (await loadStoredConfig()) ?? {};
        const deviceName = stored.deviceName ?? generateDeviceName();
        const subsystems = buildSubsystems();
        const payload = buildDevicePayload(deviceName, subsystems);

        appendLog('Ensuring device exists');
        await client.ensureDevice(token, payload);
        await client.triggerRegisterActions(token);

        configRef.current = { host, username, token, deviceName, subsystems };
        await saveStoredConfig({ host, username, token, deviceName });

        const mqttUrl = buildMQTTUrl(host);
        appendLog(`Connecting MQTT (${mqttUrl})`);
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
            handler(payload, async (body) => {
              if (!requestId) return;
              await reply(body);
            });
          },
        });
        mqttRef.current = mqtt;

        appendLog('Publishing boot monitors');
        await publishBootMonitors(deviceName, subsystems, mqtt);
        startIntervals(deviceName, subsystems, mqtt, intervalsRef);
        actionHandlers.current = collectActionHandlers(subsystems);

        await activateKeepAwakeAsync('vento-mobile');
        setState({
          status: 'connected',
          deviceName,
          logs: [],
          host,
          username,
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
      if (cfg) {
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
  }, [stopAgent]);

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
    }
  }
  return map;
}

async function publishBootMonitors(deviceName: string, subsystems: SubsystemDefinition[], mqtt: MQTTManager) {
  for (const subsystem of subsystems) {
    for (const monitor of subsystem.monitors) {
      if (!monitor.boot) continue;
      const value = await monitor.boot();
      mqtt.publish(deviceName, monitor.descriptor.endpoint, value);
    }
  }
}

function startIntervals(
  deviceName: string,
  subsystems: SubsystemDefinition[],
  mqtt: MQTTManager,
  ref: MutableRefObject<ReturnType<typeof setInterval>[]>,
) {
  for (const subsystem of subsystems) {
    for (const monitor of subsystem.monitors) {
      if (!monitor.intervalMs || !monitor.producer) continue;
      const timer = setInterval(async () => {
        try {
          const value = await monitor.producer!();
          mqtt.publish(deviceName, monitor.descriptor.endpoint, value);
        } catch (err) {
          console.warn('monitor publish failed', err);
        }
      }, monitor.intervalMs);
      ref.current.push(timer);
    }
  }
}

function buildMQTTUrl(host: string) {
  try {
    const parsed = new URL(host);
    const scheme = parsed.protocol === 'https:' ? 'wss' : 'ws';
    const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
    const mqttPort = port === 443 ? 8084 : 1883;
    return `${scheme}://${parsed.hostname}:${mqttPort}/mqtt`;
  } catch {
    return 'ws://localhost:1883/mqtt';
  }
}

