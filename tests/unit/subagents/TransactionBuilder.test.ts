/**
 * TransactionBuilder Tests
 *
 * Tests for multi-chain transaction building with gas estimation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JsonRpcProvider, parseUnits } from 'ethers';
import { Connection, SystemProgram, Keypair } from '@solana/web3.js';
import { TransactionBuilder } from '../../../src/subagents/TransactionBuilder.js';
import {
  TransactionType,
  type EthereumTransactionParams,
  type SolanaTransactionParams,
} from '../../../src/types/transaction.js';

describe('TransactionBuilder', () => {
  describe('Ethereum Transactions', () => {
    let provider: JsonRpcProvider;
    let builder: TransactionBuilder;

    beforeEach(() => {
      // Mock Ethereum provider
      provider = {
        estimateGas: vi.fn().mockResolvedValue(21000n),
        getFeeData: vi.fn().mockResolvedValue({
          maxFeePerGas: parseUnits('50', 'gwei'),
          maxPriorityFeePerGas: parseUnits('2', 'gwei'),
          gasPrice: null,
        }),
        getNetwork: vi.fn().mockResolvedValue({ chainId: 1n }),
        getTransactionCount: vi.fn().mockResolvedValue(5),
      } as unknown as JsonRpcProvider;

      builder = new TransactionBuilder({
        ethereumProvider: provider,
        gasSafetyMargin: 20,
        maxGasPrice: parseUnits('500', 'gwei'),
      });
    });

    it('should build EIP-1559 transaction with auto gas estimation', async () => {
      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
      };

      const built = await builder.buildTransaction(params);

      expect(built.chain).toBe('ethereum');
      expect(built.params).toEqual(params);
      expect(built.transaction).toBeDefined();
      expect(built.transaction).toHaveProperty('from', params.from);
      expect(built.transaction).toHaveProperty('to', params.to);
      expect(built.transaction).toHaveProperty('value', params.value);
      expect(built.transaction).toHaveProperty('nonce');
      expect(built.transaction).toHaveProperty('gasLimit');
      expect(built.transaction).toHaveProperty('maxFeePerGas');
      expect(built.transaction).toHaveProperty('maxPriorityFeePerGas');
      expect(built.transaction).toHaveProperty('chainId', 1);
      expect(built.estimatedGas).toBeDefined();
      expect(built.estimatedCost).toBeDefined();
    });

    it('should build legacy transaction with gasPrice', async () => {
      // Mock legacy gas price
      provider.getFeeData = vi.fn().mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: parseUnits('30', 'gwei'),
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('0.5', 'ether'),
      };

      const built = await builder.buildTransaction(params);

      expect(built.transaction).toHaveProperty('gasPrice');
      expect(built.transaction).not.toHaveProperty('maxFeePerGas');
    });

    it('should use provided nonce if specified', async () => {
      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
        nonce: 42,
      };

      const built = await builder.buildTransaction(params);

      expect(built.transaction).toHaveProperty('nonce', 42);
    });

    it('should use provided gas parameters', async () => {
      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
        gasLimit: 30000n,
        maxFeePerGas: parseUnits('100', 'gwei'),
        maxPriorityFeePerGas: parseUnits('3', 'gwei'),
      };

      const built = await builder.buildTransaction(params);

      expect(built.transaction).toHaveProperty('gasLimit', 30000n);
      expect(built.transaction).toHaveProperty('maxFeePerGas', parseUnits('100', 'gwei'));
      expect(built.transaction).toHaveProperty('maxPriorityFeePerGas', parseUnits('3', 'gwei'));
    });

    it('should build contract call transaction with data', async () => {
      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.CONTRACT_CALL,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        data: '0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890',
      };

      const built = await builder.buildTransaction(params);

      expect(built.transaction).toHaveProperty('data', params.data);
    });

    it('should apply safety margin to gas estimate', async () => {
      provider.estimateGas = vi.fn().mockResolvedValue(100000n);

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
      };

      const built = await builder.buildTransaction(params);

      // 100000 + 20% = 120000
      expect(built.estimatedGas).toBe(120000n);
    });

    it('should reject transaction if gas price exceeds maximum', async () => {
      provider.getFeeData = vi.fn().mockResolvedValue({
        maxFeePerGas: parseUnits('600', 'gwei'), // Exceeds 500 gwei max
        maxPriorityFeePerGas: parseUnits('2', 'gwei'),
        gasPrice: null,
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
      };

      await expect(builder.buildTransaction(params)).rejects.toThrow(/Gas price too high/);
    });
  });

  describe('Gas Estimation', () => {
    let provider: JsonRpcProvider;
    let builder: TransactionBuilder;

    beforeEach(() => {
      provider = {
        estimateGas: vi.fn().mockResolvedValue(21000n),
        getFeeData: vi.fn().mockResolvedValue({
          maxFeePerGas: parseUnits('50', 'gwei'),
          maxPriorityFeePerGas: parseUnits('2', 'gwei'),
          gasPrice: null,
        }),
      } as unknown as JsonRpcProvider;

      builder = new TransactionBuilder({
        ethereumProvider: provider,
        gasSafetyMargin: 20,
      });
    });

    it('should estimate gas with safety margin', async () => {
      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
      };

      const estimation = await builder.estimateGas(params);

      expect(estimation.gasLimit).toBe(25200n); // 21000 + 20%
      expect(estimation.maxFeePerGas).toBe(parseUnits('50', 'gwei'));
      expect(estimation.maxPriorityFeePerGas).toBe(parseUnits('2', 'gwei'));
      expect(estimation.estimatedCost).toBe(25200n * parseUnits('50', 'gwei'));
    });

    it('should use gasPrice for legacy transactions', async () => {
      provider.getFeeData = vi.fn().mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: parseUnits('30', 'gwei'),
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
      };

      const estimation = await builder.estimateGas(params);

      expect(estimation.maxFeePerGas).toBe(parseUnits('30', 'gwei'));
    });

    it('should handle gas estimation errors', async () => {
      provider.estimateGas = vi.fn().mockRejectedValue(new Error('Insufficient funds'));

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1000', 'ether'), // Too much
      };

      await expect(builder.estimateGas(params)).rejects.toThrow(/Gas estimation failed/);
    });
  });

  describe('Solana Transactions', () => {
    let connection: Connection;
    let builder: TransactionBuilder;

    beforeEach(() => {
      // Mock Solana connection
      connection = {
        getLatestBlockhash: vi.fn().mockResolvedValue({
          blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
          lastValidBlockHeight: 123456,
        }),
      } as unknown as Connection;

      builder = new TransactionBuilder({
        solanaConnection: connection,
      });
    });

    it('should build SOL transfer transaction', async () => {
      const fromKeypair = Keypair.generate();
      const toKeypair = Keypair.generate();

      const params: SolanaTransactionParams = {
        chain: 'solana',
        type: TransactionType.TRANSFER,
        from: fromKeypair.publicKey.toBase58(),
        to: toKeypair.publicKey.toBase58(),
        value: 1000000000n, // 1 SOL in lamports
      };

      const built = await builder.buildTransaction(params);

      expect(built.chain).toBe('solana');
      expect(built.params).toEqual(params);
      expect(built.transaction).toBeDefined();

      // Check that transaction has instructions
      const tx = built.transaction as any;
      expect(tx.instructions).toHaveLength(1);
      expect(tx.instructions[0].programId.toString()).toBe(SystemProgram.programId.toString());
    });

    it('should use provided recentBlockhash', async () => {
      const fromKeypair = Keypair.generate();
      const toKeypair = Keypair.generate();
      const customBlockhash = 'CustomBlockhash1111111111111111111111111111';

      const params: SolanaTransactionParams = {
        chain: 'solana',
        type: TransactionType.TRANSFER,
        from: fromKeypair.publicKey.toBase58(),
        to: toKeypair.publicKey.toBase58(),
        value: 1000000000n,
        recentBlockhash: customBlockhash,
      };

      const built = await builder.buildTransaction(params);

      const tx = built.transaction as any;
      expect(tx.recentBlockhash).toBe(customBlockhash);
    });

    it('should use custom feePayer', async () => {
      const fromKeypair = Keypair.generate();
      const toKeypair = Keypair.generate();
      const feePayerKeypair = Keypair.generate();

      const params: SolanaTransactionParams = {
        chain: 'solana',
        type: TransactionType.TRANSFER,
        from: fromKeypair.publicKey.toBase58(),
        to: toKeypair.publicKey.toBase58(),
        value: 1000000000n,
        feePayer: feePayerKeypair.publicKey.toBase58(),
      };

      const built = await builder.buildTransaction(params);

      const tx = built.transaction as any;
      expect(tx.feePayer?.toString()).toBe(feePayerKeypair.publicKey.toString());
    });

    it('should build transaction with custom instructions', async () => {
      const fromKeypair = Keypair.generate();

      const customInstruction = SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 500000000n,
      });

      const params: SolanaTransactionParams = {
        chain: 'solana',
        type: TransactionType.CONTRACT_CALL,
        from: fromKeypair.publicKey.toBase58(),
        instructions: [customInstruction],
      };

      const built = await builder.buildTransaction(params);

      const tx = built.transaction as any;
      expect(tx.instructions).toHaveLength(1);
    });

    it('should estimate transaction cost', async () => {
      const fromKeypair = Keypair.generate();
      const toKeypair = Keypair.generate();

      const params: SolanaTransactionParams = {
        chain: 'solana',
        type: TransactionType.TRANSFER,
        from: fromKeypair.publicKey.toBase58(),
        to: toKeypair.publicKey.toBase58(),
        value: 1000000000n,
      };

      const built = await builder.buildTransaction(params);

      expect(built.estimatedCost).toBeDefined();
      expect(built.estimatedCost).toBeGreaterThan(0n);
    });

    it('should reject transfer without "to" address', async () => {
      const fromKeypair = Keypair.generate();

      const params: SolanaTransactionParams = {
        chain: 'solana',
        type: TransactionType.TRANSFER,
        from: fromKeypair.publicKey.toBase58(),
        value: 1000000000n,
        // Missing "to"
      };

      await expect(builder.buildTransaction(params)).rejects.toThrow(/requires "to" address/);
    });

    it('should reject contract call without instructions', async () => {
      const fromKeypair = Keypair.generate();

      const params: SolanaTransactionParams = {
        chain: 'solana',
        type: TransactionType.CONTRACT_CALL,
        from: fromKeypair.publicKey.toBase58(),
        // Missing instructions
      };

      await expect(builder.buildTransaction(params)).rejects.toThrow(/requires instructions/);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration values', () => {
      const builder = new TransactionBuilder({});

      const stats = builder.getStats();
      expect(stats.hasEthereum).toBe(false);
      expect(stats.hasSolana).toBe(false);
    });

    it('should use custom safety margin', async () => {
      const provider = {
        estimateGas: vi.fn().mockResolvedValue(100000n),
        getFeeData: vi.fn().mockResolvedValue({
          maxFeePerGas: parseUnits('50', 'gwei'),
          maxPriorityFeePerGas: parseUnits('2', 'gwei'),
          gasPrice: null,
        }),
      } as unknown as JsonRpcProvider;

      const builder = new TransactionBuilder({
        ethereumProvider: provider,
        gasSafetyMargin: 50, // 50% margin
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
      };

      const estimation = await builder.estimateGas(params);

      // 100000 + 50% = 150000
      expect(estimation.gasLimit).toBe(150000n);
    });
  });

  describe('Error Handling', () => {
    it('should throw error if Ethereum provider not configured', async () => {
      const builder = new TransactionBuilder({});

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
      };

      await expect(builder.buildTransaction(params)).rejects.toThrow(
        /Ethereum provider not configured/
      );
    });

    it('should throw error if Solana connection not configured', async () => {
      const builder = new TransactionBuilder({});

      const params: SolanaTransactionParams = {
        chain: 'solana',
        type: TransactionType.TRANSFER,
        from: Keypair.generate().publicKey.toBase58(),
        to: Keypair.generate().publicKey.toBase58(),
        value: 1000000000n,
      };

      await expect(builder.buildTransaction(params)).rejects.toThrow(
        /Solana connection not configured/
      );
    });
  });

  describe('Simulation Integration', () => {
    let provider: JsonRpcProvider;

    beforeEach(() => {
      // Mock provider for simulation
      provider = {
        estimateGas: vi.fn().mockResolvedValue(21000n),
        getFeeData: vi.fn().mockResolvedValue({
          maxFeePerGas: parseUnits('50', 'gwei'),
          maxPriorityFeePerGas: parseUnits('2', 'gwei'),
          gasPrice: null,
        }),
        getNetwork: vi.fn().mockResolvedValue({ chainId: 1n }),
        getTransactionCount: vi.fn().mockResolvedValue(5),
        call: vi.fn().mockResolvedValue('0x'),
        getBlock: vi.fn().mockResolvedValue({
          number: 12345,
          timestamp: Math.floor(Date.now() / 1000),
          baseFeePerGas: parseUnits('30', 'gwei'),
        }),
      } as unknown as JsonRpcProvider;
    });

    it('should throw error if simulation not enabled', async () => {
      const builder = new TransactionBuilder({
        ethereumProvider: provider,
        enableSimulation: false, // Explicitly disabled
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
      };

      await expect(builder.buildAndSimulate(params)).rejects.toThrow(
        /Simulation not enabled/
      );
    });

    it('should successfully simulate and build transaction', async () => {
      const builder = new TransactionBuilder({
        ethereumProvider: provider,
        enableSimulation: true,
        gasSafetyMargin: 20,
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
      };

      const result = await builder.buildAndSimulate(params);

      // Check transaction was built
      expect(result.transaction).toBeDefined();
      expect(result.transaction.chain).toBe('ethereum');
      expect(result.transaction.params).toEqual(params);

      // Check simulation result
      expect(result.simulation).toBeDefined();
      expect(result.simulation.success).toBe(true);
      expect(result.simulation.status).toBe('success');
      expect(result.simulation.gasUsed).toBeGreaterThan(0n);

      // Check risk assessment
      expect(result.risk).toBeDefined();
      expect(result.risk.level).toBe('low');
      expect(result.risk.recommendations).toContain('Transaction appears safe to execute');
    });

    it('should throw error on critical risk detection', async () => {
      // Mock simulation failure
      provider.call = vi.fn().mockRejectedValue(new Error('execution reverted'));

      const builder = new TransactionBuilder({
        ethereumProvider: provider,
        enableSimulation: true,
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.CONTRACT_CALL,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        data: '0xbadfunction',
      };

      await expect(builder.buildAndSimulate(params)).rejects.toThrow(
        /Transaction simulation failed/
      );
    });

    it('should handle high risk with warnings', async () => {
      // Mock high gas usage
      provider.estimateGas = vi.fn().mockResolvedValue(15000000n); // 15M gas

      const builder = new TransactionBuilder({
        ethereumProvider: provider,
        enableSimulation: true,
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.CONTRACT_CALL,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        data: '0xcomplex',
      };

      const result = await builder.buildAndSimulate(params);

      // Should still build transaction despite high risk
      expect(result.transaction).toBeDefined();

      // Should have warnings
      expect(result.risk.level).toBe('medium');
      expect(result.risk.warnings).toContain('Extremely high gas usage detected');
    });

    it('should handle Solana transactions with fallback', async () => {
      const connection = {
        getLatestBlockhash: vi.fn().mockResolvedValue({
          blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
          lastValidBlockHeight: 123456,
        }),
      } as unknown as Connection;

      const builder = new TransactionBuilder({
        ethereumProvider: provider,
        solanaConnection: connection,
        enableSimulation: true,
      });

      const fromKeypair = Keypair.generate();
      const toKeypair = Keypair.generate();

      const params: SolanaTransactionParams = {
        chain: 'solana',
        type: TransactionType.TRANSFER,
        from: fromKeypair.publicKey.toBase58(),
        to: toKeypair.publicKey.toBase58(),
        value: 1000000000n,
      };

      const result = await builder.buildAndSimulate(params);

      // Should build transaction
      expect(result.transaction).toBeDefined();
      expect(result.transaction.chain).toBe('solana');

      // Should have dummy simulation result
      expect(result.simulation.status).toBe('success');
      expect(result.risk.level).toBe('low');
      expect(result.risk.recommendations).toContain('Simulation not available for this chain');
    });

    it('should detect revert reason in simulation', async () => {
      // Mock revert with reason
      provider.call = vi.fn().mockRejectedValue(
        new Error("execution reverted with reason string 'Insufficient balance'")
      );

      const builder = new TransactionBuilder({
        ethereumProvider: provider,
        enableSimulation: true,
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.CONTRACT_CALL,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        data: '0x',
      };

      await expect(builder.buildAndSimulate(params)).rejects.toThrow(
        /Transaction simulation failed/
      );

      // Try to catch error and check details
      try {
        await builder.buildAndSimulate(params);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle gas estimation errors in simulation', async () => {
      provider.estimateGas = vi.fn().mockRejectedValue(new Error('out of gas'));

      const builder = new TransactionBuilder({
        ethereumProvider: provider,
        enableSimulation: true,
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
        gasLimit: 1000n, // Too low
      };

      await expect(builder.buildAndSimulate(params)).rejects.toThrow();
    });

    it('should include simulation metadata', async () => {
      const builder = new TransactionBuilder({
        ethereumProvider: provider,
        enableSimulation: true,
      });

      const params: EthereumTransactionParams = {
        chain: 'ethereum',
        type: TransactionType.TRANSFER,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: parseUnits('1', 'ether'),
      };

      const result = await builder.buildAndSimulate(params);

      // Check metadata
      expect(result.simulation.provider).toBe('local');
      expect(result.simulation.simulatedAt).toBeInstanceOf(Date);
      expect(result.simulation.blockNumber).toBeGreaterThan(0);
      expect(result.simulation.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', () => {
      const provider = {} as JsonRpcProvider;
      const connection = {} as Connection;

      const builder = new TransactionBuilder({
        ethereumProvider: provider,
        solanaConnection: connection,
      });

      const stats = builder.getStats();

      expect(stats.hasEthereum).toBe(true);
      expect(stats.hasSolana).toBe(true);
      expect(stats.nonceManagerStats).toBeDefined();
    });

    it('should return NonceManager instance', () => {
      const provider = {} as JsonRpcProvider;

      const builder = new TransactionBuilder({
        ethereumProvider: provider,
      });

      const nonceManager = builder.getNonceManager();

      expect(nonceManager).toBeDefined();
    });
  });
});
