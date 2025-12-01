import * as Location from 'expo-location';
import {
  Accelerometer,
  Gyroscope,
  Magnetometer,
  Barometer,
  LightSensor,
  Pedometer,
} from 'expo-sensors';
import { hasTorchController, requestTorchState } from '../torch/controller';

import type { SubsystemDefinition, EmitFn, UnsubscribeFn } from './types';

const GPS_ENDPOINT = '/sensors/monitors/gps';
const ACCEL_ENDPOINT = '/sensors/monitors/accelerometer';
const GYRO_ENDPOINT = '/sensors/monitors/gyroscope';
const MAGNETO_ENDPOINT = '/sensors/monitors/magnetometer';
const BAROMETER_ENDPOINT = '/sensors/monitors/barometer';
const LIGHT_ENDPOINT = '/sensors/monitors/light';
const PEDOMETER_ENDPOINT = '/sensors/monitors/pedometer';
const TORCH_ENDPOINT = '/sensors/actions/torch';

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
          ephemeral: true,
          cardProps: {
            icon: 'map-pin',
            color: '$blue10',
            order: 21,
            html: `//@card/react
function Widget(card) {
  const v = card.value || {};
  const lat = v.latitude;
  const lon = v.longitude;
  const hasCoords = lat !== undefined && lon !== undefined && !v.error;
  
  // OpenStreetMap embed - formato limpio
  const delta = 0.005;
  const bbox = (lon - delta).toFixed(4) + ',' + (lat - delta).toFixed(4) + ',' + (lon + delta).toFixed(4) + ',' + (lat + delta).toFixed(4);
  const osmUrl = hasCoords 
    ? 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&layer=mapnik&marker=' + lat.toFixed(5) + ',' + lon.toFixed(5)
    : null;
  
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {hasCoords ? (
            <>
              <iframe 
                src={osmUrl}
                style={{
                  width: '100%',
                  height: '140px',
                  border: 'none',
                  borderRadius: '8px',
                }}
              />
              <div style={{fontSize: '11px', opacity: 0.6, marginTop: '4px'}}>
                {lat?.toFixed(5)}, {lon?.toFixed(5)}
                {v.accuracy ? ' ±' + v.accuracy?.toFixed(0) + 'm' : ''}
              </div>
            </>
          ) : (
            <>
              <Icon name="map-pin" size={48} color="#ef4444"/>
              <div style={{fontSize: '14px', marginTop: '8px', opacity: 0.7}}>
                {v.error === 'permission-denied' ? 'Permiso denegado' : 
                 v.error === 'no-cached-location' ? 'Esperando GPS...' :
                 v.error || 'Cargando...'}
              </div>
            </>
          )}
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}`,
          },
        },
        boot: readLocationOnce,
        subscribe: subscribeLocation,
        minIntervalMs: 5000, // Max 1 update per 5 seconds
      },
      {
        descriptor: {
          name: 'accelerometer',
          label: 'Accelerometer',
          description: 'Acceleration on each axis (g)',
          endpoint: ACCEL_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'activity',
            color: '$pink10',
            order: 22,
          },
        },
        subscribe: subscribeAccelerometer,
        minIntervalMs: 200, // Max 5 updates per second
      },
      {
        descriptor: {
          name: 'gyroscope',
          label: 'Gyroscope',
          description: 'Rotation rate on each axis (°/s)',
          endpoint: GYRO_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'refresh-cw',
            color: '$purple10',
            order: 23,
          },
        },
        subscribe: subscribeGyroscope,
        minIntervalMs: 200,
      },
      {
        descriptor: {
          name: 'magnetometer',
          label: 'Magnetometer',
          description: 'Magnetic field on each axis (compass)',
          endpoint: MAGNETO_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'compass',
            color: '$red10',
            order: 24,
          },
        },
        subscribe: subscribeMagnetometer,
        minIntervalMs: 500,
      },
      {
        descriptor: {
          name: 'barometer',
          label: 'Barometer',
          description: 'Atmospheric pressure (hPa)',
          endpoint: BAROMETER_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'cloud',
            color: '$blue10',
            order: 25,
          },
        },
        subscribe: subscribeBarometer,
        minIntervalMs: 2000, // Pressure doesn't change fast
      },
      {
        descriptor: {
          name: 'light',
          label: 'Light sensor',
          description: 'Ambient light level (lux)',
          endpoint: LIGHT_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'sun',
            color: '$yellow10',
            order: 26,
          },
        },
        subscribe: subscribeLightSensor,
        minIntervalMs: 500,
      },
      {
        descriptor: {
          name: 'pedometer',
          label: 'Step counter',
          description: 'Steps counted today',
          endpoint: PEDOMETER_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'footprints',
            color: '$green10',
            order: 27,
          },
        },
        subscribe: subscribePedometer,
        minIntervalMs: 1000, // Steps don't need fast updates
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
            icon: 'flashlight',
            color: '$yellow10',
            order: 28,
            buttonMode: true,
            buttonLabel: 'Toggle',
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

// ============ Location ============

async function ensureLocationPermission() {
  if (locationPermissionGranted !== null) {
    return locationPermissionGranted;
  }
  const { status } = await Location.requestForegroundPermissionsAsync();
  locationPermissionGranted = status === Location.PermissionStatus.GRANTED;
  return locationPermissionGranted;
}

async function readLocationOnce() {
  if (!(await ensureLocationPermission())) {
    return { error: 'permission-denied' };
  }
  try {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown) {
      const { latitude, longitude, accuracy, altitude, speed } = lastKnown.coords;
      return { latitude, longitude, accuracy, altitude, speed, timestamp: lastKnown.timestamp };
    }
    return { error: 'no-cached-location' };
  } catch (err: any) {
    return { error: err?.message ?? 'location-error' };
  }
}

function subscribeLocation(emit: EmitFn): UnsubscribeFn {
  let subscription: Location.LocationSubscription | null = null;
  
  (async () => {
    if (!(await ensureLocationPermission())) {
      emit({ error: 'permission-denied' });
      return;
    }
    
    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10, // Minimum 10 meters change
        timeInterval: 5000, // Or at least 5 seconds
      },
      (location) => {
        const { latitude, longitude, accuracy, altitude, speed } = location.coords;
        emit({
          latitude: round(latitude, 6),
          longitude: round(longitude, 6),
          accuracy: round(accuracy ?? 0, 1),
          altitude: round(altitude ?? 0, 1),
          speed: round(speed ?? 0, 2),
          timestamp: location.timestamp,
        });
      }
    );
  })();

  return () => {
    subscription?.remove();
  };
}

// ============ Accelerometer ============

function subscribeAccelerometer(emit: EmitFn): UnsubscribeFn {
  let available = false;
  
  Accelerometer.isAvailableAsync().then((isAvailable) => {
    available = isAvailable;
    if (!available) {
      emit({ error: 'accelerometer-unavailable' });
    }
  });

  Accelerometer.setUpdateInterval(100);
  const subscription = Accelerometer.addListener((data) => {
    if (!available) return;
    emit({
      x: round(data.x, 3),
      y: round(data.y, 3),
      z: round(data.z, 3),
    });
  });

  return () => subscription.remove();
}

// ============ Gyroscope ============

function subscribeGyroscope(emit: EmitFn): UnsubscribeFn {
  let available = false;
  
  Gyroscope.isAvailableAsync().then((isAvailable) => {
    available = isAvailable;
    if (!available) {
      emit({ error: 'gyroscope-unavailable' });
    }
  });

  Gyroscope.setUpdateInterval(100);
  const subscription = Gyroscope.addListener((data) => {
    if (!available) return;
    emit({
      x: round(data.x, 3),
      y: round(data.y, 3),
      z: round(data.z, 3),
    });
  });

  return () => subscription.remove();
}

// ============ Magnetometer ============

function subscribeMagnetometer(emit: EmitFn): UnsubscribeFn {
  let available = false;
  
  Magnetometer.isAvailableAsync().then((isAvailable) => {
    available = isAvailable;
    if (!available) {
      emit({ error: 'magnetometer-unavailable' });
    }
  });

  Magnetometer.setUpdateInterval(200);
  const subscription = Magnetometer.addListener((data) => {
    if (!available) return;
    const { x, y, z } = data;
    const heading = Math.atan2(y, x) * (180 / Math.PI);
    const normalizedHeading = heading >= 0 ? heading : heading + 360;
    emit({
      x: round(x, 2),
      y: round(y, 2),
      z: round(z, 2),
      heading: Math.round(normalizedHeading),
    });
  });

  return () => subscription.remove();
}

// ============ Barometer ============

function subscribeBarometer(emit: EmitFn): UnsubscribeFn {
  let available = false;
  
  Barometer.isAvailableAsync().then((isAvailable) => {
    available = isAvailable;
    if (!available) {
      emit({ error: 'barometer-unavailable' });
    }
  });

  const subscription = Barometer.addListener((data) => {
    if (!available) return;
    emit({
      pressure: round(data.pressure, 2),
      relativeAltitude: data.relativeAltitude != null ? round(data.relativeAltitude, 1) : null,
    });
  });

  return () => subscription.remove();
}

// ============ Light Sensor ============

function subscribeLightSensor(emit: EmitFn): UnsubscribeFn {
  let available = false;
  
  LightSensor.isAvailableAsync().then((isAvailable) => {
    available = isAvailable;
    if (!available) {
      emit({ error: 'light-sensor-unavailable' });
    }
  });

  const subscription = LightSensor.addListener((data) => {
    if (!available) return;
    emit({
      illuminance: Math.round(data.illuminance),
    });
  });

  return () => subscription.remove();
}

// ============ Pedometer ============

function subscribePedometer(emit: EmitFn): UnsubscribeFn {
  let available = false;
  
  Pedometer.isAvailableAsync().then((isAvailable) => {
    available = isAvailable;
    if (!available) {
      emit({ error: 'pedometer-unavailable' });
    }
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const subscription = Pedometer.watchStepCount((result) => {
    if (!available) return;
    emit({
      steps: result.steps,
      since: startOfDay.toISOString(),
    });
  });

  return () => subscription.remove();
}

// ============ Helpers ============

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
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
