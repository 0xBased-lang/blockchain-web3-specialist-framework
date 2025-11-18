/**
 * Utility functions for the framework
 */

/**
 * Logger utility (placeholder for winston integration)
 */
export const logger = {
  info: (message: string, ...args: unknown[]): void => {
    console.log(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]): void => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  debug: (message: string, ...args: unknown[]): void => {
    if (process.env['DEBUG']) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
};

/**
 * Sleep utility for async operations
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry utility for resilient operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    backoff?: boolean;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoff = true } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);

      if (attempt < maxAttempts) {
        const delay = backoff ? delayMs * attempt : delayMs;
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Export crypto utilities
 */
export * from './crypto.js';

/**
 * Export rate limiting utilities
 */
export { RateLimiter, RateLimiterManager, RPCProvider, type RateLimitConfig } from './RateLimiter.js';

/**
 * Export caching utilities
 */
export { CacheManager, CacheType, type CacheStats } from './CacheManager.js';
