import * as Battery from 'expo-battery';

import type { SubsystemDefinition } from './types';

const BATTERY_LEVEL_ENDPOINT = '/battery/monitors/level';
const BATTERY_STATE_ENDPOINT = '/battery/monitors/state';
const BATTERY_LOW_POWER_ENDPOINT = '/battery/monitors/low_power_mode';

const BATTERY_INTERVAL_MS = 30_000; // Every 30 seconds

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
          ephemeral: false,
          cardProps: {
            icon: 'battery',
            color: '$green10',
          },
        },
        boot: async () => {
          const level = await Battery.getBatteryLevelAsync();
          return Math.round(level * 100);
        },
        intervalMs: BATTERY_INTERVAL_MS,
        producer: async () => {
          const level = await Battery.getBatteryLevelAsync();
          return Math.round(level * 100);
        },
      },
      {
        descriptor: {
          name: 'state',
          label: 'Battery state',
          description: 'Charging state (charging, discharging, full, unknown)',
          endpoint: BATTERY_STATE_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'battery-charging',
            color: '$yellow10',
          },
        },
        boot: async () => {
          const state = await Battery.getBatteryStateAsync();
          return batteryStateToString(state);
        },
        intervalMs: BATTERY_INTERVAL_MS,
        producer: async () => {
          const state = await Battery.getBatteryStateAsync();
          return batteryStateToString(state);
        },
      },
      {
        descriptor: {
          name: 'low_power_mode',
          label: 'Low power mode',
          description: 'Whether low power mode is enabled',
          endpoint: BATTERY_LOW_POWER_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'zap-off',
            color: '$orange10',
          },
        },
        boot: async () => {
          const enabled = await Battery.isLowPowerModeEnabledAsync();
          return enabled ? 'enabled' : 'disabled';
        },
        intervalMs: BATTERY_INTERVAL_MS,
        producer: async () => {
          const enabled = await Battery.isLowPowerModeEnabledAsync();
          return enabled ? 'enabled' : 'disabled';
        },
      },
    ],
    actions: [],
  };
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

