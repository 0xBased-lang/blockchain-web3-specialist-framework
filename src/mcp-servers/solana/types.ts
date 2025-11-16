import { z } from 'zod';

/**
 * Solana Type Definitions
 *
 * Comprehensive type system for Solana blockchain operations:
 * - Base58 address validation (32 bytes)
 * - Lamports handling (1 SOL = 10^9 lamports)
 * - Recent blockhash management
 * - SPL token support
 * - Compute unit limits
 *
 * Edge cases handled:
 * - Invalid Base58 addresses
 * - Blockhash expiration (79 seconds)
 * - Insufficient lamports
 * - Compute budget exceeded
 * - SPL token account initialization
 */

/**
 * Base58 address schema
 *
 * Solana addresses are 32-byte Base58 encoded strings
 * Examples:
 * - System Program: 11111111111111111111111111111111
 * - Token Program: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
 */
export const SolanaAddressSchema = z
  .string()
  .min(32, 'Solana address too short')
  .max(44, 'Solana address too long')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid Base58 address')
  .transform((addr) => addr as SolanaAddress);

export type SolanaAddress = string & { readonly __brand: 'SolanaAddress' };

/**
 * Transaction signature schema
 *
 * Solana signatures are Base58 encoded (64 bytes)
 */
export const SignatureSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, 'Invalid signature format')
  .transform((sig) => sig as Signature);

export type Signature = string & { readonly __brand: 'Signature' };

/**
 * Blockhash schema
 *
 * Recent blockhash (expires after ~79 seconds)
 */
export const BlockhashSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid blockhash format')
  .transform((hash) => hash as Blockhash);

export type Blockhash = string & { readonly __brand: 'Blockhash' };

/**
 * BigInt schema with coercion
 *
 * Handles lamports (1 SOL = 1,000,000,000 lamports)
 */
export const BigIntSchema = z.union([
  z.bigint(),
  z.string().transform((val) => BigInt(val)),
  z.number().transform((val) => BigInt(val)),
]);

/**
 * Commitment level schema
 *
 * Solana has different commitment levels:
 * - processed: Transaction processed but not confirmed
 * - confirmed: Transaction confirmed by cluster (12 confirmations)
 * - finalized: Transaction finalized (32 confirmations, ~14 seconds)
 */
export const CommitmentSchema = z.enum(['processed', 'confirmed', 'finalized']);
export type Commitment = z.infer<typeof CommitmentSchema>;

/**
 * Query balance parameters
 */
export const QueryBalanceParamsSchema = z.object({
  address: SolanaAddressSchema,
  token: SolanaAddressSchema.optional(), // SPL token mint address
  commitment: CommitmentSchema.optional(),
});

export type QueryBalanceParams = z.infer<typeof QueryBalanceParamsSchema>;

/**
 * Balance response
 */
export interface BalanceResponse {
  address: SolanaAddress;
  balance: string; // Lamports as string
  decimals: number; // 9 for SOL, varies for SPL tokens
  symbol?: string; // SOL or token symbol
  slot: number;
  token?: SolanaAddress; // If querying SPL token
}

/**
 * Send transaction parameters
 */
export const SendTransactionParamsSchema = z.object({
  to: SolanaAddressSchema,
  amount: BigIntSchema, // Lamports
  recentBlockhash: BlockhashSchema.optional(), // If not provided, will fetch
  feePayer: SolanaAddressSchema.optional(), // Defaults to signer
  computeUnitLimit: z.number().optional(), // Max 1.4M compute units
  computeUnitPrice: BigIntSchema.optional(), // Priority fee (micro-lamports per compute unit)
});

export type SendTransactionParams = z.infer<typeof SendTransactionParamsSchema>;

/**
 * Transaction response
 */
export interface TransactionResponse {
  signature: Signature;
  from: SolanaAddress;
  to: SolanaAddress;
  amount: string; // Lamports
  fee: string; // Transaction fee in lamports
  recentBlockhash: Blockhash;
  slot: number | null;
  status: 'pending' | 'confirmed' | 'finalized' | 'failed';
  computeUnitsConsumed?: number;
}

/**
 * SPL token transfer parameters
 */
export const TransferTokenParamsSchema = z.object({
  to: SolanaAddressSchema,
  amount: BigIntSchema, // Token amount (respecting decimals)
  mint: SolanaAddressSchema, // SPL token mint address
  decimals: z.number().min(0).max(9), // Token decimals
  createAssociatedTokenAccount: z.boolean().optional(), // Auto-create recipient ATA
  recentBlockhash: BlockhashSchema.optional(),
  computeUnitLimit: z.number().optional(),
  computeUnitPrice: BigIntSchema.optional(),
});

export type TransferTokenParams = z.infer<typeof TransferTokenParamsSchema>;

/**
 * Call program parameters
 */
export const CallProgramParamsSchema = z.object({
  programId: SolanaAddressSchema,
  instruction: z.string(), // Base64 encoded instruction data
  accounts: z.array(
    z.object({
      pubkey: SolanaAddressSchema,
      isSigner: z.boolean(),
      isWritable: z.boolean(),
    })
  ),
  recentBlockhash: BlockhashSchema.optional(),
  commitment: CommitmentSchema.optional(),
});

export type CallProgramParams = z.infer<typeof CallProgramParamsSchema>;

/**
 * Program call response
 */
export interface ProgramCallResponse {
  result: unknown; // Decoded program output
  slot: number;
  computeUnitsConsumed: number;
}

/**
 * Get transaction parameters
 */
export const GetTransactionParamsSchema = z.object({
  signature: SignatureSchema,
  commitment: CommitmentSchema.optional(),
});

export type GetTransactionParams = z.infer<typeof GetTransactionParamsSchema>;

/**
 * Wait for confirmation parameters
 */
export const WaitForConfirmationParamsSchema = z.object({
  signature: SignatureSchema,
  commitment: CommitmentSchema.optional(), // Default: 'confirmed'
  timeout: z.number().optional(), // Milliseconds (default: 30000)
});

export type WaitForConfirmationParams = z.infer<typeof WaitForConfirmationParamsSchema>;

/**
 * Get recent blockhash parameters
 */
export const GetRecentBlockhashParamsSchema = z.object({
  commitment: CommitmentSchema.optional(),
});

export type GetRecentBlockhashParams = z.infer<typeof GetRecentBlockhashParamsSchema>;

/**
 * Recent blockhash response
 */
export interface RecentBlockhashResponse {
  blockhash: Blockhash;
  lastValidBlockHeight: number;
}

/**
 * Request airdrop parameters (devnet/testnet only)
 */
export const RequestAirdropParamsSchema = z.object({
  address: SolanaAddressSchema,
  lamports: BigIntSchema,
});

export type RequestAirdropParams = z.infer<typeof RequestAirdropParamsSchema>;

/**
 * Custom error class for Solana operations
 */
export class SolanaError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SolanaError';
  }
}

/**
 * Error codes
 */
export enum SolanaErrorCode {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  BLOCKHASH_EXPIRED = 'BLOCKHASH_EXPIRED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  TOKEN_ACCOUNT_NOT_FOUND = 'TOKEN_ACCOUNT_NOT_FOUND',
  PROGRAM_ERROR = 'PROGRAM_ERROR',
  COMPUTE_BUDGET_EXCEEDED = 'COMPUTE_BUDGET_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SIMULATION_FAILED = 'SIMULATION_FAILED',
}

/**
 * Solana cluster type
 */
export enum SolanaCluster {
  MAINNET = 'mainnet-beta',
  TESTNET = 'testnet',
  DEVNET = 'devnet',
  LOCALNET = 'localnet',
}

/**
 * Account info response
 */
export interface AccountInfo {
  address: SolanaAddress;
  lamports: string;
  owner: SolanaAddress; // Program that owns this account
  executable: boolean;
  rentEpoch: number;
  data: string; // Base64 encoded
  slot: number;
}

/**
 * Token account info
 */
export interface TokenAccountInfo {
  address: SolanaAddress; // Token account address
  mint: SolanaAddress; // Token mint address
  owner: SolanaAddress; // Owner of token account
  amount: string; // Token amount (respecting decimals)
  decimals: number;
  symbol?: string;
  name?: string;
  slot: number;
}

/**
 * Block info response
 */
export interface BlockInfo {
  slot: number;
  blockhash: Blockhash;
  previousBlockhash: Blockhash;
  parentSlot: number;
  transactions: Signature[];
  blockTime: number | null; // Unix timestamp
  blockHeight: number | null;
  rewards: Array<{
    pubkey: SolanaAddress;
    lamports: string;
    rewardType: string;
  }>;
}

/**
 * Transaction info
 */
export interface TransactionInfo {
  signature: Signature;
  slot: number;
  blockTime: number | null;
  fee: string; // Lamports
  status: 'success' | 'failed';
  error: string | null;
  computeUnitsConsumed: number;
  logMessages: string[];
  preBalances: string[]; // Lamports before transaction
  postBalances: string[]; // Lamports after transaction
  accounts: SolanaAddress[];
}

/**
 * SPL token metadata
 */
export interface TokenMetadata {
  mint: SolanaAddress;
  decimals: number;
  symbol: string;
  name: string;
  supply: string;
  freezeAuthority: SolanaAddress | null;
  mintAuthority: SolanaAddress | null;
}
