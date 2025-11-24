import * as Location from 'expo-location';
import {
  Accelerometer,
  Gyroscope,
  Magnetometer,
  Barometer,
  LightSensor,
  Pedometer,
  type AccelerometerMeasurement,
  type GyroscopeMeasurement,
  type MagnetometerMeasurement,
} from 'expo-sensors';
import { hasTorchController, requestTorchState } from '../torch/controller';

import type { SubsystemDefinition } from './types';

const GPS_ENDPOINT = '/sensors/monitors/gps';
const ACCEL_ENDPOINT = '/sensors/monitors/accelerometer';
const GYRO_ENDPOINT = '/sensors/monitors/gyroscope';
const MAGNETO_ENDPOINT = '/sensors/monitors/magnetometer';
const BAROMETER_ENDPOINT = '/sensors/monitors/barometer';
const LIGHT_ENDPOINT = '/sensors/monitors/light';
const PEDOMETER_ENDPOINT = '/sensors/monitors/pedometer';
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
      {
        descriptor: {
          name: 'magnetometer',
          label: 'Magnetometer',
          description: 'Magnetic field on each axis (compass)',
          endpoint: MAGNETO_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'compass',
            color: '$red10',
          },
        },
        boot: readMagnetometer,
        intervalMs: SENSOR_INTERVAL_MS,
        producer: readMagnetometer,
      },
      {
        descriptor: {
          name: 'barometer',
          label: 'Barometer',
          description: 'Atmospheric pressure (hPa)',
          endpoint: BAROMETER_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'cloud',
            color: '$blue9',
          },
        },
        boot: readBarometer,
        intervalMs: SENSOR_INTERVAL_MS * 2,
        producer: readBarometer,
      },
      {
        descriptor: {
          name: 'light',
          label: 'Light sensor',
          description: 'Ambient light level (lux)',
          endpoint: LIGHT_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'sun',
            color: '$amber10',
          },
        },
        boot: readLightSensor,
        intervalMs: SENSOR_INTERVAL_MS,
        producer: readLightSensor,
      },
      {
        descriptor: {
          name: 'pedometer',
          label: 'Step counter',
          description: 'Steps counted today',
          endpoint: PEDOMETER_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'footprints',
            color: '$green9',
          },
        },
        boot: readPedometer,
        intervalMs: 30_000, // Every 30 seconds
        producer: readPedometer,
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
  Sensor: typeof Accelerometer | typeof Gyroscope | typeof Magnetometer,
): Promise<AccelerometerMeasurement | GyroscopeMeasurement | MagnetometerMeasurement | null> {
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

async function readMagnetometer() {
  const available = await Magnetometer.isAvailableAsync();
  if (!available) {
    return { error: 'magnetometer-unavailable' };
  }
  const sample = await sampleSensor(Magnetometer);
  if (!sample) {
    return { error: 'magnetometer-timeout' };
  }
  // Calculate heading (compass direction) from magnetometer data
  const { x, y, z } = sample;
  const heading = Math.atan2(y, x) * (180 / Math.PI);
  const normalizedHeading = heading >= 0 ? heading : heading + 360;
  return {
    x,
    y,
    z,
    heading: Math.round(normalizedHeading),
  };
}

async function readBarometer() {
  const available = await Barometer.isAvailableAsync();
  if (!available) {
    return { error: 'barometer-unavailable' };
  }
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        subscription.remove();
        resolve({ error: 'barometer-timeout' });
      }
    }, 750);

    const subscription = Barometer.addListener((reading) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      subscription.remove();
      resolve({
        pressure: reading.pressure,
        relativeAltitude: reading.relativeAltitude ?? null,
      });
    });
  });
}

async function readLightSensor() {
  const available = await LightSensor.isAvailableAsync();
  if (!available) {
    return { error: 'light-sensor-unavailable' };
  }
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        subscription.remove();
        resolve({ error: 'light-sensor-timeout' });
      }
    }, 750);

    const subscription = LightSensor.addListener((reading) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      subscription.remove();
      resolve({
        illuminance: reading.illuminance,
      });
    });
  });
}

async function readPedometer() {
  const available = await Pedometer.isAvailableAsync();
  if (!available) {
    return { error: 'pedometer-unavailable' };
  }
  try {
    // Get steps from start of today
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const result = await Pedometer.getStepCountAsync(startOfDay, now);
    return {
      steps: result.steps,
      since: startOfDay.toISOString(),
    };
  } catch (err: any) {
    return { error: err?.message ?? 'pedometer-error' };
  }
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

