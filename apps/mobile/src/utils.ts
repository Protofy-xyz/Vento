export function generateDeviceName(): string {
  const base = (typeof globalThis?.navigator?.product === 'string' ? 'mobile' : 'device');
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${base}_${suffix}`;
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

