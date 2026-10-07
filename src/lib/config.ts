// src/lib/config.ts

/**
 * Retrieves the base URL for the application.
 * It prioritizes NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_APP_URL,
 * and falls back to window.location.origin or localhost.
 * @returns The base URL string.
 */
export const getBaseUrl = (): string => {
  if (typeof process !== 'undefined' && process.env) {
    const envUrl = 
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL;
    if (envUrl) {
      return envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
    }
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return `http://localhost:${process.env.PORT || 3007}`;
};
