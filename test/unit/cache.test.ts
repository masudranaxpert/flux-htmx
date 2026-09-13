import { describe, expect, it, beforeEach, vi } from 'vitest';
import { FragmentCache, isCacheableMethod } from '../../src/cache/cache.js';
import { cacheKey } from '../../src/cache/cacheWire.js';

describe('FragmentCache — basic', () => {
  let cache: FragmentCache;
  beforeEach(() => {
    cache = new FragmentCache();
  });

  it('stores and returns a value', () => {
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
  });

  it('returns null for a missing key', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('invalidate removes a key', () => {
    cache.set('k', 'v');
    expect(cache.invalidate('k')).toBe(true);
    expect(cache.get('k')).toBeNull();
  });

  it('clear empties the cache', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe('FragmentCache — TTL', () => {
  it('expires fresh entries after the TTL and serves stale during stale grace window', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const cache = new FragmentCache();
    cache.set('k', 'v', 1000, 5000);
    expect(cache.get('k')).toBe('v');
    expect(cache.get('k', { returnMeta: true })).toEqual({ value: 'v', isStale: false });

    vi.setSystemTime(now + 1001);
    expect(cache.get('k')).toBeNull();
    expect(cache.get('k', { allowStale: true, returnMeta: true })).toEqual({
      value: 'v',
      isStale: true,
    });

    vi.setSystemTime(now + 5001);
    expect(cache.get('k', { allowStale: true })).toBeNull();
    vi.useRealTimers();
  });
});

describe('FragmentCache — LRU eviction', () => {
  it('evicts the least-recently-used entry when over the cap', () => {
    const cache = new FragmentCache({ maxEntries: 2 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.get('a');
    cache.set('c', '3');
    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');
  });

  it('evicts when total byte size exceeds maxBytes', () => {
    const cache = new FragmentCache({ maxBytes: 10 });
    cache.set('a', '12345');
    cache.set('b', '123456');
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe('123456');
    expect(cache.totalBytes).toBeLessThanOrEqual(10);
  });
});

describe('FragmentCache — wildcard invalidation', () => {
  it('invalidateMatching removes matching keys', () => {
    const cache = new FragmentCache();
    cache.set('products:list', 'x');
    cache.set('products:detail:1', 'y');
    cache.set('users:list', 'z');
    expect(cache.invalidateMatching('products:*')).toBe(2);
    expect(cache.size).toBe(1);
    expect(cache.get('users:list')).toBe('z');
  });
});

describe('isCacheableMethod', () => {
  it('GET only', () => {
    expect(isCacheableMethod('GET')).toBe(true);
    expect(isCacheableMethod('get')).toBe(true);
    expect(isCacheableMethod('POST')).toBe(false);
    expect(isCacheableMethod('DELETE')).toBe(false);
  });
});

describe('cacheKey — sensitive value hashing', () => {
  const make = (value: string) => {
    const form = document.createElement('form');
    form.innerHTML = `<input type="password" name="password" value="${value}" />`;
    return form;
  };

  it('gives distinct keys per secret without ever writing the secret', () => {
    const a = cacheKey(make('hunter2'), { method: 'GET', action: '/login' });
    const b = cacheKey(make('letmein'), { method: 'GET', action: '/login' });
    expect(a).not.toBe(b);
    expect(a).not.toContain('hunter2');
    expect(b).not.toContain('letmein');
    expect(a).toContain('password=%7E');
  });

  it('produces a stable key for identical secrets', () => {
    const form = make('hunter2');
    expect(cacheKey(form, { method: 'GET', action: '/login' })).toBe(
      cacheKey(form, { method: 'GET', action: '/login' }),
    );
  });
});
