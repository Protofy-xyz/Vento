import NetInfo from '@react-native-community/netinfo';

import type { SubsystemDefinition } from './types';

const NETWORK_TYPE_ENDPOINT = '/network/monitors/type';
const NETWORK_CONNECTED_ENDPOINT = '/network/monitors/connected';
const NETWORK_DETAILS_ENDPOINT = '/network/monitors/details';

const NETWORK_INTERVAL_MS = 15_000; // Every 15 seconds

export function buildNetworkSubsystem(): SubsystemDefinition {
  return {
    name: 'network',
    type: 'virtual',
    monitors: [
      {
        descriptor: {
          name: 'type',
          label: 'Network type',
          description: 'Current network type (wifi, cellular, none, etc.)',
          endpoint: NETWORK_TYPE_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'wifi',
            color: '$blue10',
          },
        },
        boot: readNetworkType,
        intervalMs: NETWORK_INTERVAL_MS,
        producer: readNetworkType,
      },
      {
        descriptor: {
          name: 'connected',
          label: 'Connected',
          description: 'Whether device has internet connection',
          endpoint: NETWORK_CONNECTED_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'globe',
            color: '$green10',
          },
        },
        boot: readNetworkConnected,
        intervalMs: NETWORK_INTERVAL_MS,
        producer: readNetworkConnected,
      },
      {
        descriptor: {
          name: 'details',
          label: 'Network details',
          description: 'Detailed network information (SSID, IP, etc.)',
          endpoint: NETWORK_DETAILS_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: false,
          cardProps: {
            icon: 'info',
            color: '$purple10',
          },
        },
        boot: readNetworkDetails,
        intervalMs: NETWORK_INTERVAL_MS,
        producer: readNetworkDetails,
      },
    ],
    actions: [],
  };
}

async function readNetworkType() {
  const state = await NetInfo.fetch();
  return state.type;
}

async function readNetworkConnected() {
  const state = await NetInfo.fetch();
  return state.isConnected ? 'connected' : 'disconnected';
}

async function readNetworkDetails() {
  const state = await NetInfo.fetch();
  const details: Record<string, any> = {
    type: state.type,
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
  };

  if (state.type === 'wifi' && state.details) {
    const wifiDetails = state.details as any;
    details.ssid = wifiDetails.ssid ?? 'unknown';
    details.strength = wifiDetails.strength ?? null;
    details.ipAddress = wifiDetails.ipAddress ?? null;
    details.frequency = wifiDetails.frequency ?? null;
  } else if (state.type === 'cellular' && state.details) {
    const cellDetails = state.details as any;
    details.cellularGeneration = cellDetails.cellularGeneration ?? 'unknown';
    details.carrier = cellDetails.carrier ?? 'unknown';
  }

  return details;
}

