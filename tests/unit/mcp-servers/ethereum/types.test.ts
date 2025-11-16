import { describe, it, expect } from 'vitest';
import {
  AddressSchema,
  TxHashSchema,
  HexSchema,
  BigIntSchema,
  QueryBalanceParamsSchema,
  SendTransactionParamsSchema,
  CallContractParamsSchema,
  EthereumError,
  EthereumErrorCode,
} from '../../../../src/mcp-servers/ethereum/types.js';

describe('Ethereum Types', () => {
  describe('AddressSchema', () => {
    it('should validate correct Ethereum addresses', () => {
      const validAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        '0x0000000000000000000000000000000000000000',
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      ];

      validAddresses.forEach((addr) => {
        const result = AddressSchema.safeParse(addr);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(addr.toLowerCase());
        }
      });
    });

    it('should reject invalid addresses', () => {
      const invalidAddresses = [
        '0x123', // Too short
        '742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Missing 0x
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // Invalid hex
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb01', // Too long
      ];

      invalidAddresses.forEach((addr) => {
        const result = AddressSchema.safeParse(addr);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('TxHashSchema', () => {
    it('should validate correct transaction hashes', () => {
      const validHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = TxHashSchema.safeParse(validHash);
      expect(result.success).toBe(true);
    });

    it('should reject invalid transaction hashes', () => {
      const invalidHashes = [
        '0x123', // Too short
        '0xGGGG567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Invalid hex
      ];

      invalidHashes.forEach((hash) => {
        const result = TxHashSchema.safeParse(hash);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('HexSchema', () => {
    it('should validate hex strings', () => {
      const validHex = ['0x', '0x00', '0xabcdef123456'];

      validHex.forEach((hex) => {
        const result = HexSchema.safeParse(hex);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid hex strings', () => {
      const invalidHex = ['abc', '0xGG', 'hello'];

      invalidHex.forEach((hex) => {
        const result = HexSchema.safeParse(hex);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('BigIntSchema', () => {
    it('should coerce from various types', () => {
      const tests = [
        { input: 100n, expected: 100n },
        { input: '1000000000000000000', expected: 1000000000000000000n },
        { input: 42, expected: 42n },
      ];

      tests.forEach(({ input, expected }) => {
        const result = BigIntSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(expected);
        }
      });
    });
  });

  describe('QueryBalanceParamsSchema', () => {
    it('should validate correct balance query params', () => {
      const validParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        blockTag: 'latest' as const,
      };

      const result = QueryBalanceParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should validate with optional token parameter', () => {
      const validParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        blockTag: 12345678,
      };

      const result = QueryBalanceParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });
  });

  describe('SendTransactionParamsSchema', () => {
    it('should validate transaction parameters', () => {
      const validParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        value: '1000000000000000000', // 1 ETH in wei
        gasLimit: 21000n,
      };

      const result = SendTransactionParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(1000000000000000000n);
        expect(result.data.gasLimit).toBe(21000n);
      }
    });

    it('should validate EIP-1559 parameters', () => {
      const validParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        value: 0n,
        maxFeePerGas: '50000000000', // 50 gwei
        maxPriorityFeePerGas: '2000000000', // 2 gwei
      };

      const result = SendTransactionParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });
  });

  describe('CallContractParamsSchema', () => {
    it('should validate contract call parameters', () => {
      const validParams = {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        abi: [{ name: 'balanceOf', type: 'function' }],
        method: 'balanceOf',
        args: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'],
      };

      const result = CallContractParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });
  });

  describe('EthereumError', () => {
    it('should create custom errors with code and details', () => {
      const error = new EthereumError('Insufficient funds', EthereumErrorCode.INSUFFICIENT_FUNDS, {
        balance: '0',
        required: '1000000000000000000',
      });

      expect(error.message).toBe('Insufficient funds');
      expect(error.code).toBe(EthereumErrorCode.INSUFFICIENT_FUNDS);
      expect(error.details).toEqual({ balance: '0', required: '1000000000000000000' });
      expect(error.name).toBe('EthereumError');
    });
  });
});
