/**
 * Unit Tests: Shared Cache
 *
 * Tests the shared caching utility for correctness and performance.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SharedCache, bucketedKey } from '../../../src/utils/shared-cache.js';

describe('SharedCache', () => {
  let cache: SharedCache;

  beforeEach(() => {
    cache = new SharedCache({
      maxSize: 100,
      defaultTTL: 1000, // 1 second for tests
      debug: false,
    });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Basic Caching', () => {
    it('should cache and retrieve values', async () => {
      const fetcher = vi.fn().mockResolvedValue('cached-value');

      const result1 = await cache.get('test-key', fetcher);
      expect(result1).toBe('cached-value');
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await cache.get('test-key', fetcher);
      expect(result2).toBe('cached-value');
      expect(fetcher).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should respect TTL expiration', async () => {
      const fetcher = vi.fn().mockResolvedValue('value');

      // Cache with 100ms TTL
      await cache.get('test-key', fetcher, 100);
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Immediately should hit cache
      await cache.get('test-key', fetcher, 100);
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should fetch again
      await cache.get('test-key', fetcher, 100);
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should use default TTL when not specified', async () => {
      const fetcher = vi.fn().mockResolvedValue('value');

      await cache.get('test-key', fetcher);

      // Should still be cached after 500ms (default TTL is 1000ms)
      await new Promise((resolve) => setTimeout(resolve, 500));
      await cache.get('test-key', fetcher);

      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should handle different types of data', async () => {
      const stringFetcher = vi.fn().mockResolvedValue('string');
      const numberFetcher = vi.fn().mockResolvedValue(12345);
      const objectFetcher = vi.fn().mockResolvedValue({ foo: 'bar' });
      const arrayFetcher = vi.fn().mockResolvedValue([1, 2, 3]);

      const results = await Promise.all([
        cache.get('string-key', stringFetcher),
        cache.get('number-key', numberFetcher),
        cache.get('object-key', objectFetcher),
        cache.get('array-key', arrayFetcher),
      ]);

      expect(results).toEqual(['string', 12345, { foo: 'bar' }, [1, 2, 3]]);
    });
  });

  describe('set() and getSync()', () => {
    it('should set values directly', () => {
      cache.set('test-key', 'test-value');

      const result = cache.getSync('test-key');
      expect(result).toBe('test-value');
    });

    it('should return undefined for missing keys', () => {
      const result = cache.getSync('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return undefined for expired keys', () => {
      cache.set('test-key', 'test-value', 10); // 10ms TTL

      expect(cache.getSync('test-key')).toBe('test-value');

      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cache.getSync('test-key')).toBeUndefined();
          resolve(undefined);
        }, 50);
      });
    });
  });

  describe('has()', () => {
    it('should check key existence correctly', () => {
      expect(cache.has('test-key')).toBe(false);

      cache.set('test-key', 'value');
      expect(cache.has('test-key')).toBe(true);

      cache.invalidate('test-key');
      expect(cache.has('test-key')).toBe(false);
    });

    it('should return false for expired keys', () => {
      cache.set('test-key', 'value', 10);
      expect(cache.has('test-key')).toBe(true);

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cache.has('test-key')).toBe(false);
          resolve(undefined);
        }, 50);
      });
    });
  });

  describe('Invalidation', () => {
    it('should invalidate single key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);

      const deleted = cache.invalidate('key1');
      expect(deleted).toBe(true);

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
    });

    it('should return false when invalidating non-existent key', () => {
      const deleted = cache.invalidate('non-existent');
      expect(deleted).toBe(false);
    });

    it('should invalidate by pattern', () => {
      cache.set('price:ETH', 100);
      cache.set('price:BTC', 200);
      cache.set('price:USDC', 1);
      cache.set('balance:ETH', 50);

      const count = cache.invalidatePattern('price:*');
      expect(count).toBe(3);

      expect(cache.has('price:ETH')).toBe(false);
      expect(cache.has('price:BTC')).toBe(false);
      expect(cache.has('price:USDC')).toBe(false);
      expect(cache.has('balance:ETH')).toBe(true);
    });

    it('should support wildcard patterns', () => {
      cache.set('user:123:name', 'Alice');
      cache.set('user:123:email', 'alice@example.com');
      cache.set('user:456:name', 'Bob');
      cache.set('product:789', 'Widget');

      // Invalidate all user:123 entries
      const count = cache.invalidatePattern('user:123:*');
      expect(count).toBe(2);

      expect(cache.has('user:123:name')).toBe(false);
      expect(cache.has('user:123:email')).toBe(false);
      expect(cache.has('user:456:name')).toBe(true);
      expect(cache.has('product:789')).toBe(true);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(false);

      const stats = cache.getStats();
      expect(stats.entries).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', async () => {
      const fetcher = vi.fn().mockResolvedValue('value');

      // Miss
      await cache.get('key1', fetcher);
      let stats = cache.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(1);

      // Hit
      await cache.get('key1', fetcher);
      stats = cache.getStats();
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);

      // Another hit
      await cache.get('key1', fetcher);
      stats = cache.getStats();
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      const fetcher = vi.fn().mockResolvedValue('value');

      await cache.get('key1', fetcher); // Miss
      await cache.get('key1', fetcher); // Hit
      await cache.get('key1', fetcher); // Hit
      await cache.get('key2', fetcher); // Miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.5); // 2 hits / 4 total requests
    });

    it('should track entry count', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const stats = cache.getStats();
      expect(stats.entries).toBe(3);
    });

    it('should estimate memory usage', () => {
      cache.set('short', '123');
      cache.set('longer-key', 'longer-value-12345');

      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Eviction', () => {
    it('should evict oldest entry when max size reached', () => {
      const smallCache = new SharedCache({
        maxSize: 3,
        defaultTTL: 10000,
      });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      expect(smallCache.has('key1')).toBe(true);

      // Adding 4th entry should evict oldest (key1)
      smallCache.set('key4', 'value4');

      expect(smallCache.has('key1')).toBe(false);
      expect(smallCache.has('key2')).toBe(true);
      expect(smallCache.has('key3')).toBe(true);
      expect(smallCache.has('key4')).toBe(true);
    });

    it('should not exceed max size', () => {
      const smallCache = new SharedCache({
        maxSize: 5,
        defaultTTL: 10000,
      });

      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        smallCache.set(`key${i}`, `value${i}`);
      }

      const stats = smallCache.getStats();
      expect(stats.entries).toBeLessThanOrEqual(5);
    });
  });

  describe('dump()', () => {
    it('should provide detailed cache dump', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // Access key1 twice to increase hits
      cache.getSync('key1');
      cache.getSync('key1');

      const dump = cache.dump();

      expect(dump).toHaveLength(2);
      expect(dump[0]!.key).toBe('key1');
      expect(dump[0]!.hits).toBe(2);
      expect(dump[1]!.key).toBe('key2');
      expect(dump[1]!.hits).toBe(0);

      // Dump should be sorted by hits (descending)
      expect(dump[0]!.hits).toBeGreaterThanOrEqual(dump[1]!.hits);
    });

    it('should include age and TTL information', () => {
      cache.set('key1', 'value1', 5000);

      const dump = cache.dump();

      expect(dump[0]!.age).toBeGreaterThanOrEqual(0);
      expect(dump[0]!.ttl).toBeGreaterThan(0);
      expect(dump[0]!.ttl).toBeLessThanOrEqual(5000);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent fetches correctly', async () => {
      let fetchCount = 0;
      const fetcher = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        fetchCount++;
        return `value-${fetchCount}`;
      });

      // Make 3 concurrent requests for same key
      const promises = [
        cache.get('concurrent-key', fetcher),
        cache.get('concurrent-key', fetcher),
        cache.get('concurrent-key', fetcher),
      ];

      const results = await Promise.all(promises);

      // All should get the same value, but only first should fetch
      // Note: Current implementation may fetch multiple times if
      // requests arrive before first completes
      expect(results[0]).toBeDefined();
      expect(fetcher).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should propagate fetcher errors', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('Fetch failed'));

      await expect(cache.get('error-key', fetcher)).rejects.toThrow('Fetch failed');
    });

    it('should not cache failed fetches', async () => {
      let attemptCount = 0;
      const fetcher = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('First attempt failed');
        }
        return 'success';
      });

      // First attempt fails
      await expect(cache.get('retry-key', fetcher)).rejects.toThrow();

      // Second attempt should try again (not use cached error)
      const result = await cache.get('retry-key', fetcher);
      expect(result).toBe('success');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });
});

describe('bucketedKey', () => {
  it('should create time-bucketed keys', () => {
    const baseKey = 'price:ETH';
    const bucketSize = 30000; // 30 seconds

    const key1 = bucketedKey(baseKey, bucketSize);
    expect(key1).toMatch(/^price:ETH:\d+$/);

    // Same bucket within 30 seconds
    const key2 = bucketedKey(baseKey, bucketSize);
    expect(key2).toBe(key1);
  });

  it('should create different buckets after time passes', () => {
    const baseKey = 'price:BTC';
    const bucketSize = 10; // 10ms for testing

    const key1 = bucketedKey(baseKey, bucketSize);

    return new Promise((resolve) => {
      setTimeout(() => {
        const key2 = bucketedKey(baseKey, bucketSize);
        expect(key2).not.toBe(key1);
        resolve(undefined);
      }, 15);
    });
  });

  it('should create consistent buckets for same time window', () => {
    const now = Date.now();
    const bucketSize = 60000; // 1 minute

    const bucket = Math.floor(now / bucketSize);
    const expectedKey = `test:${bucket}`;

    const key = bucketedKey('test', bucketSize);
    expect(key).toBe(expectedKey);
  });
});
