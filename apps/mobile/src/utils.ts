import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

export async function generateDeviceName(): Promise<string> {
  const platform = Platform.OS; // 'android' or 'ios'
  
  let uniqueId: string | null = null;
  
  if (Platform.OS === 'android') {
    // Use Android ID - unique per device/user combination
    uniqueId = Application.getAndroidId();
  } else if (Platform.OS === 'ios') {
    // Use iOS vendor ID - unique per app/vendor
    uniqueId = await Application.getIosIdForVendorAsync();
  }
  
  if (uniqueId) {
    // Take first 8 chars of the ID for a shorter name
    const shortId = uniqueId.replace(/-/g, '').slice(0, 8).toLowerCase();
    return `${platform}_${shortId}`;
  }
  
  // Fallback: use device model + random
  const model = Device.modelName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'device';
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${platform}_${model}_${suffix}`;
}

export function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return 'Unknown error';
}

