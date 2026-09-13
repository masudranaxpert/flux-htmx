// Development logger. Suppressed in production builds. Vite replaces import.meta.env.PROD
// at build time; the process.env fallback covers Node consumers running unbundled source.

const PREFIX = '[flux]';

const isProductionBuild: boolean =
  Boolean((import.meta as { env?: { PROD?: boolean } }).env?.PROD) ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

export const log = {
  info(...args: unknown[]): void {
    if (!isProductionBuild) console.info(PREFIX, ...args);
  },
  warn(...args: unknown[]): void {
    if (!isProductionBuild) console.warn(PREFIX, ...args);
  },
  error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
  },
  url(msg: string, url: string): void {
    if (!isProductionBuild) console.warn(PREFIX, `${msg}: ${url}`);
  },
};
