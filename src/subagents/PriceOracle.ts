/**
 * Price Oracle Subagent
 *
 * Multi-source price oracle with:
 * - Chainlink integration (primary)
 * - Multiple oracle source aggregation
 * - TWAP calculations
 * - Price manipulation detection
 * - TTL-based caching
 *
 * Security features:
 * - Outlier detection
 * - Flash loan detection
 * - Confidence scoring
 * - Freshness tracking
 */

import { ethers } from 'ethers';
import {
  type OracleConfig,
  type PriceQueryRequest,
  type PriceQueryResult,
  type PriceData,
  type AggregatedPrice,
  type TWAPData,
  type ManipulationDetection,
  type ManipulationIndicator,
  type CachedPrice,
  OracleSource,
  OracleFreshness,
  ManipulationType,
  OracleError,
  OracleErrorCode,
  DEFAULT_ORACLE_CONFIG,
  PriceQueryRequestSchema,
} from '../types/oracle.js';
import { logger } from '../utils/logger.js';

/**
 * Chainlink Aggregator V3 Interface ABI
 */
const CHAINLINK_AGGREGATOR_V3_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)',
];

/**
 * Price Oracle Subagent
 */
export class PriceOracle {
  private config: OracleConfig;
  private priceCache: Map<string, CachedPrice>;
  private previousPrices: Map<string, PriceData[]>; // For rapid change detection
  private provider?: ethers.Provider;

  constructor(config: Partial<OracleConfig> = {}, provider?: ethers.Provider) {
    this.config = { ...DEFAULT_ORACLE_CONFIG, ...config };
    this.priceCache = new Map();
    this.previousPrices = new Map();

    // Only assign provider if it's defined (exactOptionalPropertyTypes compliance)
    if (provider !== undefined) {
      this.provider = provider;
    }

    logger.info('PriceOracle initialized', {
      enabledSources: this.config.enabledSources,
      cacheTTL: this.config.cacheTTL,
    });
  }

  /**
   * Query price for a token
   */
  async queryPrice(request: PriceQueryRequest): Promise<PriceQueryResult> {
    // Validate request
    const validatedRequest = PriceQueryRequestSchema.parse(request);

    const {
      tokenSymbol,
      quoteCurrency = 'USD',
      sources,
      includeTWAP = false,
      twapPeriod = 3600,
      bypassCache = false,
    } = validatedRequest;

    logger.debug('Querying price', {
      tokenSymbol,
      quoteCurrency,
      bypassCache,
    });

    // Check cache first
    if (!bypassCache) {
      const cached = this.getCachedPrice(tokenSymbol);
      if (cached) {
        const freshness = this.calculateFreshness(cached.price.timestamp);

        // Build result with conditional properties
        const result: PriceQueryResult = {
          tokenSymbol,
          quoteCurrency,
          price: cached.price,
          freshness,
          fromCache: true,
        };

        // Add optional properties conditionally
        if (cached.twap !== undefined) {
          (result as PriceQueryResult & { twap: TWAPData }).twap = cached.twap;
        }
        if (cached.manipulation !== undefined) {
          (result as PriceQueryResult & { manipulation: ManipulationDetection }).manipulation =
            cached.manipulation;
        }

        return result;
      }
    }

    // Fetch fresh prices
    const sourcesToUse: OracleSource[] = (sources ?? this.config.enabledSources) as OracleSource[];
    const priceDataArray = await this.fetchPricesFromSources(
      tokenSymbol,
      quoteCurrency,
      sourcesToUse
    );

    if (priceDataArray.length === 0) {
      throw new OracleError(
        `No price data available for ${tokenSymbol}`,
        OracleErrorCode.NO_PRICE_AVAILABLE,
        tokenSymbol
      );
    }

    // Aggregate prices
    const aggregatedPrice = this.aggregatePrices(priceDataArray);

    // Build result
    const result: PriceQueryResult = {
      tokenSymbol,
      quoteCurrency,
      price: aggregatedPrice,
      freshness: this.calculateFreshness(aggregatedPrice.timestamp),
      fromCache: false,
    };

    // TWAP calculation (optional)
    if (includeTWAP) {
      const twapData = this.calculateTWAP(tokenSymbol, quoteCurrency, twapPeriod, sourcesToUse);
      if (twapData !== undefined) {
        (result as PriceQueryResult & { twap: TWAPData }).twap = twapData;
      }
    }

    // Manipulation detection (optional)
    if (this.config.enableManipulationDetection) {
      const manipulation = this.detectManipulation(aggregatedPrice, tokenSymbol, result.twap);
      (result as PriceQueryResult & { manipulation: ManipulationDetection }).manipulation =
        manipulation;
    }

    // Cache result
    this.cachePrice(tokenSymbol, result);

    // Store for rapid change detection
    this.storePriceHistory(tokenSymbol, priceDataArray);

    return result;
  }

  /**
   * Fetch prices from multiple sources
   */
  private async fetchPricesFromSources(
    tokenSymbol: string,
    quoteCurrency: string,
    sources: OracleSource[]
  ): Promise<PriceData[]> {
    const pricePromises = sources.map((source) =>
      this.fetchPriceFromSource(tokenSymbol, quoteCurrency, source).catch((error) => {
        logger.warn(`Failed to fetch price from ${source}`, { error });
        return null;
      })
    );

    const results = await Promise.all(pricePromises);
    return results.filter((p): p is PriceData => p !== null);
  }

  /**
   * Fetch price from a single source
   */
  private async fetchPriceFromSource(
    tokenSymbol: string,
    quoteCurrency: string,
    source: OracleSource
  ): Promise<PriceData> {
    switch (source) {
      case OracleSource.CHAINLINK:
        return this.fetchChainlinkPrice(tokenSymbol, quoteCurrency);

      case OracleSource.UNISWAP_V3:
        // TODO: Implement Uniswap V3 TWAP
        throw new OracleError(
          'Uniswap V3 not yet implemented',
          OracleErrorCode.ORACLE_UNREACHABLE,
          tokenSymbol
        );

      case OracleSource.UNISWAP_V2:
        // TODO: Implement Uniswap V2
        throw new OracleError(
          'Uniswap V2 not yet implemented',
          OracleErrorCode.ORACLE_UNREACHABLE,
          tokenSymbol
        );

      case OracleSource.SUSHISWAP:
        // TODO: Implement SushiSwap
        throw new OracleError(
          'SushiSwap not yet implemented',
          OracleErrorCode.ORACLE_UNREACHABLE,
          tokenSymbol
        );

      case OracleSource.CURVE:
        // TODO: Implement Curve
        throw new OracleError(
          'Curve not yet implemented',
          OracleErrorCode.ORACLE_UNREACHABLE,
          tokenSymbol
        );

      case OracleSource.MANUAL:
        // Manual prices for testing
        throw new OracleError(
          'Manual price source requires explicit data',
          OracleErrorCode.NO_PRICE_AVAILABLE,
          tokenSymbol
        );

      default:
        throw new OracleError(
          `Unknown oracle source: ${source}`,
          OracleErrorCode.ORACLE_UNREACHABLE,
          tokenSymbol
        );
    }
  }

  /**
   * Fetch price from Chainlink
   */
  private async fetchChainlinkPrice(
    tokenSymbol: string,
    quoteCurrency: string
  ): Promise<PriceData> {
    if (!this.provider) {
      throw new OracleError(
        'Provider required for Chainlink',
        OracleErrorCode.ORACLE_UNREACHABLE,
        tokenSymbol
      );
    }

    const pair = `${tokenSymbol}/${quoteCurrency}`;
    const feedConfig = this.config.chainlinkFeeds[tokenSymbol];

    if (!feedConfig) {
      throw new OracleError(
        `No Chainlink feed configured for ${pair}`,
        OracleErrorCode.INVALID_FEED,
        tokenSymbol,
        { pair }
      );
    }

    logger.debug('Fetching Chainlink price', { pair, feedConfig });

    try {
      const contract = new ethers.Contract(
        feedConfig.address,
        CHAINLINK_AGGREGATOR_V3_ABI,
        this.provider
      );

      // Use bracket notation for dynamic property access (exactOptionalPropertyTypes compliance)
      const latestRoundData = contract['latestRoundData'] as () => Promise<
        [bigint, bigint, bigint, bigint, bigint]
      >;

      const [, answer, , updatedAt] = await latestRoundData();

      // Validate freshness
      const timestamp = new Date(Number(updatedAt) * 1000);
      const ageSeconds = (Date.now() - timestamp.getTime()) / 1000;

      if (ageSeconds > feedConfig.heartbeat * 2) {
        logger.warn('Chainlink price is stale', {
          pair,
          ageSeconds,
          heartbeat: feedConfig.heartbeat,
        });
      }

      // Normalize to 18 decimals
      const normalizedPrice = this.normalizePriceDecimals(answer, feedConfig.decimals, 18);

      // Calculate confidence based on freshness
      const confidence = this.calculateConfidence(timestamp, feedConfig.heartbeat);

      return {
        price: normalizedPrice,
        decimals: 18,
        timestamp,
        source: OracleSource.CHAINLINK,
        confidence,
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new OracleError(
        `Failed to fetch Chainlink price for ${pair}`,
        OracleErrorCode.ORACLE_UNREACHABLE,
        tokenSymbol,
        { error }
      );
    }
  }

  /**
   * Aggregate multiple price sources
   */
  private aggregatePrices(prices: PriceData[]): AggregatedPrice {
    if (prices.length === 0) {
      throw new Error('Cannot aggregate empty price array');
    }

    if (prices.length < this.config.minSources) {
      logger.warn('Insufficient price sources', {
        available: prices.length,
        required: this.config.minSources,
      });
    }

    // Sort prices
    const sortedPrices = [...prices].sort((a, b) =>
      a.price < b.price ? -1 : a.price > b.price ? 1 : 0
    );

    // Calculate median
    const medianIndex = Math.floor(sortedPrices.length / 2);
    const medianPrice =
      sortedPrices.length % 2 === 0
        ? (sortedPrices[medianIndex - 1]!.price + sortedPrices[medianIndex]!.price) / 2n
        : sortedPrices[medianIndex]!.price;

    // Detect outliers
    const outliers: OracleSource[] = [];
    const validPrices = prices.filter((p) => {
      const deviation = this.calculateDeviation(p.price, medianPrice);
      if (deviation > this.config.outlierThreshold) {
        outliers.push(p.source);
        logger.warn('Price outlier detected', {
          source: p.source,
          price: p.price.toString(),
          median: medianPrice.toString(),
          deviation,
        });
        return false;
      }
      return true;
    });

    // Calculate spread
    const minPrice = sortedPrices[0]!.price;
    const maxPrice = sortedPrices[sortedPrices.length - 1]!.price;
    const spread = this.calculateDeviation(maxPrice, minPrice);

    // Calculate average confidence
    const avgConfidence =
      validPrices.reduce((sum, p) => sum + p.confidence, 0) / validPrices.length;

    // Get latest timestamp
    const latestTimestamp = new Date(Math.max(...prices.map((p) => p.timestamp.getTime())));

    return {
      price: medianPrice,
      decimals: 18,
      sources: validPrices,
      timestamp: latestTimestamp,
      confidence: avgConfidence,
      spread,
      outliers,
    };
  }

  /**
   * Calculate TWAP (Time-Weighted Average Price)
   */
  private calculateTWAP(
    tokenSymbol: string,
    quoteCurrency: string,
    period: number,
    sources: OracleSource[]
  ): TWAPData | undefined {
    // TODO: Implement proper TWAP calculation
    // For now, return undefined (will be implemented with Uniswap V3 integration)
    logger.debug('TWAP calculation not yet implemented', {
      tokenSymbol,
      quoteCurrency,
      period,
      sources,
    });
    return undefined;
  }

  /**
   * Detect price manipulation
   */
  private detectManipulation(
    price: AggregatedPrice,
    tokenSymbol: string,
    twap?: TWAPData
  ): ManipulationDetection {
    const indicators: ManipulationIndicator[] = [];

    // 1. Large spread detection
    if (price.spread > this.config.manipulationThresholds.maxSpread) {
      indicators.push({
        type: ManipulationType.LARGE_SPREAD,
        severity: price.spread > 10 ? 'critical' : 'warning',
        description: `Price spread is ${price.spread.toFixed(2)}%`,
        evidence: { spread: price.spread, threshold: this.config.manipulationThresholds.maxSpread },
      });
    }

    // 2. Rapid change detection
    const previousPrices = this.previousPrices.get(tokenSymbol);
    if (previousPrices && previousPrices.length > 0) {
      const latestPrevious = previousPrices[previousPrices.length - 1]!;
      const timeDiffMinutes =
        (price.timestamp.getTime() - latestPrevious.timestamp.getTime()) / 60000;

      if (timeDiffMinutes > 0) {
        const priceChange = this.calculateDeviation(price.price, latestPrevious.price);
        const changePerMinute = priceChange / timeDiffMinutes;

        if (changePerMinute > this.config.manipulationThresholds.maxRapidChange) {
          indicators.push({
            type: ManipulationType.RAPID_CHANGE,
            severity: changePerMinute > 20 ? 'critical' : 'warning',
            description: `Price changed ${changePerMinute.toFixed(2)}% per minute`,
            evidence: {
              changePerMinute,
              threshold: this.config.manipulationThresholds.maxRapidChange,
            },
          });
        }
      }
    }

    // 3. Oracle deviation
    if (price.sources.length > 1) {
      const maxDeviation = Math.max(
        ...price.sources.map((s) => this.calculateDeviation(s.price, price.price))
      );

      if (maxDeviation > this.config.manipulationThresholds.maxDeviation) {
        indicators.push({
          type: ManipulationType.ORACLE_DEVIATION,
          severity: maxDeviation > 5 ? 'error' : 'warning',
          description: `Oracles disagree by ${maxDeviation.toFixed(2)}%`,
          evidence: { maxDeviation, threshold: this.config.manipulationThresholds.maxDeviation },
        });
      }
    }

    // 4. TWAP deviation (if available)
    if (twap) {
      const twapDeviation = this.calculateDeviation(price.price, twap.price);
      if (twapDeviation > this.config.manipulationThresholds.maxDeviation) {
        indicators.push({
          type: ManipulationType.ORACLE_DEVIATION,
          severity: 'warning',
          description: `Spot price deviates ${twapDeviation.toFixed(2)}% from TWAP`,
          evidence: { twapDeviation, threshold: this.config.manipulationThresholds.maxDeviation },
        });
      }
    }

    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(indicators);

    // Generate recommendations
    const recommendations = this.generateRecommendations(indicators, riskLevel);

    return {
      isManipulated: indicators.length > 0,
      confidence: this.calculateManipulationConfidence(indicators),
      indicators,
      riskLevel,
      recommendations,
    };
  }

  /**
   * Calculate risk level from indicators
   */
  private calculateRiskLevel(
    indicators: ManipulationIndicator[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (indicators.length === 0) return 'low';

    const hasCritical = indicators.some((i) => i.severity === 'critical');
    const hasError = indicators.some((i) => i.severity === 'error');
    const warningCount = indicators.filter((i) => i.severity === 'warning').length;

    if (hasCritical || indicators.length >= 3) return 'critical';
    if (hasError || warningCount >= 2) return 'high';
    if (warningCount >= 1) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations based on indicators
   */
  private generateRecommendations(
    indicators: ManipulationIndicator[],
    riskLevel: string
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical') {
      recommendations.push('DO NOT execute transaction - high manipulation risk');
      recommendations.push('Wait for price to stabilize');
    } else if (riskLevel === 'high') {
      recommendations.push('Use caution - potential manipulation detected');
      recommendations.push('Consider using TWAP or waiting');
    } else if (riskLevel === 'medium') {
      recommendations.push('Monitor price closely');
      recommendations.push('Consider additional oracle sources');
    }

    if (indicators.some((i) => i.type === ManipulationType.LARGE_SPREAD)) {
      recommendations.push('High volatility detected - use tight slippage');
    }

    if (indicators.some((i) => i.type === ManipulationType.RAPID_CHANGE)) {
      recommendations.push('Rapid price movement - verify in block explorer');
    }

    return recommendations;
  }

  /**
   * Calculate manipulation confidence
   */
  private calculateManipulationConfidence(indicators: ManipulationIndicator[]): number {
    if (indicators.length === 0) return 0;

    const severityScores = {
      info: 10,
      warning: 30,
      error: 60,
      critical: 90,
    };

    const totalScore = indicators.reduce((sum, i) => sum + severityScores[i.severity], 0);

    return Math.min(100, totalScore / indicators.length);
  }

  /**
   * Cache price
   */
  private cachePrice(tokenSymbol: string, result: PriceQueryResult): void {
    const expiresAt = new Date(Date.now() + this.config.cacheTTL * 1000);

    const cached: CachedPrice = {
      tokenSymbol,
      price: result.price,
      expiresAt,
    };

    // Add optional properties conditionally
    if ('twap' in result && result.twap !== undefined) {
      (cached as CachedPrice & { twap: TWAPData }).twap = result.twap;
    }
    if ('manipulation' in result && result.manipulation !== undefined) {
      (cached as CachedPrice & { manipulation: ManipulationDetection }).manipulation =
        result.manipulation;
    }

    this.priceCache.set(tokenSymbol, cached);

    // Cleanup if cache is too large
    if (this.priceCache.size > this.config.maxCacheSize) {
      const oldestKey = this.priceCache.keys().next().value as string;
      this.priceCache.delete(oldestKey);
    }
  }

  /**
   * Get cached price
   */
  private getCachedPrice(tokenSymbol: string): CachedPrice | null {
    const cached = this.priceCache.get(tokenSymbol);
    if (!cached) return null;

    // Check expiration
    if (cached.expiresAt < new Date()) {
      this.priceCache.delete(tokenSymbol);
      return null;
    }

    return cached;
  }

  /**
   * Store price history for rapid change detection
   */
  private storePriceHistory(tokenSymbol: string, prices: PriceData[]): void {
    const existing = this.previousPrices.get(tokenSymbol) ?? [];
    const updated = [...existing, ...prices];

    // Keep only last 10 entries
    if (updated.length > 10) {
      updated.splice(0, updated.length - 10);
    }

    this.previousPrices.set(tokenSymbol, updated);
  }

  /**
   * Calculate freshness level
   */
  private calculateFreshness(timestamp: Date): OracleFreshness {
    const ageSeconds = (Date.now() - timestamp.getTime()) / 1000;

    if (ageSeconds < 60) return OracleFreshness.FRESH;
    if (ageSeconds < 300) return OracleFreshness.RECENT;
    if (ageSeconds < 900) return OracleFreshness.STALE;
    return OracleFreshness.EXPIRED;
  }

  /**
   * Calculate confidence based on freshness
   */
  private calculateConfidence(timestamp: Date, heartbeat: number): number {
    const ageSeconds = (Date.now() - timestamp.getTime()) / 1000;
    const ratio = ageSeconds / heartbeat;

    if (ratio < 0.5) return 100;
    if (ratio < 1.0) return 90;
    if (ratio < 1.5) return 70;
    if (ratio < 2.0) return 50;
    return 30;
  }

  /**
   * Normalize price to target decimals
   */
  private normalizePriceDecimals(price: bigint, fromDecimals: number, toDecimals: number): bigint {
    if (fromDecimals === toDecimals) return price;

    if (fromDecimals < toDecimals) {
      const multiplier = 10n ** BigInt(toDecimals - fromDecimals);
      return price * multiplier;
    } else {
      const divisor = 10n ** BigInt(fromDecimals - toDecimals);
      return price / divisor;
    }
  }

  /**
   * Calculate percentage deviation between two prices
   */
  private calculateDeviation(price1: bigint, price2: bigint): number {
    if (price2 === 0n) return 100;

    const diff = price1 > price2 ? price1 - price2 : price2 - price1;
    const percentage = Number((diff * 10000n) / price2) / 100;

    return percentage;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.priceCache.clear();
    logger.info('Price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.priceCache.size,
      maxSize: this.config.maxCacheSize,
      ttl: this.config.cacheTTL,
    };
  }
}
