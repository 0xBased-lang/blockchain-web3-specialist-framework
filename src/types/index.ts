/**
 * Core type definitions for the framework
 */

/**
 * Supported blockchain networks
 */
export enum Chain {
  ETHEREUM_MAINNET = 'ethereum-mainnet',
  ETHEREUM_SEPOLIA = 'ethereum-sepolia',
  POLYGON_MAINNET = 'polygon-mainnet',
  POLYGON_MUMBAI = 'polygon-mumbai',
  SOLANA_MAINNET = 'solana-mainnet',
  SOLANA_DEVNET = 'solana-devnet',
}

/**
 * Blockchain address types
 */
export type EthereumAddress = `0x${string}`;
export type SolanaAddress = string; // Base58 encoded

/**
 * Transaction hash types
 */
export type EthereumTxHash = `0x${string}`;
export type SolanaTxSignature = string; // Base58 encoded

/**
 * Common result type for operations
 */
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

/**
 * Base configuration interface
 */
export interface BaseConfig {
  chain: Chain;
  rpcUrl?: string;
  apiKey?: string;
}
