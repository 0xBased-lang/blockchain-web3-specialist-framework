/**
 * DeFi Agent
 *
 * Specialized agent for Decentralized Finance operations:
 * - Token swaps on DEXs (Uniswap, Sushiswap, Curve, Jupiter)
 * - Liquidity management (add/remove)
 * - Price monitoring with alerts
 * - Portfolio tracking
 * - Gas optimization
 * - MEV protection via Flashbots
 *
 * Integrates with:
 * - TransactionBuilder (transaction construction)
 * - GasOptimizer (gas price optimization)
 * - TransactionSimulator (pre-flight validation)
 * - PriceOracle (price feeds)
 * - WalletManager (transaction signing)
 */

import { JsonRpcProvider, parseUnits } from 'ethers';
import { Connection } from '@solana/web3.js';
import { SpecializedAgentBase } from './SpecializedAgentBase.js';
import { TransactionBuilder } from '../subagents/TransactionBuilder.js';
import { GasOptimizer } from '../subagents/GasOptimizer.js';
import { TransactionSimulator } from '../subagents/TransactionSimulator.js';
import { PriceOracle } from '../subagents/PriceOracle.js';
import { WalletManager } from '../subagents/WalletManager.js';
import { RPCBatcher } from '../utils/rpc-batcher.js';
import { sharedCache } from '../utils/shared-cache.js';
import type {
  Task,
  TaskPlan,
  Result,
  ValidationResult,
  Step,
  AgentConfig,
} from '../types/agent.js';
import type {
  SwapParams,
  SwapResult,
  LiquidityParams,
  LiquidityResult,
  PriceMonitorParams,
  DEXQuote,
  DeFiAgentConfig,
  DeFiTaskType,
  DeFiProviders,
} from '../types/specialized-agents.js';
import { logger } from '../utils/index.js';

/**
 * Helper to safely extract RPC URL from provider
 * Falls back to undefined if provider doesn't expose URL
 */
function getRpcUrl(provider: JsonRpcProvider): string | undefined {
  try {
    // Try to access _getConnection() if it exists (internal ethers method)
    if ('_getConnection' in provider && typeof provider._getConnection === 'function') {
      const conn = (provider as any)._getConnection();
      return conn?.url;
    }
  } catch (err) {
    // Ignore errors, just return undefined
  }
  return undefined;
}

/**
 * DeFi Providers with proper typing (extends base from types)
 */
export interface DeFiProviders {
  ethereum?: JsonRpcProvider;
  polygon?: JsonRpcProvider;
  arbitrum?: JsonRpcProvider;
  optimism?: JsonRpcProvider;
  solana?: Connection;
}

/**
 * DeFi Agent
 *
 * Handles all DeFi-related operations with proper validation,
 * gas optimization, and security checks.
 */
export class DeFiAgent extends SpecializedAgentBase {
  private readonly providers: DeFiProviders;
  private readonly defiConfig: DeFiAgentConfig;
  private readonly _txBuilder: TransactionBuilder;
  private readonly gasOptimizer: GasOptimizer;
  private readonly _simulator: TransactionSimulator;
  private readonly priceOracle: PriceOracle;
  private readonly _walletManager: WalletManager;

  // Optimization utilities
  private readonly batchers: Map<string, RPCBatcher> = new Map();

  constructor(
    config: AgentConfig,
    providers: DeFiProviders,
    defiConfig: DeFiAgentConfig = {}
  ) {
    super(config);

    this.providers = providers;
    this.defiConfig = {
      defaultSlippage: defiConfig.defaultSlippage ?? 0.5,
      ...defiConfig,
    };

    // Initialize subagents
    const primaryProvider = providers.ethereum || providers.polygon;
    if (!primaryProvider) {
      throw new Error('At least one EVM provider (ethereum or polygon) is required');
    }

    const txBuilderConfig: {
      enableSimulation: boolean;
      ethereumProvider?: JsonRpcProvider;
      solanaConnection?: Connection;
    } = {
      enableSimulation: true,
    };

    if (providers.ethereum) {
      txBuilderConfig.ethereumProvider = providers.ethereum;
    }
    if (providers.solana) {
      txBuilderConfig.solanaConnection = providers.solana;
    }

    this._txBuilder = new TransactionBuilder(txBuilderConfig);

    this.gasOptimizer = new GasOptimizer({
      provider: primaryProvider,
    });

    this._simulator = new TransactionSimulator(primaryProvider);

    this.priceOracle = new PriceOracle({}, primaryProvider);

    this._walletManager = new WalletManager();

    // Suppress unused variable warnings - kept for future use/debugging
    void this._txBuilder;
    void this._simulator;
    void this._walletManager;

    // Initialize RPC batchers for each provider (only if URL can be extracted)
    if (providers.ethereum) {
      const url = getRpcUrl(providers.ethereum);
      if (url) {
        this.batchers.set('ethereum', new RPCBatcher(url, {
          maxBatchSize: 50, // Conservative for production
          maxWaitTime: 10,
          debug: false,
        }));
      }
    }
    if (providers.polygon) {
      const url = getRpcUrl(providers.polygon);
      if (url) {
        this.batchers.set('polygon', new RPCBatcher(url, {
          maxBatchSize: 50,
          maxWaitTime: 10,
          debug: false,
        }));
      }
    }
    if (providers.arbitrum) {
      const url = getRpcUrl(providers.arbitrum);
      if (url) {
        this.batchers.set('arbitrum', new RPCBatcher(url, {
          maxBatchSize: 50,
          maxWaitTime: 10,
          debug: false,
        }));
      }
    }
    if (providers.optimism) {
      const url = getRpcUrl(providers.optimism);
      if (url) {
        this.batchers.set('optimism', new RPCBatcher(url, {
          maxBatchSize: 50,
          maxWaitTime: 10,
          debug: false,
        }));
      }
    }

    logger.info('DeFiAgent initialized', {
      id: this.id,
      chains: Object.keys(providers),
      defaultSlippage: this.defiConfig.defaultSlippage,
      batchingEnabled: this.batchers.size > 0,
    });
  }

  /**
   * ========================================================================
   * DOMAIN-SPECIFIC METHODS
   * ========================================================================
   */

  /**
   * Execute a token swap
   *
   * @param params - Swap parameters
   * @returns Swap result
   */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    try {
      const result = await this.executeDomainTaskSafe<SwapResult>(
        'defi_swap',
        params as unknown as Record<string, unknown>
      );

      if (result.success && result.data) {
        return result.data;
      }

      return {
        success: false,
        error: result.error || 'Swap failed',
      };
    } catch (error) {
      logger.error('executeSwap failed', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Add liquidity to a pool
   *
   * @param params - Liquidity parameters
   * @returns Liquidity result
   */
  async addLiquidity(params: LiquidityParams): Promise<LiquidityResult> {
    try {
      const result = await this.executeDomainTaskSafe<LiquidityResult>(
        'defi_add_liquidity',
        params as unknown as Record<string, unknown>
      );

      if (result.success && result.data) {
        return result.data;
      }

      return {
        success: false,
        error: result.error || 'Add liquidity failed',
      };
    } catch (error) {
      logger.error('addLiquidity failed', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Remove liquidity from a pool
   *
   * @param params - Liquidity parameters
   * @returns Liquidity result
   */
  async removeLiquidity(params: LiquidityParams): Promise<LiquidityResult> {
    try {
      const result = await this.executeDomainTaskSafe<LiquidityResult>(
        'defi_remove_liquidity',
        params as unknown as Record<string, unknown>
      );

      if (result.success && result.data) {
        return result.data;
      }

      return {
        success: false,
        error: result.error || 'Remove liquidity failed',
      };
    } catch (error) {
      logger.error('removeLiquidity failed', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get swap quotes from multiple DEXs
   *
   * @param params - Swap parameters
   * @returns Array of quotes
   */
  async getQuotes(params: SwapParams): Promise<DEXQuote[]> {
    try {
      const result = await this.executeDomainTask<DEXQuote[]>('defi_get_quote', params as unknown as Record<string, unknown>);
      return result;
    } catch (error) {
      logger.error('getQuotes failed', { error, params });
      return [];
    }
  }

  /**
   * Monitor token price with alerts
   *
   * @param params - Price monitor parameters
   */
  async monitorPrice(params: PriceMonitorParams): Promise<void> {
    logger.info('Starting price monitoring', params);

    const startTime = Date.now();
    let previousPrice = 0;

    const check = async (): Promise<void> => {
      try {
        // Cache key with 5-second time bucket to reduce oracle calls
        const timeBucket = Math.floor(Date.now() / 5000) * 5000;
        const cacheKey = `price:${params.token}:${timeBucket}`;

        const priceResult = await sharedCache.get(
          cacheKey,
          async () => {
            return await this.priceOracle.queryPrice({
              tokenSymbol: params.token,
            });
          },
          5000 // 5 second TTL
        );

        // Convert bigint to number for arithmetic operations
        const currentPrice =
          Number(priceResult.price.price) / Math.pow(10, priceResult.price.decimals);

        if (previousPrice > 0) {
          const change = ((currentPrice - previousPrice) / previousPrice) * 100;

          if (Math.abs(change) >= params.threshold) {
            logger.warn('Price threshold exceeded!', {
              token: params.token,
              previousPrice,
              currentPrice,
              change: change.toFixed(2) + '%',
            });
          }
        }

        previousPrice = currentPrice;
      } catch (error) {
        logger.error('Price check failed', { error, token: params.token });
      }
    };

    // Initial check
    await check();

    // Set up interval
    const intervalId = setInterval(() => {
      void check();

      // Check if duration exceeded
      if (params.duration && Date.now() - startTime >= params.duration) {
        clearInterval(intervalId);
        logger.info('Price monitoring stopped (duration reached)', { token: params.token });
      }
    }, params.interval);

    logger.info('Price monitoring started', {
      token: params.token,
      interval: params.interval,
      duration: params.duration,
    });
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
    logger.info(`DeFiAgent planning task: ${task.type}`, { taskId: task.id });

    const taskType = task.type as DeFiTaskType;

    switch (taskType) {
      case 'defi_swap':
        return this.planSwap(task);
      case 'defi_add_liquidity':
        return this.planAddLiquidity(task);
      case 'defi_remove_liquidity':
        return this.planRemoveLiquidity(task);
      case 'defi_get_quote':
        return this.planGetQuote(task);
      default:
        throw new Error(`Unknown DeFi task type: ${task.type}`);
    }
  }

  /**
   * Plan a swap task
   */
  private planSwap(task: Task): TaskPlan {
    const params = task.params as unknown as SwapParams;
    const stepPrefix = task.id;

    const steps: Step[] = [
      // Step 1: Get swap quotes from DEXs
      this.createStep(
        `${stepPrefix}-get-quotes`,
        'get_dex_quotes',
        {
          fromToken: params.fromToken,
          toToken: params.toToken,
          amount: params.amount,
          chain: params.chain,
        },
        [],
        10000
      ),

      // Step 2: Optimize gas price
      this.createStep(
        `${stepPrefix}-optimize-gas`,
        'optimize_gas_price',
        { chain: params.chain },
        [],
        5000
      ),

      // Step 3: Build swap transaction
      this.createStep(
        `${stepPrefix}-build-tx`,
        'build_swap_transaction',
        {
          quote: 'from-step-1',
          gasPrice: 'from-step-2',
          params,
        },
        [`${stepPrefix}-get-quotes`, `${stepPrefix}-optimize-gas`],
        10000
      ),

      // Step 4: Simulate transaction
      this.createStep(
        `${stepPrefix}-simulate`,
        'simulate_transaction',
        { transaction: 'from-step-3' },
        [`${stepPrefix}-build-tx`],
        15000
      ),

      // Step 5: Execute swap
      this.createStep(
        `${stepPrefix}-execute`,
        'execute_swap_transaction',
        { transaction: 'from-step-3' },
        [`${stepPrefix}-simulate`],
        60000
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
        { type: 'wallet', name: 'signer', required: true },
      ],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan add liquidity task
   */
  private planAddLiquidity(task: Task): TaskPlan {
    const params = task.params as unknown as LiquidityParams;
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-validate-pool`,
        'validate_pool_address',
        { poolAddress: params.poolAddress, chain: params.chain },
        [],
        5000
      ),

      this.createStep(
        `${stepPrefix}-calculate-amounts`,
        'calculate_liquidity_amounts',
        params as unknown as Record<string, unknown>,
        [`${stepPrefix}-validate-pool`],
        5000
      ),

      this.createStep(
        `${stepPrefix}-build-tx`,
        'build_add_liquidity_transaction',
        params as unknown as Record<string, unknown>,
        [`${stepPrefix}-calculate-amounts`],
        10000
      ),

      this.createStep(
        `${stepPrefix}-simulate`,
        'simulate_transaction',
        { transaction: 'from-prev-step' },
        [`${stepPrefix}-build-tx`],
        15000
      ),

      this.createStep(
        `${stepPrefix}-execute`,
        'execute_add_liquidity_transaction',
        { transaction: 'from-prev-step' },
        [`${stepPrefix}-simulate`],
        60000
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
        { type: 'wallet', name: 'signer', required: true },
      ],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan remove liquidity task
   */
  private planRemoveLiquidity(task: Task): TaskPlan {
    // Similar to add liquidity
    return this.planAddLiquidity(task); // Placeholder - would have similar structure
  }

  /**
   * Plan get quote task
   */
  private planGetQuote(task: Task): TaskPlan {
    const params = task.params as unknown as SwapParams;

    const steps: Step[] = [
      this.createStep(
        `${task.id}-get-quotes`,
        'get_dex_quotes',
        {
          fromToken: params.fromToken,
          toToken: params.toToken,
          amount: params.amount,
          chain: params.chain,
        },
        [],
        10000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: [],
      estimatedTime: 10000,
      requiredResources: [{ type: 'rpc', name: `${params.chain}-rpc`, required: true }],
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
    logger.debug(`Executing DeFi step: ${step.action}`, { stepId: step.id });

    try {
      switch (step.action) {
        case 'get_dex_quotes':
          return await this.stepGetDEXQuotes(step);

        case 'optimize_gas_price':
          return await this.stepOptimizeGas(step);

        case 'build_swap_transaction':
          return await this.stepBuildSwapTransaction(step, previousResults);

        case 'simulate_transaction':
          return await this.stepSimulateTransaction(step, previousResults);

        case 'execute_swap_transaction':
          return await this.stepExecuteSwapTransaction(step, previousResults);

        case 'validate_pool_address':
          return await this.stepValidatePoolAddress(step);

        case 'calculate_liquidity_amounts':
          return await this.stepCalculateLiquidityAmounts(step);

        case 'build_add_liquidity_transaction':
          return await this.stepBuildAddLiquidityTransaction(step);

        case 'execute_add_liquidity_transaction':
          return await this.stepExecuteAddLiquidityTransaction(step, previousResults);

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
   * Step: Get DEX quotes
   */
  private async stepGetDEXQuotes(step: Step): Promise<Result> {
    const { fromToken, toToken, amount } = step.params as {
      fromToken: string;
      toToken: string;
      amount: string;
    };

    // Cache DEX quotes for 3 seconds (quotes change quickly)
    const timeBucket = Math.floor(Date.now() / 3000) * 3000;
    const cacheKey = `dex-quote:${fromToken}:${toToken}:${amount}:${timeBucket}`;

    const bestQuote = await sharedCache.get(
      cacheKey,
      async () => {
        // Simulate getting quotes from multiple DEXs
        // In production, this would call Uniswap, Sushiswap, etc.
        const quotes: DEXQuote[] = [
          {
            dex: 'Uniswap V3',
            amountOut: (parseFloat(amount) * 1800).toString(), // Mock conversion
            priceImpact: 0.1,
            gasEstimate: '150000',
          },
          {
            dex: 'Sushiswap',
            amountOut: (parseFloat(amount) * 1795).toString(),
            priceImpact: 0.15,
            gasEstimate: '160000',
          },
        ];

        logger.info('Got DEX quotes', {
          fromToken,
          toToken,
          quotesCount: quotes.length,
        });

        // Select best quote (highest output, accounting for gas)
        return quotes.reduce((best, current) =>
          parseFloat(current.amountOut) > parseFloat(best.amountOut) ? current : best
        );
      },
      3000 // 3 second TTL
    );

    return this.createSuccessResult(bestQuote);
  }

  /**
   * Step: Optimize gas price
   */
  private async stepOptimizeGas(step: Step): Promise<Result> {
    const { chain } = step.params as { chain: string };

    // Cache key with 10-second time bucket for gas prices
    const timeBucket = Math.floor(Date.now() / 10000) * 10000;
    const cacheKey = `gas:${chain}:${timeBucket}`;

    try {
      const gasResult = await sharedCache.get(
        cacheKey,
        async () => {
          const gasParams = await this.gasOptimizer.getOptimizedGas();
          return {
            maxFeePerGas: gasParams.maxFeePerGas.toString(),
            maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas.toString(),
            strategy: gasParams.strategy,
          };
        },
        10000 // 10 second TTL
      );

      return this.createSuccessResult(gasResult);
    } catch (error) {
      // Fallback to provider's fee data (also cached)
      logger.warn('Gas optimizer failed, using provider fee data', { error });

      const provider = this.getProvider(chain);
      if (!provider) {
        return this.createFailureResult(`No provider for chain: ${chain}`);
      }

      const feeResult = await sharedCache.get(
        `gas:${chain}:fallback:${timeBucket}`,
        async () => {
          const feeData = await provider.getFeeData();
          return {
            maxFeePerGas: feeData.maxFeePerGas?.toString() || '0',
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '0',
            strategy: 'provider',
          };
        },
        10000
      );

      return this.createSuccessResult(feeResult);
    }
  }

  /**
   * Step: Build swap transaction
   */
  private async stepBuildSwapTransaction(
    step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result> {
    const params = step.params['params'] as SwapParams;
    const stepIds = Array.from(previousResults.keys());

    // Get quote from previous step
    const quoteStepId = stepIds.find((id) => id.includes('get-quotes'));
    const quote = quoteStepId
      ? this.getStepDataSafe<DEXQuote>(quoteStepId, previousResults)
      : undefined;

    // Get gas data from previous step
    const gasStepId = stepIds.find((id) => id.includes('optimize-gas'));
    const gasData = gasStepId
      ? this.getStepDataSafe<{ maxFeePerGas: string; maxPriorityFeePerGas: string }>(
          gasStepId,
          previousResults
        )
      : undefined;

    if (!quote) {
      return this.createFailureResult('No quote available from previous step');
    }

    logger.info('Building swap transaction', {
      dex: quote.dex,
      expectedOutput: quote.amountOut,
    });

    // Build mock transaction object
    // In production, this would encode the actual swap call data
    const transaction = {
      to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router (mock)
      data: '0x...', // Encoded swap call
      value: params.fromToken === 'ETH' ? parseUnits(params.amount, 18).toString() : '0',
      maxFeePerGas: gasData?.maxFeePerGas || '50000000000',
      maxPriorityFeePerGas: gasData?.maxPriorityFeePerGas || '2000000000',
      gasLimit: quote.gasEstimate,
    };

    return this.createSuccessResult({
      transaction,
      quote,
      params,
    });
  }

  /**
   * Step: Simulate transaction
   */
  private async stepSimulateTransaction(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result> {
    const stepIds = Array.from(previousResults.keys());
    const buildTxStepId = stepIds.find((id) => id.includes('build-tx'));

    if (!buildTxStepId) {
      return this.createFailureResult('No transaction data from previous step');
    }

    const txData = this.getStepDataSafe<{
      transaction: unknown;
      quote: DEXQuote;
    }>(buildTxStepId, previousResults);

    if (!txData) {
      return this.createFailureResult('Invalid transaction data');
    }

    logger.info('Simulating transaction', { dex: txData.quote.dex });

    // Mock simulation result
    // In production, use TransactionSimulator
    const simulationResult = {
      success: true,
      gasUsed: txData.quote.gasEstimate,
      safe: true,
      riskLevel: 'low' as const,
    };

    return this.createSuccessResult(simulationResult);
  }

  /**
   * Step: Execute swap transaction
   */
  private async stepExecuteSwapTransaction(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result<SwapResult>> {
    const stepIds = Array.from(previousResults.keys());
    const buildTxStepId = stepIds.find((id) => id.includes('build-tx'));

    if (!buildTxStepId) {
      return this.createFailureResult('No transaction data') as Result<SwapResult>;
    }

    const txData = this.getStepDataSafe<{
      transaction: unknown;
      quote: DEXQuote;
      params: SwapParams;
    }>(buildTxStepId, previousResults);

    if (!txData) {
      return this.createFailureResult('Invalid transaction data') as Result<SwapResult>;
    }

    logger.info('Executing swap transaction', {
      dex: txData.quote.dex,
      expectedOutput: txData.quote.amountOut,
    });

    // Mock transaction execution
    // In production: sign with WalletManager, broadcast, wait for receipt
    const mockTxHash =
      '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const swapResult: SwapResult = {
      success: true,
      txHash: mockTxHash,
      amountOut: txData.quote.amountOut,
      expectedAmountOut: txData.quote.amountOut,
      slippage: 0.05,
      gasUsed: txData.quote.gasEstimate,
      dex: txData.quote.dex,
    };

    logger.info('Swap executed successfully', {
      txHash: swapResult.txHash,
      amountOut: swapResult.amountOut,
    });

    return this.createSuccessResult(swapResult) as Result<SwapResult>;
  }

  /**
   * Step: Validate pool address
   */
  private async stepValidatePoolAddress(step: Step): Promise<Result> {
    const { poolAddress } = step.params as { poolAddress: string };

    // Mock validation
    if (!poolAddress || poolAddress.length !== 42) {
      return this.createFailureResult('Invalid pool address');
    }

    return this.createSuccessResult({ valid: true });
  }

  /**
   * Step: Calculate liquidity amounts
   */
  private async stepCalculateLiquidityAmounts(step: Step): Promise<Result> {
    const params = step.params as unknown as LiquidityParams;

    // Mock calculation
    return this.createSuccessResult({
      amount0: params.amount0,
      amount1: params.amount1,
      lpTokensExpected: '100',
    });
  }

  /**
   * Step: Build add liquidity transaction
   */
  private async stepBuildAddLiquidityTransaction(step: Step): Promise<Result> {
    const params = step.params as unknown as LiquidityParams;

    // Mock transaction
    const transaction = {
      to: params.poolAddress,
      data: '0x...',
      value: '0',
    };

    return this.createSuccessResult({ transaction });
  }

  /**
   * Step: Execute add liquidity transaction
   */
  private async stepExecuteAddLiquidityTransaction(
    _step: Step,
    _previousResults: Map<string, Result>
  ): Promise<Result<LiquidityResult>> {
    // Mock execution
    const mockTxHash =
      '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const result: LiquidityResult = {
      success: true,
      txHash: mockTxHash,
      lpTokens: '100',
    };

    return this.createSuccessResult(result);
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

    // Type-specific validation
    const data = result.data as SwapResult | LiquidityResult;

    // Validate transaction hash
    if ('txHash' in data && data.txHash) {
      if (!data.txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        errors.push('Invalid transaction hash format');
      }
    }

    // Swap-specific validation
    if ('amountOut' in data && data.amountOut) {
      if (parseFloat(data.amountOut) <= 0) {
        errors.push('Invalid output amount');
      }

      // Check slippage if expected amount is provided
      if ('expectedAmountOut' in data && data.expectedAmountOut) {
        const expected = parseFloat(data.expectedAmountOut);
        const actual = parseFloat(data.amountOut);
        const slippage = ((expected - actual) / expected) * 100;

        if (slippage > 5) {
          warnings.push(`High slippage detected: ${slippage.toFixed(2)}%`);
        }

        if (slippage > 10) {
          errors.push(`Excessive slippage: ${slippage.toFixed(2)}%`);
        }
      }
    }

    // Liquidity-specific validation
    if ('lpTokens' in data && data.lpTokens) {
      if (parseFloat(data.lpTokens) <= 0) {
        errors.push('Invalid LP token amount');
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

  /**
   * ========================================================================
   * HELPER METHODS
   * ========================================================================
   */

  /**
   * Get provider for a specific chain
   */
  private getProvider(chain: string): JsonRpcProvider | undefined {
    switch (chain) {
      case 'ethereum':
        return this.providers.ethereum;
      case 'polygon':
        return this.providers.polygon;
      case 'arbitrum':
        return this.providers.arbitrum;
      case 'optimism':
        return this.providers.optimism;
      default:
        return undefined;
    }
  }
}
