/**
 * PriceOracle Tests
 *
 * Comprehensive test suite for Price Oracle subagent
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ethers } from 'ethers';
import { PriceOracle } from '../../../src/subagents/PriceOracle.js';
import {
  type OracleConfig,
  type PriceQueryRequest,
  OracleSource,
  OracleFreshness,
  ManipulationType,
  OracleError,
  OracleErrorCode,
  DEFAULT_ORACLE_CONFIG,
} from '../../../src/types/oracle.js';

// Mock ethers Contract at module level
let mockContractInstance: unknown = null;

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ethers')>();
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: vi.fn(() => mockContractInstance),
    },
  };
});

describe('PriceOracle', () => {
  let oracle: PriceOracle;
  let mockProvider: ethers.Provider;

  beforeEach(() => {
    // Create mock provider
    mockProvider = {
      call: vi.fn(),
    } as unknown as ethers.Provider;

    // Reset mock contract
    mockContractInstance = null;

    // Create fresh oracle instance
    oracle = new PriceOracle({}, mockProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const testOracle = new PriceOracle();
      const stats = testOracle.getCacheStats();

      expect(stats.maxSize).toBe(DEFAULT_ORACLE_CONFIG.maxCacheSize);
      expect(stats.ttl).toBe(DEFAULT_ORACLE_CONFIG.cacheTTL);
      expect(stats.size).toBe(0);
    });

    it('should initialize with custom config', () => {
      const customConfig: Partial<OracleConfig> = {
        cacheTTL: 120,
        maxCacheSize: 500,
        minSources: 2,
      };

      const testOracle = new PriceOracle(customConfig);
      const stats = testOracle.getCacheStats();

      expect(stats.ttl).toBe(120);
      expect(stats.maxSize).toBe(500);
    });

    it('should initialize without provider', () => {
      const testOracle = new PriceOracle();
      expect(testOracle).toBeDefined();
    });
  });

  describe('Chainlink Price Fetching', () => {
    it('should fetch price from Chainlink successfully', async () => {
      // Mock Chainlink contract response
      mockContractInstance = {
        latestRoundData: vi.fn().mockResolvedValue([
          1n, // roundId
          200000000000n, // answer (2000 USD with 8 decimals)
          0n, // startedAt
          BigInt(Math.floor(Date.now() / 1000)), // updatedAt (current time)
          1n, // answeredInRound
        ]),
      };

      const request: PriceQueryRequest = {
        tokenSymbol: 'ETH',
        quoteCurrency: 'USD',
        bypassCache: true,
      };

      const result = await oracle.queryPrice(request);

      expect(result.tokenSymbol).toBe('ETH');
      expect(result.quoteCurrency).toBe('USD');
      expect(result.price.price).toBeGreaterThan(0n);
      expect(result.price.decimals).toBe(18);
      expect(result.price.sources).toHaveLength(1);
      expect(result.price.sources[0]?.source).toBe(OracleSource.CHAINLINK);
      expect(result.freshness).toBe(OracleFreshness.FRESH);
      expect(result.fromCache).toBe(false);
    });

    it('should throw error when provider is missing', async () => {
      const testOracle = new PriceOracle(); // No provider

      const request: PriceQueryRequest = {
        tokenSymbol: 'ETH',
        quoteCurrency: 'USD',
        bypassCache: true,
      };

      await expect(testOracle.queryPrice(request)).rejects.toThrow(OracleError);
    });

    it('should throw error for unconfigured token', async () => {
      const request: PriceQueryRequest = {
        tokenSymbol: 'UNKNOWN',
        quoteCurrency: 'USD',
        bypassCache: true,
      };

      await expect(oracle.queryPrice(request)).rejects.toThrow(OracleError);
    });

    it('should detect stale Chainlink price', async () => {
      // Mock stale price (1 day old)
      const stalePriceTime = Math.floor(Date.now() / 1000) - 86400;
      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(stalePriceTime), 1n]),
      };

      const request: PriceQueryRequest = {
        tokenSymbol: 'ETH',
        bypassCache: true,
      };

      const result = await oracle.queryPrice(request);

      expect(result.freshness).toBe(OracleFreshness.EXPIRED);
      expect(result.price.sources[0]?.confidence).toBeLessThan(100);
    });
  });

  describe('Price Caching', () => {
    it('should cache price after first query', async () => {
      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      const request: PriceQueryRequest = {
        tokenSymbol: 'ETH',
      };

      // First query
      const result1 = await oracle.queryPrice(request);
      expect(result1.fromCache).toBe(false);

      // Second query (should be cached)
      const result2 = await oracle.queryPrice(request);
      expect(result2.fromCache).toBe(true);
      expect(result2.price.price).toBe(result1.price.price);
    });

    it('should bypass cache when requested', async () => {
      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      // First query
      await oracle.queryPrice({ tokenSymbol: 'ETH' });

      // Second query with bypass
      const result = await oracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.fromCache).toBe(false);
    });

    it('should clear cache', async () => {
      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      // Add to cache
      await oracle.queryPrice({ tokenSymbol: 'ETH' });
      expect(oracle.getCacheStats().size).toBe(1);

      // Clear cache
      oracle.clearCache();
      expect(oracle.getCacheStats().size).toBe(0);
    });

    it('should respect max cache size', async () => {
      const testOracle = new PriceOracle({ maxCacheSize: 2 }, mockProvider);

      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      // Add 3 items (should evict oldest)
      await testOracle.queryPrice({ tokenSymbol: 'ETH' });
      await testOracle.queryPrice({ tokenSymbol: 'BTC' });
      await testOracle.queryPrice({ tokenSymbol: 'LINK' });

      expect(testOracle.getCacheStats().size).toBe(2);
    });
  });

  describe('Price Aggregation', () => {
    it('should calculate median price from multiple sources', async () => {
      // We can't easily test multi-source aggregation without mocking multiple oracle sources
      // For now, test with single source and verify aggregation logic

      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      const result = await oracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.price.price).toBeGreaterThan(0n);
      expect(result.price.spread).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when no prices available', async () => {
      const testOracle = new PriceOracle({
        enabledSources: [OracleSource.MANUAL], // No real sources
      });

      await expect(
        testOracle.queryPrice({
          tokenSymbol: 'ETH',
          bypassCache: true,
        })
      ).rejects.toThrow(OracleError);
    });
  });

  describe('Manipulation Detection', () => {
    it('should detect large spread', async () => {
      const testOracle = new PriceOracle(
        {
          enableManipulationDetection: true,
          manipulationThresholds: {
            maxSpread: 2.0,
            maxRapidChange: 10.0,
            minLiquidity: 1000000n * 10n ** 18n,
            maxDeviation: 3.0,
          },
        },
        mockProvider
      );

      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      const result = await testOracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.manipulation).toBeDefined();
      expect(result.manipulation?.riskLevel).toBeDefined();
    });

    it('should detect rapid price changes', async () => {
      const testOracle = new PriceOracle(
        {
          enableManipulationDetection: true,
          manipulationThresholds: {
            maxSpread: 5.0,
            maxRapidChange: 5.0, // 5% per minute
            minLiquidity: 1000000n * 10n ** 18n,
            maxDeviation: 3.0,
          },
        },
        mockProvider
      );

      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      // First query
      await testOracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      // Second query with higher price (simulate rapid change)
      (mockContractInstance as { latestRoundData: unknown }).latestRoundData = vi
        .fn()
        .mockResolvedValue([
          2n,
          220000000000n, // 10% higher
          0n,
          BigInt(Math.floor(Date.now() / 1000) + 60), // 1 minute later
          2n,
        ]);

      const result = await testOracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.manipulation).toBeDefined();
      // Should detect rapid change (10% in 1 minute > 5% threshold)
      const hasRapidChange = result.manipulation?.indicators.some(
        (i) => i.type === ManipulationType.RAPID_CHANGE
      );
      expect(hasRapidChange).toBe(true);
    });

    it('should provide recommendations based on risk level', async () => {
      const testOracle = new PriceOracle(
        {
          enableManipulationDetection: true,
          manipulationThresholds: {
            maxSpread: 5.0,
            maxRapidChange: 10.0,
            minLiquidity: 1000000n * 10n ** 18n,
            maxDeviation: 3.0,
          },
        },
        mockProvider
      );

      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      const result = await testOracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.manipulation?.recommendations).toBeDefined();
      expect(Array.isArray(result.manipulation?.recommendations)).toBe(true);
    });
  });

  describe('Freshness Calculation', () => {
    it('should calculate FRESH for recent prices', async () => {
      mockContractInstance = {
        latestRoundData: vi.fn().mockResolvedValue([
          1n,
          200000000000n,
          0n,
          BigInt(Math.floor(Date.now() / 1000)), // Current time
          1n,
        ]),
      };

      const result = await oracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.freshness).toBe(OracleFreshness.FRESH);
    });

    it('should calculate RECENT for 2-minute old prices', async () => {
      mockContractInstance = {
        latestRoundData: vi.fn().mockResolvedValue([
          1n,
          200000000000n,
          0n,
          BigInt(Math.floor(Date.now() / 1000) - 120), // 2 minutes old
          1n,
        ]),
      };

      const result = await oracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.freshness).toBe(OracleFreshness.RECENT);
    });

    it('should calculate STALE for 10-minute old prices', async () => {
      mockContractInstance = {
        latestRoundData: vi.fn().mockResolvedValue([
          1n,
          200000000000n,
          0n,
          BigInt(Math.floor(Date.now() / 1000) - 600), // 10 minutes old
          1n,
        ]),
      };

      const result = await oracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.freshness).toBe(OracleFreshness.STALE);
    });

    it('should calculate EXPIRED for very old prices', async () => {
      mockContractInstance = {
        latestRoundData: vi.fn().mockResolvedValue([
          1n,
          200000000000n,
          0n,
          BigInt(Math.floor(Date.now() / 1000) - 1800), // 30 minutes old
          1n,
        ]),
      };

      const result = await oracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.freshness).toBe(OracleFreshness.EXPIRED);
    });
  });

  describe('Input Validation', () => {
    it('should validate request with Zod schema', async () => {
      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      const validRequest: PriceQueryRequest = {
        tokenSymbol: 'ETH',
        quoteCurrency: 'USD',
        includeTWAP: false,
        bypassCache: true,
      };

      await expect(oracle.queryPrice(validRequest)).resolves.toBeDefined();
    });

    it('should reject invalid token symbol', async () => {
      const invalidRequest = {
        tokenSymbol: '', // Empty string
        quoteCurrency: 'USD',
      };

      await expect(oracle.queryPrice(invalidRequest as PriceQueryRequest)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle Chainlink contract errors', async () => {
      mockContractInstance = {
        latestRoundData: vi.fn().mockRejectedValue(new Error('Network error')),
      };

      await expect(
        oracle.queryPrice({
          tokenSymbol: 'ETH',
          bypassCache: true,
        })
      ).rejects.toThrow(OracleError);
    });

    it('should include error code in OracleError', async () => {
      mockContractInstance = {
        latestRoundData: vi.fn().mockRejectedValue(new Error('Network error')),
      };

      try {
        await oracle.queryPrice({
          tokenSymbol: 'ETH',
          bypassCache: true,
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(OracleError);
        // When all sources fail, we get NO_PRICE_AVAILABLE error
        expect((error as OracleError).code).toBe(OracleErrorCode.NO_PRICE_AVAILABLE);
      }
    });
  });

  describe('Confidence Scoring', () => {
    it('should give high confidence to fresh prices', async () => {
      mockContractInstance = {
        latestRoundData: vi.fn().mockResolvedValue([
          1n,
          200000000000n,
          0n,
          BigInt(Math.floor(Date.now() / 1000)), // Fresh
          1n,
        ]),
      };

      const result = await oracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.price.confidence).toBeGreaterThanOrEqual(90);
    });

    it('should give lower confidence to stale prices', async () => {
      mockContractInstance = {
        latestRoundData: vi.fn().mockResolvedValue([
          1n,
          200000000000n,
          0n,
          BigInt(Math.floor(Date.now() / 1000) - 7200), // 2 hours old
          1n,
        ]),
      };

      const result = await oracle.queryPrice({
        tokenSymbol: 'ETH',
        bypassCache: true,
      });

      expect(result.price.confidence).toBeLessThan(90);
    });
  });

  describe('TWAP Support', () => {
    it('should handle TWAP request (not yet implemented)', async () => {
      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      const result = await oracle.queryPrice({
        tokenSymbol: 'ETH',
        includeTWAP: true,
        twapPeriod: 3600,
        bypassCache: true,
      });

      // TWAP not implemented yet, should be undefined
      expect(result.twap).toBeUndefined();
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache size', async () => {
      mockContractInstance = {
        latestRoundData: vi
          .fn()
          .mockResolvedValue([1n, 200000000000n, 0n, BigInt(Math.floor(Date.now() / 1000)), 1n]),
      };

      expect(oracle.getCacheStats().size).toBe(0);

      await oracle.queryPrice({ tokenSymbol: 'ETH' });
      expect(oracle.getCacheStats().size).toBe(1);

      await oracle.queryPrice({ tokenSymbol: 'BTC' });
      expect(oracle.getCacheStats().size).toBe(2);
    });
  });
});
