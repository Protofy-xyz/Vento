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

// Callback to emit a new value
export type EmitFn = (value: any) => void;

// Cleanup function returned by subscribe
export type UnsubscribeFn = () => void;

export interface MonitorRuntime {
  descriptor: MonitorDescriptor;
  // Get initial value (optional, for boot)
  boot?: () => Promise<any>;
  // Subscribe to changes - returns cleanup function
  // The monitor should call emit() whenever the value changes
  // minIntervalMs is the minimum time between emissions (throttle)
  subscribe?: (emit: EmitFn) => UnsubscribeFn;
  minIntervalMs?: number; // Throttle interval (default: 500ms)
  
  // Legacy polling mode (deprecated, use subscribe instead)
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
