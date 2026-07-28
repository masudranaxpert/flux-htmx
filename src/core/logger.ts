// Development logger. Suppressed in production builds when process.env.NODE_ENV === 'production'.

const PREFIX = '[flux]';

export const log = {
  info(...args: unknown[]): void {
    if (shouldLog()) console.info(PREFIX, ...args);
  },
  warn(...args: unknown[]): void {
    if (shouldLog()) console.warn(PREFIX, ...args);
  },
  error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
  },
  url(msg: string, url: string): void {
    if (shouldLog()) console.warn(PREFIX, `${msg}: ${url}`);
  },
};

function shouldLog(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return false;
  }
  return true;
}
