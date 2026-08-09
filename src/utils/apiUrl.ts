export const normalizeApiUrl = (url?: string): string => {
  if (!url) return '/api';

  const trimmed = String(url).trim();
  if (!trimmed) return '/api';

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$|\s+$/g, '');
  }

  const normalized = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized ? `/${normalized}` : '/api';
};

export const getApiBaseUrl = (): string => normalizeApiUrl((import.meta as any).env?.VITE_API_URL as string | undefined);
