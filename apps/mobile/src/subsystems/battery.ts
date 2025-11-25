import * as Battery from 'expo-battery';

import type { SubsystemDefinition, EmitFn, UnsubscribeFn } from './types';

const BATTERY_LEVEL_ENDPOINT = '/battery/monitors/level';
const BATTERY_STATE_ENDPOINT = '/battery/monitors/state';
const BATTERY_LOW_POWER_ENDPOINT = '/battery/monitors/low_power_mode';

export function buildBatterySubsystem(): SubsystemDefinition {
  return {
    name: 'battery',
    type: 'virtual',
    monitors: [
      {
        descriptor: {
          name: 'level',
          label: 'Battery level',
          description: 'Current battery level (0-100%)',
          units: '%',
          endpoint: BATTERY_LEVEL_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'battery',
            color: '$green10',
          },
        },
        boot: async () => {
          const level = await Battery.getBatteryLevelAsync();
          return Math.round(level * 100);
        },
        subscribe: subscribeBatteryLevel,
        minIntervalMs: 5000, // Max 1 update per 5 seconds
      },
      {
        descriptor: {
          name: 'state',
          label: 'Battery state',
          description: 'Charging state (charging, discharging, full, unknown)',
          endpoint: BATTERY_STATE_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'battery-charging',
            color: '$yellow10',
          },
        },
        boot: async () => {
          const state = await Battery.getBatteryStateAsync();
          return batteryStateToString(state);
        },
        subscribe: subscribeBatteryState,
        minIntervalMs: 1000,
      },
      {
        descriptor: {
          name: 'low_power_mode',
          label: 'Low power mode',
          description: 'Whether low power mode is enabled',
          endpoint: BATTERY_LOW_POWER_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'zap-off',
            color: '$orange10',
          },
        },
        boot: async () => {
          const enabled = await Battery.isLowPowerModeEnabledAsync();
          return enabled ? 'enabled' : 'disabled';
        },
        subscribe: subscribeLowPowerMode,
        minIntervalMs: 1000,
      },
    ],
    actions: [],
  };
}

function subscribeBatteryLevel(emit: EmitFn): UnsubscribeFn {
  const subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
    emit(Math.round(batteryLevel * 100));
  });
  return () => subscription.remove();
}

function subscribeBatteryState(emit: EmitFn): UnsubscribeFn {
  const subscription = Battery.addBatteryStateListener(({ batteryState }) => {
    emit(batteryStateToString(batteryState));
  });
  return () => subscription.remove();
}

function subscribeLowPowerMode(emit: EmitFn): UnsubscribeFn {
  const subscription = Battery.addLowPowerModeListener(({ lowPowerMode }) => {
    emit(lowPowerMode ? 'enabled' : 'disabled');
  });
  return () => subscription.remove();
}

function batteryStateToString(state: Battery.BatteryState): string {
  switch (state) {
    case Battery.BatteryState.CHARGING:
      return 'charging';
    case Battery.BatteryState.FULL:
      return 'full';
    case Battery.BatteryState.UNPLUGGED:
      return 'discharging';
    default:
      return 'unknown';
  }
}
