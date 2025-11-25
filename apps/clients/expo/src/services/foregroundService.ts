import notifee, { AndroidImportance, EventType } from '@notifee/react-native';

const CHANNEL_ID = 'vento-agent';
const NOTIFICATION_ID = 'vento-foreground';

// Callback to handle disconnect from notification
let onDisconnectCallback: (() => void) | null = null;

export function setDisconnectCallback(callback: (() => void) | null) {
  onDisconnectCallback = callback;
}

/**
 * Initialize the foreground service and create notification channel
 */
export async function initForegroundService() {
  // Create notification channel (Android only)
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Vento Agent',
    description: 'Shows when Vento Agent is connected',
    importance: AndroidImportance.LOW, // Low = no sound, but visible
  });
}

/**
 * Start foreground service with persistent notification
 */
export async function startForegroundService(host: string, deviceName: string) {
  // Request notification permissions
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < 1) {
    console.warn('[foreground] notification permission denied');
  }

  // Extract just the host part for display
  let displayHost = host;
  try {
    const url = new URL(host);
    displayHost = url.hostname + (url.port ? `:${url.port}` : '');
  } catch {
    // Keep original if parsing fails
  }

  // Display persistent notification with foreground service
  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: '🟢 Vento Agent Connected',
    body: `Device: ${deviceName}\nServer: ${displayHost}`,
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      ongoing: true, // Cannot be dismissed
      smallIcon: 'ic_launcher', // Uses app icon
      pressAction: {
        id: 'open',
        launchActivity: 'default',
      },
      actions: [
        {
          title: '🔴 Disconnect',
          pressAction: {
            id: 'disconnect',
          },
        },
      ],
    },
  });

  console.log('[foreground] service started');
}

/**
 * Stop foreground service
 */
export async function stopForegroundService() {
  await notifee.stopForegroundService();
  await notifee.cancelNotification(NOTIFICATION_ID);
  console.log('[foreground] service stopped');
}

/**
 * Handle notification events (must be called from index.ts)
 */
export function handleNotificationEvent(type: EventType, detail: any) {
  if (type === EventType.ACTION_PRESS) {
    if (detail.pressAction?.id === 'disconnect') {
      console.log('[foreground] disconnect pressed');
      if (onDisconnectCallback) {
        onDisconnectCallback();
      }
    }
  } else if (type === EventType.PRESS) {
    // Tapped on notification body - opens app
    console.log('[foreground] notification pressed');
  }
}

