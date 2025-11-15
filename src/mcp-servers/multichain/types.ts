import { z } from 'zod';
import type { Address as EthereumAddress } from '../ethereum/types.js';
import type { SolanaAddress } from '../solana/types.js';

/**
 * Multi-Chain Type Definitions
 *
 * Unified type system for cross-chain operations:
 * - Automatic chain detection from address format
 * - Discriminated unions for type safety
 * - Unified response formats
 * - Chain-specific metadata preservation
 *
 * Supported Chains:
 * - Ethereum (and EVM-compatible chains)
 * - Solana
 *
 * Address Detection:
 * - Ethereum: 0x followed by 40 hex characters
 * - Solana: 32-44 Base58 characters
 */

/**
 * Supported blockchain networks
 */
export enum SupportedChain {
  ETHEREUM = 'ethereum',
  SOLANA = 'solana',
  AUTO = 'auto', // Auto-detect from address format
}

/**
 * Chain detection result
 */
export interface ChainDetectionResult {
  chain: SupportedChain.ETHEREUM | SupportedChain.SOLANA;
  confidence: 'high' | 'medium' | 'low';
  address: string;
}

/**
 * Detect blockchain from address format
 *
 * Rules:
 * - 0x[a-fA-F0-9]{40} → Ethereum (40 hex chars after 0x)
 * - [1-9A-HJ-NP-Za-km-z]{32,44} → Solana (Base58, 32-44 chars)
 */
export function detectChain(address: string): ChainDetectionResult {
  // Ethereum address detection (0x + 40 hex chars)
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return {
      chain: SupportedChain.ETHEREUM,
      confidence: 'high',
      address: address.toLowerCase(),
    };
  }

  // Solana address detection (Base58, typically 32-44 chars)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return {
      chain: SupportedChain.SOLANA,
      confidence: 'high',
      address,
    };
  }

  throw new Error(
    `Unable to detect chain from address: ${address}. ` +
      `Expected Ethereum (0x + 40 hex) or Solana (Base58, 32-44 chars)`
  );
}

/**
 * Validate address matches expected chain
 */
export function validateAddressForChain(
  address: string,
  expectedChain: SupportedChain
): boolean {
  if (expectedChain === SupportedChain.AUTO) {
    // Auto mode - just detect
    try {
      detectChain(address);
      return true;
    } catch {
      return false;
    }
  }

  const detected = detectChain(address);
  return detected.chain === expectedChain;
}

/**
 * Multi-chain address schema
 *
 * Supports:
 * - Explicit chain: { chain: 'ethereum', address: '0x...' }
 * - Auto-detect: { chain: 'auto', address: '0x...' or 'Base58...' }
 */
export const MultiChainAddressSchema = z.object({
  chain: z.nativeEnum(SupportedChain),
  address: z.string().min(32),
});

export type MultiChainAddress = z.infer<typeof MultiChainAddressSchema>;

/**
 * Unified balance response
 *
 * Works for both ETH/ERC20 and SOL/SPL tokens
 */
export interface UnifiedBalanceResponse {
  chain: SupportedChain.ETHEREUM | SupportedChain.SOLANA;
  address: string;
  balance: string; // String to handle both wei and lamports
  symbol: string;
  decimals: number;
  // Chain-specific metadata
  slot?: number; // Solana
  blockNumber?: number; // Ethereum
  token?: string; // Token contract/mint address
}

/**
 * Unified transaction response
 *
 * Normalizes Ethereum and Solana transaction formats
 */
export interface UnifiedTransactionResponse {
  chain: SupportedChain.ETHEREUM | SupportedChain.SOLANA;
  signature: string; // Transaction hash (Ethereum) or signature (Solana)
  from: string;
  to: string;
  amount: string;
  fee: string;
  status: 'pending' | 'confirmed' | 'finalized' | 'failed';
  // Chain-specific metadata
  slot?: number; // Solana
  blockNumber?: number | null; // Ethereum
  gasUsed?: string; // Ethereum
  computeUnitsConsumed?: number; // Solana
}

/**
 * Query balance parameters (multi-chain)
 */
export const QueryBalanceParamsSchema = z.object({
  address: z.string().min(32),
  chain: z.nativeEnum(SupportedChain).optional().default(SupportedChain.AUTO),
  token: z.string().optional(), // ERC20 or SPL token address
  // Commitment/confirmation level
  commitment: z
    .enum(['processed', 'confirmed', 'finalized', 'latest', 'pending'])
    .optional(),
});

export type QueryBalanceParams = z.infer<typeof QueryBalanceParamsSchema>;

/**
 * Send transaction parameters (multi-chain)
 */
export const SendTransactionParamsSchema = z.object({
  chain: z.nativeEnum(SupportedChain).optional().default(SupportedChain.AUTO),
  to: z.string().min(32),
  amount: z.union([
    z.bigint(),
    z.string().transform((val) => BigInt(val)),
    z.number().transform((val) => BigInt(val)),
  ]),
  // Optional parameters
  data: z.string().optional(), // Ethereum only
  gasLimit: z
    .union([z.bigint(), z.string().transform((val) => BigInt(val)), z.number()])
    .optional(), // Ethereum
  gasPrice: z
    .union([z.bigint(), z.string().transform((val) => BigInt(val)), z.number()])
    .optional(), // Ethereum
  maxFeePerGas: z
    .union([z.bigint(), z.string().transform((val) => BigInt(val)), z.number()])
    .optional(), // Ethereum EIP-1559
  maxPriorityFeePerGas: z
    .union([z.bigint(), z.string().transform((val) => BigInt(val)), z.number()])
    .optional(), // Ethereum EIP-1559
  computeUnitLimit: z.number().optional(), // Solana
  computeUnitPrice: z
    .union([z.bigint(), z.string().transform((val) => BigInt(val)), z.number()])
    .optional(), // Solana
});

export type SendTransactionParams = z.infer<typeof SendTransactionParamsSchema>;

/**
 * Transfer token parameters (multi-chain)
 *
 * Works for both ERC20 (Ethereum) and SPL (Solana) tokens
 */
export const TransferTokenParamsSchema = z.object({
  chain: z.nativeEnum(SupportedChain).optional().default(SupportedChain.AUTO),
  to: z.string().min(32),
  amount: z.union([
    z.bigint(),
    z.string().transform((val) => BigInt(val)),
    z.number().transform((val) => BigInt(val)),
  ]),
  token: z.string(), // Contract address (Ethereum) or mint address (Solana)
  decimals: z.number().min(0).max(18), // Token decimals
  // Solana-specific
  createAssociatedTokenAccount: z.boolean().optional(),
});

export type TransferTokenParams = z.infer<typeof TransferTokenParamsSchema>;

/**
 * Get transaction parameters (multi-chain)
 */
export const GetTransactionParamsSchema = z.object({
  chain: z.nativeEnum(SupportedChain).optional().default(SupportedChain.AUTO),
  signature: z.string(), // Transaction hash or signature
  commitment: z
    .enum(['processed', 'confirmed', 'finalized', 'latest', 'pending'])
    .optional(),
});

export type GetTransactionParams = z.infer<typeof GetTransactionParamsSchema>;

/**
 * Wait for confirmation parameters (multi-chain)
 */
export const WaitForConfirmationParamsSchema = z.object({
  chain: z.nativeEnum(SupportedChain).optional().default(SupportedChain.AUTO),
  signature: z.string(),
  confirmations: z.number().optional(), // Ethereum (default: 12)
  commitment: z.enum(['processed', 'confirmed', 'finalized']).optional(), // Solana (default: confirmed)
  timeout: z.number().optional(), // Milliseconds
});

export type WaitForConfirmationParams = z.infer<typeof WaitForConfirmationParamsSchema>;

/**
 * Multi-chain error
 *
 * Wraps chain-specific errors with additional context
 */
export class MultiChainError extends Error {
  constructor(
    message: string,
    public chain: SupportedChain,
    public code: string,
    public details?: Record<string, unknown>,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'MultiChainError';
  }
}

/**
 * Multi-chain error codes
 */
export enum MultiChainErrorCode {
  CHAIN_DETECTION_FAILED = 'CHAIN_DETECTION_FAILED',
  INVALID_CHAIN = 'INVALID_CHAIN',
  CHAIN_NOT_CONFIGURED = 'CHAIN_NOT_CONFIGURED',
  CHAIN_UNAVAILABLE = 'CHAIN_UNAVAILABLE',
  ADDRESS_CHAIN_MISMATCH = 'ADDRESS_CHAIN_MISMATCH',
  OPERATION_NOT_SUPPORTED = 'OPERATION_NOT_SUPPORTED',
  BOTH_CHAINS_FAILED = 'BOTH_CHAINS_FAILED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
}

/**
 * Chain health status
 */
export interface ChainHealthStatus {
  chain: SupportedChain.ETHEREUM | SupportedChain.SOLANA;
  healthy: boolean;
  latency: number; // ms
  blockHeight: number | null;
  lastChecked: Date;
  error?: string;
}

/**
 * Multi-chain status response
 */
export interface MultiChainStatusResponse {
  ethereum: ChainHealthStatus;
  solana: ChainHealthStatus;
  overallHealthy: boolean;
}

/**
 * Resource URI types
 */
export type MultiChainResourceURI =
  | `multichain://ethereum/account/${string}`
  | `multichain://ethereum/contract/${string}`
  | `multichain://ethereum/transaction/${string}`
  | `multichain://ethereum/block/${string}`
  | `multichain://solana/account/${string}`
  | `multichain://solana/token-account/${string}`
  | `multichain://solana/transaction/${string}`
  | `multichain://solana/block/${string}`
  | `multichain://auto/account/${string}`; // Auto-detect chain

/**
 * Parse multi-chain URI
 */
export interface ParsedMultiChainURI {
  chain: SupportedChain;
  resourceType: string;
  identifier: string;
}

export function parseMultiChainURI(uri: string): ParsedMultiChainURI {
  const match = uri.match(/^multichain:\/\/([^/]+)\/([^/]+)\/(.+)$/);

  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid multi-chain URI format: ${uri}`);
  }

  const [, chainStr, resourceType, identifier] = match;

  // Validate chain
  let chain: SupportedChain;
  if (chainStr === 'ethereum') {
    chain = SupportedChain.ETHEREUM;
  } else if (chainStr === 'solana') {
    chain = SupportedChain.SOLANA;
  } else if (chainStr === 'auto') {
    chain = SupportedChain.AUTO;
  } else {
    throw new Error(`Unknown chain in URI: ${chainStr}`);
  }

  return {
    chain,
    resourceType,
    identifier,
  };
}

/**
 * Type guards
 */
export function isEthereumAddress(address: string): address is EthereumAddress {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isSolanaAddress(address: string): address is SolanaAddress {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}
