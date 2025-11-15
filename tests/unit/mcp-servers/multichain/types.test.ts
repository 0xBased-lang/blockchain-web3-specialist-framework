import { describe, it, expect } from 'vitest';
import {
  SupportedChain,
  detectChain,
  validateAddressForChain,
  parseMultiChainURI,
  isEthereumAddress,
  isSolanaAddress,
  MultiChainAddressSchema,
  QueryBalanceParamsSchema,
  SendTransactionParamsSchema,
  TransferTokenParamsSchema,
  MultiChainError,
  MultiChainErrorCode,
} from '../../../../src/mcp-servers/multichain/types.js';

describe('Multi-Chain Type System', () => {
  describe('Chain Detection', () => {
    describe('Ethereum Address Detection', () => {
      it('should detect valid Ethereum addresses', () => {
        const ethereumAddresses = [
          '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          '0x0000000000000000000000000000000000000000',
          '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
          '0x1234567890123456789012345678901234567890',
        ];

        for (const address of ethereumAddresses) {
          const result = detectChain(address);
          expect(result.chain).toBe(SupportedChain.ETHEREUM);
          expect(result.confidence).toBe('high');
          expect(result.address).toBe(address.toLowerCase());
        }
      });

      it('should normalize Ethereum addresses to lowercase', () => {
        const result = detectChain('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');
        expect(result.address).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
      });
    });

    describe('Solana Address Detection', () => {
      it('should detect valid Solana addresses', () => {
        const solanaAddresses = [
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          '11111111111111111111111111111111',
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          'So11111111111111111111111111111111111111112',
        ];

        for (const address of solanaAddresses) {
          const result = detectChain(address);
          expect(result.chain).toBe(SupportedChain.SOLANA);
          expect(result.confidence).toBe('high');
          expect(result.address).toBe(address);
        }
      });

      it('should preserve Solana address case', () => {
        const address = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        const result = detectChain(address);
        expect(result.address).toBe(address); // Case preserved
      });
    });

    describe('Invalid Addresses', () => {
      it('should reject invalid Ethereum addresses', () => {
        const invalidAddresses = [
          '0x123', // Too short
          '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // Invalid hex
          '742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', // Missing 0x
          '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Too short (39 chars)
        ];

        for (const address of invalidAddresses) {
          expect(() => detectChain(address)).toThrow('Unable to detect chain');
        }
      });

      it('should reject invalid Solana addresses', () => {
        const invalidAddresses = [
          'abc', // Too short
          '0OIl' + '1'.repeat(40), // Contains invalid Base58 chars (0, O, I, l)
          'invalid address with spaces',
        ];

        for (const address of invalidAddresses) {
          expect(() => detectChain(address)).toThrow('Unable to detect chain');
        }
      });

      it('should handle empty addresses', () => {
        expect(() => detectChain('')).toThrow('Unable to detect chain');
      });
    });
  });

  describe('Address Validation', () => {
    it('should validate Ethereum address for Ethereum chain', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      expect(validateAddressForChain(address, SupportedChain.ETHEREUM)).toBe(true);
    });

    it('should reject Solana address for Ethereum chain', () => {
      const address = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      expect(validateAddressForChain(address, SupportedChain.ETHEREUM)).toBe(false);
    });

    it('should validate Solana address for Solana chain', () => {
      const address = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      expect(validateAddressForChain(address, SupportedChain.SOLANA)).toBe(true);
    });

    it('should reject Ethereum address for Solana chain', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      expect(validateAddressForChain(address, SupportedChain.SOLANA)).toBe(false);
    });

    it('should accept any valid address for AUTO chain', () => {
      const ethereumAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      const solanaAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

      expect(validateAddressForChain(ethereumAddress, SupportedChain.AUTO)).toBe(true);
      expect(validateAddressForChain(solanaAddress, SupportedChain.AUTO)).toBe(true);
    });

    it('should reject invalid address for AUTO chain', () => {
      expect(validateAddressForChain('invalid', SupportedChain.AUTO)).toBe(false);
    });
  });

  describe('URI Parsing', () => {
    it('should parse Ethereum account URI', () => {
      const uri = 'multichain://ethereum/account/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      const parsed = parseMultiChainURI(uri);

      expect(parsed.chain).toBe(SupportedChain.ETHEREUM);
      expect(parsed.resourceType).toBe('account');
      expect(parsed.identifier).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0');
    });

    it('should parse Solana account URI', () => {
      const uri = 'multichain://solana/account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      const parsed = parseMultiChainURI(uri);

      expect(parsed.chain).toBe(SupportedChain.SOLANA);
      expect(parsed.resourceType).toBe('account');
      expect(parsed.identifier).toBe('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK');
    });

    it('should parse auto-detect URI', () => {
      const uri = 'multichain://auto/account/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      const parsed = parseMultiChainURI(uri);

      expect(parsed.chain).toBe(SupportedChain.AUTO);
      expect(parsed.resourceType).toBe('account');
    });

    it('should parse transaction URIs', () => {
      const ethUri = 'multichain://ethereum/transaction/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const parsed = parseMultiChainURI(ethUri);

      expect(parsed.chain).toBe(SupportedChain.ETHEREUM);
      expect(parsed.resourceType).toBe('transaction');
    });

    it('should reject invalid URI format', () => {
      const invalidURIs = [
        'multichain://invalid',
        'ethereum://account/0x123',
        'multichain:/account/0x123',
        '',
      ];

      for (const uri of invalidURIs) {
        expect(() => parseMultiChainURI(uri)).toThrow('Invalid multi-chain URI format');
      }
    });

    it('should reject unknown chains in URI', () => {
      const uri = 'multichain://bitcoin/account/someaddress';
      expect(() => parseMultiChainURI(uri)).toThrow('Unknown chain in URI');
    });
  });

  describe('Schema Validation', () => {
    describe('MultiChainAddressSchema', () => {
      it('should validate Ethereum address', () => {
        const data = {
          chain: SupportedChain.ETHEREUM,
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        };

        const result = MultiChainAddressSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should validate Solana address', () => {
        const data = {
          chain: SupportedChain.SOLANA,
          address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        };

        const result = MultiChainAddressSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject address too short', () => {
        const data = {
          chain: SupportedChain.ETHEREUM,
          address: '0x123',
        };

        const result = MultiChainAddressSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });

    describe('QueryBalanceParamsSchema', () => {
      it('should validate with auto-detect (default)', () => {
        const data = {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        };

        const result = QueryBalanceParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
        expect(result.data?.chain).toBe(SupportedChain.AUTO);
      });

      it('should validate with explicit chain', () => {
        const data = {
          address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          chain: SupportedChain.SOLANA,
        };

        const result = QueryBalanceParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
        expect(result.data?.chain).toBe(SupportedChain.SOLANA);
      });

      it('should validate with token address', () => {
        const data = {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        };

        const result = QueryBalanceParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should validate with commitment level', () => {
        const data = {
          address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          commitment: 'finalized' as const,
        };

        const result = QueryBalanceParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    describe('SendTransactionParamsSchema', () => {
      it('should validate basic transaction', () => {
        const data = {
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          amount: '1000000000000000000', // 1 ETH in wei
        };

        const result = SendTransactionParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
        expect(result.data?.amount).toBe(1000000000000000000n);
      });

      it('should coerce amount from string to BigInt', () => {
        const data = {
          to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          amount: '1000000000', // 1 SOL in lamports
        };

        const result = SendTransactionParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
        expect(result.data?.amount).toBe(1000000000n);
      });

      it('should accept BigInt amount', () => {
        const data = {
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          amount: 1000000000000000000n,
        };

        const result = SendTransactionParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should validate with Ethereum-specific params', () => {
        const data = {
          chain: SupportedChain.ETHEREUM,
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          amount: 1000000000000000000n,
          gasLimit: 21000,
          maxFeePerGas: '100000000000',
          maxPriorityFeePerGas: '2000000000',
        };

        const result = SendTransactionParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should validate with Solana-specific params', () => {
        const data = {
          chain: SupportedChain.SOLANA,
          to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          amount: 1000000000n,
          computeUnitLimit: 200000,
          computeUnitPrice: 1000n,
        };

        const result = SendTransactionParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    describe('TransferTokenParamsSchema', () => {
      it('should validate ERC20 transfer', () => {
        const data = {
          chain: SupportedChain.ETHEREUM,
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          amount: 1000000n, // 1 USDC (6 decimals)
          token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          decimals: 6,
        };

        const result = TransferTokenParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should validate SPL token transfer', () => {
        const data = {
          chain: SupportedChain.SOLANA,
          to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          amount: 1000000n,
          token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
          decimals: 6,
          createAssociatedTokenAccount: true,
        };

        const result = TransferTokenParamsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should enforce decimal limits', () => {
        const data = {
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          amount: 1000000n,
          token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          decimals: 19, // Invalid: max is 18
        };

        const result = TransferTokenParamsSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Type Guards', () => {
    it('should identify Ethereum addresses', () => {
      expect(isEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(true);
      expect(isEthereumAddress('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK')).toBe(false);
    });

    it('should identify Solana addresses', () => {
      expect(isSolanaAddress('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK')).toBe(true);
      expect(isSolanaAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(false);
    });
  });

  describe('MultiChainError', () => {
    it('should create error with chain context', () => {
      const error = new MultiChainError(
        'Operation failed',
        SupportedChain.ETHEREUM,
        MultiChainErrorCode.CHAIN_UNAVAILABLE,
        { rpcUrl: 'https://example.com' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('MultiChainError');
      expect(error.message).toBe('Operation failed');
      expect(error.chain).toBe(SupportedChain.ETHEREUM);
      expect(error.code).toBe(MultiChainErrorCode.CHAIN_UNAVAILABLE);
      expect(error.details).toEqual({ rpcUrl: 'https://example.com' });
    });

    it('should wrap original error', () => {
      const originalError = new Error('RPC failed');
      const error = new MultiChainError(
        'Chain operation failed',
        SupportedChain.SOLANA,
        MultiChainErrorCode.CHAIN_UNAVAILABLE,
        undefined,
        originalError
      );

      expect(error.originalError).toBe(originalError);
    });
  });
});
