/**
 * Price Oracle Type Definitions
 *
 * Type definitions for price oracle system with:
 * - Chainlink integration
 * - Multiple oracle sources
 * - TWAP calculations
 * - Price manipulation detection
 * - Cache management
 */

import { z } from 'zod';

/**
 * Supported oracle sources
 */
export enum OracleSource {
  CHAINLINK = 'chainlink',
  UNISWAP_V3 = 'uniswap_v3',
  UNISWAP_V2 = 'uniswap_v2',
  SUSHISWAP = 'sushiswap',
  CURVE = 'curve',
  MANUAL = 'manual', // For testing/override
}

/**
 * Oracle data freshness
 */
export enum OracleFreshness {
  FRESH = 'fresh', // < 1 minute old
  RECENT = 'recent', // < 5 minutes old
  STALE = 'stale', // < 15 minutes old
  EXPIRED = 'expired', // > 15 minutes old
}

/**
 * Price data from oracle
 */
export interface PriceData {
  price: bigint; // Price in wei (18 decimals)
  decimals: number; // Decimals of the price feed
  timestamp: Date; // When price was updated
  source: OracleSource; // Oracle source
  confidence: number; // Confidence level (0-100)
  updatedAt: Date; // When we fetched this data
}

/**
 * Aggregated price from multiple sources
 */
export interface AggregatedPrice {
  price: bigint; // Median price from all sources
  decimals: number; // Standard decimals (18)
  sources: PriceData[]; // All source prices
  timestamp: Date; // Latest timestamp
  confidence: number; // Average confidence
  spread: number; // Price spread % (volatility indicator)
  outliers: OracleSource[]; // Sources excluded as outliers
}

/**
 * TWAP (Time-Weighted Average Price) data
 */
export interface TWAPData {
  price: bigint; // TWAP price
  decimals: number; // Decimals
  period: number; // Time period in seconds
  observations: number; // Number of observations
  startTime: Date; // Start of TWAP window
  endTime: Date; // End of TWAP window
  source: OracleSource; // Source of TWAP data
}

/**
 * Price manipulation detection result
 */
export interface ManipulationDetection {
  isManipulated: boolean; // True if manipulation detected
  confidence: number; // Confidence level (0-100)
  indicators: ManipulationIndicator[]; // Specific indicators
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[]; // What to do
}

/**
 * Price manipulation indicator
 */
export interface ManipulationIndicator {
  type: ManipulationType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  description: string;
  evidence: Record<string, unknown>;
}

/**
 * Types of price manipulation
 */
export enum ManipulationType {
  LARGE_SPREAD = 'large_spread', // Price difference between sources > threshold
  RAPID_CHANGE = 'rapid_change', // Price changed too quickly
  LOW_LIQUIDITY = 'low_liquidity', // Not enough liquidity
  ORACLE_DEVIATION = 'oracle_deviation', // Oracles disagree significantly
  VOLUME_ANOMALY = 'volume_anomaly', // Unusual trading volume
  FLASH_LOAN_DETECTED = 'flash_loan_detected', // Flash loan in recent blocks
}

/**
 * Chainlink price feed configuration
 */
export interface ChainlinkFeedConfig {
  address: string; // Feed contract address
  pair: string; // Token pair (e.g., "ETH/USD")
  decimals: number; // Feed decimals
  heartbeat: number; // Expected update frequency (seconds)
  deviation: number; // Expected price deviation threshold (%)
}

/**
 * Uniswap V3 TWAP configuration
 */
export interface UniswapV3TWAPConfig {
  poolAddress: string; // Pool contract address
  pair: string; // Token pair
  fee: number; // Pool fee tier (500, 3000, 10000)
  period: number; // TWAP period in seconds
  token0: string; // Token0 address
  token1: string; // Token1 address
}

/**
 * Oracle configuration
 */
export interface OracleConfig {
  // Enabled sources
  enabledSources: OracleSource[];

  // Chainlink feeds
  chainlinkFeeds: Record<string, ChainlinkFeedConfig>; // tokenSymbol -> config

  // Uniswap V3 pools
  uniswapV3Pools: Record<string, UniswapV3TWAPConfig>; // pair -> config

  // Cache settings
  cacheTTL: number; // Cache time-to-live (seconds)
  maxCacheSize: number; // Max cached entries

  // Aggregation settings
  minSources: number; // Minimum sources for aggregation
  outlierThreshold: number; // Outlier detection threshold (%)
  maxSpread: number; // Maximum acceptable spread (%)

  // Manipulation detection
  enableManipulationDetection: boolean;
  manipulationThresholds: {
    maxSpread: number; // Max spread % before flagging
    maxRapidChange: number; // Max % change per minute
    minLiquidity: bigint; // Minimum liquidity in USD
    maxDeviation: number; // Max deviation between oracles (%)
  };

  // Update settings
  autoUpdate: boolean; // Auto-update prices in background
  updateInterval: number; // Update interval (seconds)
}

/**
 * Cached price entry
 */
export interface CachedPrice {
  tokenSymbol: string; // Token symbol
  price: AggregatedPrice; // Aggregated price
  twap?: TWAPData; // TWAP if available
  manipulation?: ManipulationDetection; // Manipulation check result
  expiresAt: Date; // When cache expires
}

/**
 * Price query request
 */
export interface PriceQueryRequest {
  tokenSymbol: string; // Token to query (e.g., "ETH", "USDC")
  quoteCurrency?: string; // Quote currency (default: "USD")
  sources?: OracleSource[]; // Specific sources to use
  includeTWAP?: boolean; // Include TWAP calculation
  twapPeriod?: number; // TWAP period in seconds
  bypassCache?: boolean; // Force fresh data
}

/**
 * Price query result
 */
export interface PriceQueryResult {
  tokenSymbol: string;
  quoteCurrency: string;
  price: AggregatedPrice;
  twap?: TWAPData;
  manipulation?: ManipulationDetection;
  freshness: OracleFreshness;
  fromCache: boolean;
}

/**
 * Validation schemas
 */

export const OracleSourceSchema = z.enum([
  'chainlink',
  'uniswap_v3',
  'uniswap_v2',
  'sushiswap',
  'curve',
  'manual',
]);

export const PriceDataSchema = z.object({
  price: z.bigint(),
  decimals: z.number().int().min(0).max(18),
  timestamp: z.date(),
  source: OracleSourceSchema,
  confidence: z.number().min(0).max(100),
  updatedAt: z.date(),
});

export const PriceQueryRequestSchema = z.object({
  tokenSymbol: z.string().min(1).max(20),
  quoteCurrency: z.string().min(1).max(20).optional(),
  sources: z.array(OracleSourceSchema).optional(),
  includeTWAP: z.boolean().optional(),
  twapPeriod: z.number().int().positive().optional(),
  bypassCache: z.boolean().optional(),
});

/**
 * Oracle error codes
 */
export enum OracleErrorCode {
  NO_PRICE_AVAILABLE = 'NO_PRICE_AVAILABLE',
  STALE_PRICE = 'STALE_PRICE',
  INSUFFICIENT_SOURCES = 'INSUFFICIENT_SOURCES',
  MANIPULATION_DETECTED = 'MANIPULATION_DETECTED',
  ORACLE_UNREACHABLE = 'ORACLE_UNREACHABLE',
  INVALID_FEED = 'INVALID_FEED',
  PRICE_DEVIATION_TOO_HIGH = 'PRICE_DEVIATION_TOO_HIGH',
  CACHE_ERROR = 'CACHE_ERROR',
}

/**
 * Oracle error class
 */
export class OracleError extends Error {
  constructor(
    message: string,
    public readonly code: OracleErrorCode,
    public readonly tokenSymbol?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OracleError';
  }
}

/**
 * Known Chainlink feed addresses (Ethereum Mainnet)
 */
export const CHAINLINK_FEEDS_MAINNET: Record<string, ChainlinkFeedConfig> = {
  ETH: {
    address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    pair: 'ETH/USD',
    decimals: 8,
    heartbeat: 3600, // 1 hour
    deviation: 0.5, // 0.5%
  },
  BTC: {
    address: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
    pair: 'BTC/USD',
    decimals: 8,
    heartbeat: 3600,
    deviation: 0.5,
  },
  USDC: {
    address: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    pair: 'USDC/USD',
    decimals: 8,
    heartbeat: 86400, // 24 hours
    deviation: 0.1,
  },
  USDT: {
    address: '0x3E7d1eAB13ad0104d264de5e4DA9d0F3e8F89f0b',
    pair: 'USDT/USD',
    decimals: 8,
    heartbeat: 86400,
    deviation: 0.1,
  },
  DAI: {
    address: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
    pair: 'DAI/USD',
    decimals: 8,
    heartbeat: 3600,
    deviation: 0.5,
  },
  LINK: {
    address: '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
    pair: 'LINK/USD',
    decimals: 8,
    heartbeat: 3600,
    deviation: 1.0,
  },
};

/**
 * Default oracle configuration
 */
export const DEFAULT_ORACLE_CONFIG: OracleConfig = {
  enabledSources: [OracleSource.CHAINLINK, OracleSource.UNISWAP_V3],
  chainlinkFeeds: CHAINLINK_FEEDS_MAINNET,
  uniswapV3Pools: {},
  cacheTTL: 60, // 1 minute
  maxCacheSize: 1000,
  minSources: 1,
  outlierThreshold: 5.0, // 5%
  maxSpread: 2.0, // 2%
  enableManipulationDetection: true,
  manipulationThresholds: {
    maxSpread: 5.0, // 5%
    maxRapidChange: 10.0, // 10% per minute
    minLiquidity: 1000000n * 10n ** 18n, // $1M
    maxDeviation: 3.0, // 3%
  },
  autoUpdate: false,
  updateInterval: 60, // 1 minute
};
