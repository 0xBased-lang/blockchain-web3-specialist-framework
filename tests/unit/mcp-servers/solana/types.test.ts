import { describe, it, expect } from 'vitest';
import {
  SolanaAddressSchema,
  SignatureSchema,
  BlockhashSchema,
  BigIntSchema,
  CommitmentSchema,
  QueryBalanceParamsSchema,
  SendTransactionParamsSchema,
  TransferTokenParamsSchema,
  CallProgramParamsSchema,
  GetTransactionParamsSchema,
  WaitForConfirmationParamsSchema,
  RequestAirdropParamsSchema,
  SolanaError,
  SolanaErrorCode,
  SolanaCluster,
} from '../../../../src/mcp-servers/solana/types.js';

describe('Solana Type Validation', () => {
  describe('SolanaAddressSchema', () => {
    it('should validate correct Solana addresses', () => {
      const validAddresses = [
        '11111111111111111111111111111111', // System Program
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
        'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK', // Random address
        'So11111111111111111111111111111111111111112', // Wrapped SOL
      ];

      for (const address of validAddresses) {
        const result = SolanaAddressSchema.safeParse(address);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid Base58 addresses', () => {
      const invalidAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', // Ethereum address
        'invalid address with spaces',
        '0OIl', // Contains invalid Base58 chars (0, O, I, l)
        '', // Empty
        'abc', // Too short
      ];

      for (const address of invalidAddresses) {
        const result = SolanaAddressSchema.safeParse(address);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('SignatureSchema', () => {
    it('should validate correct transaction signatures', () => {
      const validSignatures = [
        '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
        '3yJKQHLssXF1qKqzN7JzTLCp2rFLqXFGvLmFHBm3y8gRVGdJNUPzHJzHMvqJQKHVCxNwqXKVHZJPvqzN7JzTLCp',
      ];

      for (const signature of validSignatures) {
        const result = SignatureSchema.safeParse(signature);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid signatures', () => {
      const invalidSignatures = [
        '0x1234567890abcdef', // Hex format
        'short', // Too short
        'invalid signature with spaces and symbols!@#',
      ];

      for (const signature of invalidSignatures) {
        const result = SignatureSchema.safeParse(signature);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('BlockhashSchema', () => {
    it('should validate correct blockhashes', () => {
      const validBlockhashes = [
        'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
        '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY',
      ];

      for (const blockhash of validBlockhashes) {
        const result = BlockhashSchema.safeParse(blockhash);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('BigIntSchema', () => {
    it('should coerce string to BigInt', () => {
      const result = BigIntSchema.parse('1000000000'); // 1 SOL in lamports
      expect(result).toBe(1000000000n);
    });

    it('should coerce number to BigInt', () => {
      const result = BigIntSchema.parse(1000000000);
      expect(result).toBe(1000000000n);
    });

    it('should accept BigInt directly', () => {
      const result = BigIntSchema.parse(1000000000n);
      expect(result).toBe(1000000000n);
    });

    it('should handle large lamport values', () => {
      const result = BigIntSchema.parse('999999999999999999'); // Large amount
      expect(result).toBe(999999999999999999n);
    });
  });

  describe('CommitmentSchema', () => {
    it('should accept valid commitment levels', () => {
      const validCommitments = ['processed', 'confirmed', 'finalized'];

      for (const commitment of validCommitments) {
        const result = CommitmentSchema.safeParse(commitment);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid commitment levels', () => {
      const invalidCommitments = ['pending', 'latest', 'earliest'];

      for (const commitment of invalidCommitments) {
        const result = CommitmentSchema.safeParse(commitment);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('QueryBalanceParamsSchema', () => {
    it('should validate SOL balance query', () => {
      const params = {
        address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
      };

      const result = QueryBalanceParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate SPL token balance query', () => {
      const params = {
        address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
        commitment: 'confirmed' as const,
      };

      const result = QueryBalanceParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should reject invalid address', () => {
      const params = {
        address: 'invalid_address',
      };

      const result = QueryBalanceParamsSchema.safeParse(params);
      expect(result.success).toBe(false);
    });
  });

  describe('SendTransactionParamsSchema', () => {
    it('should validate minimal send transaction params', () => {
      const params = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: 1000000000n, // 1 SOL
      };

      const result = SendTransactionParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(1000000000n);
    });

    it('should validate with all optional fields', () => {
      const params = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: '1000000000', // String coercion
        recentBlockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
        feePayer: '11111111111111111111111111111111',
        computeUnitLimit: 200000,
        computeUnitPrice: 1000n,
      };

      const result = SendTransactionParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(1000000000n);
    });

    it('should coerce amount from string to BigInt', () => {
      const params = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: '500000000',
      };

      const result = SendTransactionParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(500000000n);
    });
  });

  describe('TransferTokenParamsSchema', () => {
    it('should validate SPL token transfer', () => {
      const params = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: 1000000n, // 1 USDC (6 decimals)
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
      };

      const result = TransferTokenParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate with ATA creation flag', () => {
      const params = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: 1000000n,
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
        createAssociatedTokenAccount: true,
      };

      const result = TransferTokenParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should enforce decimal limits', () => {
      const params = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: 1000000n,
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 10, // Invalid: max is 9
      };

      const result = TransferTokenParamsSchema.safeParse(params);
      expect(result.success).toBe(false);
    });
  });

  describe('CallProgramParamsSchema', () => {
    it('should validate program call with accounts', () => {
      const params = {
        programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        instruction: 'base64encodeddata',
        accounts: [
          {
            pubkey: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
            isSigner: true,
            isWritable: true,
          },
          {
            pubkey: '11111111111111111111111111111111',
            isSigner: false,
            isWritable: false,
          },
        ],
      };

      const result = CallProgramParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate with optional commitment', () => {
      const params = {
        programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        instruction: 'base64encodeddata',
        accounts: [],
        commitment: 'finalized' as const,
      };

      const result = CallProgramParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });
  });

  describe('GetTransactionParamsSchema', () => {
    it('should validate transaction query', () => {
      const params = {
        signature:
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
        commitment: 'confirmed' as const,
      };

      const result = GetTransactionParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });
  });

  describe('WaitForConfirmationParamsSchema', () => {
    it('should validate with all params', () => {
      const params = {
        signature:
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
        commitment: 'finalized' as const,
        timeout: 60000,
      };

      const result = WaitForConfirmationParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate with defaults', () => {
      const params = {
        signature:
          '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
      };

      const result = WaitForConfirmationParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });
  });

  describe('RequestAirdropParamsSchema', () => {
    it('should validate airdrop request', () => {
      const params = {
        address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        lamports: 1000000000n, // 1 SOL
      };

      const result = RequestAirdropParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should coerce lamports from string', () => {
      const params = {
        address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        lamports: '2000000000', // 2 SOL as string
      };

      const result = RequestAirdropParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
      expect(result.data?.lamports).toBe(2000000000n);
    });
  });

  describe('SolanaError', () => {
    it('should create error with code and details', () => {
      const error = new SolanaError('Insufficient funds', SolanaErrorCode.INSUFFICIENT_FUNDS, {
        required: '1000000000',
        available: '500000000',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('SolanaError');
      expect(error.message).toBe('Insufficient funds');
      expect(error.code).toBe(SolanaErrorCode.INSUFFICIENT_FUNDS);
      expect(error.details).toEqual({
        required: '1000000000',
        available: '500000000',
      });
    });
  });

  describe('SolanaCluster', () => {
    it('should have correct cluster values', () => {
      expect(SolanaCluster.MAINNET).toBe('mainnet-beta');
      expect(SolanaCluster.TESTNET).toBe('testnet');
      expect(SolanaCluster.DEVNET).toBe('devnet');
      expect(SolanaCluster.LOCALNET).toBe('localnet');
    });
  });
});
