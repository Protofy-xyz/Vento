import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { SubsystemDefinition } from './types';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let permissionGranted: boolean | null = null;

async function ensurePermissions(): Promise<boolean> {
  if (permissionGranted !== null) {
    return permissionGranted;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  
  if (existingStatus === 'granted') {
    permissionGranted = true;
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  permissionGranted = status === 'granted';
  
  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  }

  return permissionGranted;
}

export function buildNotificationsSubsystem(): SubsystemDefinition {
  // Request permissions on load
  ensurePermissions();

  return {
    name: 'notifications',
    type: 'virtual',
    monitors: [],
    actions: [
      {
        descriptor: {
          name: 'show',
          label: 'Show notification',
          description: 'Display a local notification immediately',
          endpoint: '/notifications/actions/show',
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              title: {
                type: 'string',
                description: 'Notification title',
                default: 'Vento',
              },
              body: {
                type: 'string',
                description: 'Notification body text',
                default: 'Hello from Vento!',
              },
              data: {
                type: 'object',
                description: 'Optional data payload (JSON)',
              },
            },
          },
          cardProps: {
            icon: 'bell',
            color: '$blue10',
            order: 69,
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            const hasPermission = await ensurePermissions();
            if (!hasPermission) {
              await reply({ error: 'Notification permission denied' });
              return;
            }

            const { title, body, data } = parseNotificationPayload(payload);

            const id = await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                data: data ?? {},
                sound: 'default',
              },
              trigger: null, // null = immediate
            });

            console.log('[notifications] showed notification:', id);
            await reply({ status: 'ok', id });
          } catch (err: any) {
            console.error('[notifications] error:', err);
            await reply({ error: err?.message ?? 'failed to show notification' });
          }
        },
      },
      {
        descriptor: {
          name: 'schedule',
          label: 'Schedule notification',
          description: 'Schedule a notification to appear later',
          endpoint: '/notifications/actions/schedule',
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              title: {
                type: 'string',
                description: 'Notification title',
                default: 'Reminder',
              },
              body: {
                type: 'string',
                description: 'Notification body text',
                default: 'Scheduled notification',
              },
              seconds: {
                type: 'number',
                description: 'Seconds from now to show notification',
                default: 60,
              },
              data: {
                type: 'object',
                description: 'Optional data payload (JSON)',
              },
            },
          },
          cardProps: {
            icon: 'clock',
            color: '$orange10',
            order: 70,
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            const hasPermission = await ensurePermissions();
            if (!hasPermission) {
              await reply({ error: 'Notification permission denied' });
              return;
            }

            const { title, body, seconds, data } = parseSchedulePayload(payload);

            if (seconds <= 0) {
              await reply({ error: 'seconds must be positive' });
              return;
            }

            const id = await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                data: data ?? {},
                sound: 'default',
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds,
              },
            });

            const scheduledFor = new Date(Date.now() + seconds * 1000).toISOString();
            console.log('[notifications] scheduled notification:', id, 'for', scheduledFor);
            await reply({ status: 'ok', id, scheduledFor });
          } catch (err: any) {
            console.error('[notifications] error:', err);
            await reply({ error: err?.message ?? 'failed to schedule notification' });
          }
        },
      },
      {
        descriptor: {
          name: 'cancel',
          label: 'Cancel notification',
          description: 'Cancel a scheduled notification by ID',
          endpoint: '/notifications/actions/cancel',
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              id: {
                type: 'string',
                description: 'Notification ID to cancel',
              },
            },
          },
          cardProps: {
            icon: 'bell-off',
            color: '$red10',
            order: 71,
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            const { id } = parseCancelPayload(payload);

            if (!id) {
              await reply({ error: 'id is required' });
              return;
            }

            await Notifications.cancelScheduledNotificationAsync(id);
            console.log('[notifications] cancelled notification:', id);
            await reply({ status: 'ok', cancelled: id });
          } catch (err: any) {
            console.error('[notifications] error:', err);
            await reply({ error: err?.message ?? 'failed to cancel notification' });
          }
        },
      },
      {
        descriptor: {
          name: 'cancel_all',
          label: 'Cancel all notifications',
          description: 'Cancel all scheduled notifications',
          endpoint: '/notifications/actions/cancel_all',
          connectionType: 'mqtt',
          payload: { type: 'none' },
          cardProps: {
            icon: 'trash-2',
            color: '$red10',
            order: 72,
          },
          mode: 'request-reply',
        },
        handler: async (_payload, reply) => {
          try {
            await Notifications.cancelAllScheduledNotificationsAsync();
            console.log('[notifications] cancelled all notifications');
            await reply({ status: 'ok' });
          } catch (err: any) {
            console.error('[notifications] error:', err);
            await reply({ error: err?.message ?? 'failed to cancel notifications' });
          }
        },
      },
      {
        descriptor: {
          name: 'set_badge',
          label: 'Set badge count',
          description: 'Set the app icon badge number (iOS/Android)',
          endpoint: '/notifications/actions/set_badge',
          connectionType: 'mqtt',
          payload: {
            type: 'json-schema',
            schema: {
              count: {
                type: 'number',
                description: 'Badge count (0 to clear)',
                default: 0,
              },
            },
          },
          cardProps: {
            icon: 'hash',
            color: '$purple10',
            order: 73,
          },
          mode: 'request-reply',
        },
        handler: async (payload, reply) => {
          try {
            const { count } = parseBadgePayload(payload);
            await Notifications.setBadgeCountAsync(count);
            console.log('[notifications] set badge count:', count);
            await reply({ status: 'ok', badge: count });
          } catch (err: any) {
            console.error('[notifications] error:', err);
            await reply({ error: err?.message ?? 'failed to set badge' });
          }
        },
      },
    ],
  };
}

// ============ Payload parsers ============

function parseNotificationPayload(payload: string): { title: string; body: string; data?: Record<string, any> } {
  const defaults = { title: 'Vento', body: 'Hello from Vento!' };
  
  if (!payload.trim()) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(payload);
    return {
      title: parsed.title ?? defaults.title,
      body: parsed.body ?? defaults.body,
      data: parsed.data,
    };
  } catch {
    // If not JSON, use payload as body
    return { title: defaults.title, body: payload.trim() };
  }
}

function parseSchedulePayload(payload: string): { title: string; body: string; seconds: number; data?: Record<string, any> } {
  const defaults = { title: 'Reminder', body: 'Scheduled notification', seconds: 60 };
  
  if (!payload.trim()) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(payload);
    return {
      title: parsed.title ?? defaults.title,
      body: parsed.body ?? defaults.body,
      seconds: parsed.seconds ?? defaults.seconds,
      data: parsed.data,
    };
  } catch {
    return defaults;
  }
}

function parseCancelPayload(payload: string): { id: string | null } {
  if (!payload.trim()) {
    return { id: null };
  }

  try {
    const parsed = JSON.parse(payload);
    return { id: parsed.id ?? null };
  } catch {
    // If not JSON, use payload as ID
    return { id: payload.trim() };
  }
}

function parseBadgePayload(payload: string): { count: number } {
  if (!payload.trim()) {
    return { count: 0 };
  }

  try {
    const parsed = JSON.parse(payload);
    return { count: Math.max(0, Math.floor(parsed.count ?? parsed ?? 0)) };
  } catch {
    const num = parseInt(payload.trim(), 10);
    return { count: isNaN(num) ? 0 : Math.max(0, num) };
  }
}

