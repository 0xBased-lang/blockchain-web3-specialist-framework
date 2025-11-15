/**
 * GasOptimizer Tests
 *
 * Tests for multi-source gas price optimization.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JsonRpcProvider, parseUnits } from 'ethers';
import { GasOptimizer, GasStrategy, type GasPriceSource } from '../../../src/subagents/GasOptimizer.js';

describe('GasOptimizer', () => {
  let provider: JsonRpcProvider;
  let optimizer: GasOptimizer;

  beforeEach(() => {
    // Mock provider with gas price data
    provider = {
      getFeeData: vi.fn().mockResolvedValue({
        maxFeePerGas: parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: parseUnits('2', 'gwei'),
        gasPrice: null,
      }),
      getBlock: vi.fn().mockResolvedValue({
        number: 12345,
        timestamp: Math.floor(Date.now() / 1000),
        baseFeePerGas: parseUnits('30', 'gwei'),
      }),
    } as unknown as JsonRpcProvider;

    optimizer = new GasOptimizer({
      provider,
      maxGasPrice: parseUnits('500', 'gwei'),
      minPriorityFee: parseUnits('0.1', 'gwei'),
    });
  });

  describe('Gas Optimization', () => {
    it('should optimize gas for standard strategy', async () => {
      const result = await optimizer.getOptimizedGas(GasStrategy.STANDARD);

      expect(result.strategy).toBe(GasStrategy.STANDARD);
      expect(result.baseFee).toBeGreaterThan(0n);
      expect(result.maxPriorityFeePerGas).toBeGreaterThan(0n);
      expect(result.maxFeePerGas).toBeGreaterThan(result.baseFee);
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.estimatedTimeSeconds).toBe(180); // 3 minutes for standard
    });

    it('should optimize gas for slow strategy', async () => {
      const result = await optimizer.getOptimizedGas(GasStrategy.SLOW);

      expect(result.strategy).toBe(GasStrategy.SLOW);
      expect(result.estimatedTimeSeconds).toBe(1200); // 20 minutes for slow
    });

    it('should optimize gas for fast strategy', async () => {
      const result = await optimizer.getOptimizedGas(GasStrategy.FAST);

      expect(result.strategy).toBe(GasStrategy.FAST);
      expect(result.estimatedTimeSeconds).toBe(45); // 45 seconds for fast

      // Fast strategy should have higher priority fee
      const standard = await optimizer.getOptimizedGas(GasStrategy.STANDARD);
      expect(result.maxPriorityFeePerGas).toBeGreaterThan(standard.maxPriorityFeePerGas);
    });

    it('should optimize gas for urgent strategy', async () => {
      const result = await optimizer.getOptimizedGas(GasStrategy.URGENT);

      expect(result.strategy).toBe(GasStrategy.URGENT);
      expect(result.estimatedTimeSeconds).toBe(15); // 15 seconds for urgent

      // Urgent should be most expensive
      const fast = await optimizer.getOptimizedGas(GasStrategy.FAST);
      expect(result.maxFeePerGas).toBeGreaterThanOrEqual(fast.maxFeePerGas);
    });

    it('should enforce minimum priority fee', async () => {
      // Mock very low priority fee
      provider.getFeeData = vi.fn().mockResolvedValue({
        maxFeePerGas: parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: parseUnits('0.01', 'gwei'), // Below minimum
        gasPrice: null,
      });

      const result = await optimizer.getOptimizedGas(GasStrategy.STANDARD);

      expect(result.maxPriorityFeePerGas).toBeGreaterThanOrEqual(parseUnits('0.1', 'gwei'));
    });

    it('should enforce maximum gas price ceiling', async () => {
      // Mock very high gas price
      provider.getFeeData = vi.fn().mockResolvedValue({
        maxFeePerGas: parseUnits('1000', 'gwei'), // Above ceiling
        maxPriorityFeePerGas: parseUnits('100', 'gwei'),
        gasPrice: null,
      });

      provider.getBlock = vi.fn().mockResolvedValue({
        number: 12345,
        timestamp: Math.floor(Date.now() / 1000),
        baseFeePerGas: parseUnits('900', 'gwei'),
      });

      const result = await optimizer.getOptimizedGas(GasStrategy.URGENT);

      expect(result.maxFeePerGas).toBeLessThanOrEqual(parseUnits('500', 'gwei'));
    });
  });

  describe('Multi-Source Aggregation', () => {
    it('should aggregate from multiple sources', async () => {
      const externalSource: GasPriceSource = {
        name: 'etherscan',
        baseFee: parseUnits('35', 'gwei'),
        priorityFee: parseUnits('2.5', 'gwei'),
        timestamp: Date.now(),
      };

      optimizer.addSource(externalSource);

      const result = await optimizer.getOptimizedGas(GasStrategy.STANDARD);

      expect(result.sources.length).toBeGreaterThanOrEqual(2);
      expect(result.sources.some((s) => s.name === 'provider')).toBe(true);
      expect(result.sources.some((s) => s.name === 'etherscan')).toBe(true);
    });

    it('should calculate median from multiple sources', async () => {
      // Add multiple sources with different prices
      optimizer.addSource({
        name: 'source1',
        baseFee: parseUnits('25', 'gwei'),
        priorityFee: parseUnits('1.5', 'gwei'),
        timestamp: Date.now(),
      });

      optimizer.addSource({
        name: 'source2',
        baseFee: parseUnits('35', 'gwei'),
        priorityFee: parseUnits('2.5', 'gwei'),
        timestamp: Date.now(),
      });

      optimizer.addSource({
        name: 'source3',
        baseFee: parseUnits('40', 'gwei'),
        priorityFee: parseUnits('3', 'gwei'),
        timestamp: Date.now(),
      });

      const result = await optimizer.getOptimizedGas(GasStrategy.STANDARD);

      expect(result.sources.length).toBeGreaterThanOrEqual(4);
      // Median should be somewhere in the middle
      expect(result.baseFee).toBeGreaterThan(parseUnits('20', 'gwei'));
      expect(result.baseFee).toBeLessThan(parseUnits('45', 'gwei'));
    });

    it('should handle provider fetch failure gracefully', async () => {
      provider.getFeeData = vi.fn().mockRejectedValue(new Error('Provider unavailable'));

      // Should still work with external sources
      optimizer.addSource({
        name: 'fallback',
        baseFee: parseUnits('30', 'gwei'),
        priorityFee: parseUnits('2', 'gwei'),
        timestamp: Date.now(),
      });

      const result = await optimizer.getOptimizedGas(GasStrategy.STANDARD);

      expect(result.sources.length).toBeGreaterThanOrEqual(1);
      expect(result.baseFee).toBeGreaterThan(0n);
    });
  });

  describe('Historical Analysis', () => {
    it('should update gas price history', async () => {
      await optimizer.updateHistory();

      const stats = optimizer.getStats();
      expect(stats.historicalEntries).toBe(1);
      expect(stats.latestBaseFee).toBeDefined();
      expect(stats.latestPriorityFee).toBeDefined();
    });

    it('should maintain history size limit', async () => {
      const smallOptimizer = new GasOptimizer({
        provider,
        historySizeLimit: 5,
      });

      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        await smallOptimizer.updateHistory();
      }

      const stats = smallOptimizer.getStats();
      expect(stats.historicalEntries).toBeLessThanOrEqual(5);
    });

    it('should calculate historical average', async () => {
      // Add some history
      await optimizer.updateHistory();
      await optimizer.updateHistory();
      await optimizer.updateHistory();

      const average = optimizer.getHistoricalAverage(3600); // 1 hour window

      expect(average).not.toBeNull();
      if (average) {
        expect(average.baseFee).toBeGreaterThan(0n);
        expect(average.priorityFee).toBeGreaterThan(0n);
      }
    });

    it('should return null for empty history', () => {
      const average = optimizer.getHistoricalAverage(3600);
      expect(average).toBeNull();
    });

    it('should filter by time window', async () => {
      // Mock historical blocks with timestamps - some within window, some outside
      let timestamp = Math.floor(Date.now() / 1000) - 1800; // 30 minutes ago

      provider.getBlock = vi.fn().mockImplementation(() => ({
        number: 12345,
        timestamp: timestamp,
        baseFeePerGas: parseUnits('30', 'gwei'),
      }));

      // Add entries within the time window
      for (let i = 0; i < 5; i++) {
        await optimizer.updateHistory();
        timestamp += 300; // 5 minutes between each
      }

      // Get average for last 1 hour (should include all entries)
      const average = optimizer.getHistoricalAverage(3600);

      expect(average).not.toBeNull();
      if (average) {
        expect(average.baseFee).toBeGreaterThan(0n);
      }
    });

    it('should handle history update errors gracefully', async () => {
      provider.getFeeData = vi.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw
      await optimizer.updateHistory();

      const stats = optimizer.getStats();
      expect(stats.historicalEntries).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', () => {
      const stats = optimizer.getStats();

      expect(stats).toHaveProperty('historicalEntries');
      expect(stats).toHaveProperty('externalSources');
      expect(stats.historicalEntries).toBe(0);
      expect(stats.externalSources).toBe(0);
    });

    it('should track external sources count', () => {
      optimizer.addSource({
        name: 'source1',
        baseFee: parseUnits('30', 'gwei'),
        priorityFee: parseUnits('2', 'gwei'),
        timestamp: Date.now(),
      });

      optimizer.addSource({
        name: 'source2',
        baseFee: parseUnits('32', 'gwei'),
        priorityFee: parseUnits('2.2', 'gwei'),
        timestamp: Date.now(),
      });

      const stats = optimizer.getStats();
      expect(stats.externalSources).toBe(2);
    });

    it('should show latest prices after history update', async () => {
      await optimizer.updateHistory();

      const stats = optimizer.getStats();
      expect(stats.latestBaseFee).toBeDefined();
      expect(stats.latestPriorityFee).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing base fee in block', async () => {
      provider.getBlock = vi.fn().mockResolvedValue({
        number: 12345,
        timestamp: Math.floor(Date.now() / 1000),
        baseFeePerGas: null, // Missing base fee (pre-London)
      });

      const result = await optimizer.getOptimizedGas(GasStrategy.STANDARD);

      expect(result.baseFee).toBeGreaterThan(0n);
      expect(result.maxFeePerGas).toBeGreaterThan(0n);
    });

    it('should handle null fee data', async () => {
      provider.getFeeData = vi.fn().mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: null,
      });

      const result = await optimizer.getOptimizedGas(GasStrategy.STANDARD);

      // Should use fallback values
      expect(result.baseFee).toBeGreaterThan(0n);
      expect(result.maxPriorityFeePerGas).toBeGreaterThan(0n);
    });

    it('should handle legacy gas price', async () => {
      provider.getFeeData = vi.fn().mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: parseUnits('50', 'gwei'), // Legacy only
      });

      const result = await optimizer.getOptimizedGas(GasStrategy.STANDARD);

      expect(result.maxFeePerGas).toBeGreaterThan(0n);
    });

    it('should handle single source (no median calculation)', async () => {
      // Only provider, no external sources
      const result = await optimizer.getOptimizedGas(GasStrategy.STANDARD);

      expect(result.sources.length).toBeGreaterThanOrEqual(1);
      expect(result.baseFee).toBeGreaterThan(0n);
    });

    it('should handle all sources missing priority fee', async () => {
      provider.getFeeData = vi.fn().mockResolvedValue({
        maxFeePerGas: parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: null,
        gasPrice: null,
      });

      const result = await optimizer.getOptimizedGas(GasStrategy.STANDARD);

      // Should use fallback priority fee
      expect(result.maxPriorityFeePerGas).toBeGreaterThanOrEqual(parseUnits('0.1', 'gwei'));
    });
  });

  describe('Strategy Differences', () => {
    it('should have increasing priority fees across strategies', async () => {
      const slow = await optimizer.getOptimizedGas(GasStrategy.SLOW);
      const standard = await optimizer.getOptimizedGas(GasStrategy.STANDARD);
      const fast = await optimizer.getOptimizedGas(GasStrategy.FAST);
      const urgent = await optimizer.getOptimizedGas(GasStrategy.URGENT);

      expect(slow.maxPriorityFeePerGas).toBeLessThan(standard.maxPriorityFeePerGas);
      expect(standard.maxPriorityFeePerGas).toBeLessThan(fast.maxPriorityFeePerGas);
      expect(fast.maxPriorityFeePerGas).toBeLessThan(urgent.maxPriorityFeePerGas);
    });

    it('should have decreasing confirmation times across strategies', async () => {
      const slow = await optimizer.getOptimizedGas(GasStrategy.SLOW);
      const standard = await optimizer.getOptimizedGas(GasStrategy.STANDARD);
      const fast = await optimizer.getOptimizedGas(GasStrategy.FAST);
      const urgent = await optimizer.getOptimizedGas(GasStrategy.URGENT);

      expect(slow.estimatedTimeSeconds).toBeGreaterThan(standard.estimatedTimeSeconds);
      expect(standard.estimatedTimeSeconds).toBeGreaterThan(fast.estimatedTimeSeconds);
      expect(fast.estimatedTimeSeconds).toBeGreaterThan(urgent.estimatedTimeSeconds);
    });
  });
});
