/**
 * Cache Manager
 *
 * Provides caching for blockchain data with TTL (Time To Live) support.
 * Reduces RPC calls and improves performance.
 *
 * Cache Strategy (from architecture docs):
 * - Balance: 30s TTL (frequently changes)
 * - Transaction: Infinity (immutable once confirmed)
 * - Block number: 12s TTL (~1 block time)
 * - Gas price: 15s TTL (changes frequently)
 * - Contract code: Infinity (immutable)
 *
 * Usage:
 *   const cache = CacheManager.getInstance();
 *   await cache.getOrSet('balance:0x123', async () => getBalance('0x123'), 30);
 */

import NodeCache from 'node-cache';
import { logger } from './logger.js';

/**
 * Cache entry types for type-safe caching
 */
export enum CacheType {
  BALANCE = 'balance',
  TRANSACTION = 'transaction',
  BLOCK = 'block',
  BLOCK_NUMBER = 'blockNumber',
  GAS_PRICE = 'gasPrice',
  CONTRACT_CODE = 'contractCode',
  NONCE = 'nonce',
  RECEIPT = 'receipt',
  TOKEN_METADATA = 'tokenMetadata',
  CUSTOM = 'custom',
}

/**
 * Cache configuration per type
 */
const CACHE_TTL: Record<CacheType, number> = {
  [CacheType.BALANCE]: 30, // 30 seconds
  [CacheType.TRANSACTION]: 0, // Infinity (never expires)
  [CacheType.BLOCK]: 0, // Infinity (immutable)
  [CacheType.BLOCK_NUMBER]: 12, // 12 seconds (~1 block)
  [CacheType.GAS_PRICE]: 15, // 15 seconds
  [CacheType.CONTRACT_CODE]: 0, // Infinity (immutable)
  [CacheType.NONCE]: 5, // 5 seconds (changes frequently)
  [CacheType.RECEIPT]: 0, // Infinity (immutable)
  [CacheType.TOKEN_METADATA]: 3600, // 1 hour (rarely changes)
  [CacheType.CUSTOM]: 60, // 1 minute default
};

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  hitRate: number;
  ksize: number;
  vsize: number;
}

/**
 * Cache Manager Class
 *
 * Singleton pattern for global cache management
 */
export class CacheManager {
  private static instance: CacheManager | null = null;
  private cache: NodeCache;
  private hits = 0;
  private misses = 0;

  private constructor(config?: NodeCache.Options) {
    this.cache = new NodeCache({
      stdTTL: 60, // Default TTL: 60 seconds
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false, // Don't clone values (better performance)
      ...config,
    });

    // Event listeners for monitoring
    this.cache.on('set', (key, _value) => {
      logger.debug('Cache set', { key, size: JSON.stringify(_value).length });
    });

    this.cache.on('del', (key, _value) => {
      logger.debug('Cache delete', { key });
    });

    this.cache.on('expired', (key, _value) => {
      logger.debug('Cache expired', { key });
    });

    this.cache.on('flush', () => {
      logger.info('Cache flushed');
    });

    logger.info('CacheManager initialized');
  }

  /**
   * Get singleton instance
   *
   * @param config - Optional cache configuration (only used on first call)
   * @returns CacheManager instance
   */
  static getInstance(config?: NodeCache.Options): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  /**
   * Build cache key from type and identifier
   *
   * @param type - Cache type
   * @param identifier - Unique identifier (address, hash, etc.)
   * @param chain - Optional chain identifier
   * @returns Cache key string
   */
  static buildKey(type: CacheType, identifier: string, chain?: string): string {
    const parts = [type, identifier];
    if (chain) {
      parts.unshift(chain);
    }
    return parts.join(':');
  }

  /**
   * Get value from cache
   *
   * @param key - Cache key
   * @returns Cached value or undefined
   */
  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);

    if (value !== undefined) {
      this.hits++;
      logger.debug('Cache hit', { key });
      return value;
    }

    this.misses++;
    logger.debug('Cache miss', { key });
    return undefined;
  }

  /**
   * Set value in cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (0 = infinity)
   * @returns Success boolean
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    const success = this.cache.set(key, value, ttl ?? 0);
    if (success) {
      logger.debug('Cache set success', { key, ttl });
    } else {
      logger.warn('Cache set failed', { key });
    }
    return success;
  }

  /**
   * Get value from cache or fetch and cache if missing
   *
   * @param key - Cache key
   * @param fetchFn - Function to fetch value if cache miss
   * @param ttl - Time to live in seconds
   * @returns Cached or fetched value
   */
  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    // Try cache first
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Fetch fresh value
    const value = await fetchFn();

    // Cache it
    this.set(key, value, ttl);

    return value;
  }

  /**
   * Get value with automatic TTL based on cache type
   *
   * @param type - Cache type
   * @param identifier - Unique identifier
   * @param fetchFn - Function to fetch value if cache miss
   * @param chain - Optional chain identifier
   * @returns Cached or fetched value
   */
  async getOrSetTyped<T>(
    type: CacheType,
    identifier: string,
    fetchFn: () => Promise<T>,
    chain?: string
  ): Promise<T> {
    const key = CacheManager.buildKey(type, identifier, chain);
    const ttl = CACHE_TTL[type];
    return this.getOrSet(key, fetchFn, ttl);
  }

  /**
   * Delete value from cache
   *
   * @param key - Cache key
   * @returns Number of deleted entries
   */
  del(key: string): number {
    return this.cache.del(key);
  }

  /**
   * Delete multiple values from cache
   *
   * @param keys - Array of cache keys
   * @returns Number of deleted entries
   */
  delMultiple(keys: string[]): number {
    return this.cache.del(keys);
  }

  /**
   * Check if key exists in cache
   *
   * @param key - Cache key
   * @returns True if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get TTL for a key
   *
   * @param key - Cache key
   * @returns TTL in seconds, or undefined if key doesn't exist
   */
  getTTL(key: string): number | undefined {
    return this.cache.getTtl(key);
  }

  /**
   * Update TTL for a key
   *
   * @param key - Cache key
   * @param ttl - New TTL in seconds
   * @returns Success boolean
   */
  updateTTL(key: string, ttl: number): boolean {
    return this.cache.ttl(key, ttl);
  }

  /**
   * Get all keys matching a pattern
   *
   * @param pattern - Regex pattern or string prefix
   * @returns Array of matching keys
   */
  keys(pattern?: string | RegExp): string[] {
    const allKeys = this.cache.keys();

    if (!pattern) {
      return allKeys;
    }

    if (typeof pattern === 'string') {
      // String prefix match
      return allKeys.filter((key) => key.startsWith(pattern));
    }

    // Regex match
    return allKeys.filter((key) => pattern.test(key));
  }

  /**
   * Clear cache entries matching pattern
   *
   * @param pattern - Optional pattern to match (clears all if not provided)
   * @returns Number of deleted entries
   */
  clear(pattern?: string | RegExp): number {
    if (!pattern) {
      this.cache.flushAll();
      return 0; // flushAll doesn't return count
    }

    const matchingKeys = this.keys(pattern);
    return this.delMultiple(matchingKeys);
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  getStats(): CacheStats {
    const stats = this.cache.getStats();
    const totalRequests = this.hits + this.misses;

    return {
      hits: this.hits,
      misses: this.misses,
      keys: stats.keys,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      ksize: stats.ksize,
      vsize: stats.vsize,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Close cache and clean up
   */
  close(): void {
    this.cache.close();
    logger.info('CacheManager closed');
  }
}

