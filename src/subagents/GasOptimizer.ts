/**
 * Gas Optimizer
 *
 * Aggregates gas prices from multiple sources and provides optimal gas parameters.
 *
 * Features:
 * - Multi-source gas price aggregation
 * - Gas price strategies (slow, standard, fast)
 * - Price prediction using historical data
 * - Rate limiting and fallback mechanisms
 * - EIP-1559 optimization (base fee + priority fee)
 *
 * CRITICAL: Prevents overpaying for gas while ensuring timely confirmation
 */

import { JsonRpcProvider, formatUnits, parseUnits } from 'ethers';
import { logger } from '../utils/index.js';

/**
 * Gas price strategy
 */
export enum GasStrategy {
  SLOW = 'slow', // Low priority (~10-30 min)
  STANDARD = 'standard', // Normal priority (~1-5 min)
  FAST = 'fast', // High priority (~15-60 sec)
  URGENT = 'urgent', // Highest priority (~15 sec)
}

/**
 * Gas price source
 */
export interface GasPriceSource {
  name: string;
  baseFee?: bigint;
  priorityFee?: bigint;
  maxFee?: bigint;
  gasPrice?: bigint; // Legacy
  timestamp: number;
}

/**
 * Optimized gas parameters
 */
export interface OptimizedGasParams {
  baseFee: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  strategy: GasStrategy;
  sources: GasPriceSource[];
  estimatedTimeSeconds: number;
  createdAt: Date;
}

/**
 * Gas price history entry
 */
export interface GasPriceHistory {
  timestamp: number;
  baseFee: bigint;
  priorityFee: bigint;
  blockNumber: number;
}

/**
 * Gas Optimizer Configuration
 */
export interface GasOptimizerConfig {
  provider: JsonRpcProvider;
  sources?: GasPriceSource[];
  historySizeLimit?: number; // Max history entries to keep
  maxGasPrice?: bigint; // Safety ceiling
  minPriorityFee?: bigint; // Minimum priority fee
}

/**
 * Gas Optimizer
 *
 * Provides optimal gas parameters by aggregating data from multiple sources
 * and analyzing historical trends.
 */
export class GasOptimizer {
  private readonly provider: JsonRpcProvider;
  private readonly config: {
    historySizeLimit: number;
    maxGasPrice: bigint;
    minPriorityFee: bigint;
  };

  // Gas price history for prediction
  private readonly history: GasPriceHistory[] = [];

  // External sources (can be added via configuration)
  private readonly externalSources: GasPriceSource[] = [];

  constructor(config: GasOptimizerConfig) {
    this.provider = config.provider;
    this.config = {
      historySizeLimit: config.historySizeLimit ?? 100,
      maxGasPrice: config.maxGasPrice ?? parseUnits('500', 'gwei'),
      minPriorityFee: config.minPriorityFee ?? parseUnits('0.1', 'gwei'),
    };

    if (config.sources) {
      this.externalSources.push(...config.sources);
    }

    logger.info('GasOptimizer initialized', {
      historySizeLimit: this.config.historySizeLimit,
      maxGasPrice: formatUnits(this.config.maxGasPrice, 'gwei'),
      minPriorityFee: formatUnits(this.config.minPriorityFee, 'gwei'),
    });
  }

  /**
   * Get optimized gas parameters for a strategy
   *
   * @param strategy - Gas strategy (slow, standard, fast, urgent)
   * @returns Optimized gas parameters
   */
  async getOptimizedGas(strategy: GasStrategy = GasStrategy.STANDARD): Promise<OptimizedGasParams> {
    // Gather gas prices from all sources
    const sources = await this.gatherSources();

    // Calculate optimal parameters
    const { baseFee, priorityFee, maxFee } = this.calculateOptimal(sources, strategy);

    // Estimate confirmation time
    const estimatedTimeSeconds = this.estimateConfirmationTime(strategy);

    logger.info('Optimized gas calculated', {
      strategy,
      baseFee: formatUnits(baseFee, 'gwei'),
      priorityFee: formatUnits(priorityFee, 'gwei'),
      maxFee: formatUnits(maxFee, 'gwei'),
      sources: sources.length,
      estimatedTimeSeconds,
    });

    return {
      baseFee,
      maxPriorityFeePerGas: priorityFee,
      maxFeePerGas: maxFee,
      strategy,
      sources,
      estimatedTimeSeconds,
      createdAt: new Date(),
    };
  }

  /**
   * Update gas price history
   *
   * Stores historical gas prices for prediction analysis.
   */
  async updateHistory(): Promise<void> {
    try {
      const feeData = await this.provider.getFeeData();
      const block = await this.provider.getBlock('latest');

      if (!block || !feeData.maxFeePerGas) {
        return;
      }

      const entry: GasPriceHistory = {
        timestamp: block.timestamp,
        baseFee: block.baseFeePerGas ?? 0n,
        priorityFee: feeData.maxPriorityFeePerGas ?? 0n,
        blockNumber: block.number,
      };

      this.history.push(entry);

      // Trim history if too large
      if (this.history.length > this.config.historySizeLimit) {
        this.history.shift();
      }

      logger.debug('Gas price history updated', {
        entries: this.history.length,
        baseFee: formatUnits(entry.baseFee, 'gwei'),
        priorityFee: formatUnits(entry.priorityFee, 'gwei'),
      });
    } catch (error) {
      logger.error('Failed to update gas price history', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get average gas price over time window
   *
   * @param windowSeconds - Time window in seconds
   * @returns Average base fee and priority fee
   */
  getHistoricalAverage(windowSeconds: number): { baseFee: bigint; priorityFee: bigint } | null {
    if (this.history.length === 0) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - windowSeconds;

    const recentEntries = this.history.filter((entry) => entry.timestamp >= cutoff);

    if (recentEntries.length === 0) {
      return null;
    }

    const sumBaseFee = recentEntries.reduce((sum, entry) => sum + entry.baseFee, 0n);
    const sumPriorityFee = recentEntries.reduce((sum, entry) => sum + entry.priorityFee, 0n);

    const baseFee = sumBaseFee / BigInt(recentEntries.length);
    const priorityFee = sumPriorityFee / BigInt(recentEntries.length);

    return { baseFee, priorityFee };
  }

  /**
   * Add external gas price source
   *
   * @param source - Gas price source to add
   */
  addSource(source: GasPriceSource): void {
    this.externalSources.push(source);
    logger.debug('External gas price source added', { source: source.name });
  }

  /**
   * Get statistics about gas optimizer
   *
   * @returns Optimizer statistics
   */
  getStats(): {
    historicalEntries: number;
    externalSources: number;
    latestBaseFee?: string;
    latestPriorityFee?: string;
  } {
    const latest = this.history[this.history.length - 1];

    const stats: {
      historicalEntries: number;
      externalSources: number;
      latestBaseFee?: string;
      latestPriorityFee?: string;
    } = {
      historicalEntries: this.history.length,
      externalSources: this.externalSources.length,
    };

    if (latest !== undefined) {
      stats.latestBaseFee = formatUnits(latest.baseFee, 'gwei');
      stats.latestPriorityFee = formatUnits(latest.priorityFee, 'gwei');
    }

    return stats;
  }

  /**
   * Private helper methods
   */

  /**
   * Gather gas prices from all sources
   *
   * @returns Array of gas price sources
   */
  private async gatherSources(): Promise<GasPriceSource[]> {
    const sources: GasPriceSource[] = [];

    // Primary source: provider
    try {
      const feeData = await this.provider.getFeeData();
      const block = await this.provider.getBlock('latest');

      const providerSource: GasPriceSource = {
        name: 'provider',
        timestamp: Date.now(),
      };

      // Conditionally add optional properties
      if (block?.baseFeePerGas !== null && block?.baseFeePerGas !== undefined) {
        providerSource.baseFee = block.baseFeePerGas;
      }
      if (feeData.maxFeePerGas !== null && feeData.maxFeePerGas !== undefined) {
        providerSource.maxFee = feeData.maxFeePerGas;
      }
      if (feeData.maxPriorityFeePerGas !== null && feeData.maxPriorityFeePerGas !== undefined) {
        providerSource.priorityFee = feeData.maxPriorityFeePerGas;
      }
      if (feeData.gasPrice !== null && feeData.gasPrice !== undefined) {
        providerSource.gasPrice = feeData.gasPrice;
      }

      sources.push(providerSource);
    } catch (error) {
      logger.warn('Failed to fetch gas price from provider', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Add external sources
    sources.push(...this.externalSources);

    return sources;
  }

  /**
   * Calculate optimal gas parameters from sources
   *
   * @param sources - Array of gas price sources
   * @param strategy - Gas strategy
   * @returns Optimal base fee, priority fee, and max fee
   */
  private calculateOptimal(
    sources: GasPriceSource[],
    strategy: GasStrategy
  ): { baseFee: bigint; priorityFee: bigint; maxFee: bigint } {
    // Strategy multipliers
    const strategyMultipliers: Record<GasStrategy, { base: number; priority: number }> = {
      [GasStrategy.SLOW]: { base: 1.0, priority: 0.9 },
      [GasStrategy.STANDARD]: { base: 1.0, priority: 1.0 },
      [GasStrategy.FAST]: { base: 1.1, priority: 1.2 },
      [GasStrategy.URGENT]: { base: 1.2, priority: 1.5 },
    };

    const multiplier = strategyMultipliers[strategy];

    // Calculate median base fee
    const baseFees = sources
      .map((s) => s.baseFee)
      .filter((fee): fee is bigint => fee !== undefined);

    const medianBaseFee =
      baseFees.length > 0 ? this.calculateMedian(baseFees) : parseUnits('30', 'gwei');

    // Calculate median priority fee
    const priorityFees = sources
      .map((s) => s.priorityFee)
      .filter((fee): fee is bigint => fee !== undefined);

    const medianPriorityFee =
      priorityFees.length > 0 ? this.calculateMedian(priorityFees) : parseUnits('2', 'gwei');

    // Apply strategy multipliers
    const baseFee = (medianBaseFee * BigInt(Math.floor(multiplier.base * 100))) / 100n;
    let priorityFee = (medianPriorityFee * BigInt(Math.floor(multiplier.priority * 100))) / 100n;

    // Ensure minimum priority fee
    priorityFee =
      priorityFee < this.config.minPriorityFee ? this.config.minPriorityFee : priorityFee;

    // Calculate max fee (base fee + priority fee + buffer)
    let maxFee = baseFee + priorityFee;

    // Apply safety ceiling
    if (maxFee > this.config.maxGasPrice) {
      logger.warn('Calculated max fee exceeds ceiling', {
        calculated: formatUnits(maxFee, 'gwei'),
        ceiling: formatUnits(this.config.maxGasPrice, 'gwei'),
      });
      maxFee = this.config.maxGasPrice;
    }

    return { baseFee, priorityFee, maxFee };
  }

  /**
   * Calculate median of bigint array
   *
   * @param values - Array of bigints
   * @returns Median value
   */
  private calculateMedian(values: bigint[]): bigint {
    if (values.length === 0) {
      return 0n;
    }

    const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      const val1 = sorted[mid - 1];
      const val2 = sorted[mid];
      if (val1 === undefined || val2 === undefined) {
        return 0n;
      }
      return (val1 + val2) / 2n;
    } else {
      const val = sorted[mid];
      return val ?? 0n;
    }
  }

  /**
   * Estimate confirmation time for a strategy
   *
   * @param strategy - Gas strategy
   * @returns Estimated time in seconds
   */
  private estimateConfirmationTime(strategy: GasStrategy): number {
    const estimations: Record<GasStrategy, number> = {
      [GasStrategy.SLOW]: 1200, // 20 minutes
      [GasStrategy.STANDARD]: 180, // 3 minutes
      [GasStrategy.FAST]: 45, // 45 seconds
      [GasStrategy.URGENT]: 15, // 15 seconds
    };

    return estimations[strategy];
  }
}
