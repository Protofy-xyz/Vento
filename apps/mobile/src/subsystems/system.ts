import * as Device from 'expo-device';

import type { SubsystemDefinition } from './types';

const MemoryTotalEndpoint = '/system/monitors/memory_total';
const OSVersionEndpoint = '/system/monitors/os_version';
const DeviceNameEndpoint = '/system/monitors/device_name';

const PrintEndpoint = '/system/actions/system_print';
const ExecuteEndpoint = '/system/actions/execute';

export function buildSystemSubsystem(): SubsystemDefinition {
  return {
    name: 'system',
    type: 'virtual',
    monitors: [
      {
        descriptor: {
          name: 'memory_total',
          label: 'Total memory',
          description: 'Device total memory',
          units: 'bytes',
          endpoint: MemoryTotalEndpoint,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'database',
            color: '$green10',
          },
        },
        boot: async () => Device.totalMemory ?? 0,
      },
      {
        descriptor: {
          name: 'os_version',
          label: 'Operating system',
          description: 'OS name and version',
          endpoint: OSVersionEndpoint,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'smartphone',
            color: '$blue10',
          },
        },
        boot: async () => `${Device.osName ?? 'Unknown'} ${Device.osVersion ?? ''}`.trim(),
      },
      {
        descriptor: {
          name: 'device_name',
          label: 'Device name',
          description: 'Reported device name',
          endpoint: DeviceNameEndpoint,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'smartphone',
          },
        },
        boot: async () => Device.deviceName ?? 'unknown_device',
      },
    ],
    actions: [
      {
        descriptor: {
          name: 'system_print',
          label: 'Print to stdout',
          description: 'Logs payload on the device',
          endpoint: PrintEndpoint,
          connectionType: 'mqtt',
          payload: {
            type: 'string',
          },
          cardProps: {
            icon: 'terminal',
          },
        },
        handler: async (payload) => {
          console.log('[system_print]', payload);
        },
      },
      {
        descriptor: {
          name: 'execute',
          label: 'Execute command',
          description: 'Not supported on mobile devices',
          endpoint: ExecuteEndpoint,
          connectionType: 'mqtt',
          payload: {
            type: 'string',
          },
          cardProps: {
            icon: 'code',
            color: '$red10',
          },
          mode: 'request-reply',
        },
        handler: async (_payload, reply) => {
          await reply({
            error: 'execute is not supported on mobile agent',
          });
        },
      },
    ],
  };
}

