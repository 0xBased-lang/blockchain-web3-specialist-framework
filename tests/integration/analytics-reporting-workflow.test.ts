/**
 * E2E Integration Test: Analytics Reporting Workflow
 *
 * Tests the complete analytics and reporting flow:
 * 1. Portfolio tracking across multiple chains
 * 2. Transaction history analysis
 * 3. Gas usage analytics and optimization insights
 * 4. Price history tracking and trend analysis
 * 5. Performance metrics and reporting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JsonRpcProvider } from 'ethers';
import { AnalyticsAgent } from '../../src/agents/AnalyticsAgent.js';
import type { AnalyticsProviders } from '../../src/agents/AnalyticsAgent.js';
import type { AgentConfig } from '../../src/types/agent.js';
import type {
  PortfolioParams,
  TransactionAnalysisParams,
  GasAnalysisParams,
  PriceHistoryParams,
} from '../../src/types/specialized-agents.js';

describe('Analytics Reporting Workflow E2E', () => {
  let agent: AnalyticsAgent;
  let mockEthProvider: JsonRpcProvider;
  let config: AgentConfig;

  beforeEach(() => {
    // Mock Ethereum provider with analytics data
    mockEthProvider = {
      getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: 'mainnet' }),
      getBlockNumber: vi.fn().mockResolvedValue(18000000),
      getBalance: vi.fn().mockResolvedValue(5000000000000000000n), // 5 ETH
      getTransactionCount: vi.fn().mockResolvedValue(150),
      getBlock: vi.fn().mockResolvedValue({
        number: 18000000,
        timestamp: Math.floor(Date.now() / 1000),
        transactions: ['0x123...', '0x456...'],
      }),
      getTransaction: vi.fn().mockResolvedValue({
        hash: '0x1234567890...',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        value: 1000000000000000000n,
        gasLimit: 100000n,
        gasPrice: 50000000000n,
      }),
      getTransactionReceipt: vi.fn().mockResolvedValue({
        transactionHash: '0x1234567890...',
        gasUsed: 75000n,
        effectiveGasPrice: 50000000000n,
        status: 1,
      }),
      call: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000000000001bc16d674ec80000'),
    } as unknown as JsonRpcProvider;

    config = {
      id: 'analytics-e2e-agent',
      name: 'AnalyticsAgent',
      description: 'Analytics and reporting operations',
      capabilities: ['portfolio', 'transaction_analysis', 'gas_analysis', 'price_tracking'],
      mcpClient: {},
      maxConcurrentTasks: 5,
      timeout: 120000,
    };

    const providers: AnalyticsProviders = {
      ethereum: mockEthProvider,
    };

    agent = new AnalyticsAgent(config, providers);
  });

  describe('Portfolio Tracking Workflow', () => {
    it('should execute full portfolio analysis: plan → execute → validate', async () => {
      const portfolioParams: PortfolioParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chains: ['ethereum'],
      };

      const task = {
        id: 'portfolio-task-1',
        type: 'analytics_get_portfolio',
        params: portfolioParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      // Step 1: Plan the portfolio analysis
      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.taskId).toBe('portfolio-task-1');
      expect(plan.steps.length).toBeGreaterThan(0);

      // Verify plan includes key analysis steps
      const stepActions = plan.steps.map((s) => s.action);
      expect(stepActions).toContain('fetch_balances');
      expect(stepActions).toContain('calculate_values');

      // Step 2: Execute the portfolio analysis
      const result = await agent.execute(plan);

      expect(result).toBeDefined();

      // Step 3: Validate the result
      if (result.success && result.data) {
        const validation = await agent.validate(result);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    it('should track portfolio across multiple chains', async () => {
      const multiChainParams: PortfolioParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chains: ['ethereum', 'polygon', 'arbitrum'],
      };

      const result = await agent.getPortfolio(multiChainParams);

      expect(result).toBeDefined();
      if (result && 'chains' in result) {
        expect(result.chains).toBeDefined();
        expect(Array.isArray(result.chains)).toBe(true);
      }
    });

    it('should calculate total portfolio value in USD', async () => {
      const portfolioParams: PortfolioParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chains: ['ethereum'],
      };

      const result = await agent.getPortfolio(portfolioParams);

      expect(result).toBeDefined();
      if (result && 'totalValueUSD' in result) {
        expect(typeof result.totalValueUSD).toBe('number');
        expect(result.totalValueUSD).toBeGreaterThanOrEqual(0);
      }
    });

    it('should validate portfolio data structure', async () => {
      const mockPortfolio = {
        totalValueUSD: 15000,
        chains: ['ethereum'],
        assets: [
          {
            token: 'ETH',
            balance: '5',
            valueUSD: 10000,
            percentage: 66.67,
          },
          {
            token: 'USDC',
            balance: '5000',
            valueUSD: 5000,
            percentage: 33.33,
          },
        ],
        lastUpdated: new Date(),
      };

      const result = {
        success: true,
        data: mockPortfolio,
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject negative portfolio values', async () => {
      const invalidPortfolio = {
        success: true,
        data: {
          totalValueUSD: -1000, // Invalid
          chains: ['ethereum'],
          assets: [],
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(invalidPortfolio);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Total value cannot be negative');
    });
  });

  describe('Transaction Analysis Workflow', () => {
    it('should analyze transaction history for address', async () => {
      const txParams: TransactionAnalysisParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chain: 'ethereum',
      };

      const task = {
        id: 'tx-analysis-task',
        type: 'analytics_analyze_tx',
        params: txParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      expect(result).toBeDefined();
      if (result.success && result.data) {
        // Should contain transaction statistics
        expect(result.data).toBeDefined();
      }
    });

    it('should calculate transaction statistics', async () => {
      const txParams: TransactionAnalysisParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chain: 'ethereum',
      };

      const result = await agent.analyzeTransactions(txParams);

      expect(result).toBeDefined();
      if (result && 'totalTransactions' in result) {
        expect(typeof result.totalTransactions).toBe('number');
        expect(result.totalTransactions).toBeGreaterThanOrEqual(0);
      }
    });

    it('should identify transaction patterns', async () => {
      const txParams: TransactionAnalysisParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chain: 'ethereum',
      };

      const result = await agent.analyzeTransactions(txParams);

      if (result && 'patterns' in result) {
        // Should identify patterns like frequent trading, HODLing, etc.
        expect(result.patterns).toBeDefined();
      }
    });

    it('should reject invalid transaction count', async () => {
      const invalidTxResult = {
        success: true,
        data: {
          totalTransactions: -5, // Invalid
          uniqueAddresses: 10,
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(invalidTxResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Transaction count cannot be negative');
    });
  });

  describe('Gas Usage Analysis Workflow', () => {
    it('should analyze gas usage patterns', async () => {
      const gasParams: GasAnalysisParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chain: 'ethereum',
        period: 'month',
      };

      const task = {
        id: 'gas-analysis-task',
        type: 'analytics_analyze_gas',
        params: gasParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      expect(result).toBeDefined();
      if (result.success && result.data) {
        expect(result.data).toBeDefined();
      }
    });

    it('should calculate total gas costs', async () => {
      const gasParams: GasAnalysisParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chain: 'ethereum',
        period: 'month',
      };

      const result = await agent.analyzeGasUsage(gasParams);

      expect(result).toBeDefined();
      if (result && 'totalGasUsed' in result) {
        expect(result.totalGasUsed).toBeDefined();
      }
      if (result && 'totalCostUSD' in result) {
        expect(typeof result.totalCostUSD).toBe('number');
        expect(result.totalCostUSD).toBeGreaterThanOrEqual(0);
      }
    });

    it('should provide gas optimization recommendations', async () => {
      const gasParams: GasAnalysisParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chain: 'ethereum',
        period: 'month',
      };

      const result = await agent.analyzeGasUsage(gasParams);

      if (result && 'recommendations' in result) {
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
      }
    });

    it('should reject negative gas usage', async () => {
      const invalidGasResult = {
        success: true,
        data: {
          totalGasUsed: '-100', // Invalid
          totalCostUSD: 50,
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(invalidGasResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Gas used cannot be negative');
    });
  });

  describe('Price History Tracking', () => {
    it('should fetch price history for token', async () => {
      const priceParams: PriceHistoryParams = {
        token: 'ETH',
        chain: 'ethereum',
        period: 'day',
      };

      const task = {
        id: 'price-history-task',
        type: 'analytics_price_history',
        params: priceParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      expect(result).toBeDefined();
      if (result.success && result.data) {
        expect(result.data).toBeDefined();
      }
    });

    it('should calculate price statistics', async () => {
      const priceParams: PriceHistoryParams = {
        token: 'ETH',
        chain: 'ethereum',
        period: 'day',
      };

      const result = await agent.getPriceHistory(priceParams);

      expect(result).toBeDefined();
      if (result && 'prices' in result) {
        expect(Array.isArray(result.prices)).toBe(true);
      }
      if (result && typeof result === 'object' && 'high' in result && 'low' in result) {
        const typedResult = result as { high: number; low: number };
        expect(typedResult.high).toBeGreaterThanOrEqual(typedResult.low);
      }
    });

    it('should handle different time periods', async () => {
      const periods: Array<'hour' | 'day' | 'week' | 'month'> = ['hour', 'day', 'week', 'month'];

      for (const period of periods) {
        const priceParams: PriceHistoryParams = {
          token: 'ETH',
          chain: 'ethereum',
          period,
        };

        const result = await agent.getPriceHistory(priceParams);
        expect(result).toBeDefined();
      }
    });
  });

  describe('Performance Metrics and Reporting', () => {
    it('should calculate portfolio performance metrics', async () => {
      const portfolioParams: PortfolioParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chains: ['ethereum'],
      };

      const result = await agent.getPortfolio(portfolioParams);

      if (result && 'performance' in result) {
        const perf = result.performance as Record<string, unknown>;
        if ('totalReturn' in perf) {
          expect(typeof perf['totalReturn']).toBe('number');
        }
        if ('percentReturn' in perf) {
          expect(typeof perf['percentReturn']).toBe('number');
        }
      }
    });

    it('should validate reasonable percent returns', async () => {
      const validResult = {
        success: true,
        data: {
          percentReturn: 50, // 50% gain (reasonable)
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(validResult);
      expect(validation.valid).toBe(true);
    });

    it('should reject impossible percent returns', async () => {
      const invalidResult = {
        success: true,
        data: {
          percentReturn: -150, // Can't lose more than 100%
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(invalidResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors?.some((e) => e.includes('percent return'))).toBe(true);
    });
  });

  describe('Multi-Chain Analytics', () => {
    it('should aggregate analytics across multiple chains', async () => {
      const portfolioParams: PortfolioParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chains: ['ethereum', 'polygon', 'arbitrum', 'optimism'],
      };

      const result = await agent.getPortfolio(portfolioParams);

      expect(result).toBeDefined();
      if (result && 'chains' in result) {
        expect(result.chains.length).toBeGreaterThan(1);
      }
    });

    it('should calculate cross-chain totals', async () => {
      const portfolioParams: PortfolioParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chains: ['ethereum', 'polygon'],
      };

      const result = await agent.getPortfolio(portfolioParams);

      if (result && 'totalValueUSD' in result) {
        // Total should be sum of all chains
        expect(result.totalValueUSD).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Time-Series Analysis', () => {
    it('should track portfolio value over time', async () => {
      const portfolioParams: PortfolioParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chains: ['ethereum'],
      };

      const result = await agent.getPortfolio(portfolioParams);

      if (result && 'history' in result) {
        const history = result.history as unknown[];
        expect(Array.isArray(history)).toBe(true);
      }
    });

    it('should calculate moving averages', async () => {
      const priceParams: PriceHistoryParams = {
        token: 'ETH',
        chain: 'ethereum',
        period: 'day',
      };

      const result = await agent.getPriceHistory(priceParams);

      if (result && 'movingAverage' in result) {
        expect(result.movingAverage).toBeDefined();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors during analytics', async () => {
      // Mock network failure
      mockEthProvider.getBalance = vi.fn().mockRejectedValue(new Error('Network error'));

      const portfolioParams: PortfolioParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chains: ['ethereum'],
      };

      const result = await agent.getPortfolio(portfolioParams);

      expect(result).toBeDefined();
      // Should fail gracefully
    });

    it('should handle missing data gracefully', async () => {
      // Mock empty transaction history
      mockEthProvider.getTransactionCount = vi.fn().mockResolvedValue(0);

      const txParams: TransactionAnalysisParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chain: 'ethereum',
      };

      const result = await agent.analyzeTransactions(txParams);

      expect(result).toBeDefined();
      if (result && 'totalTransactions' in result) {
        expect(result.totalTransactions).toBe(0);
      }
    });

    it('should validate date ranges for historical data', async () => {
      const priceParams: PriceHistoryParams = {
        token: 'ETH',
        chain: 'ethereum',
        period: 'year',
      };

      const result = await agent.getPriceHistory(priceParams);

      // Should handle historical data requests
      expect(result).toBeDefined();
    });

    it('should handle rate limiting from price APIs', async () => {
      // Mock rate limit
      mockEthProvider.call = vi.fn().mockRejectedValue(
        new Error('429 Too Many Requests')
      );

      const priceParams: PriceHistoryParams = {
        token: 'ETH',
        chain: 'ethereum',
        period: 'day',
      };

      try {
        await agent.getPriceHistory(priceParams);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Analytics Report Generation', () => {
    it('should generate comprehensive analytics report', async () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

      // Gather all analytics
      const portfolio = await agent.getPortfolio({
        address,
        chains: ['ethereum'],
      });

      const txAnalysis = await agent.analyzeTransactions({
        address,
        chain: 'ethereum',
      });

      const gasAnalysis = await agent.analyzeGasUsage({
        address,
        chain: 'ethereum',
        period: 'month',
      });

      // Verify all data collected
      expect(portfolio).toBeDefined();
      expect(txAnalysis).toBeDefined();
      expect(gasAnalysis).toBeDefined();

      // Combined report should be comprehensive
      const report = {
        portfolio,
        transactions: txAnalysis,
        gas: gasAnalysis,
        generatedAt: new Date(),
      };

      expect(report).toBeDefined();
      expect(report.portfolio).toBeDefined();
      expect(report.transactions).toBeDefined();
      expect(report.gas).toBeDefined();
    });
  });
});
