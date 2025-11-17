/**
 * Unit Tests: RPC Batcher
 *
 * Tests the RPC batching utility for correctness and performance.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RPCBatcher, createBatchedProvider } from '../../../src/utils/rpc-batcher.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('RPCBatcher', () => {
  let batcher: RPCBatcher;
  const mockRpcUrl = 'https://eth-mainnet.example.com/v2/test';

  beforeEach(() => {
    vi.clearAllMocks();
    batcher = new RPCBatcher(mockRpcUrl, {
      maxBatchSize: 10,
      maxWaitTime: 50, // Longer for tests
      debug: false,
    });
  });

  afterEach(async () => {
    // Ensure pending batches are flushed
    if (batcher.isPending()) {
      await batcher.flush();
    }
  });

  describe('Basic Batching', () => {
    it('should batch multiple calls into single request', async () => {
      const mockResponse = [
        { jsonrpc: '2.0', id: 0, result: '0x1234' },
        { jsonrpc: '2.0', id: 1, result: '0x5678' },
        { jsonrpc: '2.0', id: 2, result: '0xabcd' },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const promises = [
        batcher.call('eth_getBalance', ['0xAddress1', 'latest']),
        batcher.call('eth_getBalance', ['0xAddress2', 'latest']),
        batcher.call('eth_getBalance', ['0xAddress3', 'latest']),
      ];

      // Manually flush to avoid waiting for timer
      setTimeout(() => batcher.flush(), 10);

      const results = await Promise.all(promises);

      expect(results).toEqual(['0x1234', '0x5678', '0xabcd']);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall![1]!.body as string);

      expect(requestBody).toHaveLength(3);
      expect(requestBody[0]).toMatchObject({
        jsonrpc: '2.0',
        id: 0,
        method: 'eth_getBalance',
        params: ['0xAddress1', 'latest'],
      });
    });

    it('should auto-flush after maxWaitTime', async () => {
      const mockResponse = [{ jsonrpc: '2.0', id: 0, result: '0x1234' }];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const promise = batcher.call('eth_getBalance', ['0xAddress', 'latest']);

      // Wait for auto-flush (maxWaitTime = 50ms)
      const result = await promise;

      expect(result).toBe('0x1234');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should auto-flush when batch size reached', async () => {
      const mockResponse = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0',
        id: i,
        result: `0x${i}`,
      }));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Create 10 calls (equals maxBatchSize)
      const promises = Array.from({ length: 10 }, (_, i) =>
        batcher.call('eth_getBalance', [`0xAddress${i}`, 'latest'])
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle RPC errors correctly', async () => {
      const mockResponse = [
        { jsonrpc: '2.0', id: 0, result: '0x1234' },
        {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32000, message: 'Insufficient funds' },
        },
        { jsonrpc: '2.0', id: 2, result: '0xabcd' },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const promises = [
        batcher.call('eth_sendTransaction', [{ to: '0xAddress1' }]),
        batcher.call('eth_sendTransaction', [{ to: '0xAddress2' }]),
        batcher.call('eth_sendTransaction', [{ to: '0xAddress3' }]),
      ];

      setTimeout(() => batcher.flush(), 10);

      const results = await Promise.allSettled(promises);

      expect(results[0]!.status).toBe('fulfilled');
      expect((results[0] as PromiseFulfilledResult<unknown>).value).toBe('0x1234');

      expect(results[1]!.status).toBe('rejected');
      expect((results[1] as PromiseRejectedResult).reason.message).toContain(
        'Insufficient funds'
      );

      expect(results[2]!.status).toBe('fulfilled');
      expect((results[2] as PromiseFulfilledResult<unknown>).value).toBe('0xabcd');
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const promise = batcher.call('eth_getBalance', ['0xAddress', 'latest']);

      setTimeout(() => batcher.flush(), 10);

      await expect(promise).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should handle network errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network timeout')
      );

      const promises = [
        batcher.call('eth_getBalance', ['0xAddress1', 'latest']),
        batcher.call('eth_getBalance', ['0xAddress2', 'latest']),
      ];

      setTimeout(() => batcher.flush(), 10);

      await expect(Promise.all(promises)).rejects.toThrow('Network timeout');
    });
  });

  describe('Statistics', () => {
    it('should track batch statistics correctly', async () => {
      const mockResponses = [
        [
          { jsonrpc: '2.0', id: 0, result: '0x1' },
          { jsonrpc: '2.0', id: 1, result: '0x2' },
          { jsonrpc: '2.0', id: 2, result: '0x3' },
        ],
        [
          { jsonrpc: '2.0', id: 0, result: '0x4' },
          { jsonrpc: '2.0', id: 1, result: '0x5' },
        ],
      ];

      for (const response of mockResponses) {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          json: async () => response,
        } as Response);
      }

      // Batch 1: 3 requests
      const batch1 = [
        batcher.call('eth_getBalance', ['0xA1', 'latest']),
        batcher.call('eth_getBalance', ['0xA2', 'latest']),
        batcher.call('eth_getBalance', ['0xA3', 'latest']),
      ];
      setTimeout(() => batcher.flush(), 10);
      await Promise.all(batch1);

      // Batch 2: 2 requests
      const batch2 = [
        batcher.call('eth_getBalance', ['0xA4', 'latest']),
        batcher.call('eth_getBalance', ['0xA5', 'latest']),
      ];
      setTimeout(() => batcher.flush(), 10);
      await Promise.all(batch2);

      const stats = batcher.getStats();

      expect(stats.totalRequests).toBe(5);
      expect(stats.totalBatches).toBe(2);
      expect(stats.avgBatchSize).toBe(2.5); // (3 + 2) / 2
      expect(stats.maxBatchSize).toBe(3);
      expect(stats.avgLatency).toBeGreaterThan(0);
    });

    it('should reset statistics', async () => {
      const mockResponse = [{ jsonrpc: '2.0', id: 0, result: '0x1234' }];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await batcher.call('eth_getBalance', ['0xAddress', 'latest']);
      await batcher.flush();

      let stats = batcher.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);

      batcher.resetStats();

      stats = batcher.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalBatches).toBe(0);
    });
  });

  describe('Queue Management', () => {
    it('should report queue size correctly', () => {
      expect(batcher.getQueueSize()).toBe(0);

      batcher.call('eth_getBalance', ['0xAddress1', 'latest']);
      expect(batcher.getQueueSize()).toBe(1);

      batcher.call('eth_getBalance', ['0xAddress2', 'latest']);
      expect(batcher.getQueueSize()).toBe(2);
    });

    it('should report pending status correctly', () => {
      expect(batcher.isPending()).toBe(false);

      batcher.call('eth_getBalance', ['0xAddress', 'latest']);
      expect(batcher.isPending()).toBe(true);
    });

    it('should handle empty flush gracefully', async () => {
      await expect(batcher.flush()).resolves.toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('createBatchedProvider', () => {
    it('should create batched provider with helper', async () => {
      const mockResponse = [
        { jsonrpc: '2.0', id: 0, result: '0x1234' },
        { jsonrpc: '2.0', id: 1, result: '0x5678' },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const provider = createBatchedProvider(mockRpcUrl, {
        maxBatchSize: 100,
        maxWaitTime: 50,
      });

      const promises = [
        provider.call('eth_getBalance', ['0xAddress1', 'latest']),
        provider.call('eth_getBalance', ['0xAddress2', 'latest']),
      ];

      setTimeout(() => provider.batcher.flush(), 10);

      const results = await Promise.all(promises);

      expect(results).toEqual(['0x1234', '0x5678']);

      const stats = provider.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalBatches).toBe(1);
    });
  });

  describe('Performance Characteristics', () => {
    it('should batch requests made in quick succession', async () => {
      const mockResponse = Array.from({ length: 5 }, (_, i) => ({
        jsonrpc: '2.0',
        id: i,
        result: `0x${i}`,
      }));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Make calls in rapid succession (< 50ms apart)
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(batcher.call('eth_getBalance', [`0xAddr${i}`, 'latest']));
      }

      setTimeout(() => batcher.flush(), 10);
      await Promise.all(promises);

      // Should batch all into single request
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle different RPC methods in same batch', async () => {
      const mockResponse = [
        { jsonrpc: '2.0', id: 0, result: '0x1234' },
        { jsonrpc: '2.0', id: 1, result: '0x5' },
        { jsonrpc: '2.0', id: 2, result: '0x3b9aca00' },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const promises = [
        batcher.call('eth_getBalance', ['0xAddress', 'latest']),
        batcher.call('eth_getTransactionCount', ['0xAddress', 'latest']),
        batcher.call('eth_gasPrice', []),
      ];

      setTimeout(() => batcher.flush(), 10);
      await Promise.all(promises);

      expect(global.fetch).toHaveBeenCalledTimes(1);

      const requestBody = JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1]!.body as string
      );

      expect(requestBody[0]!.method).toBe('eth_getBalance');
      expect(requestBody[1]!.method).toBe('eth_getTransactionCount');
      expect(requestBody[2]!.method).toBe('eth_gasPrice');
    });
  });
});
