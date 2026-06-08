import type { GrowthbookConfig } from './types';

const DEFAULT_APP_ORIGIN = 'https://app.growthbook.io';

function normalizeUrl(value: string, fallback?: string): string {
  const normalized = (value?.trim() || fallback || '').replace(/\/+$/, '');
  return normalized;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const GB_TOKEN: string = requireEnv('GB_TOKEN');
export const GB_API_HOST: string = normalizeUrl(requireEnv('GB_API_HOST'));
export const GB_APP_ORIGIN: string = normalizeUrl(
  process.env.GB_APP_ORIGIN || '',
  DEFAULT_APP_ORIGIN
);

export function getGrowthbookConfig(): GrowthbookConfig {
  return {
    token: GB_TOKEN,
    apiHost: GB_API_HOST,
    appOrigin: GB_APP_ORIGIN,
  };
}

export { normalizeUrl };
