import { describe, it, expect } from 'vitest';
import { VERSION, initialize } from '../../src/index.js';
import { Chain } from '../../src/types/index.js';
import { logger, sleep, retry } from '../../src/utils/index.js';

describe('Framework Initialization', () => {
  it('should export VERSION constant', () => {
    expect(VERSION).toBe('0.1.0');
  });

  it('should initialize without errors', () => {
    expect(() => initialize()).not.toThrow();
  });
});

describe('Type Definitions', () => {
  it('should export Chain enum', () => {
    expect(Chain.ETHEREUM_MAINNET).toBe('ethereum-mainnet');
    expect(Chain.ETHEREUM_SEPOLIA).toBe('ethereum-sepolia');
    expect(Chain.SOLANA_MAINNET).toBe('solana-mainnet');
    expect(Chain.SOLANA_DEVNET).toBe('solana-devnet');
  });
});

describe('Utility Functions', () => {
  it('should have logger with all methods', () => {
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('error');
    expect(logger).toHaveProperty('debug');
  });

  it('should sleep for specified duration', async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(150);
  });

  it('should retry failed operations', async () => {
    let attempts = 0;
    const fn = (): Promise<string> => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Simulated failure'));
      }
      return Promise.resolve('success');
    };

    const result = await retry(fn, { maxAttempts: 3, delayMs: 10, backoff: false });
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should throw after max retries', async () => {
    const fn = (): Promise<never> => {
      return Promise.reject(new Error('Always fails'));
    };

    await expect(retry(fn, { maxAttempts: 2, delayMs: 10 })).rejects.toThrow('Always fails');
  });
});
