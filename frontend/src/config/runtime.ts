function isDevEnv(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    return port === '5173' || port === '5174' || port === '5175';
  }
  return false;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getDirectBackendOrigin(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
}

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE as string | undefined;
  if (fromEnv && fromEnv.trim()) return trimTrailingSlash(fromEnv.trim());

  if (isDevEnv()) {
    return getDirectBackendOrigin();
  }
  return '/api';
}

export function getWebSocketUrl(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  if (isDevEnv()) {
    return `ws://${window.location.hostname}:8000/ws`;
  }
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

export function resolveAssetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http') || path.startsWith('data:')) return path;

  if (isDevEnv()) {
    return `${getDirectBackendOrigin()}${path}`;
  }
  return path;
}
