import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EthereumResourceManager } from '../../../../src/mcp-servers/ethereum/resources.js';
import { EthereumProvider } from '../../../../src/mcp-servers/ethereum/provider.js';

describe('EthereumResourceManager', () => {
  let resourceManager: EthereumResourceManager;
  let mockProvider: EthereumProvider;

  beforeEach(() => {
    // Create a real provider instance (for type compatibility)
    mockProvider = new EthereumProvider('https://example.com', 1, 'test');

    // Mock the provider methods
    vi.spyOn(mockProvider, 'getBalance').mockResolvedValue(1000000000000000000n);
    vi.spyOn(mockProvider, 'getCode').mockResolvedValue('0x');
    vi.spyOn(mockProvider, 'getBlockNumber').mockResolvedValue(1000000);
    vi.spyOn(mockProvider, 'getTransaction').mockResolvedValue(null);
    vi.spyOn(mockProvider, 'getTransactionReceipt').mockResolvedValue(null);
    vi.spyOn(mockProvider, 'getBlock').mockResolvedValue(null);

    const ethersProvider = mockProvider.getProvider();
    vi.spyOn(ethersProvider, 'getTransactionCount').mockResolvedValue(5);

    resourceManager = new EthereumResourceManager(mockProvider);
  });

  describe('getAccountResource', () => {
    it('should get account resource for EOA', async () => {
      const address = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0';

      const result = await resourceManager.getAccountResource(address);

      expect(result.uri).toBe(`ethereum://account/${address}`);
      expect(result.type).toBe('account');
      expect(result.data.address).toBe(address);
      expect(result.data.balance).toBe('1000000000000000000');
      expect(result.data.nonce).toBe(5);
      expect(result.data.isContract).toBe(false);
      expect(result.data.blockNumber).toBe(1000000);
    });

    it('should identify contract accounts', async () => {
      const address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
      vi.spyOn(mockProvider, 'getCode').mockResolvedValue('0x6080604052...');

      const result = await resourceManager.getAccountResource(address);

      expect(result.data.isContract).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const address = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0';
      vi.spyOn(mockProvider, 'getBalance').mockRejectedValue(new Error('RPC error'));

      await expect(resourceManager.getAccountResource(address)).rejects.toThrow(
        'Failed to get account'
      );
    });
  });

  describe('getContractResource', () => {
    it('should get contract resource', async () => {
      const address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
      const bytecode = '0x608060405234801561001057600080fd5b50600436106100365760003560e01c8063';

      vi.spyOn(mockProvider, 'getCode').mockResolvedValue(bytecode);

      const result = await resourceManager.getContractResource(address);

      expect(result.uri).toBe(`ethereum://contract/${address}`);
      expect(result.type).toBe('contract');
      expect(result.data.address).toBe(address);
      expect(result.data.bytecode).toBe(bytecode);
      expect(result.data.balance).toBe('1000000000000000000');
      expect(result.data.blockNumber).toBe(1000000);
    });

    it('should throw error for non-contract address', async () => {
      const address = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0';
      vi.spyOn(mockProvider, 'getCode').mockResolvedValue('0x');

      await expect(resourceManager.getContractResource(address)).rejects.toThrow(
        'Address is not a contract'
      );
    });
  });

  describe('getTransactionResource', () => {
    it('should get pending transaction', async () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const mockTx = {
        hash,
        from: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        value: 1000000000000000000n,
        gasLimit: 21000n,
        gasPrice: 50000000000n,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
        nonce: 5,
        data: '0x',
        blockNumber: null,
        blockHash: null,
      };

      vi.spyOn(mockProvider, 'getTransaction').mockResolvedValue(mockTx as never);
      vi.spyOn(mockProvider, 'getTransactionReceipt').mockResolvedValue(null);

      const result = await resourceManager.getTransactionResource(hash);

      expect(result.uri).toBe(`ethereum://transaction/${hash}`);
      expect(result.type).toBe('transaction');
      expect(result.data.hash).toBe(hash);
      expect(result.data.from).toBe(mockTx.from);
      expect(result.data.to).toBe(mockTx.to);
      expect(result.data.value).toBe('1000000000000000000');
      expect(result.data.status).toBe('pending');
    });

    it('should get confirmed transaction with receipt', async () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const mockTx = {
        hash,
        from: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        value: 1000000000000000000n,
        gasLimit: 21000n,
        gasPrice: 50000000000n,
        nonce: 5,
        data: '0x',
        blockNumber: 1000000,
        blockHash: '0xabc123',
      };

      const mockReceipt = {
        status: 1,
        gasUsed: 21000n,
      };

      vi.spyOn(mockProvider, 'getTransaction').mockResolvedValue(mockTx as never);
      vi.spyOn(mockProvider, 'getTransactionReceipt').mockResolvedValue(mockReceipt as never);

      const result = await resourceManager.getTransactionResource(hash);

      expect(result.data.status).toBe('confirmed');
      expect(result.data.gasUsed).toBe('21000');
      expect(result.data.blockNumber).toBe(1000000);
    });

    it('should identify failed transactions', async () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const mockTx = {
        hash,
        from: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        value: 0n,
        gasLimit: 100000n,
        gasPrice: 50000000000n,
        nonce: 5,
        data: '0x',
        blockNumber: 1000000,
        blockHash: '0xabc123',
      };

      const mockReceipt = {
        status: 0, // Failed
        gasUsed: 100000n,
      };

      vi.spyOn(mockProvider, 'getTransaction').mockResolvedValue(mockTx as never);
      vi.spyOn(mockProvider, 'getTransactionReceipt').mockResolvedValue(mockReceipt as never);

      const result = await resourceManager.getTransactionResource(hash);

      expect(result.data.status).toBe('failed');
    });

    it('should throw error for non-existent transaction', async () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      vi.spyOn(mockProvider, 'getTransaction').mockResolvedValue(null);

      await expect(resourceManager.getTransactionResource(hash)).rejects.toThrow(
        'Transaction not found'
      );
    });
  });

  describe('getBlockResource', () => {
    it('should get block resource', async () => {
      const mockBlock = {
        number: 1000000,
        hash: '0xabc123',
        parentHash: '0xdef456',
        timestamp: 1234567890,
        transactions: ['0xtx1', '0xtx2', '0xtx3'],
        gasUsed: 12000000n,
        gasLimit: 30000000n,
        miner: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
      };

      vi.spyOn(mockProvider, 'getBlock').mockResolvedValue(mockBlock as never);

      const result = await resourceManager.getBlockResource(1000000);

      expect(result.uri).toBe('ethereum://block/1000000');
      expect(result.type).toBe('block');
      expect(result.data.number).toBe(1000000);
      expect(result.data.hash).toBe('0xabc123');
      expect(result.data.transactions).toEqual(['0xtx1', '0xtx2', '0xtx3']);
      expect(result.data.transactionCount).toBe(3);
      expect(result.data.gasUsed).toBe('12000000');
      expect(result.data.miner).toBe('0x742d35cc6634c0532925a3b844bc9e7595f0beb0');
    });

    it('should get latest block', async () => {
      const mockBlock = {
        number: 1000500,
        hash: '0xlatest',
        parentHash: '0xparent',
        timestamp: 1234567890,
        transactions: [],
        gasUsed: 0n,
        gasLimit: 30000000n,
        miner: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
      };

      vi.spyOn(mockProvider, 'getBlock').mockResolvedValue(mockBlock as never);

      const result = await resourceManager.getBlockResource('latest');

      expect(result.data.number).toBe(1000500);
    });

    it('should throw error for non-existent block', async () => {
      vi.spyOn(mockProvider, 'getBlock').mockResolvedValue(null);

      await expect(resourceManager.getBlockResource(9999999)).rejects.toThrow('Block not found');
    });
  });

  describe('listResources', () => {
    it('should list all available resource types', () => {
      const resources = resourceManager.listResources();

      expect(resources).toHaveLength(4);
      expect(resources[0]?.uri).toBe('ethereum://account/*');
      expect(resources[1]?.uri).toBe('ethereum://contract/*');
      expect(resources[2]?.uri).toBe('ethereum://transaction/*');
      expect(resources[3]?.uri).toBe('ethereum://block/*');

      resources.forEach((resource) => {
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('description');
        expect(resource).toHaveProperty('mimeType');
        expect(resource.mimeType).toBe('application/json');
      });
    });
  });
});
