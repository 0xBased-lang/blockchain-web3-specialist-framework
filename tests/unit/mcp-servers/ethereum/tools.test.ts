import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { EthereumToolManager } from '../../../../src/mcp-servers/ethereum/tools.js';
import { EthereumProvider } from '../../../../src/mcp-servers/ethereum/provider.js';
import { EthereumError } from '../../../../src/mcp-servers/ethereum/types.js';

describe('EthereumToolManager', () => {
  let toolManager: EthereumToolManager;
  let mockProvider: EthereumProvider;
  const testPrivateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
  const testAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0';

  beforeEach(() => {
    mockProvider = new EthereumProvider('https://example.com', 1, 'test');

    // Mock provider methods
    vi.spyOn(mockProvider, 'getBalance').mockResolvedValue(1000000000000000000n); // 1 ETH
    vi.spyOn(mockProvider, 'getCode').mockResolvedValue('0x608060405234801561001057600080fd5b50');
    vi.spyOn(mockProvider, 'getBlockNumber').mockResolvedValue(1000000);
    vi.spyOn(mockProvider, 'call').mockResolvedValue(
      '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000'
    ); // 1 ETH in hex
    vi.spyOn(mockProvider, 'estimateGas').mockResolvedValue(21000n);
    vi.spyOn(mockProvider, 'getGasPrice').mockResolvedValue(50000000000n);
    vi.spyOn(mockProvider, 'getFeeData').mockResolvedValue({
      gasPrice: 50000000000n,
      maxFeePerGas: 100000000000n,
      maxPriorityFeePerGas: 2000000000n,
    });
    vi.spyOn(mockProvider, 'getTransactionReceipt').mockResolvedValue({
      blockNumber: 1000001,
      gasUsed: 21000n,
      status: 1,
    } as never);
    vi.spyOn(mockProvider, 'waitForTransaction').mockResolvedValue({
      blockNumber: 1000001,
      gasUsed: 21000n,
      status: 1,
    } as never);

    toolManager = new EthereumToolManager(mockProvider);
  });

  describe('Wallet Management', () => {
    it('should initialize wallet with private key', () => {
      toolManager.initializeWallet(testPrivateKey);
      // Wallet should be initialized (tested implicitly via sendTransaction)
    });

    it('should clear wallet from memory', () => {
      toolManager.initializeWallet(testPrivateKey);
      toolManager.clearWallet();

      // Attempting to send transaction after clearing should fail
      expect(
        toolManager.sendTransaction({
          to: testAddress,
          value: 1000000000000000000n,
        })
      ).rejects.toThrow('Wallet not initialized');
    });

    it('should throw error for invalid private key', () => {
      expect(() => toolManager.initializeWallet('invalid')).toThrow(EthereumError);
    });
  });

  describe('queryBalance', () => {
    it('should query ETH balance', async () => {
      const result = await toolManager.queryBalance({
        address: testAddress,
      });

      expect(result.address).toBe(testAddress);
      expect(result.balance).toBe('1000000000000000000');
      expect(result.blockNumber).toBe(1000000);
      expect(result.symbol).toBe('ETH');
      expect(result.decimals).toBe(18);
    });

    it('should query ERC20 token balance', async () => {
      const tokenAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

      // Mock token calls
      vi.spyOn(mockProvider, 'call')
        .mockResolvedValueOnce('0x0000000000000000000000000000000000000000000000000de0b6b3a7640000') // balanceOf
        .mockResolvedValueOnce(ethers.AbiCoder.defaultAbiCoder().encode(['string'], ['USDC'])) // symbol
        .mockResolvedValueOnce(ethers.AbiCoder.defaultAbiCoder().encode(['uint8'], [6])); // decimals

      const result = await toolManager.queryBalance({
        address: testAddress,
        token: tokenAddress,
      });

      expect(result.address).toBe(testAddress);
      expect(result.token).toBe(tokenAddress);
      expect(result.symbol).toBe('USDC');
      expect(result.decimals).toBe(6);
    });

    it('should handle non-standard ERC20 tokens', async () => {
      const tokenAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

      // Mock token calls - balanceOf succeeds, symbol/decimals fail
      vi.spyOn(mockProvider, 'call')
        .mockResolvedValueOnce('0x0000000000000000000000000000000000000000000000000de0b6b3a7640000')
        .mockRejectedValueOnce(new Error('symbol not found'))
        .mockRejectedValueOnce(new Error('decimals not found'));

      const result = await toolManager.queryBalance({
        address: testAddress,
        token: tokenAddress,
      });

      expect(result.balance).toBe('1000000000000000000');
      expect(result.symbol).toBeUndefined();
      expect(result.decimals).toBeUndefined();
    });

    it('should validate address format', async () => {
      await expect(
        toolManager.queryBalance({
          address: 'invalid',
        })
      ).rejects.toThrow();
    });
  });

  describe('sendTransaction', () => {
    beforeEach(() => {
      toolManager.initializeWallet(testPrivateKey);

      // Mock wallet.sendTransaction - return the transaction with actual parameters
      const mockSendTx = vi.fn().mockImplementation(async (tx: ethers.TransactionRequest) => ({
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        from: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
        to: tx.to ?? testAddress,
        value: tx.value ?? 0n,
        gasLimit: tx.gasLimit ?? 21000n,
        gasPrice: tx.gasPrice ?? null,
        maxFeePerGas: tx.maxFeePerGas ?? null,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? null,
        nonce: tx.nonce ?? 0,
        data: tx.data ?? '0x',
        blockNumber: null,
        blockHash: null,
      }));

      // Access the wallet and mock its sendTransaction method
      vi.spyOn(ethers.Wallet.prototype, 'sendTransaction').mockImplementation(mockSendTx);
    });

    it('should send ETH transaction', async () => {
      const result = await toolManager.sendTransaction({
        to: testAddress,
        value: 1000000000000000000n,
      });

      expect(result.hash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.to).toBe(testAddress);
      expect(result.value).toBe('1000000000000000000');
      expect(result.status).toBe('pending');
    });

    it('should throw error if wallet not initialized', async () => {
      toolManager.clearWallet();

      await expect(
        toolManager.sendTransaction({
          to: testAddress,
          value: 1000000000000000000n,
        })
      ).rejects.toThrow('Wallet not initialized');
    });

    it('should throw error for insufficient balance', async () => {
      vi.spyOn(mockProvider, 'getBalance').mockResolvedValue(100000000000000n); // 0.0001 ETH

      await expect(
        toolManager.sendTransaction({
          to: testAddress,
          value: 1000000000000000000n, // 1 ETH
        })
      ).rejects.toThrow(EthereumError);
    });

    it('should use provided gas limit and price', async () => {
      const result = await toolManager.sendTransaction({
        to: testAddress,
        value: 0n,
        gasLimit: 50000n,
        gasPrice: 100000000000n,
      });

      expect(result.gasLimit).toBe('50000');
    });

    it('should support EIP-1559 transactions', async () => {
      const result = await toolManager.sendTransaction({
        to: testAddress,
        value: 0n,
        maxFeePerGas: 100000000000n,
        maxPriorityFeePerGas: 2000000000n,
      });

      expect(result.maxFeePerGas).toBe('100000000000');
      expect(result.maxPriorityFeePerGas).toBe('2000000000');
    });

    it('should use fallback gas limit if estimation fails', async () => {
      vi.spyOn(mockProvider, 'estimateGas').mockRejectedValue(new Error('Estimation failed'));

      const result = await toolManager.sendTransaction({
        to: testAddress,
        value: 1000000000000000000n,
      });

      // Should use default 21000 gas
      expect(result.gasLimit).toBe('21000');
    });
  });

  describe('callContract', () => {
    it('should call contract method successfully', async () => {
      const abi = [
        'function balanceOf(address) view returns (uint256)',
        'function symbol() view returns (string)',
      ];

      // Mock the underlying ethers provider's call method
      const mockInterface = new ethers.Interface(abi);
      const encodedResult = mockInterface.encodeFunctionResult('balanceOf', [1000000000000000000n]);

      const ethersProvider = mockProvider.getProvider();
      vi.spyOn(ethersProvider, 'call').mockResolvedValue(encodedResult);

      const result = await toolManager.callContract({
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        abi,
        method: 'balanceOf',
        args: [testAddress],
      });

      expect(result.result).toBe(1000000000000000000n);
      expect(result.blockNumber).toBe(1000000);
    });

    it('should throw error if contract does not exist', async () => {
      vi.spyOn(mockProvider, 'getCode').mockResolvedValue('0x');

      await expect(
        toolManager.callContract({
          address: testAddress,
          abi: ['function test() view returns (uint256)'],
          method: 'test',
        })
      ).rejects.toThrow('No contract at address');
    });

    it('should throw error if method not found', async () => {
      const abi = ['function balanceOf(address) view returns (uint256)'];

      await expect(
        toolManager.callContract({
          address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          abi,
          method: 'nonExistentMethod',
        })
      ).rejects.toThrow(EthereumError);
    });
  });

  describe('deployContract', () => {
    beforeEach(() => {
      toolManager.initializeWallet(testPrivateKey);
    });

    it('should throw error if wallet not initialized', async () => {
      toolManager.clearWallet();

      await expect(
        toolManager.deployContract({
          bytecode: '0x608060405234801561001057600080fd5b50',
          abi: [],
        })
      ).rejects.toThrow('Wallet not initialized');
    });

    it('should validate deployment parameters', async () => {
      await expect(
        toolManager.deployContract({
          bytecode: 'invalid',
          abi: [],
        })
      ).rejects.toThrow();
    });
  });

  describe('estimateGas', () => {
    it('should estimate gas for transaction', async () => {
      const result = await toolManager.estimateGas({
        to: testAddress,
        value: 1000000000000000000n,
      });

      expect(result.gasEstimate).toBe('21000');
      expect(result.gasEstimateWithBuffer).toBe('21000'); // Provider adds buffer
    });

    it('should handle estimation errors', async () => {
      vi.spyOn(mockProvider, 'estimateGas').mockRejectedValue(new Error('Estimation failed'));

      await expect(
        toolManager.estimateGas({
          to: testAddress,
          value: 1000000000000000000n,
        })
      ).rejects.toThrow(EthereumError);
    });
  });

  describe('getGasPrice', () => {
    it('should get current gas prices with EIP-1559 support', async () => {
      const result = await toolManager.getGasPrice();

      expect(result.gasPrice).toBe('50000000000');
      expect(result.maxFeePerGas).toBe('100000000000');
      expect(result.maxPriorityFeePerGas).toBe('2000000000');
    });

    it('should handle legacy gas price', async () => {
      vi.spyOn(mockProvider, 'getFeeData').mockResolvedValue({
        gasPrice: 50000000000n,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
      });

      const result = await toolManager.getGasPrice();

      expect(result.gasPrice).toBe('50000000000');
      expect(result.maxFeePerGas).toBeNull();
      expect(result.maxPriorityFeePerGas).toBeNull();
    });
  });

  describe('waitForTransaction', () => {
    it('should wait for transaction confirmation', async () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const result = await toolManager.waitForTransaction(hash, 12);

      expect(result.confirmed).toBe(true);
      expect(result.blockNumber).toBe(1000001);
      expect(result.gasUsed).toBe('21000');
      expect(result.status).toBe('confirmed');
    });

    it('should detect failed transactions', async () => {
      vi.spyOn(mockProvider, 'waitForTransaction').mockResolvedValue({
        blockNumber: 1000001,
        gasUsed: 21000n,
        status: 0, // Failed
      } as never);

      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = await toolManager.waitForTransaction(hash);

      expect(result.status).toBe('failed');
    });

    it('should throw error if transaction not found', async () => {
      vi.spyOn(mockProvider, 'waitForTransaction').mockResolvedValue(null);

      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      await expect(toolManager.waitForTransaction(hash)).rejects.toThrow(EthereumError);
    });
  });
});
