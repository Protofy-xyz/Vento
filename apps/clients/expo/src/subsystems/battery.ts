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
            order: 11,
            html: `//@card/react
function Widget(card) {
  const level = parseInt(card.value) || 0;
  const color = level > 50 ? '#22c55e' : level > 20 ? '#eab308' : '#ef4444';
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card.icon && card.displayIcon !== false && (
            <Icon name={card.icon} size={48} color={color}/>
          )}
          <div style={{fontSize: '36px', fontWeight: 'bold', marginTop: '12px', color: color}}>
            {level}%
          </div>
          <div style={{width: '80%', height: '8px', background: '#333', borderRadius: '4px', marginTop: '8px', overflow: 'hidden'}}>
            <div style={{width: level + '%', height: '100%', background: color, borderRadius: '4px', transition: 'width 0.3s'}}/>
          </div>
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}`,
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
            order: 12,
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
            order: 13,
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
