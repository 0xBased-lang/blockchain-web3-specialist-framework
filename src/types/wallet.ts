/**
 * Wallet Management Type Definitions
 *
 * Types for secure wallet operations:
 * - Encrypted key storage
 * - Multi-chain wallet support
 * - HD wallet derivation
 * - Transaction signing
 *
 * SECURITY CRITICAL: 100% test coverage required
 */

import { z } from 'zod';

/**
 * Supported blockchain networks for wallet operations
 */
export const WalletChain = {
  ETHEREUM: 'ethereum',
  SOLANA: 'solana',
} as const;

export type WalletChain = (typeof WalletChain)[keyof typeof WalletChain];

/**
 * Encrypted key structure (AES-256-GCM)
 */
export interface EncryptedKey {
  encrypted: string; // Hex-encoded encrypted data
  iv: string; // Initialization vector (hex)
  salt: string; // Scrypt salt (hex)
  authTag: string; // GCM authentication tag (hex)
  algorithm: 'aes-256-gcm';
}

/**
 * Wallet metadata
 */
export interface WalletMetadata {
  address: string;
  chain: WalletChain;
  label?: string;
  derivationPath?: string; // For HD wallets (e.g., m/44'/60'/0'/0/0)
  createdAt: Date;
}

/**
 * Wallet configuration
 */
export interface WalletConfig {
  chain: WalletChain;
  label?: string;
}

/**
 * Signing request
 */
export interface SignRequest {
  address: string;
  data: string | Uint8Array; // Data to sign (hex string or bytes)
  password: string;
  chain?: WalletChain; // Optional chain override
}

/**
 * Signing response
 */
export interface SignResponse {
  signature: string; // Hex-encoded signature
  address: string;
  chain: WalletChain;
  timestamp: number;
}

/**
 * HD Wallet mnemonic import request
 */
export interface MnemonicImportRequest {
  mnemonic: string;
  password: string;
  wordCount?: 12 | 15 | 18 | 21 | 24; // BIP39 word counts
}

/**
 * Key derivation request (for HD wallets)
 */
export interface KeyDerivationRequest {
  path: string; // BIP32 derivation path (e.g., m/44'/60'/0'/0/0)
  password: string;
  chain: WalletChain;
}

/**
 * Wallet export format (encrypted)
 */
export interface WalletExport {
  version: string;
  wallets: Record<
    string,
    {
      encryptedKey: EncryptedKey;
      metadata: WalletMetadata;
    }
  >;
  hdWallet?: {
    encryptedSeed: EncryptedKey;
  };
  exportedAt: Date;
}

/**
 * Zod Validation Schemas
 */

export const WalletChainSchema = z.enum(['ethereum', 'solana']);

export const EncryptedKeySchema = z.object({
  encrypted: z.string().min(1),
  iv: z.string().length(32), // 16 bytes hex = 32 chars
  salt: z.string().length(32), // 16 bytes hex = 32 chars
  authTag: z.string().length(32), // 16 bytes hex = 32 chars
  algorithm: z.literal('aes-256-gcm'),
});

export const WalletConfigSchema = z.object({
  chain: WalletChainSchema,
  label: z.string().optional(),
});

export const SignRequestSchema = z.object({
  address: z.string().min(1),
  data: z.union([z.string(), z.instanceof(Uint8Array)]),
  password: z.string().min(1),
  chain: WalletChainSchema.optional(),
});

export const MnemonicImportRequestSchema = z.object({
  mnemonic: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  wordCount: z.enum(['12', '15', '18', '21', '24']).optional(),
});

export const KeyDerivationRequestSchema = z.object({
  path: z.string().regex(/^m(\/\d+'?)+$/, 'Invalid BIP32 derivation path'),
  password: z.string().min(1),
  chain: WalletChainSchema,
});

/**
 * Error types for wallet operations
 */
export enum WalletErrorCode {
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  SIGNING_FAILED = 'SIGNING_FAILED',
  INVALID_MNEMONIC = 'INVALID_MNEMONIC',
  INVALID_DERIVATION_PATH = 'INVALID_DERIVATION_PATH',
  CHAIN_MISMATCH = 'CHAIN_MISMATCH',
  WALLET_ALREADY_EXISTS = 'WALLET_ALREADY_EXISTS',
}

/**
 * Wallet error class
 */
export class WalletError extends Error {
  constructor(
    message: string,
    public readonly code: WalletErrorCode,
    public readonly chain?: WalletChain
  ) {
    super(message);
    this.name = 'WalletError';
  }
}
