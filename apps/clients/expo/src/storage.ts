import * as SecureStore from 'expo-secure-store';

export interface StoredConfig {
  host: string;
  username: string;
  deviceName?: string;
  token?: string;
}

const STORAGE_KEY = 'vento_mobile_config';

export async function loadStoredConfig(): Promise<StoredConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredConfig;
  } catch {
    return null;
  }
}

export async function saveStoredConfig(config: StoredConfig) {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed to save config', err);
  }
}

export async function clearStoredConfig() {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear config', err);
  }
}

