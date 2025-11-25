import { registerRootComponent } from 'expo';
import notifee from '@notifee/react-native';

import App from './App';
import { handleNotificationEvent, initForegroundService } from './src/services/foregroundService';

// Initialize foreground service channel
initForegroundService().catch(console.error);

// Register foreground service task
notifee.registerForegroundService(() => {
  return new Promise(() => {
    // This promise intentionally never resolves while the service runs
    // The service will be stopped explicitly when disconnect is called
    console.log('[foreground] service task running');
  });
});

// Handle notification events in foreground
notifee.onForegroundEvent(({ type, detail }) => {
  handleNotificationEvent(type, detail);
});

// Handle notification events in background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  handleNotificationEvent(type, detail);
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
