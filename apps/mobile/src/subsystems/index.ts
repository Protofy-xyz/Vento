import { buildSystemSubsystem } from './system';
import { buildSensorsSubsystem } from './sensors';
import type { DevicePayload, SubsystemDefinition } from './types';

export function buildSubsystems(): SubsystemDefinition[] {
  return [buildSystemSubsystem(), buildSensorsSubsystem()];
}

export function buildDevicePayload(deviceName: string, subsystems: SubsystemDefinition[]): DevicePayload {
  return {
    name: deviceName,
    currentSdk: 'vento-mobile',
    subsystem: subsystems.map((sub) => ({
      name: sub.name,
      type: sub.type,
      monitors: sub.monitors.map((m) => m.descriptor),
      actions: sub.actions.map((a) => a.descriptor),
    })),
  };
}

