/**
 * Simulation Types
 *
 * Type definitions for transaction simulation and validation.
 *
 * CRITICAL: All transactions MUST be simulated before execution
 * to prevent loss of funds, detect reverts, and validate state changes.
 */

import { z } from 'zod';

/**
 * Simulation provider types
 */
export const SimulationProvider = {
  TENDERLY: 'tenderly',
  FORK: 'fork',
  LOCAL: 'local',
} as const;

export type SimulationProvider = (typeof SimulationProvider)[keyof typeof SimulationProvider];

/**
 * Simulation status
 */
export enum SimulationStatus {
  SUCCESS = 'success',
  REVERT = 'revert',
  FAIL = 'fail',
  TIMEOUT = 'timeout',
}

/**
 * Simulation request parameters
 */
export interface SimulationRequest {
  chain: 'ethereum' | 'solana';
  from: string;
  to?: string;
  value?: bigint | string;
  data?: string;
  gasLimit?: bigint | string;
  gasPrice?: bigint | string;
  maxFeePerGas?: bigint | string;
  maxPriorityFeePerGas?: bigint | string;
  blockNumber?: number | 'latest';
  stateOverrides?: Record<string, StateOverride>;
}

/**
 * State override for simulation
 */
export interface StateOverride {
  balance?: string;
  nonce?: number;
  code?: string;
  state?: Record<string, string>;
}

/**
 * Log entry from simulation
 */
export interface SimulationLog {
  address: string;
  topics: string[];
  data: string;
  logIndex?: number;
  transactionIndex?: number;
  blockNumber?: number;
}

/**
 * Asset balance change from simulation
 */
export interface AssetChange {
  address: string;
  assetType: 'native' | 'erc20' | 'erc721' | 'erc1155';
  tokenAddress?: string;
  tokenId?: string;
  from: string;
  to: string;
  amount: string;
  rawAmount?: bigint;
}

/**
 * State change from simulation
 */
export interface StateChange {
  address: string;
  slot: string;
  previousValue: string;
  newValue: string;
}

/**
 * Call trace entry
 */
export interface CallTrace {
  type: 'CALL' | 'DELEGATECALL' | 'STATICCALL' | 'CREATE' | 'CREATE2' | 'SELFDESTRUCT';
  from: string;
  to?: string;
  value?: string;
  gas?: string;
  gasUsed?: string;
  input?: string;
  output?: string;
  error?: string;
  revertReason?: string;
  calls?: CallTrace[];
}

/**
 * Simulation result
 */
export interface SimulationResult {
  status: SimulationStatus;
  gasUsed: bigint;
  gasLimit?: bigint;
  blockNumber: number;
  timestamp: number;
  success: boolean;

  // Transaction output
  returnData?: string;
  logs?: SimulationLog[];

  // Error information
  error?: string;
  revertReason?: string;

  // State changes
  assetChanges?: AssetChange[];
  stateChanges?: StateChange[];
  balanceChanges?: Record<string, string>;

  // Execution trace
  trace?: CallTrace;

  // Metadata
  provider: SimulationProvider;
  simulatedAt: Date;
}

/**
 * Simulation error codes
 */
export enum SimulationErrorCode {
  REVERT = 'SIMULATION_REVERT',
  OUT_OF_GAS = 'SIMULATION_OUT_OF_GAS',
  INVALID_OPCODE = 'SIMULATION_INVALID_OPCODE',
  STACK_OVERFLOW = 'SIMULATION_STACK_OVERFLOW',
  STACK_UNDERFLOW = 'SIMULATION_STACK_UNDERFLOW',
  INVALID_JUMP = 'SIMULATION_INVALID_JUMP',
  UNAUTHORIZED = 'SIMULATION_UNAUTHORIZED',
  INSUFFICIENT_BALANCE = 'SIMULATION_INSUFFICIENT_BALANCE',
  NONCE_TOO_LOW = 'SIMULATION_NONCE_TOO_LOW',
  NONCE_TOO_HIGH = 'SIMULATION_NONCE_TOO_HIGH',
  PROVIDER_ERROR = 'SIMULATION_PROVIDER_ERROR',
  TIMEOUT = 'SIMULATION_TIMEOUT',
  UNKNOWN = 'SIMULATION_UNKNOWN',
}

/**
 * Simulation error
 */
export class SimulationError extends Error {
  constructor(
    message: string,
    public readonly code: SimulationErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SimulationError';
  }
}

/**
 * Validation schemas
 */

export const SimulationRequestSchema = z.object({
  chain: z.enum(['ethereum', 'solana']),
  from: z.string(),
  to: z.string().optional(),
  value: z.union([z.bigint(), z.string()]).optional(),
  data: z.string().optional(),
  gasLimit: z.union([z.bigint(), z.string()]).optional(),
  gasPrice: z.union([z.bigint(), z.string()]).optional(),
  maxFeePerGas: z.union([z.bigint(), z.string()]).optional(),
  maxPriorityFeePerGas: z.union([z.bigint(), z.string()]).optional(),
  blockNumber: z.union([z.number(), z.literal('latest')]).optional(),
  stateOverrides: z
    .record(
      z.string(),
      z.object({
        balance: z.string().optional(),
        nonce: z.number().optional(),
        code: z.string().optional(),
        state: z.record(z.string(), z.string()).optional(),
      })
    )
    .optional(),
});

export const AssetChangeSchema = z.object({
  address: z.string(),
  assetType: z.enum(['native', 'erc20', 'erc721', 'erc1155']),
  tokenAddress: z.string().optional(),
  tokenId: z.string().optional(),
  from: z.string(),
  to: z.string(),
  amount: z.string(),
  rawAmount: z.bigint().optional(),
});

/**
 * Risk assessment from simulation
 */
export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
  issues: RiskIssue[];
  recommendations: string[];
}

/**
 * Risk issue identified in simulation
 */
export interface RiskIssue {
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'reentrancy' | 'gas' | 'access-control' | 'overflow' | 'price-manipulation' | 'other';
  description: string;
  location?: string;
  mitigation?: string;
}

/**
 * Simulation configuration
 */
export interface SimulationConfig {
  provider: SimulationProvider;
  timeout?: number;
  saveIfFails?: boolean;
  includeTrace?: boolean;
  includeStateDiff?: boolean;
  tenderlyAccessKey?: string;
  tenderlyProject?: string;
  forkUrl?: string;
}
