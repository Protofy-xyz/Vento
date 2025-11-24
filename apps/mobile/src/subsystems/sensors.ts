import * as Location from 'expo-location';
import { Accelerometer, Gyroscope, type AccelerometerMeasurement, type GyroscopeMeasurement } from 'expo-sensors';
import { hasTorchController, requestTorchState } from '../torch/controller';

import type { SubsystemDefinition } from './types';

const GPS_ENDPOINT = '/sensors/monitors/gps';
const ACCEL_ENDPOINT = '/sensors/monitors/accelerometer';
const GYRO_ENDPOINT = '/sensors/monitors/gyroscope';
const TORCH_ENDPOINT = '/sensors/actions/torch';

const GPS_INTERVAL_MS = 10_000;
const SENSOR_INTERVAL_MS = 5_000;

let locationPermissionGranted: boolean | null = null;

export function buildSensorsSubsystem(): SubsystemDefinition {
  return {
    name: 'sensors',
    type: 'virtual',
    monitors: [
      {
        descriptor: {
          name: 'gps_position',
          label: 'GPS position',
          description: 'Latitude/longitude with accuracy',
          endpoint: GPS_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'navigation',
            color: '$cyan10',
          },
        },
        boot: readLocation,
        intervalMs: GPS_INTERVAL_MS,
        producer: readLocation,
      },
      {
        descriptor: {
          name: 'accelerometer',
          label: 'Accelerometer',
          description: 'Acceleration on each axis (g)',
          endpoint: ACCEL_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'activity',
            color: '$pink10',
          },
        },
        boot: readAccelerometer,
        intervalMs: SENSOR_INTERVAL_MS,
        producer: readAccelerometer,
      },
      {
        descriptor: {
          name: 'gyroscope',
          label: 'Gyroscope',
          description: 'Rotation rate on each axis (°/s)',
          endpoint: GYRO_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'refresh-cw',
            color: '$purple9',
          },
        },
        boot: readGyroscope,
        intervalMs: SENSOR_INTERVAL_MS,
        producer: readGyroscope,
      },
    ],
    actions: [
      {
        descriptor: {
          name: 'torch',
          label: 'Flashlight',
          description: 'Turns the flashlight on/off',
          endpoint: TORCH_ENDPOINT,
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              state: {
                type: 'string',
                enum: ['on', 'off'],
                description: 'Desired flashlight state',
                default: 'on',
              },
            },
          },
          cardProps: {
            icon: 'sun',
            color: '$yellow10',
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          const desired = parseTorchPayload(payload);
          if (!desired) {
            await reply({ error: 'state must be "on" or "off"' });
            return;
          }
          if (!hasTorchController()) {
            await reply({ error: 'torch unavailable or permission denied' });
            return;
          }
          try {
            await requestTorchState(desired);
            await reply({ state: desired });
          } catch (err: any) {
            await reply({ error: err?.message ?? 'torch unavailable' });
          }
        },
      },
    ],
  };
}

async function readLocation() {
  if (!(await ensureLocationPermission())) {
    return { error: 'permission-denied' };
  }
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    });
    const { latitude, longitude, accuracy, altitude, speed } = position.coords;
    return {
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      timestamp: position.timestamp,
    };
  } catch (err: any) {
    return { error: err?.message ?? 'location-error' };
  }
}

async function ensureLocationPermission() {
  if (locationPermissionGranted !== null) {
    return locationPermissionGranted;
  }
  const { status } = await Location.requestForegroundPermissionsAsync();
  locationPermissionGranted = status === Location.PermissionStatus.GRANTED;
  return locationPermissionGranted;
}

async function readAccelerometer() {
  const available = await Accelerometer.isAvailableAsync();
  if (!available) {
    return { error: 'accelerometer-unavailable' };
  }
  const sample = await sampleSensor(Accelerometer);
  if (!sample) {
    return { error: 'accelerometer-timeout' };
  }
  return {
    x: sample.x,
    y: sample.y,
    z: sample.z,
  };
}

async function readGyroscope() {
  const available = await Gyroscope.isAvailableAsync();
  if (!available) {
    return { error: 'gyroscope-unavailable' };
  }
  const sample = await sampleSensor(Gyroscope);
  if (!sample) {
    return { error: 'gyroscope-timeout' };
  }
  return {
    x: sample.x,
    y: sample.y,
    z: sample.z,
  };
}

function sampleSensor(
  Sensor: typeof Accelerometer | typeof Gyroscope,
): Promise<AccelerometerMeasurement | GyroscopeMeasurement | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        subscription.remove();
        resolve(null);
      }
    }, 750);

    const subscription = Sensor.addListener((reading) => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timeout);
      subscription.remove();
      resolve(reading);
    });

    Sensor.setUpdateInterval(200);
  });
}

function parseTorchPayload(payload: string) {
  const trimmed = payload.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === 'on' || trimmed === 'off') {
    return trimmed;
  }
  try {
    const data = JSON.parse(trimmed);
    if (typeof data === 'string' && (data === 'on' || data === 'off')) {
      return data;
    }
    if (typeof data?.state === 'string' && (data.state === 'on' || data.state === 'off')) {
      return data.state;
    }
  } catch {
    // ignore JSON errors
  }
  return null;
}

