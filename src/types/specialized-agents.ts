/**
 * Specialized Agents Type Definitions
 *
 * Type definitions for domain-specific blockchain agents:
 * - DeFi Agent
 * - NFT Agent
 * - Security Agent
 * - Analytics Agent
 */

/**
 * ============================================================================
 * TASK TYPES
 * ============================================================================
 */

/**
 * DeFi Task Types
 */
export type DeFiTaskType =
  | 'defi_swap' // Token swap on DEX
  | 'defi_add_liquidity' // Add liquidity to pool
  | 'defi_remove_liquidity' // Remove liquidity
  | 'defi_stake' // Stake tokens
  | 'defi_unstake' // Unstake tokens
  | 'defi_get_quote' // Get swap quote
  | 'defi_monitor_price'; // Monitor price with alerts

/**
 * NFT Task Types
 */
export type NFTTaskType =
  | 'nft_mint_erc721' // Mint ERC721 NFT
  | 'nft_mint_erc1155' // Mint ERC1155 NFT
  | 'nft_transfer' // Transfer NFT
  | 'nft_batch_mint' // Batch mint collection
  | 'nft_upload_metadata' // Upload metadata to IPFS
  | 'nft_get_collection_stats'; // Get collection statistics

/**
 * Security Task Types
 */
export type SecurityTaskType =
  | 'security_audit_contract' // Full contract audit
  | 'security_validate_tx' // Pre-flight transaction validation
  | 'security_check_malicious' // Malicious contract check
  | 'security_analyze_mev' // MEV risk analysis
  | 'security_monitor_contract' // Continuous monitoring
  | 'security_generate_report'; // Generate security report

/**
 * Analytics Task Types
 */
export type AnalyticsTaskType =
  | 'analytics_get_portfolio' // Portfolio summary
  | 'analytics_analyze_tx' // Transaction analysis
  | 'analytics_gas_analysis' // Gas usage analysis
  | 'analytics_price_history' // Token price history
  | 'analytics_performance' // Performance report
  | 'analytics_compare_allocation'; // Compare portfolio allocation

/**
 * All Specialized Task Types
 */
export type SpecializedTaskType =
  | DeFiTaskType
  | NFTTaskType
  | SecurityTaskType
  | AnalyticsTaskType;

/**
 * ============================================================================
 * CHAIN TYPES
 * ============================================================================
 */

export type EVMChain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base';
export type SolanaChain = 'solana';
export type SupportedChain = EVMChain | SolanaChain;

/**
 * ============================================================================
 * DEFI TYPES
 * ============================================================================
 */

/**
 * Parameters for token swap operation
 */
export interface SwapParams {
  readonly fromToken: string; // Token address or symbol
  readonly toToken: string; // Token address or symbol
  readonly amount: string; // Amount in human-readable format (e.g., "1.5")
  readonly chain: EVMChain | SolanaChain;
  readonly slippage?: number; // Percentage (default: 0.5)
  readonly recipient?: string; // Recipient address (default: sender)
  readonly deadline?: number; // Unix timestamp (default: now + 20 min)
  readonly useMEVProtection?: boolean; // Use Flashbots (default: true)
}

/**
 * Result of swap operation
 */
export interface SwapResult {
  readonly success: boolean;
  readonly txHash?: string;
  readonly amountOut?: string; // Actual amount received
  readonly expectedAmountOut?: string; // Expected amount
  readonly slippage?: number; // Actual slippage percentage
  readonly gasUsed?: string; // Gas used in wei
  readonly dex?: string; // DEX used for swap
  readonly error?: string;
}

/**
 * Parameters for liquidity operation
 */
export interface LiquidityParams {
  readonly poolAddress: string;
  readonly token0: string;
  readonly token1: string;
  readonly amount0: string;
  readonly amount1: string;
  readonly chain: EVMChain;
  readonly slippage?: number; // Percentage (default: 0.5)
}

/**
 * Result of liquidity operation
 */
export interface LiquidityResult {
  readonly success: boolean;
  readonly txHash?: string;
  readonly lpTokens?: string; // LP tokens received/burned
  readonly amount0?: string; // Token0 amount
  readonly amount1?: string; // Token1 amount
  readonly error?: string;
}

/**
 * Parameters for price monitoring
 */
export interface PriceMonitorParams {
  readonly token: string;
  readonly chain: SupportedChain;
  readonly threshold: number; // Alert threshold (percentage change)
  readonly interval: number; // Check interval in milliseconds
  readonly duration?: number; // Monitoring duration (default: indefinite)
}

/**
 * DEX quote information
 */
export interface DEXQuote {
  readonly dex: string; // DEX name
  readonly amountOut: string; // Expected output amount
  readonly priceImpact: number; // Price impact percentage
  readonly gasEstimate: string; // Estimated gas cost
}

/**
 * ============================================================================
 * NFT TYPES
 * ============================================================================
 */

/**
 * NFT Metadata (ERC721/ERC1155 compatible)
 */
export interface NFTMetadata {
  readonly name: string;
  readonly description: string;
  readonly image: string; // URL or data URI
  readonly external_url?: string;
  readonly attributes?: readonly NFTAttribute[];
  readonly animation_url?: string;
  readonly background_color?: string;
}

/**
 * NFT Attribute
 */
export interface NFTAttribute {
  readonly trait_type: string;
  readonly value: string | number;
  readonly display_type?: 'number' | 'boost_percentage' | 'boost_number' | 'date';
  readonly max_value?: number;
}

/**
 * Parameters for ERC721 minting
 */
export interface MintERC721Params {
  readonly contract: string; // Contract address
  readonly recipient: string; // Recipient address
  readonly metadata: NFTMetadata;
  readonly chain: EVMChain | SolanaChain;
  readonly royaltyBps?: number; // Royalty in basis points (e.g., 500 = 5%)
  readonly royaltyRecipient?: string;
}

/**
 * Parameters for ERC1155 minting
 */
export interface MintERC1155Params {
  readonly contract: string;
  readonly recipient: string;
  readonly metadata: NFTMetadata;
  readonly amount: number; // Number of editions
  readonly chain: EVMChain;
  readonly royaltyBps?: number;
  readonly royaltyRecipient?: string;
}

/**
 * Result of NFT mint operation
 */
export interface MintResult {
  readonly success: boolean;
  readonly txHash?: string;
  readonly tokenId?: string;
  readonly metadataUri?: string; // IPFS URI or other storage
  readonly contractAddress?: string;
  readonly error?: string;
}

/**
 * Parameters for NFT transfer
 */
export interface NFTTransferParams {
  readonly contract: string;
  readonly tokenId: string;
  readonly from: string;
  readonly to: string;
  readonly chain: EVMChain | SolanaChain;
  readonly amount?: number; // For ERC1155
}

/**
 * Parameters for batch minting
 */
export interface BatchMintParams {
  readonly contract: string;
  readonly recipients: readonly string[];
  readonly metadataList: readonly NFTMetadata[];
  readonly chain: EVMChain | SolanaChain;
}

/**
 * Collection statistics
 */
export interface CollectionStats {
  readonly contract: string;
  readonly totalSupply: number;
  readonly ownersCount: number;
  readonly floorPrice?: string;
  readonly volumeTraded?: string;
  readonly chain: SupportedChain;
}

/**
 * ============================================================================
 * SECURITY TYPES
 * ============================================================================
 */

/**
 * Parameters for contract audit
 */
export interface AuditParams {
  readonly address: string;
  readonly chain: EVMChain | SolanaChain;
  readonly includeSourceCode?: boolean;
  readonly deepAnalysis?: boolean;
}

/**
 * Vulnerability finding
 */
export interface VulnerabilityFinding {
  readonly severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly location?: string; // Function name or line number
  readonly recommendation?: string;
}

/**
 * Result of security audit
 */
export interface AuditResult {
  readonly address: string;
  readonly chain: SupportedChain;
  readonly riskLevel: 'minimal' | 'low' | 'medium' | 'high' | 'critical';
  readonly findings: readonly VulnerabilityFinding[];
  readonly score: number; // 0-100 (higher is better)
  readonly recommendations: readonly string[];
  readonly timestamp: number;
}

/**
 * Parameters for transaction validation
 */
export interface TransactionValidationParams {
  readonly to: string;
  readonly data?: string;
  readonly value?: string;
  readonly chain: EVMChain;
}

/**
 * Result of transaction validation
 */
export interface TransactionValidationResult {
  readonly safe: boolean;
  readonly riskLevel: 'minimal' | 'low' | 'medium' | 'high' | 'critical';
  readonly risks: readonly string[];
  readonly warnings: readonly string[];
  readonly recommendation: string;
  readonly simulationResult?: {
    readonly success: boolean;
    readonly gasUsed: string;
    readonly stateChanges: readonly unknown[];
  };
}

/**
 * Parameters for malicious contract check
 */
export interface MaliciousCheckParams {
  readonly address: string;
  readonly chain: EVMChain;
}

/**
 * Parameters for MEV analysis
 */
export interface MEVAnalysisParams {
  readonly transaction: {
    readonly to: string;
    readonly data: string;
    readonly value?: string;
  };
  readonly chain: EVMChain;
}

/**
 * Result of MEV analysis
 */
export interface MEVAnalysisResult {
  readonly vulnerable: boolean;
  readonly riskLevel: 'low' | 'medium' | 'high';
  readonly vulnerabilities: readonly string[];
  readonly recommendations: readonly string[];
  readonly estimatedLoss?: string; // Potential loss in USD
}

/**
 * ============================================================================
 * ANALYTICS TYPES
 * ============================================================================
 */

/**
 * Parameters for portfolio query
 */
export interface PortfolioParams {
  readonly address: string;
  readonly chains: readonly SupportedChain[];
  readonly includeNFTs?: boolean;
  readonly includeStaked?: boolean;
}

/**
 * Asset in portfolio
 */
export interface PortfolioAsset {
  readonly token: string;
  readonly symbol: string;
  readonly balance: string;
  readonly priceUSD: number;
  readonly valueUSD: number;
  readonly percentage: number; // Percentage of total portfolio
  readonly chain: SupportedChain;
}

/**
 * Portfolio summary
 */
export interface PortfolioSummary {
  readonly totalValueUSD: number;
  readonly assets: readonly PortfolioAsset[];
  readonly chains: readonly {
    readonly chain: SupportedChain;
    readonly valueUSD: number;
    readonly percentage: number;
  }[];
  readonly performance24h?: {
    readonly changeUSD: number;
    readonly changePercent: number;
  };
  readonly nfts?: readonly {
    readonly contract: string;
    readonly tokenId: string;
    readonly chain: SupportedChain;
    readonly estimatedValueUSD?: number;
  }[];
}

/**
 * Parameters for transaction analysis
 */
export interface TransactionAnalysisParams {
  readonly address: string;
  readonly chain: SupportedChain;
  readonly startBlock?: number;
  readonly endBlock?: number;
  readonly limit?: number;
}

/**
 * Transaction statistics
 */
export interface TransactionStats {
  readonly totalTransactions: number;
  readonly sent: number;
  readonly received: number;
  readonly totalValueUSD: number;
  readonly averageGasPrice: string;
  readonly totalGasUsed: string;
  readonly mostActiveToken?: string;
  readonly period: {
    readonly startBlock: number;
    readonly endBlock: number;
  };
}

/**
 * Parameters for gas analysis
 */
export interface GasAnalysisParams {
  readonly address: string;
  readonly chain: EVMChain;
  readonly period: 'day' | 'week' | 'month' | 'year';
}

/**
 * Gas usage statistics
 */
export interface GasStats {
  readonly totalGasUsed: string; // In wei
  readonly totalCostUSD: number;
  readonly averageGasPrice: string; // In gwei
  readonly transactionCount: number;
  readonly mostExpensiveTx?: {
    readonly hash: string;
    readonly gasUsed: string;
    readonly costUSD: number;
  };
  readonly optimizationPotential?: {
    readonly estimatedSavings: number; // USD
    readonly recommendations: readonly string[];
  };
}

/**
 * Parameters for price history
 */
export interface PriceHistoryParams {
  readonly token: string;
  readonly chain: SupportedChain;
  readonly period: 'hour' | 'day' | 'week' | 'month' | 'year';
  readonly dataPoints?: number; // Number of data points (default: 100)
}

/**
 * Price data point
 */
export interface PriceDataPoint {
  readonly timestamp: number;
  readonly priceUSD: number;
  readonly volume24h?: number;
  readonly marketCapUSD?: number;
}

/**
 * Price history result
 */
export interface PriceHistory {
  readonly token: string;
  readonly chain: SupportedChain;
  readonly period: string;
  readonly data: readonly PriceDataPoint[];
  readonly summary: {
    readonly currentPrice: number;
    readonly highPrice: number;
    readonly lowPrice: number;
    readonly averagePrice: number;
    readonly changePercent: number;
  };
}

/**
 * Parameters for performance report
 */
export interface PerformanceReportParams {
  readonly address: string;
  readonly chains: readonly SupportedChain[];
  readonly startDate: Date;
  readonly endDate: Date;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  readonly period: {
    readonly start: Date;
    readonly end: Date;
  };
  readonly initialValueUSD: number;
  readonly finalValueUSD: number;
  readonly absoluteReturn: number; // USD
  readonly percentReturn: number; // Percentage
  readonly bestPerformer?: {
    readonly token: string;
    readonly returnPercent: number;
  };
  readonly worstPerformer?: {
    readonly token: string;
    readonly returnPercent: number;
  };
  readonly totalGasCostUSD: number;
}

/**
 * ============================================================================
 * AGENT CONFIG TYPES
 * ============================================================================
 */

/**
 * Provider configuration for agents
 */
export interface AgentProviders {
  readonly ethereum?: unknown; // JsonRpcProvider (avoiding import)
  readonly polygon?: unknown;
  readonly arbitrum?: unknown;
  readonly optimism?: unknown;
  readonly solana?: unknown; // Connection
}

/**
 * DeFi-specific providers
 */
export interface DeFiProviders {
  readonly ethereum?: unknown; // JsonRpcProvider
  readonly polygon?: unknown; // JsonRpcProvider
  readonly arbitrum?: unknown; // JsonRpcProvider
  readonly optimism?: unknown; // JsonRpcProvider
}

/**
 * NFT-specific providers
 */
export interface NFTProviders {
  readonly ethereum?: unknown; // JsonRpcProvider
  readonly polygon?: unknown; // JsonRpcProvider
  readonly solana?: unknown; // Connection
}

/**
 * Security-specific providers
 */
export interface SecurityProviders {
  readonly ethereum?: unknown; // JsonRpcProvider
  readonly polygon?: unknown; // JsonRpcProvider
}

/**
 * Analytics-specific providers
 */
export interface AnalyticsProviders {
  readonly ethereum?: unknown; // JsonRpcProvider
  readonly polygon?: unknown; // JsonRpcProvider
  readonly solana?: unknown; // Connection
}

/**
 * DeFi Agent specific config
 */
export interface DeFiAgentConfig {
  readonly tenderlyAccessKey?: string;
  readonly tenderlyProject?: string;
  readonly flashbotsRPC?: string;
  readonly defaultSlippage?: number;
}

/**
 * NFT Agent specific config
 */
export interface NFTAgentConfig {
  readonly ipfsGateway?: string;
  readonly pinataAPIKey?: string;
  readonly arweaveWallet?: string;
}

/**
 * Security Agent specific config
 */
export interface SecurityAgentConfig {
  readonly tenderlyAccessKey?: string;
  readonly tenderlyProject?: string;
  readonly etherscanAPIKey?: string;
}

/**
 * Analytics Agent specific config
 */
export interface AnalyticsAgentConfig {
  readonly coingeckoAPIKey?: string;
  readonly defillama?: boolean;
}
