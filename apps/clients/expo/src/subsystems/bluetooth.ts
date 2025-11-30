import { BleManager, Device, State, Characteristic } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { SubsystemDefinition, EmitFn, UnsubscribeFn } from './types';

// Singleton BLE manager
let bleManager: BleManager | null = null;

function getBleManager(): BleManager {
  if (!bleManager) {
    bleManager = new BleManager();
  }
  return bleManager;
}

// State tracking
let isScanning = false;
let connectedDevices = new Map<string, Device>();

// Endpoints
const BT_STATE_ENDPOINT = '/bluetooth/monitors/state';
const BT_DEVICES_ENDPOINT = '/bluetooth/monitors/devices';
const BT_SCAN_ENDPOINT = '/bluetooth/actions/scan';
const BT_STOP_SCAN_ENDPOINT = '/bluetooth/actions/stop_scan';
const BT_CONNECT_ENDPOINT = '/bluetooth/actions/connect';
const BT_DISCONNECT_ENDPOINT = '/bluetooth/actions/disconnect';
const BT_DISCOVER_ENDPOINT = '/bluetooth/actions/discover';
const BT_READ_ENDPOINT = '/bluetooth/actions/read';
const BT_WRITE_ENDPOINT = '/bluetooth/actions/write';
const BT_SUBSCRIBE_ENDPOINT = '/bluetooth/actions/subscribe';
const BT_UNSUBSCRIBE_ENDPOINT = '/bluetooth/actions/unsubscribe';

// Discovered devices during scan
let discoveredDevices: Map<string, DeviceInfo> = new Map();
let deviceEmitter: EmitFn | null = null;

interface DeviceInfo {
  id: string;
  name: string | null;
  rssi: number | null;
  localName: string | null;
  manufacturerData: string | null;
  serviceUUIDs: string[] | null;
}

interface ServiceInfo {
  uuid: string;
  characteristics: CharacteristicInfo[];
}

interface CharacteristicInfo {
  uuid: string;
  serviceUUID: string;
  isReadable: boolean;
  isWritableWithResponse: boolean;
  isWritableWithoutResponse: boolean;
  isNotifiable: boolean;
  isIndicatable: boolean;
}

export function buildBluetoothSubsystem(): SubsystemDefinition {
  return {
    name: 'bluetooth',
    type: 'virtual',
    monitors: [
      {
        descriptor: {
          name: 'state',
          label: 'Bluetooth state',
          description: 'Current Bluetooth adapter state',
          endpoint: BT_STATE_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'bluetooth',
            color: '$blue10',
            order: 36,
          },
        },
        boot: getBluetoothState,
        subscribe: subscribeBluetoothState,
        minIntervalMs: 1000,
      },
      {
        descriptor: {
          name: 'devices',
          label: 'Discovered devices',
          description: 'BLE devices found during scan',
          endpoint: BT_DEVICES_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'radio',
            color: '$blue9',
            order: 37,
          },
        },
        subscribe: subscribeDiscoveredDevices,
        minIntervalMs: 1000,
      },
    ],
    actions: [
      // Scan for devices
      {
        descriptor: {
          name: 'scan',
          label: 'Start BLE scan',
          description: 'Start scanning for nearby BLE devices',
          endpoint: BT_SCAN_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              duration: {
                type: 'number',
                description: 'Scan duration in seconds (default: 10)',
                default: 10,
              },
              serviceUUIDs: {
                type: 'array',
                description: 'Filter by service UUIDs (optional)',
                items: { type: 'string' },
              },
            },
          },
          cardProps: {
            icon: 'search',
            color: '$blue10',
            order: 38,
          },
          mode: 'request-reply',
        },
        handler: handleStartScan,
      },
      // Stop scanning
      {
        descriptor: {
          name: 'stop_scan',
          label: 'Stop BLE scan',
          description: 'Stop scanning for BLE devices',
          endpoint: BT_STOP_SCAN_ENDPOINT,
          connectionType: 'mqtt',
          payload: { type: 'empty' },
          cardProps: {
            icon: 'stop-circle',
            color: '$orange10',
            order: 39,
          },
          mode: 'request-reply',
        },
        handler: handleStopScan,
      },
      // Connect to device
      {
        descriptor: {
          name: 'connect',
          label: 'Connect to device',
          description: 'Connect to a BLE device by ID',
          endpoint: BT_CONNECT_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              deviceId: {
                type: 'string',
                description: 'Device ID (MAC address or UUID)',
              },
            },
          },
          cardProps: {
            icon: 'link',
            color: '$green10',
            order: 40,
          },
          mode: 'request-reply',
        },
        handler: handleConnect,
      },
      // Disconnect from device
      {
        descriptor: {
          name: 'disconnect',
          label: 'Disconnect device',
          description: 'Disconnect from a connected BLE device',
          endpoint: BT_DISCONNECT_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              deviceId: {
                type: 'string',
                description: 'Device ID to disconnect',
              },
            },
          },
          cardProps: {
            icon: 'unlink',
            color: '$red10',
            order: 41,
          },
          mode: 'request-reply',
        },
        handler: handleDisconnect,
      },
      // Discover services and characteristics
      {
        descriptor: {
          name: 'discover',
          label: 'Discover services',
          description: 'Discover all services and characteristics of a connected device',
          endpoint: BT_DISCOVER_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              deviceId: {
                type: 'string',
                description: 'Device ID to discover',
              },
            },
          },
          cardProps: {
            icon: 'layers',
            color: '$purple10',
            order: 42,
          },
          mode: 'request-reply',
        },
        handler: handleDiscover,
      },
      // Read characteristic
      {
        descriptor: {
          name: 'read',
          label: 'Read characteristic',
          description: 'Read value from a BLE characteristic',
          endpoint: BT_READ_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              deviceId: {
                type: 'string',
                description: 'Device ID',
              },
              serviceUUID: {
                type: 'string',
                description: 'Service UUID',
              },
              characteristicUUID: {
                type: 'string',
                description: 'Characteristic UUID',
              },
            },
          },
          cardProps: {
            icon: 'download',
            color: '$cyan10',
            order: 43,
          },
          mode: 'request-reply',
        },
        handler: handleRead,
      },
      // Write characteristic
      {
        descriptor: {
          name: 'write',
          label: 'Write characteristic',
          description: 'Write value to a BLE characteristic',
          endpoint: BT_WRITE_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              deviceId: {
                type: 'string',
                description: 'Device ID',
              },
              serviceUUID: {
                type: 'string',
                description: 'Service UUID',
              },
              characteristicUUID: {
                type: 'string',
                description: 'Characteristic UUID',
              },
              value: {
                type: 'string',
                description: 'Base64 encoded value to write',
              },
              withResponse: {
                type: 'boolean',
                description: 'Write with response (default: true)',
                default: true,
              },
            },
          },
          cardProps: {
            icon: 'upload',
            color: '$pink10',
            order: 44,
          },
          mode: 'request-reply',
        },
        handler: handleWrite,
      },
      // Subscribe to notifications
      {
        descriptor: {
          name: 'subscribe',
          label: 'Subscribe to notifications',
          description: 'Subscribe to characteristic notifications',
          endpoint: BT_SUBSCRIBE_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              deviceId: {
                type: 'string',
                description: 'Device ID',
              },
              serviceUUID: {
                type: 'string',
                description: 'Service UUID',
              },
              characteristicUUID: {
                type: 'string',
                description: 'Characteristic UUID',
              },
            },
          },
          cardProps: {
            icon: 'bell',
            color: '$amber10',
            order: 45,
          },
          mode: 'request-reply',
        },
        handler: handleSubscribe,
      },
      // Unsubscribe from notifications
      {
        descriptor: {
          name: 'unsubscribe',
          label: 'Unsubscribe from notifications',
          description: 'Unsubscribe from characteristic notifications',
          endpoint: BT_UNSUBSCRIBE_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              deviceId: {
                type: 'string',
                description: 'Device ID',
              },
              serviceUUID: {
                type: 'string',
                description: 'Service UUID',
              },
              characteristicUUID: {
                type: 'string',
                description: 'Characteristic UUID',
              },
            },
          },
          cardProps: {
            icon: 'bell-off',
            color: '$gray10',
            order: 46,
          },
          mode: 'request-reply',
        },
        handler: handleUnsubscribe,
      },
    ],
  };
}

// ============ State Monitor ============

async function getBluetoothState() {
  try {
    const manager = getBleManager();
    const state = await manager.state();
    return { state: mapBleState(state), scanning: isScanning };
  } catch (err: any) {
    return { error: err?.message ?? 'bluetooth-error' };
  }
}

function subscribeBluetoothState(emit: EmitFn): UnsubscribeFn {
  const manager = getBleManager();
  
  const subscription = manager.onStateChange((state) => {
    emit({ state: mapBleState(state), scanning: isScanning });
  }, true);

  return () => {
    subscription.remove();
  };
}

function mapBleState(state: State): string {
  switch (state) {
    case State.PoweredOn:
      return 'on';
    case State.PoweredOff:
      return 'off';
    case State.Resetting:
      return 'resetting';
    case State.Unauthorized:
      return 'unauthorized';
    case State.Unsupported:
      return 'unsupported';
    default:
      return 'unknown';
  }
}

// ============ Devices Monitor ============

function subscribeDiscoveredDevices(emit: EmitFn): UnsubscribeFn {
  deviceEmitter = emit;
  
  // Emit current state immediately
  emitDeviceList();

  return () => {
    deviceEmitter = null;
  };
}

function emitDeviceList() {
  if (!deviceEmitter) return;
  
  const devices = Array.from(discoveredDevices.values())
    .sort((a, b) => (b.rssi ?? -100) - (a.rssi ?? -100)); // Sort by signal strength
  
  deviceEmitter({
    scanning: isScanning,
    count: devices.length,
    devices: devices.slice(0, 50), // Limit to 50 devices
  });
}

// ============ Permissions ============

async function requestBluetoothPermissions(): Promise<{ granted: boolean; error?: string }> {
  try {
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version;
      
      // Android 12+ (API 31+) requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
      if (apiLevel >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        
        const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'granted';
        const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted';
        const locationGranted = results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted';
        
        console.log('[bluetooth] permissions:', { scanGranted, connectGranted, locationGranted });
        
        if (!scanGranted || !connectGranted) {
          return { granted: false, error: 'Bluetooth permissions denied' };
        }
        if (!locationGranted) {
          return { granted: false, error: 'Location permission denied (required for BLE scan)' };
        }
        
        return { granted: true };
      } else {
        // Android < 12 only needs location
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
        if (result !== 'granted') {
          return { granted: false, error: 'Location permission denied' };
        }
        
        return { granted: true };
      }
    } else {
      // iOS - use expo-location for permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return { granted: false, error: 'Location permission denied' };
      }
      return { granted: true };
    }
  } catch (err: any) {
    console.error('[bluetooth] permission error:', err);
    return { granted: false, error: err?.message ?? 'permission-error' };
  }
}

// ============ Scan Actions ============

async function handleStartScan(payload: string, reply: (body: any) => Promise<void>) {
  try {
    const params = parseJsonPayload(payload, { duration: 10 });
    const manager = getBleManager();
    
    // Request permissions first
    const permResult = await requestBluetoothPermissions();
    if (!permResult.granted) {
      await reply({ error: permResult.error });
      return;
    }
    
    // Check state
    const state = await manager.state();
    console.log('[bluetooth] adapter state:', mapBleState(state));
    
    if (state !== State.PoweredOn) {
      await reply({ error: `bluetooth is ${mapBleState(state)}` });
      return;
    }

    // Stop existing scan
    if (isScanning) {
      manager.stopDeviceScan();
    }

    // Clear previous results
    discoveredDevices.clear();
    isScanning = true;
    emitDeviceList();
    
    const serviceUUIDs = params.serviceUUIDs?.length ? params.serviceUUIDs : null;
    
    console.log('[bluetooth] starting scan, serviceUUIDs:', serviceUUIDs);

    manager.startDeviceScan(serviceUUIDs, { allowDuplicates: true }, (error, device) => {
      if (error) {
        console.warn('[bluetooth] scan error:', error.message, error.reason);
        isScanning = false;
        emitDeviceList();
        return;
      }
      
      if (device) {
        console.log('[bluetooth] found device:', device.id, device.name || device.localName || '(unnamed)');
        discoveredDevices.set(device.id, {
          id: device.id,
          name: device.name,
          rssi: device.rssi,
          localName: device.localName,
          manufacturerData: device.manufacturerData,
          serviceUUIDs: device.serviceUUIDs,
        });
        emitDeviceList();
      }
    });

    // Auto-stop after duration
    const duration = Math.min(Math.max(params.duration || 10, 1), 60); // 1-60 seconds
    setTimeout(() => {
      if (isScanning) {
        console.log('[bluetooth] scan timeout, stopping');
        manager.stopDeviceScan();
        isScanning = false;
        emitDeviceList();
      }
    }, duration * 1000);

    await reply({ started: true, duration, permissionsGranted: true });
  } catch (err: any) {
    console.error('[bluetooth] scan error:', err);
    await reply({ error: err?.message ?? 'scan-error' });
  }
}

async function handleStopScan(_payload: string, reply: (body: any) => Promise<void>) {
  try {
    const manager = getBleManager();
    manager.stopDeviceScan();
    isScanning = false;
    emitDeviceList();
    await reply({ stopped: true, devicesFound: discoveredDevices.size });
  } catch (err: any) {
    await reply({ error: err?.message ?? 'stop-scan-error' });
  }
}

// ============ Connect/Disconnect ============

async function handleConnect(payload: string, reply: (body: any) => Promise<void>) {
  try {
    const params = parseJsonPayload(payload, {});
    if (!params.deviceId) {
      await reply({ error: 'deviceId required' });
      return;
    }

    const manager = getBleManager();
    
    // Check if already connected
    if (connectedDevices.has(params.deviceId)) {
      await reply({ connected: true, deviceId: params.deviceId, alreadyConnected: true });
      return;
    }
    
    console.log('[bluetooth] connecting to', params.deviceId);
    const device = await manager.connectToDevice(params.deviceId, {
      timeout: 10000, // 10 second timeout
    });
    
    connectedDevices.set(params.deviceId, device);
    
    // Listen for disconnection
    device.onDisconnected((error, disconnectedDevice) => {
      console.log('[bluetooth] device disconnected:', disconnectedDevice?.id, error?.message);
      connectedDevices.delete(params.deviceId);
    });

    await reply({
      connected: true,
      deviceId: device.id,
      name: device.name,
    });
  } catch (err: any) {
    await reply({ error: err?.message ?? 'connect-error' });
  }
}

async function handleDisconnect(payload: string, reply: (body: any) => Promise<void>) {
  try {
    const params = parseJsonPayload(payload, {});
    if (!params.deviceId) {
      await reply({ error: 'deviceId required' });
      return;
    }

    const manager = getBleManager();
    await manager.cancelDeviceConnection(params.deviceId);
    connectedDevices.delete(params.deviceId);

    await reply({ disconnected: true, deviceId: params.deviceId });
  } catch (err: any) {
    await reply({ error: err?.message ?? 'disconnect-error' });
  }
}

// ============ Discover Services ============

async function handleDiscover(payload: string, reply: (body: any) => Promise<void>) {
  try {
    const params = parseJsonPayload(payload, {});
    if (!params.deviceId) {
      await reply({ error: 'deviceId required' });
      return;
    }

    const device = connectedDevices.get(params.deviceId);
    if (!device) {
      await reply({ error: 'device not connected' });
      return;
    }
    
    console.log('[bluetooth] discovering services for', params.deviceId);
    await device.discoverAllServicesAndCharacteristics();
    
    const services = await device.services();
    const result: ServiceInfo[] = [];

    for (const service of services) {
      const characteristics = await service.characteristics();
      result.push({
        uuid: service.uuid,
        characteristics: characteristics.map((c) => ({
          uuid: c.uuid,
          serviceUUID: c.serviceUUID,
          isReadable: c.isReadable,
          isWritableWithResponse: c.isWritableWithResponse,
          isWritableWithoutResponse: c.isWritableWithoutResponse,
          isNotifiable: c.isNotifiable,
          isIndicatable: c.isIndicatable,
        })),
      });
    }

    await reply({
      deviceId: params.deviceId,
      services: result,
    });
  } catch (err: any) {
    await reply({ error: err?.message ?? 'discover-error' });
  }
}

// ============ Read/Write Characteristics ============

async function handleRead(payload: string, reply: (body: any) => Promise<void>) {
  try {
    const params = parseJsonPayload(payload, {});
    if (!params.deviceId || !params.serviceUUID || !params.characteristicUUID) {
      await reply({ error: 'deviceId, serviceUUID, and characteristicUUID required' });
      return;
    }

    const device = connectedDevices.get(params.deviceId);
    if (!device) {
      await reply({ error: 'device not connected' });
      return;
    }
    
    const characteristic = await device.readCharacteristicForService(
      params.serviceUUID,
      params.characteristicUUID
    );

    await reply({
      deviceId: params.deviceId,
      serviceUUID: params.serviceUUID,
      characteristicUUID: params.characteristicUUID,
      value: characteristic.value, // Base64 encoded
    });
  } catch (err: any) {
    await reply({ error: err?.message ?? 'read-error' });
  }
}

async function handleWrite(payload: string, reply: (body: any) => Promise<void>) {
  try {
    const params = parseJsonPayload(payload, { withResponse: true });
    if (!params.deviceId || !params.serviceUUID || !params.characteristicUUID || !params.value) {
      await reply({ error: 'deviceId, serviceUUID, characteristicUUID, and value required' });
      return;
    }

    const device = connectedDevices.get(params.deviceId);
    if (!device) {
      await reply({ error: 'device not connected' });
      return;
    }
    
    if (params.withResponse) {
      await device.writeCharacteristicWithResponseForService(
        params.serviceUUID,
        params.characteristicUUID,
        params.value // Base64 encoded
      );
    } else {
      await device.writeCharacteristicWithoutResponseForService(
        params.serviceUUID,
        params.characteristicUUID,
        params.value
      );
    }

    await reply({
      written: true,
      deviceId: params.deviceId,
      serviceUUID: params.serviceUUID,
      characteristicUUID: params.characteristicUUID,
    });
  } catch (err: any) {
    await reply({ error: err?.message ?? 'write-error' });
  }
}

// ============ Subscribe/Unsubscribe Notifications ============

// Store active subscriptions for cleanup
const activeSubscriptions = new Map<string, { remove: () => void }>();

function getSubscriptionKey(deviceId: string, serviceUUID: string, charUUID: string): string {
  return `${deviceId}:${serviceUUID}:${charUUID}`;
}

async function handleSubscribe(payload: string, reply: (body: any) => Promise<void>) {
  try {
    const params = parseJsonPayload(payload, {});
    if (!params.deviceId || !params.serviceUUID || !params.characteristicUUID) {
      await reply({ error: 'deviceId, serviceUUID, and characteristicUUID required' });
      return;
    }

    const device = connectedDevices.get(params.deviceId);
    if (!device) {
      await reply({ error: 'device not connected' });
      return;
    }
    
    const subKey = getSubscriptionKey(params.deviceId, params.serviceUUID, params.characteristicUUID);
    
    // Remove existing subscription if any
    if (activeSubscriptions.has(subKey)) {
      activeSubscriptions.get(subKey)?.remove();
    }
    
    // Subscribe to notifications
    const subscription = device.monitorCharacteristicForService(
      params.serviceUUID,
      params.characteristicUUID,
      (error, characteristic) => {
        if (error) {
          console.warn('[bluetooth] notification error:', error.message);
          return;
        }
        
        if (characteristic && deviceEmitter) {
          // Emit notification value through the devices monitor
          // In a real implementation, you might want a separate monitor for notifications
          console.log('[bluetooth] notification received:', characteristic.uuid, characteristic.value);
        }
      }
    );

    activeSubscriptions.set(subKey, subscription);

    await reply({
      subscribed: true,
      deviceId: params.deviceId,
      serviceUUID: params.serviceUUID,
      characteristicUUID: params.characteristicUUID,
    });
  } catch (err: any) {
    await reply({ error: err?.message ?? 'subscribe-error' });
  }
}

async function handleUnsubscribe(payload: string, reply: (body: any) => Promise<void>) {
  try {
    const params = parseJsonPayload(payload, {});
    if (!params.deviceId || !params.serviceUUID || !params.characteristicUUID) {
      await reply({ error: 'deviceId, serviceUUID, and characteristicUUID required' });
      return;
    }

    const subKey = getSubscriptionKey(params.deviceId, params.serviceUUID, params.characteristicUUID);
    
    if (activeSubscriptions.has(subKey)) {
      activeSubscriptions.get(subKey)?.remove();
      activeSubscriptions.delete(subKey);
      await reply({
        unsubscribed: true,
        deviceId: params.deviceId,
        serviceUUID: params.serviceUUID,
        characteristicUUID: params.characteristicUUID,
      });
    } else {
      await reply({ error: 'no active subscription found' });
    }
  } catch (err: any) {
    await reply({ error: err?.message ?? 'unsubscribe-error' });
  }
}

// ============ Helpers ============

function parseJsonPayload(payload: string, defaults: Record<string, any> = {}): Record<string, any> {
  const trimmed = payload.trim();
  if (!trimmed) {
    return defaults;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}
