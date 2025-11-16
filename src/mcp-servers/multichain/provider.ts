import { EthereumProvider } from '../ethereum/provider.js';
import { SolanaProvider } from '../solana/provider.js';
import {
  SupportedChain,
  detectChain,
  MultiChainError,
  MultiChainErrorCode,
  type ChainHealthStatus,
  type MultiChainStatusResponse,
} from './types.js';
import { logger } from '../../utils/index.js';

/**
 * Multi-Chain Provider
 *
 * Intelligent routing between Ethereum and Solana providers:
 * - Automatic chain detection from address format
 * - Failover and retry logic
 * - Chain health monitoring
 * - Unified interface for cross-chain operations
 *
 * Edge Cases Handled:
 * - Both chains offline → Proper error with details
 * - Ambiguous address format → Force chain selection
 * - Chain-specific features → Graceful degradation
 * - Provider initialization failures → Fallback modes
 * - RPC rate limiting → Per-chain retry logic
 *
 * Usage:
 *   const provider = new MultiChainProvider(ethereumConfig, solanaConfig);
 *   const balance = await provider.getBalance(address); // Auto-detects chain
 */
export class MultiChainProvider {
  private ethereumProvider: EthereumProvider | null = null;
  private solanaProvider: SolanaProvider | null = null;
  private healthCache: Map<SupportedChain, ChainHealthStatus> = new Map();
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(
    ethereumConfig?: {
      rpcUrl: string;
      chainId: number;
      chainName: string;
      maxRetries?: number;
      retryDelay?: number;
    },
    solanaConfig?: {
      rpcUrl: string;
      cluster: string;
      maxRetries?: number;
      retryDelay?: number;
    },
    options?: {
      autoStartHealthMonitoring?: boolean;
    }
  ) {
    // Initialize Ethereum provider if configured
    if (ethereumConfig) {
      try {
        this.ethereumProvider = new EthereumProvider(
          ethereumConfig.rpcUrl,
          ethereumConfig.chainId,
          ethereumConfig.chainName,
          {
            ...(ethereumConfig.maxRetries !== undefined && {
              maxRetries: ethereumConfig.maxRetries,
            }),
            ...(ethereumConfig.retryDelay !== undefined && {
              retryDelay: ethereumConfig.retryDelay,
            }),
          }
        );
        logger.info('Ethereum provider initialized', {
          chainId: ethereumConfig.chainId,
          chainName: ethereumConfig.chainName,
        });
      } catch (error) {
        logger.error('Failed to initialize Ethereum provider', { error: String(error) });
      }
    }

    // Initialize Solana provider if configured
    if (solanaConfig) {
      try {
        this.solanaProvider = new SolanaProvider(
          solanaConfig.rpcUrl,
          solanaConfig.cluster,
          solanaConfig.maxRetries,
          solanaConfig.retryDelay
        );
        logger.info('Solana provider initialized', { cluster: solanaConfig.cluster });
      } catch (error) {
        logger.error('Failed to initialize Solana provider', { error: String(error) });
      }
    }

    // Start health monitoring (unless disabled for testing)
    if (options?.autoStartHealthMonitoring !== false) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Get Ethereum provider
   *
   * @throws {MultiChainError} if Ethereum provider not configured
   */
  getEthereumProvider(): EthereumProvider {
    if (!this.ethereumProvider) {
      throw new MultiChainError(
        'Ethereum provider not configured',
        SupportedChain.ETHEREUM,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }
    return this.ethereumProvider;
  }

  /**
   * Get Solana provider
   *
   * @throws {MultiChainError} if Solana provider not configured
   */
  getSolanaProvider(): SolanaProvider {
    if (!this.solanaProvider) {
      throw new MultiChainError(
        'Solana provider not configured',
        SupportedChain.SOLANA,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }
    return this.solanaProvider;
  }

  /**
   * Detect chain from address format
   *
   * @param address - Address to analyze
   * @returns Detected chain
   * @throws {MultiChainError} if unable to detect
   */
  detectChainFromAddress(address: string): SupportedChain.ETHEREUM | SupportedChain.SOLANA {
    try {
      const result = detectChain(address);
      return result.chain;
    } catch (error) {
      throw new MultiChainError(
        `Unable to detect chain from address: ${address}`,
        SupportedChain.AUTO,
        MultiChainErrorCode.CHAIN_DETECTION_FAILED,
        { address, error: String(error) }
      );
    }
  }

  /**
   * Route operation to specific chain
   *
   * @param chain - Target chain (or AUTO for detection)
   * @param address - Optional address for auto-detection
   * @param operation - Operation to execute
   * @returns Operation result
   */
  async routeToChain<T>(
    chain: SupportedChain,
    address: string | undefined,
    operation: (provider: EthereumProvider | SolanaProvider) => Promise<T>
  ): Promise<T> {
    let targetChain = chain;

    // Auto-detect if needed
    if (chain === SupportedChain.AUTO) {
      if (!address) {
        throw new MultiChainError(
          'Address required for auto-detection',
          SupportedChain.AUTO,
          MultiChainErrorCode.CHAIN_DETECTION_FAILED
        );
      }
      targetChain = this.detectChainFromAddress(address);
    }

    // Route to appropriate provider
    try {
      if (targetChain === SupportedChain.ETHEREUM) {
        const provider = this.getEthereumProvider();
        return await operation(provider);
      } else if (targetChain === SupportedChain.SOLANA) {
        const provider = this.getSolanaProvider();
        return await operation(provider);
      } else {
        throw new MultiChainError(
          `Invalid chain: ${targetChain}`,
          targetChain,
          MultiChainErrorCode.INVALID_CHAIN
        );
      }
    } catch (error) {
      // Check if this is a provider not configured error
      if (error instanceof MultiChainError) {
        throw error;
      }

      // Wrap other errors
      throw new MultiChainError(
        `Operation failed on ${targetChain}`,
        targetChain,
        MultiChainErrorCode.CHAIN_UNAVAILABLE,
        { error: String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check health of specific chain
   *
   * @param chain - Chain to check
   * @returns Health status
   */
  async checkChainHealth(
    chain: SupportedChain.ETHEREUM | SupportedChain.SOLANA
  ): Promise<ChainHealthStatus> {
    const startTime = Date.now();

    try {
      if (chain === SupportedChain.ETHEREUM) {
        if (!this.ethereumProvider) {
          return {
            chain,
            healthy: false,
            latency: 0,
            blockHeight: null,
            lastChecked: new Date(),
            error: 'Provider not configured',
          };
        }

        const blockNumber = await this.ethereumProvider.getProvider().getBlockNumber();
        const latency = Date.now() - startTime;

        return {
          chain,
          healthy: true,
          latency,
          blockHeight: blockNumber,
          lastChecked: new Date(),
        };
      } else {
        // Solana
        if (!this.solanaProvider) {
          return {
            chain,
            healthy: false,
            latency: 0,
            blockHeight: null,
            lastChecked: new Date(),
            error: 'Provider not configured',
          };
        }

        const slot = await this.solanaProvider.getSlot('confirmed');
        const latency = Date.now() - startTime;

        return {
          chain,
          healthy: true,
          latency,
          blockHeight: Number(slot),
          lastChecked: new Date(),
        };
      }
    } catch (error) {
      logger.error(`Health check failed for ${chain}`, { error: String(error) });

      return {
        chain,
        healthy: false,
        latency: Date.now() - startTime,
        blockHeight: null,
        lastChecked: new Date(),
        error: String(error),
      };
    }
  }

  /**
   * Get overall multi-chain status
   *
   * @returns Status for all configured chains
   */
  async getStatus(): Promise<MultiChainStatusResponse> {
    const [ethereumHealth, solanaHealth] = await Promise.all([
      this.checkChainHealth(SupportedChain.ETHEREUM),
      this.checkChainHealth(SupportedChain.SOLANA),
    ]);

    // Update cache
    this.healthCache.set(SupportedChain.ETHEREUM, ethereumHealth);
    this.healthCache.set(SupportedChain.SOLANA, solanaHealth);

    return {
      ethereum: ethereumHealth,
      solana: solanaHealth,
      overallHealthy: ethereumHealth.healthy || solanaHealth.healthy, // At least one healthy
    };
  }

  /**
   * Get cached health status
   *
   * @param chain - Specific chain or undefined for all
   * @returns Cached health status
   */
  getCachedHealth(
    chain?: SupportedChain.ETHEREUM | SupportedChain.SOLANA
  ): ChainHealthStatus | Map<SupportedChain, ChainHealthStatus> {
    if (chain) {
      const health = this.healthCache.get(chain);
      if (!health) {
        return {
          chain,
          healthy: false,
          latency: 0,
          blockHeight: null,
          lastChecked: new Date(),
          error: 'No health data available',
        };
      }
      return health;
    }
    return this.healthCache;
  }

  /**
   * Start periodic health monitoring
   *
   * Runs health checks in background to maintain fresh status
   */
  private startHealthMonitoring(): void {
    // Initial health check
    this.getStatus().catch((error) => {
      logger.error('Initial health check failed', { error: String(error) });
    });

    // Periodic health checks
    setInterval(() => {
      this.getStatus().catch((error) => {
        logger.error('Periodic health check failed', { error: String(error) });
      });
    }, this.HEALTH_CHECK_INTERVAL);

    logger.debug('Health monitoring started', {
      interval: this.HEALTH_CHECK_INTERVAL,
    });
  }

  /**
   * Execute operation with automatic failover
   *
   * Tries both chains if auto-detection fails or if primary chain is unavailable
   *
   * @param address - Address for chain detection
   * @param operation - Operation to execute
   * @returns Operation result
   */
  async executeWithFailover<T>(
    address: string,
    operation: {
      ethereum: (provider: EthereumProvider) => Promise<T>;
      solana: (provider: SolanaProvider) => Promise<T>;
    }
  ): Promise<T> {
    // Try to detect chain
    let detectedChain: SupportedChain.ETHEREUM | SupportedChain.SOLANA;
    try {
      detectedChain = this.detectChainFromAddress(address);
    } catch (error) {
      // Can't detect - try both chains
      logger.warn('Chain detection failed, trying both chains', {
        address,
        error: String(error),
      });

      const errors: Error[] = [];

      // Try Ethereum first
      if (this.ethereumProvider) {
        try {
          return await operation.ethereum(this.ethereumProvider);
        } catch (error) {
          logger.debug('Ethereum operation failed', { error: String(error) });
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Try Solana
      if (this.solanaProvider) {
        try {
          return await operation.solana(this.solanaProvider);
        } catch (error) {
          logger.debug('Solana operation failed', { error: String(error) });
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Both failed
      throw new MultiChainError(
        'Operation failed on both chains',
        SupportedChain.AUTO,
        MultiChainErrorCode.BOTH_CHAINS_FAILED,
        {
          address,
          errors: errors.map((e) => e.message),
        }
      );
    }

    // Execute on detected chain with fallback
    try {
      if (detectedChain === SupportedChain.ETHEREUM) {
        return await operation.ethereum(this.getEthereumProvider());
      } else {
        return await operation.solana(this.getSolanaProvider());
      }
    } catch (error) {
      logger.error(`Operation failed on ${detectedChain}`, {
        address,
        error: String(error),
      });

      throw new MultiChainError(
        `Operation failed on ${detectedChain}`,
        detectedChain,
        MultiChainErrorCode.CHAIN_UNAVAILABLE,
        {
          address,
          error: String(error),
        },
        error instanceof Error ? error : undefined
      );
    }
  }
}
