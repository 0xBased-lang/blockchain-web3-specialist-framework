/**
 * Analytics Agent
 *
 * Specialized agent for blockchain analytics:
 * - Portfolio tracking across chains
 * - Transaction history analysis
 * - Gas usage statistics
 * - Token price history
 * - Performance reporting
 * - Portfolio allocation comparison
 *
 * Integrates with:
 * - PriceOracle (price feeds and history)
 */

import { JsonRpcProvider } from 'ethers';
import { Connection } from '@solana/web3.js';
import { SpecializedAgentBase } from './SpecializedAgentBase.js';
import { PriceOracle } from '../subagents/PriceOracle.js';
import type {
  Task,
  TaskPlan,
  Result,
  ValidationResult,
  Step,
  AgentConfig,
} from '../types/agent.js';
import type {
  PortfolioParams,
  PortfolioSummary,
  TransactionAnalysisParams,
  TransactionStats,
  GasAnalysisParams,
  GasStats,
  PriceHistoryParams,
  PriceHistory,
  PerformanceReportParams,
  PerformanceReport,
  AnalyticsAgentConfig,
  AnalyticsTaskType,
  PortfolioAsset,
} from '../types/specialized-agents.js';
import { logger } from '../utils/index.js';

/**
 * Providers for analytics operations
 */
export interface AnalyticsProviders {
  ethereum?: JsonRpcProvider;
  polygon?: JsonRpcProvider;
  solana?: Connection;
}

/**
 * Analytics Agent
 *
 * Handles all analytics-related operations with multi-chain support.
 */
export class AnalyticsAgent extends SpecializedAgentBase {
  private readonly _providers: AnalyticsProviders;
  private readonly _analyticsConfig: AnalyticsAgentConfig;
  private readonly _priceOracle: PriceOracle;

  constructor(
    config: AgentConfig,
    providers: AnalyticsProviders,
    analyticsConfig: AnalyticsAgentConfig = {}
  ) {
    super(config);

    this._providers = providers;
    this._analyticsConfig = analyticsConfig;

    // Initialize subagents
    const primaryProvider = providers.ethereum || providers.polygon;

    this._priceOracle = new PriceOracle({}, primaryProvider);

    logger.info('AnalyticsAgent initialized', {
      id: this.id,
      chains: Object.keys(providers),
    });
  }

  /**
   * ========================================================================
   * DOMAIN-SPECIFIC METHODS
   * ========================================================================
   */

  /**
   * Get portfolio summary
   *
   * @param params - Portfolio parameters
   * @returns Portfolio summary
   */
  async getPortfolio(params: PortfolioParams): Promise<PortfolioSummary> {
    try {
      const result = await this.executeDomainTask<PortfolioSummary>(
        'analytics_get_portfolio',
        params as unknown as Record<string, unknown>
      );
      return result;
    } catch (error) {
      logger.error('getPortfolio failed', { error, params });
      throw error;
    }
  }

  /**
   * Analyze transaction history
   *
   * @param params - Analysis parameters
   * @returns Transaction statistics
   */
  async analyzeTransactions(params: TransactionAnalysisParams): Promise<TransactionStats> {
    try {
      const result = await this.executeDomainTask<TransactionStats>(
        'analytics_analyze_tx',
        params as unknown as Record<string, unknown>
      );
      return result;
    } catch (error) {
      logger.error('analyzeTransactions failed', { error, params });
      throw error;
    }
  }

  /**
   * Analyze gas usage
   *
   * @param params - Gas analysis parameters
   * @returns Gas statistics
   */
  async analyzeGasUsage(params: GasAnalysisParams): Promise<GasStats> {
    try {
      const result = await this.executeDomainTask<GasStats>(
        'analytics_gas_analysis',
        params as unknown as Record<string, unknown>
      );
      return result;
    } catch (error) {
      logger.error('analyzeGasUsage failed', { error, params });
      throw error;
    }
  }

  /**
   * Get token price history
   *
   * @param params - Price history parameters
   * @returns Price history
   */
  async getPriceHistory(params: PriceHistoryParams): Promise<PriceHistory> {
    try {
      const result = await this.executeDomainTask<PriceHistory>(
        'analytics_price_history',
        params as unknown as Record<string, unknown>
      );
      return result;
    } catch (error) {
      logger.error('getPriceHistory failed', { error, params });
      throw error;
    }
  }

  /**
   * Generate performance report
   *
   * @param params - Report parameters
   * @returns Performance report
   */
  async generatePerformanceReport(
    params: PerformanceReportParams
  ): Promise<PerformanceReport> {
    try {
      const result = await this.executeDomainTask<PerformanceReport>(
        'analytics_performance',
        params as unknown as Record<string, unknown>
      );
      return result;
    } catch (error) {
      logger.error('generatePerformanceReport failed', { error, params });
      throw error;
    }
  }

  /**
   * Compare portfolio allocation
   *
   * @param current - Current portfolio
   * @param target - Target allocation
   * @returns Comparison result
   */
  async compareAllocation(
    current: PortfolioSummary,
    target: Record<string, number>
  ): Promise<{ differences: Array<{ token: string; currentPercent: number; targetPercent: number; diff: number }> }> {
    try {
      const result = await this.executeDomainTask<{
        differences: Array<{
          token: string;
          currentPercent: number;
          targetPercent: number;
          diff: number;
        }>;
      }>('analytics_compare_allocation', { current, target } as unknown as Record<string, unknown>);
      return result;
    } catch (error) {
      logger.error('compareAllocation failed', { error });
      throw error;
    }
  }

  /**
   * ========================================================================
   * BASE AGENT IMPLEMENTATION
   * ========================================================================
   */

  /**
   * Plan task execution
   *
   * @param task - Task to plan
   * @returns Task plan
   */
  async plan(task: Task): Promise<TaskPlan> {
    logger.info(`AnalyticsAgent planning task: ${task.type}`, { taskId: task.id });

    const taskType = task.type as AnalyticsTaskType;

    switch (taskType) {
      case 'analytics_get_portfolio':
        return this.planGetPortfolio(task);
      case 'analytics_analyze_tx':
        return this.planAnalyzeTransactions(task);
      case 'analytics_gas_analysis':
        return this.planGasAnalysis(task);
      case 'analytics_price_history':
        return this.planPriceHistory(task);
      case 'analytics_performance':
        return this.planPerformanceReport(task);
      case 'analytics_compare_allocation':
        return this.planCompareAllocation(task);
      default:
        throw new Error(`Unknown Analytics task type: ${task.type}`);
    }
  }

  /**
   * Plan get portfolio task
   */
  private planGetPortfolio(task: Task): TaskPlan {
    const params = task.params as unknown as PortfolioParams;
    const stepPrefix = task.id;

    const steps: Step[] = [
      // Step 1: Fetch balances across all chains
      this.createStep(
        `${stepPrefix}-fetch-balances`,
        'fetch_multi_chain_balances',
        { address: params.address, chains: params.chains },
        [],
        15000
      ),

      // Step 2: Get current prices for all tokens
      this.createStep(
        `${stepPrefix}-fetch-prices`,
        'fetch_token_prices',
        {},
        [`${stepPrefix}-fetch-balances`],
        10000
      ),

      // Step 3: Calculate portfolio totals and percentages
      this.createStep(
        `${stepPrefix}-calculate-summary`,
        'calculate_portfolio_summary',
        { includeNFTs: params.includeNFTs },
        [`${stepPrefix}-fetch-prices`],
        5000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: this.buildDependencies(steps),
      estimatedTime: steps.reduce((sum, s) => sum + s.timeout, 0),
      requiredResources: params.chains.map((chain) => ({
        type: 'rpc' as const,
        name: `${chain}-rpc`,
        required: true,
      })),
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan analyze transactions task
   */
  private planAnalyzeTransactions(task: Task): TaskPlan {
    const params = task.params as unknown as TransactionAnalysisParams;
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-fetch-txs`,
        'fetch_transaction_history',
        params as unknown as Record<string, unknown>,
        [],
        20000
      ),

      this.createStep(
        `${stepPrefix}-analyze`,
        'analyze_transaction_patterns',
        {},
        [`${stepPrefix}-fetch-txs`],
        10000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: this.buildDependencies(steps),
      estimatedTime: steps.reduce((sum, s) => sum + s.timeout, 0),
      requiredResources: [
        { type: 'rpc', name: `${params.chain}-rpc`, required: true },
      ],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan gas analysis task
   */
  private planGasAnalysis(task: Task): TaskPlan {
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-fetch-gas-data`,
        'fetch_gas_usage_data',
        task.params,
        [],
        15000
      ),

      this.createStep(
        `${stepPrefix}-calculate-stats`,
        'calculate_gas_statistics',
        {},
        [`${stepPrefix}-fetch-gas-data`],
        5000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: this.buildDependencies(steps),
      estimatedTime: steps.reduce((sum, s) => sum + s.timeout, 0),
      requiredResources: [{ type: 'rpc', name: 'ethereum-rpc', required: true }],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan price history task
   */
  private planPriceHistory(task: Task): TaskPlan {
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-fetch-history`,
        'fetch_price_history_data',
        task.params,
        [],
        15000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: [],
      estimatedTime: 15000,
      requiredResources: [{ type: 'api', name: 'price-feed', required: true }],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan performance report task
   */
  private planPerformanceReport(task: Task): TaskPlan {
    const params = task.params as unknown as PerformanceReportParams;
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-fetch-historical-portfolio`,
        'fetch_historical_portfolio_data',
        params as unknown as Record<string, unknown>,
        [],
        20000
      ),

      this.createStep(
        `${stepPrefix}-calculate-returns`,
        'calculate_returns_and_performance',
        {},
        [`${stepPrefix}-fetch-historical-portfolio`],
        10000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: this.buildDependencies(steps),
      estimatedTime: steps.reduce((sum, s) => sum + s.timeout, 0),
      requiredResources: params.chains.map((chain) => ({
        type: 'rpc' as const,
        name: `${chain}-rpc`,
        required: true,
      })),
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan compare allocation task
   */
  private planCompareAllocation(task: Task): TaskPlan {
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-compare`,
        'compare_allocations',
        task.params,
        [],
        5000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: [],
      estimatedTime: 5000,
      requiredResources: [],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Execute a single step
   *
   * @param step - Step to execute
   * @param previousResults - Results from previous steps
   * @returns Step execution result
   */
  protected async executeStep(
    step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result> {
    logger.debug(`Executing Analytics step: ${step.action}`, { stepId: step.id });

    try {
      switch (step.action) {
        case 'fetch_multi_chain_balances':
          return await this.stepFetchMultiChainBalances(step);

        case 'fetch_token_prices':
          return await this.stepFetchTokenPrices(step, previousResults);

        case 'calculate_portfolio_summary':
          return await this.stepCalculatePortfolioSummary(step, previousResults);

        case 'fetch_transaction_history':
          return await this.stepFetchTransactionHistory(step);

        case 'analyze_transaction_patterns':
          return await this.stepAnalyzeTransactionPatterns(step, previousResults);

        case 'fetch_gas_usage_data':
          return await this.stepFetchGasUsageData(step);

        case 'calculate_gas_statistics':
          return await this.stepCalculateGasStatistics(step, previousResults);

        case 'fetch_price_history_data':
          return await this.stepFetchPriceHistoryData(step);

        case 'fetch_historical_portfolio_data':
          return await this.stepFetchHistoricalPortfolioData(step);

        case 'calculate_returns_and_performance':
          return await this.stepCalculateReturnsAndPerformance(step, previousResults);

        case 'compare_allocations':
          return await this.stepCompareAllocations(step);

        default:
          return this.createFailureResult(`Unknown step action: ${step.action}`);
      }
    } catch (error) {
      return this.createFailureResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Step: Fetch multi-chain balances
   */
  private async stepFetchMultiChainBalances(step: Step): Promise<Result> {
    const { address, chains } = step.params as { address: string; chains: readonly string[] };

    logger.info('Fetching multi-chain balances', { address, chains });

    // Mock balances
    const balances = [
      { chain: 'ethereum', token: 'ETH', balance: '2.5', symbol: 'ETH' },
      { chain: 'ethereum', token: 'USDC', balance: '5000', symbol: 'USDC' },
      { chain: 'polygon', token: 'MATIC', balance: '1000', symbol: 'MATIC' },
    ];

    return this.createSuccessResult({ balances });
  }

  /**
   * Step: Fetch token prices
   */
  private async stepFetchTokenPrices(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result> {
    const balancesStepId = Array.from(previousResults.keys()).find((id) =>
      id.includes('fetch-balances')
    );
    const balancesData = balancesStepId
      ? this.getStepDataSafe<{ balances: Array<{ token: string }> }>(
          balancesStepId,
          previousResults
        )
      : undefined;

    logger.info('Fetching token prices');

    // Mock prices
    const prices = {
      ETH: 1800,
      USDC: 1,
      MATIC: 0.8,
    };

    return this.createSuccessResult({ prices });
  }

  /**
   * Step: Calculate portfolio summary
   */
  private async stepCalculatePortfolioSummary(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result<PortfolioSummary>> {
    const stepIds = Array.from(previousResults.keys());

    const balancesStepId = stepIds.find((id) => id.includes('fetch-balances'));
    const pricesStepId = stepIds.find((id) => id.includes('fetch-prices'));

    const balancesData = balancesStepId
      ? this.getStepDataSafe<{
          balances: Array<{ chain: string; token: string; balance: string; symbol: string }>;
        }>(balancesStepId, previousResults)
      : undefined;

    const pricesData = pricesStepId
      ? this.getStepDataSafe<{ prices: Record<string, number> }>(pricesStepId, previousResults)
      : undefined;

    if (!balancesData || !pricesData) {
      return this.createFailureResult('Missing balances or prices data') as Result<PortfolioSummary>;
    }

    logger.info('Calculating portfolio summary');

    // Calculate values - use mutable type
    type MutableAsset = {
      -readonly [K in keyof PortfolioAsset]: PortfolioAsset[K];
    };
    const assets: MutableAsset[] = balancesData.balances.map((b) => {
      const priceUSD = pricesData.prices[b.symbol] || 0;
      const valueUSD = parseFloat(b.balance) * priceUSD;

      return {
        token: b.token,
        symbol: b.symbol,
        balance: b.balance,
        priceUSD,
        valueUSD,
        percentage: 0, // Will calculate after total
        chain: b.chain as 'ethereum',
      };
    });

    const totalValueUSD = assets.reduce((sum, a) => sum + a.valueUSD, 0);

    // Update percentages
    assets.forEach((a) => {
      a.percentage = (a.valueUSD / totalValueUSD) * 100;
    });

    // Group by chain
    const chainMap = new Map<string, number>();
    assets.forEach((a) => {
      chainMap.set(a.chain, (chainMap.get(a.chain) || 0) + a.valueUSD);
    });

    const chains = Array.from(chainMap.entries()).map(([chain, valueUSD]) => ({
      chain: chain as 'ethereum',
      valueUSD,
      percentage: (valueUSD / totalValueUSD) * 100,
    }));

    const portfolio: PortfolioSummary = {
      totalValueUSD,
      assets: assets as readonly PortfolioAsset[],
      chains,
    };

    logger.info('Portfolio summary calculated', { totalValueUSD });

    return this.createSuccessResult(portfolio) as Result<PortfolioSummary>;
  }

  /**
   * Step: Fetch transaction history
   */
  private async stepFetchTransactionHistory(step: Step): Promise<Result> {
    const params = step.params as unknown as TransactionAnalysisParams;

    logger.info('Fetching transaction history', params);

    // Mock transactions
    const transactions = Array.from({ length: 50 }, (_, i) => ({
      hash: `0x${i}`,
      from: params.address,
      to: '0xRecipient',
      value: '1000000000000000000',
      gasUsed: '21000',
      gasPrice: '50000000000',
    }));

    return this.createSuccessResult({ transactions });
  }

  /**
   * Step: Analyze transaction patterns
   */
  private async stepAnalyzeTransactionPatterns(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result<TransactionStats>> {
    const txStepId = Array.from(previousResults.keys()).find((id) =>
      id.includes('fetch-txs')
    );
    const txData = txStepId
      ? this.getStepDataSafe<{ transactions: Array<{ from: string; to: string; value: string; gasUsed: string; gasPrice: string }> }>(
          txStepId,
          previousResults
        )
      : undefined;

    if (!txData) {
      return this.createFailureResult('No transaction data') as Result<TransactionStats>;
    }

    logger.info('Analyzing transaction patterns', { count: txData.transactions.length });

    const stats: TransactionStats = {
      totalTransactions: txData.transactions.length,
      sent: txData.transactions.length,
      received: 0,
      totalValueUSD: 1000,
      averageGasPrice: '50',
      totalGasUsed: (txData.transactions.length * 21000).toString(),
      period: {
        startBlock: 1000000,
        endBlock: 1050000,
      },
    };

    return this.createSuccessResult(stats) as Result<TransactionStats>;
  }

  /**
   * Step: Fetch gas usage data
   */
  private async stepFetchGasUsageData(step: Step): Promise<Result> {
    const params = step.params as unknown as GasAnalysisParams;

    logger.info('Fetching gas usage data', params);

    // Mock gas data
    const gasData = {
      totalGasUsed: '1050000',
      transactions: 50,
      averageGasPrice: '50',
    };

    return this.createSuccessResult(gasData);
  }

  /**
   * Step: Calculate gas statistics
   */
  private async stepCalculateGasStatistics(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result<GasStats>> {
    const gasDataStepId = Array.from(previousResults.keys()).find((id) =>
      id.includes('fetch-gas-data')
    );
    const gasData = gasDataStepId
      ? this.getStepDataSafe<{ totalGasUsed: string; transactions: number; averageGasPrice: string }>(
          gasDataStepId,
          previousResults
        )
      : undefined;

    if (!gasData) {
      return this.createFailureResult('No gas data') as Result<GasStats>;
    }

    logger.info('Calculating gas statistics');

    const stats: GasStats = {
      totalGasUsed: gasData.totalGasUsed,
      totalCostUSD: 50.0,
      averageGasPrice: gasData.averageGasPrice,
      transactionCount: gasData.transactions,
    };

    return this.createSuccessResult(stats) as Result<GasStats>;
  }

  /**
   * Step: Fetch price history data
   */
  private async stepFetchPriceHistoryData(step: Step): Promise<Result<PriceHistory>> {
    const params = step.params as unknown as PriceHistoryParams;

    logger.info('Fetching price history', params);

    // Mock price history
    const data = Array.from({ length: params.dataPoints || 100 }, (_, i) => ({
      timestamp: Date.now() - i * 3600000,
      priceUSD: 1800 + Math.random() * 100,
      volume24h: 1000000000,
    }));

    const priceHistory: PriceHistory = {
      token: params.token,
      chain: params.chain,
      period: params.period,
      data,
      summary: {
        currentPrice: 1850,
        highPrice: 1900,
        lowPrice: 1750,
        averagePrice: 1825,
        changePercent: 2.5,
      },
    };

    return this.createSuccessResult(priceHistory) as Result<PriceHistory>;
  }

  /**
   * Step: Fetch historical portfolio data
   */
  private async stepFetchHistoricalPortfolioData(step: Step): Promise<Result> {
    const params = step.params as unknown as PerformanceReportParams;

    logger.info('Fetching historical portfolio data', params);

    // Mock historical data
    const historicalData = {
      initialValueUSD: 10000,
      finalValueUSD: 12500,
    };

    return this.createSuccessResult(historicalData);
  }

  /**
   * Step: Calculate returns and performance
   */
  private async stepCalculateReturnsAndPerformance(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result<PerformanceReport>> {
    const histDataStepId = Array.from(previousResults.keys()).find((id) =>
      id.includes('fetch-historical-portfolio')
    );
    const histData = histDataStepId
      ? this.getStepDataSafe<{ initialValueUSD: number; finalValueUSD: number }>(
          histDataStepId,
          previousResults
        )
      : undefined;

    if (!histData) {
      return this.createFailureResult('No historical data') as Result<PerformanceReport>;
    }

    logger.info('Calculating returns and performance');

    const report: PerformanceReport = {
      period: {
        start: new Date(Date.now() - 30 * 24 * 3600000),
        end: new Date(),
      },
      initialValueUSD: histData.initialValueUSD,
      finalValueUSD: histData.finalValueUSD,
      absoluteReturn: histData.finalValueUSD - histData.initialValueUSD,
      percentReturn:
        ((histData.finalValueUSD - histData.initialValueUSD) / histData.initialValueUSD) * 100,
      totalGasCostUSD: 50,
    };

    return this.createSuccessResult(report) as Result<PerformanceReport>;
  }

  /**
   * Step: Compare allocations
   */
  private async stepCompareAllocations(step: Step): Promise<Result> {
    const { current, target } = step.params as {
      current: PortfolioSummary;
      target: Record<string, number>;
    };

    logger.info('Comparing portfolio allocations');

    const differences = current.assets.map((asset) => ({
      token: asset.token,
      currentPercent: asset.percentage,
      targetPercent: target[asset.token] || 0,
      diff: asset.percentage - (target[asset.token] || 0),
    }));

    return this.createSuccessResult({ differences });
  }

  /**
   * Validate execution result
   *
   * @param result - Result to validate
   * @returns Validation result
   */
  async validate(result: Result): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!result.success) {
      if (!result.error) {
        errors.push('Failed result must have error message');
      }
      return { valid: errors.length === 0, errors };
    }

    // Check for data
    if (!result.data) {
      errors.push('Successful result must have data');
      return { valid: false, errors };
    }

    const data = result.data as
      | PortfolioSummary
      | TransactionStats
      | GasStats
      | PriceHistory
      | PerformanceReport;

    // Validate portfolio summary
    if ('totalValueUSD' in data) {
      if (data.totalValueUSD < 0) {
        errors.push('Total value cannot be negative');
      }

      if ('assets' in data && !Array.isArray(data.assets)) {
        errors.push('Assets must be an array');
      }
    }

    // Validate transaction stats
    if ('totalTransactions' in data) {
      if (data.totalTransactions < 0) {
        errors.push('Transaction count cannot be negative');
      }
    }

    // Validate gas stats
    if ('totalGasUsed' in data && 'totalCostUSD' in data) {
      if (parseFloat(data.totalGasUsed) < 0) {
        errors.push('Gas used cannot be negative');
      }
    }

    // Validate performance report
    if ('percentReturn' in data) {
      if (data.percentReturn < -100) {
        errors.push('Invalid percent return (cannot lose more than 100%)');
      }
    }

    const validationResult: ValidationResult = {
      valid: errors.length === 0,
    };

    if (errors.length > 0) {
      validationResult.errors = errors;
    }

    if (warnings.length > 0) {
      validationResult.warnings = warnings;
    }

    return validationResult;
  }
}
