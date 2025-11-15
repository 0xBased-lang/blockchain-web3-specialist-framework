/**
 * Transaction Type Definitions
 *
 * Types for transaction building across chains:
 * - Ethereum transactions
 * - Solana transactions
 * - Gas estimation
 * - Nonce management
 */

import { z } from 'zod';
import type { TransactionRequest } from 'ethers';
import type { Transaction as SolanaTransaction } from '@solana/web3.js';

/**
 * Supported transaction types
 */
export enum TransactionType {
  TRANSFER = 'transfer',
  CONTRACT_CALL = 'contract_call',
  CONTRACT_DEPLOY = 'contract_deploy',
  TOKEN_TRANSFER = 'token_transfer',
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

/**
 * Base transaction parameters
 */
export interface BaseTransactionParams {
  type: TransactionType;
  from: string;
  to?: string;
  value?: string | bigint; // Wei for Ethereum, Lamports for Solana
  data?: string | Uint8Array;
  metadata?: Record<string, unknown>;
}

/**
 * Ethereum-specific transaction parameters
 */
export interface EthereumTransactionParams extends BaseTransactionParams {
  chain: 'ethereum';
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasPrice?: bigint; // Legacy
  nonce?: number;
  chainId?: number;
}

/**
 * Solana-specific transaction parameters
 */
export interface SolanaTransactionParams extends BaseTransactionParams {
  chain: 'solana';
  recentBlockhash?: string;
  feePayer?: string;
  instructions?: unknown[]; // Solana TransactionInstruction[]
}

/**
 * Union of all transaction parameters
 */
export type TransactionParams = EthereumTransactionParams | SolanaTransactionParams;

/**
 * Built transaction (ready to sign)
 */
export interface BuiltTransaction {
  chain: 'ethereum' | 'solana';
  params: TransactionParams;
  transaction: TransactionRequest | SolanaTransaction;
  estimatedGas?: bigint;
  estimatedCost?: bigint;
  createdAt: Date;
}

/**
 * Signed transaction (ready to broadcast)
 */
export interface SignedTransaction {
  chain: 'ethereum' | 'solana';
  rawTransaction: string; // Hex for Ethereum, Base64 for Solana
  transactionHash?: string;
  from: string;
  to?: string;
  value?: bigint;
  signedAt: Date;
}

/**
 * Transaction receipt
 */
export interface TransactionReceipt {
  chain: 'ethereum' | 'solana';
  transactionHash: string;
  blockNumber?: number;
  blockHash?: string;
  from: string;
  to?: string;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
  status: TransactionStatus;
  confirmations?: number;
  timestamp?: Date;
}

/**
 * Gas estimation result
 */
export interface GasEstimation {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCost: bigint; // Total cost in wei
  estimatedCostUSD?: number; // If price feed available
}

/**
 * Nonce state for an address
 */
export interface NonceState {
  address: string;
  currentNonce: number;
  pendingNonce: number;
  lastUpdated: Date;
}

/**
 * Transaction builder configuration
 */
export interface TransactionBuilderConfig {
  chain: 'ethereum' | 'solana';
  rpcUrl: string;
  chainId?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Zod Validation Schemas
 */

export const TransactionTypeSchema = z.enum([
  'transfer',
  'contract_call',
  'contract_deploy',
  'token_transfer',
]);

export const EthereumTransactionParamsSchema = z.object({
  chain: z.literal('ethereum'),
  type: TransactionTypeSchema,
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address').optional(),
  value: z.union([z.string(), z.bigint()]).optional(),
  data: z.union([z.string(), z.instanceof(Uint8Array)]).optional(),
  gasLimit: z.bigint().optional(),
  maxFeePerGas: z.bigint().optional(),
  maxPriorityFeePerGas: z.bigint().optional(),
  gasPrice: z.bigint().optional(),
  nonce: z.number().int().nonnegative().optional(),
  chainId: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const SolanaTransactionParamsSchema = z.object({
  chain: z.literal('solana'),
  type: TransactionTypeSchema,
  from: z.string().min(32, 'Invalid Solana address'),
  to: z.string().min(32, 'Invalid Solana address').optional(),
  value: z.union([z.string(), z.bigint()]).optional(),
  data: z.union([z.string(), z.instanceof(Uint8Array)]).optional(),
  recentBlockhash: z.string().optional(),
  feePayer: z.string().min(32, 'Invalid Solana address').optional(),
  instructions: z.array(z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const TransactionParamsSchema = z.union([
  EthereumTransactionParamsSchema,
  SolanaTransactionParamsSchema,
]);

/**
 * Error types for transaction operations
 */
export enum TransactionErrorCode {
  INVALID_PARAMS = 'INVALID_PARAMS',
  NONCE_TOO_LOW = 'NONCE_TOO_LOW',
  NONCE_TOO_HIGH = 'NONCE_TOO_HIGH',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  BROADCAST_FAILED = 'BROADCAST_FAILED',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Transaction error class
 */
export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly code: TransactionErrorCode,
    public readonly chain?: 'ethereum' | 'solana',
    public readonly transactionHash?: string
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}
