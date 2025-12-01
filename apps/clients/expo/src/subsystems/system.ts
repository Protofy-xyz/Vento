import * as Device from 'expo-device';

import type { SubsystemDefinition } from './types';

const MemoryTotalEndpoint = '/system/monitors/memory_total';
const OSVersionEndpoint = '/system/monitors/os_version';
const DeviceNameEndpoint = '/system/monitors/device_name';
const DeviceBrandEndpoint = '/system/monitors/device_brand';
const DeviceManufacturerEndpoint = '/system/monitors/device_manufacturer';
const DeviceModelEndpoint = '/system/monitors/device_model';
const DeviceProductEndpoint = '/system/monitors/device_product';
const DeviceTypeEndpoint = '/system/monitors/device_type';
const CpuArchEndpoint = '/system/monitors/cpu_arch';

export function buildSystemSubsystem(): SubsystemDefinition {
  return {
    name: 'system',
    type: 'virtual',
    monitors: [
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
            order: 1,
          },
        },
        boot: async () => `${Device.osName ?? 'Unknown'} ${Device.osVersion ?? ''}`.trim(),
      },
      {
        descriptor: {
          name: 'device_model',
          label: 'Model name',
          description: 'Model reported by the OS',
          endpoint: DeviceModelEndpoint,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'smartphone',
            color: '$orange10',
            order: 2,
          },
        },
        boot: async () => Device.modelName ?? Device.productName ?? 'unknown',
      },
      {
        descriptor: {
          name: 'device_brand',
          label: 'Brand',
          description: 'Device brand',
          endpoint: DeviceBrandEndpoint,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'tag',
            color: '$blue10',
            order: 3,
          },
        },
        boot: async () => Device.brand ?? 'unknown',
      },
      {
        descriptor: {
          name: 'device_manufacturer',
          label: 'Manufacturer',
          description: 'Hardware manufacturer',
          endpoint: DeviceManufacturerEndpoint,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'wrench',
            color: '$blue10',
            order: 4,
          },
        },
        boot: async () => Device.manufacturer ?? 'unknown',
      },
      {
        descriptor: {
          name: 'cpu_arch',
          label: 'CPU architecture',
          description: 'Supported CPU architectures',
          endpoint: CpuArchEndpoint,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'cpu',
            color: '$purple10',
            order: 5,
          },
        },
        boot: async () => (Device.supportedCpuArchitectures ?? []).join(', ') || 'unknown',
      },
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
            order: 6,
            html: `//@card/react
function Widget(card) {
  const formatBytes = (bytes) => {
    if (bytes === undefined || bytes === null || bytes === "N/A") return "N/A";
    const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(b)) return bytes;
    const KB = 1024, MB = KB * 1024, GB = MB * 1024;
    if (b >= GB) return (b / GB).toFixed(1) + " GB";
    if (b >= MB) return (b / MB).toFixed(0) + " MB";
    if (b >= KB) return (b / KB).toFixed(0) + " KB";
    return b + " B";
  };
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card.icon && card.displayIcon !== false && (
            <Icon name={card.icon} size={48} color={card.color}/>
          )}
          <div style={{fontSize: '32px', fontWeight: 'bold', marginTop: '12px'}}>
            {formatBytes(card.value)}
          </div>
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}`,
          },
        },
        boot: async () => Device.totalMemory ?? 0,
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
            icon: 'user',
            color: '$purple10',
            order: 7,
          },
        },
        boot: async () => Device.deviceName ?? 'unknown_device',
      },
      {
        descriptor: {
          name: 'device_type',
          label: 'Device type',
          description: 'Physical form factor',
          endpoint: DeviceTypeEndpoint,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'tablet',
            color: '$gray10',
            order: 8,
          },
        },
        boot: async () => formatDeviceType(Device.deviceType),
      },
      {
        descriptor: {
          name: 'device_product',
          label: 'Product ID',
          description: 'Internal product identifier',
          endpoint: DeviceProductEndpoint,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'info',
            color: '$gray10',
            order: 9,
          },
        },
        boot: async () => Device.modelId ?? Device.designName ?? 'unknown',
      },
    ],
    actions: [],
  };
}

function formatDeviceType(type?: number | null) {
  switch (type) {
    case Device.DeviceType.HANDSET:
      return 'handset';
    case Device.DeviceType.TABLET:
      return 'tablet';
    case Device.DeviceType.TV:
      return 'tv';
    case Device.DeviceType.DESKTOP:
      return 'desktop';
    case Device.DeviceType.UNKNOWN:
    default:
      return 'unknown';
  }
}
