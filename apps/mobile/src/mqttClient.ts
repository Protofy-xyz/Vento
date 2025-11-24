import { Client, Message } from 'paho-mqtt';

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
  private client: Client | null = null;

  async connect(opts: MQTTConnectOptions) {
    const clientId = `${opts.deviceName}-${Date.now()}`;
    const { url, useSSL } = normalizeBrokerUrl(opts.hostUrl);
    this.client = new Client(url, `vento-mobile-${Date.now()}`);

    await new Promise<void>((resolve, reject) => {
      this.client!.onConnectionLost = (responseObject) => {
        if (responseObject.errorCode !== 0) {
          console.warn('MQTT connection lost', responseObject.errorMessage);
        }
      };

      this.client!.onMessageArrived = (message) => {
        const topic = message.destinationName;
        const parsed = parseActionTopic(topic);
        if (!parsed) {
          return;
        }
        opts.onMessage({
          subsystem: parsed.subsystem,
          action: parsed.action,
          requestId: parsed.requestId,
          payload: message.payloadString,
          topic,
          reply: async (body: any) => {
            if (!parsed.requestId || !this.client) return;
            const replyTopic = `${topic}/reply`;
            const msg = new Message(JSON.stringify(body));
            msg.destinationName = replyTopic;
            this.client.send(msg);
          },
        });
      };

      this.client!.connect({
        useSSL,
        userName: opts.username,
        password: opts.password,
        onSuccess: () => {
          const actionsTopic = `devices/${opts.deviceName}/+/actions/#`;
          this.client!.subscribe(actionsTopic);
          resolve();
        },
        onFailure: (err) => {
          reject(new Error(err.errorMessage));
        },
      });
    });
  }

  publish(deviceName: string, endpoint: string, payload: any) {
    if (!this.client) {
      throw new Error('MQTT not connected');
    }
    const message = new Message(JSON.stringify(payload));
    message.destinationName = `devices/${deviceName}${endpoint}`;
    this.client.send(message);
  }

  disconnect() {
    if (this.client?.isConnected()) {
      this.client.disconnect();
    }
    this.client = null;
  }
}

function parseActionTopic(topic: string) {
  const parts = topic.split('/').filter(Boolean);
  if (parts.length < 5) return null;
  const [root, device, subsystem, actionsKeyword, action, ...rest] = parts;
  if (root !== 'devices' || actionsKeyword !== 'actions') {
    return null;
  }
  const requestId = rest[0];
  return {
    subsystem,
    action,
    requestId,
  };
}

function normalizeBrokerUrl(hostUrl: string): { url: string; useSSL: boolean } {
  try {
    const url = new URL(hostUrl);
    if (url.protocol === 'ws:' || url.protocol === 'wss:') {
      return { url: url.toString(), useSSL: url.protocol === 'wss:' };
    }
    const useSSL = url.protocol === 'https:';
    const port = url.port ? `:${url.port}` : '';
    return {
      url: `${useSSL ? 'wss' : 'ws'}://${url.hostname}${port}/websocket`,
      useSSL,
    };
  } catch {
    return { url: 'ws://localhost:8000/websocket', useSSL: false };
  }
}

