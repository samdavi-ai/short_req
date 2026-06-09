const DEV_PORT = '5173';

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

  if (typeof window !== 'undefined' && window.location.port === DEV_PORT) {
    return getDirectBackendOrigin();
  }
  return '/api';
}

export function getWebSocketUrl(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  if (typeof window !== 'undefined' && window.location.port === DEV_PORT) {
    return `ws://${window.location.hostname}:8000/ws`;
  }
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

export function resolveAssetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http') || path.startsWith('data:')) return path;

  if (typeof window !== 'undefined' && window.location.port === DEV_PORT) {
    return `${getDirectBackendOrigin()}${path}`;
  }
  return path;
}
