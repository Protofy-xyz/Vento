import type { DevicePayload } from '../subsystems/types';

interface LoginResponse {
  session: {
    token: string;
  };
}

export class VentoClient {
  private readonly baseUrl: URL;

  constructor(host: string) {
    const normalized = host.endsWith('/') ? host : `${host}/`;
    this.baseUrl = new URL(normalized);
  }

  private buildUrl(path: string, token?: string) {
    const url = new URL(path, this.baseUrl);
    if (token) {
      url.searchParams.set('token', token);
    }
    return url.toString();
  }

  private async request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const resp = await fetch(this.buildUrl(path, token), {
      ...init,
      headers,
    });

    if (!resp.ok) {
      const text = await resp.text();
      const error = new Error(text || `HTTP ${resp.status}`);
      (error as any).status = resp.status;
      throw error;
    }
    if (resp.status === 204) {
      return undefined as T;
    }
    return resp.json();
  }

  async login(username: string, password: string) {
    const resp = await this.request<LoginResponse>('/api/core/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return resp.session.token;
  }

  async ensureDevice(token: string, payload: DevicePayload) {
    const devicePath = `/api/core/v1/devices/${encodeURIComponent(payload.name)}`;

    try {
      await this.request(devicePath, {}, token);
    } catch (err: any) {
      if ((err as any).status !== 404) {
        throw err;
      }
      await this.request('/api/core/v1/devices', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          currentSdk: payload.currentSdk,
        }),
      }, token);
    }

    await this.request(devicePath, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  }

  async triggerRegisterActions(token: string) {
    await this.request('/api/core/v1/devices/registerActions', {}, token);
  }
}

