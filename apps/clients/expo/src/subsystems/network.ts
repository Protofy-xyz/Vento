import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

import type { SubsystemDefinition, EmitFn, UnsubscribeFn } from './types';
import { textTemplate, jsonTemplate } from './cardTemplates';

const NETWORK_TYPE_ENDPOINT = '/network/monitors/type';
const NETWORK_CONNECTED_ENDPOINT = '/network/monitors/connected';
const NETWORK_DETAILS_ENDPOINT = '/network/monitors/details';

export function buildNetworkSubsystem(): SubsystemDefinition {
  return {
    name: 'network',
    type: 'virtual',
    monitors: [
      {
        descriptor: {
          name: 'connected',
          label: 'Connected',
          description: 'Whether device has internet connection',
          endpoint: NETWORK_CONNECTED_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'globe',
            color: '$green10',
            order: 16,
            html: textTemplate,
          },
        },
        boot: async () => {
          const state = await NetInfo.fetch();
          return state.isConnected ? 'connected' : 'disconnected';
        },
        subscribe: (emit) => subscribeNetworkField(emit, (state) => 
          state.isConnected ? 'connected' : 'disconnected'
        ),
        minIntervalMs: 1000,
      },
      {
        descriptor: {
          name: 'type',
          label: 'Network type',
          description: 'Current network type (wifi, cellular, none, etc.)',
          endpoint: NETWORK_TYPE_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'wifi',
            color: '$blue10',
            order: 17,
            html: textTemplate,
          },
        },
        boot: async () => {
          const state = await NetInfo.fetch();
          return state.type;
        },
        subscribe: (emit) => subscribeNetworkField(emit, (state) => state.type),
        minIntervalMs: 1000,
      },
      {
        descriptor: {
          name: 'details',
          label: 'Network details',
          description: 'Detailed network information (SSID, IP, etc.)',
          endpoint: NETWORK_DETAILS_ENDPOINT,
          connectionType: 'mqtt',
          ephemeral: true,
          cardProps: {
            icon: 'info',
            color: '$purple10',
            order: 18,
          },
        },
        boot: async () => {
          const state = await NetInfo.fetch();
          return extractNetworkDetails(state);
        },
        subscribe: (emit) => subscribeNetworkField(emit, extractNetworkDetails),
        minIntervalMs: 2000,
      },
    ],
    actions: [],
  };
}

function subscribeNetworkField<T>(emit: EmitFn, extractor: (state: NetInfoState) => T): UnsubscribeFn {
  const unsubscribe = NetInfo.addEventListener((state) => {
    emit(extractor(state));
  });
  return unsubscribe;
}

function extractNetworkDetails(state: NetInfoState): Record<string, any> {
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
