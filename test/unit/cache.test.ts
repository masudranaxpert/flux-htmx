import { describe, expect, it, beforeEach, vi } from 'vitest';
import { FragmentCache, isCacheableMethod } from '../../src/cache/cache.js';

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
  it('expires entries after the TTL', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const cache = new FragmentCache();
    cache.set('k', 'v', 1000);
    expect(cache.get('k')).toBe('v');
    vi.setSystemTime(now + 1001);
    expect(cache.get('k')).toBeNull();
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
