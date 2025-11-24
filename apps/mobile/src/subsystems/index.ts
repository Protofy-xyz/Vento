import { buildSystemSubsystem } from './system';
import { buildSensorsSubsystem } from './sensors';
import { buildCameraSubsystem } from './camera';
import { buildHapticsSubsystem } from './haptics';
import { buildScreenSubsystem } from './screen';
import { buildAudioSubsystem } from './audio';
import { buildBatterySubsystem } from './battery';
import { buildNetworkSubsystem } from './network';
import { buildBrightnessSubsystem } from './brightness';
import { buildSpeechSubsystem } from './speech';
import { buildClipboardSubsystem } from './clipboard';
import { buildLinkingSubsystem } from './linking';
import type { DevicePayload, SubsystemDefinition } from './types';

export function buildSubsystems(): SubsystemDefinition[] {
  return [
    buildSystemSubsystem(),
    buildSensorsSubsystem(),
    buildCameraSubsystem(),
    buildHapticsSubsystem(),
    buildScreenSubsystem(),
    buildAudioSubsystem(),
    buildBatterySubsystem(),
    buildNetworkSubsystem(),
    buildBrightnessSubsystem(),
    buildSpeechSubsystem(),
    buildClipboardSubsystem(),
    buildLinkingSubsystem(),
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

