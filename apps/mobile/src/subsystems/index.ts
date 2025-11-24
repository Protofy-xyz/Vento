import { buildSystemSubsystem } from './system';
import { buildSensorsSubsystem } from './sensors';
import { buildCameraSubsystem } from './camera';
import { buildHapticsSubsystem } from './haptics';
import { buildScreenSubsystem } from './screen';
import { buildAudioSubsystem } from './audio';
import type { DevicePayload, SubsystemDefinition } from './types';

export function buildSubsystems(): SubsystemDefinition[] {
  return [
    buildSystemSubsystem(),
    buildSensorsSubsystem(),
    buildCameraSubsystem(),
    buildHapticsSubsystem(),
    buildScreenSubsystem(),
    buildAudioSubsystem(),
  ];
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

