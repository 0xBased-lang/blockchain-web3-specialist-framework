import { z } from 'zod';

// ============================================================================
// Primitive Types
// ============================================================================

/**
 * Ethereum address validation (0x + 40 hex chars)
 */
export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  .transform((addr) => addr.toLowerCase() as `0x${string}`);

export type Address = z.infer<typeof AddressSchema>;

/**
 * Transaction hash validation (0x + 64 hex chars)
 */
export const TxHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash');

export type TxHash = z.infer<typeof TxHashSchema>;

/**
 * Hex data validation
 */
export const HexSchema = z.string().regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex string');

export type Hex = z.infer<typeof HexSchema>;

/**
 * BigInt schema with coercion from string/number
 */
export const BigIntSchema = z.union([
  z.bigint(),
  z.string().transform((val) => BigInt(val)),
  z.number().transform((val) => BigInt(val)),
]);

// ============================================================================
// Resource Types
// ============================================================================

/**
 * MCP Resource URI schema
 */
export const ResourceURISchema = z.object({
  type: z.enum(['account', 'contract', 'transaction', 'block']),
  identifier: z.string(),
});

export type ResourceURI = z.infer<typeof ResourceURISchema>;

// ============================================================================
// Tool Parameter Schemas
// ============================================================================

/**
 * Query balance parameters
 */
export const QueryBalanceParamsSchema = z.object({
  address: AddressSchema,
  token: AddressSchema.optional(),
  blockTag: z.union([z.number(), z.literal('latest'), z.literal('pending')]).optional(),
});

export type QueryBalanceParams = z.infer<typeof QueryBalanceParamsSchema>;

/**
 * Send transaction parameters
 */
export const SendTransactionParamsSchema = z.object({
  to: AddressSchema,
  value: BigIntSchema,
  data: HexSchema.optional(),
  gasLimit: BigIntSchema.optional(),
  gasPrice: BigIntSchema.optional(),
  maxFeePerGas: BigIntSchema.optional(),
  maxPriorityFeePerGas: BigIntSchema.optional(),
  nonce: z.number().optional(),
});

export type SendTransactionParams = z.infer<typeof SendTransactionParamsSchema>;

/**
 * Call contract parameters
 */
export const CallContractParamsSchema = z.object({
  address: AddressSchema,
  // Support both human-readable ABI strings and JSON ABI fragments
  abi: z.array(z.union([z.string(), z.record(z.string(), z.unknown())])),
  method: z.string(),
  args: z.array(z.unknown()).optional(),
  blockTag: z.union([z.number(), z.literal('latest'), z.literal('pending')]).optional(),
});

export type CallContractParams = z.infer<typeof CallContractParamsSchema>;

/**
 * Deploy contract parameters
 */
export const DeployContractParamsSchema = z.object({
  bytecode: HexSchema,
  // Support both human-readable ABI strings and JSON ABI fragments
  abi: z.array(z.union([z.string(), z.record(z.string(), z.unknown())])),
  constructorArgs: z.array(z.unknown()).optional(),
  gasLimit: BigIntSchema.optional(),
  gasPrice: BigIntSchema.optional(),
});

export type DeployContractParams = z.infer<typeof DeployContractParamsSchema>;

/**
 * Get transaction parameters
 */
export const GetTransactionParamsSchema = z.object({
  hash: TxHashSchema,
});

export type GetTransactionParams = z.infer<typeof GetTransactionParamsSchema>;

/**
 * Get block parameters
 */
export const GetBlockParamsSchema = z.object({
  blockNumber: z.union([z.number(), z.literal('latest'), z.literal('pending')]).optional(),
  blockHash: TxHashSchema.optional(),
});

export type GetBlockParams = z.infer<typeof GetBlockParamsSchema>;

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Ethereum MCP Server configuration
 */
export interface EthereumMCPConfig {
  rpcUrl: string;
  chainId: number;
  chainName: string;
  port?: number;
  maxRetries?: number;
  retryDelay?: number;
  privateKey?: string; // Optional for signing transactions
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Balance query response
 */
export interface BalanceResponse {
  address: Address;
  balance: string; // BigInt as string for JSON serialization
  blockNumber: number;
  token?: Address;
  symbol?: string;
  decimals?: number;
}

/**
 * Transaction response
 */
export interface TransactionResponse {
  hash: TxHash;
  from: Address;
  to: Address | null;
  value: string; // BigInt as string
  gasLimit: string; // BigInt as string
  gasPrice?: string; // BigInt as string
  maxFeePerGas?: string; // BigInt as string (EIP-1559)
  maxPriorityFeePerGas?: string; // BigInt as string (EIP-1559)
  nonce: number;
  data: Hex;
  blockNumber: number | null;
  blockHash: string | null;
  status: 'pending' | 'confirmed' | 'failed';
}

/**
 * Contract call response
 */
export interface ContractCallResponse {
  result: unknown;
  blockNumber: number;
}

/**
 * Contract deployment response
 */
export interface DeploymentResponse {
  contractAddress: Address;
  transactionHash: TxHash;
  blockNumber: number;
  gasUsed: string; // BigInt as string
}

/**
 * Block response
 */
export interface BlockResponse {
  number: number;
  hash: string;
  timestamp: number;
  parentHash: string;
  transactions: string[]; // Array of tx hashes
  gasUsed: string; // BigInt as string
  gasLimit: string; // BigInt as string
  miner: Address;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Custom error for Ethereum operations
 */
export class EthereumError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EthereumError';
  }
}

/**
 * Error codes for Ethereum operations
 */
export enum EthereumErrorCode {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_TX_HASH = 'INVALID_TX_HASH',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
  DEPLOYMENT_FAILED = 'DEPLOYMENT_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
}
