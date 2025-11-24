export interface MonitorDescriptor {
  name: string;
  label: string;
  description?: string;
  units?: string;
  endpoint: string;
  connectionType: 'mqtt';
  ephemeral: boolean;
  cardProps?: Record<string, any>;
}

export interface ActionDescriptor {
  name: string;
  label: string;
  description?: string;
  endpoint: string;
  connectionType: 'mqtt';
  payload: {
    type: string;
    schema?: Record<string, any>;
    value?: any;
  };
  cardProps?: Record<string, any>;
  mode?: 'request-reply';
}

export interface MonitorRuntime {
  descriptor: MonitorDescriptor;
  boot?: () => Promise<any>;
  intervalMs?: number;
  producer?: () => Promise<any>;
}

export type ActionHandler = (payload: string, reply: (body: any) => Promise<void>) => Promise<void> | void;

export interface ActionRuntime {
  descriptor: ActionDescriptor;
  handler: ActionHandler;
}

export interface SubsystemDefinition {
  name: string;
  type: string;
  monitors: MonitorRuntime[];
  actions: ActionRuntime[];
}

export interface DevicePayload {
  name: string;
  currentSdk: string;
  subsystem: Array<{
    name: string;
    type: string;
    monitors?: MonitorDescriptor[];
    actions?: ActionDescriptor[];
  }>;
}

