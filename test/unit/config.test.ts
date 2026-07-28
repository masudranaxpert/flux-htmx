import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/core/config.js';

describe('resolveConfig', () => {
  it('applies safe defaults', () => {
    const cfg = resolveConfig();
    expect(cfg.htmx.defaultSwap).toBe('innerHTML');
    expect(cfg.requests.timeoutMs).toBe(0);
    expect(cfg.requests.credentials).toBe('same-origin');
    expect(cfg.csrf.strategy).toBe('meta');
    expect(cfg.csrf.headerName).toBe('X-CSRFToken');
  });

  it('merges user values over defaults', () => {
    const cfg = resolveConfig({
      htmx: { defaultSwap: 'outerHTML' },
      requests: { timeoutMs: 5000 },
      csrf: { strategy: 'cookie', cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' },
    });
    expect(cfg.htmx.defaultSwap).toBe('outerHTML');
    expect(cfg.requests.timeoutMs).toBe(5000);
    expect(cfg.requests.credentials).toBe('same-origin'); // untouched
    expect(cfg.csrf.strategy).toBe('cookie');
    expect(cfg.csrf.cookieName).toBe('XSRF-TOKEN');
    expect(cfg.csrf.headerName).toBe('X-XSRF-TOKEN');
  });

  it('throws on invalid strategy (no silent fallback)', () => {
    expect(() => resolveConfig({ csrf: { strategy: 'magic' as never } })).toThrow(/csrf\.strategy/);
  });

  it('throws on negative timeout', () => {
    expect(() => resolveConfig({ requests: { timeoutMs: -1 } })).toThrow(/timeoutMs/);
  });

  it('throws on non-finite timeout', () => {
    expect(() => resolveConfig({ requests: { timeoutMs: Number.POSITIVE_INFINITY } })).toThrow(
      /timeoutMs/,
    );
  });

  it('throws on invalid credentials', () => {
    expect(() => resolveConfig({ requests: { credentials: 'everything' as never } })).toThrow(
      /credentials/,
    );
  });

  it('throws on empty defaultSwap', () => {
    expect(() => resolveConfig({ htmx: { defaultSwap: '   ' } })).toThrow(/defaultSwap/);
  });

  it('allows strategy "none" to disable CSRF', () => {
    const cfg = resolveConfig({ csrf: { strategy: 'none' } });
    expect(cfg.csrf.strategy).toBe('none');
  });
});
