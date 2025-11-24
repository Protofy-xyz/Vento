import 'react-native-url-polyfill/auto';
import mqtt, { MqttClient } from 'mqtt';

export interface MQTTConnectOptions {
  hostUrl: string;
  username: string;
  password: string;
  deviceName: string;
  onMessage: (message: {
    subsystem: string;
    action: string;
    payload: string;
    requestId?: string;
    topic: string;
    reply: (body: any) => Promise<void>;
  }) => void;
}

export class MQTTManager {
  private client: MqttClient | null = null;
  private deviceName: string = '';

  async connect(opts: MQTTConnectOptions) {
    this.deviceName = opts.deviceName;
    const clientId = opts.deviceName;
    const brokerUrl = buildMqttUrl(opts.hostUrl);
    
    console.log('[mqtt] connecting to:', brokerUrl);
    console.log('[mqtt] clientId:', clientId);
    console.log('[mqtt] username:', opts.username);
    
    return new Promise<void>((resolve, reject) => {
      this.client = mqtt.connect(brokerUrl, {
        clientId,
        username: opts.username,
        password: opts.password,
        clean: true,
        keepalive: 60,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      });

      this.client.on('connect', () => {
        console.log('[mqtt] ✅ connected successfully');
        
        const topic = `devices/${opts.deviceName}/+/actions/#`;
        console.log('[mqtt] subscribing to:', topic);
        
        this.client!.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            console.error('[mqtt] ❌ subscribe error:', err);
            reject(err);
          } else {
            console.log('[mqtt] ✅ subscribed to:', topic);
            resolve();
          }
        });
      });

      this.client.on('error', (err) => {
        console.error('[mqtt] ❌ connection error:', err);
        reject(err);
      });

      this.client.on('close', () => {
        console.warn('[mqtt] connection closed');
      });

      this.client.on('message', (topic, message) => {
        const payload = message.toString();
        console.log('[mqtt] ✅ MESSAGE ARRIVED:', topic, 'payload:', payload);
        
        const parsed = parseActionTopic(topic);
        if (!parsed) {
          console.log('[mqtt] ignored topic', topic);
          return;
        }
        
        console.log('[mqtt] dispatching action', parsed.subsystem, parsed.action);
        opts.onMessage({
          subsystem: parsed.subsystem,
          action: parsed.action,
          requestId: parsed.requestId,
          payload,
          topic,
          reply: async (body: any) => {
            if (!parsed.requestId || !this.client) return;
            const replyTopic = `${topic}/reply`;
            console.log('[mqtt] sending reply to:', replyTopic);
            this.client.publish(replyTopic, JSON.stringify(body), { qos: 1 });
          },
        });
      });
    });
  }

  publish(deviceName: string, endpoint: string, payload: any) {
    if (!this.client || !this.client.connected) {
      console.warn('[mqtt] cannot publish, not connected');
      return;
    }
    const topic = `devices/${deviceName}${endpoint}`;
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }
}

function parseActionTopic(topic: string) {
  const parts = topic.split('/').filter(Boolean);
  console.log('[mqtt] parse parts', parts);
  if (parts.length < 5) return null;
  const [root, device, subsystem, actionsKeyword, action, ...rest] = parts;
  if (root !== 'devices' || actionsKeyword !== 'actions') {
    return null;
  }
  if (rest.length === 0 || rest[rest.length - 1] === 'reply') {
    console.log('[mqtt] skip reply', topic);
    return null;
  }
  const normalizedAction = action.replace(/^system_/, '');
  const requestId = rest[0];
  console.log('[mqtt] parsed action', { subsystem, action, normalizedAction, requestId });
  return {
    subsystem,
    action: normalizedAction,
    requestId,
  };
}

function buildMqttUrl(hostUrl: string): string {
  try {
    const url = new URL(hostUrl);
    const useSSL = url.protocol === 'https:';
    const host = url.hostname;
    const port = url.port || (useSSL ? '443' : '80');
    
    // Use WebSocket transport (mqtt.js will handle the protocol)
    return `${useSSL ? 'wss' : 'ws'}://${host}:${port}/websocket`;
  } catch {
    return 'ws://localhost:8000/websocket';
  }
}

