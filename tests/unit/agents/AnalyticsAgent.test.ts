import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsAgent } from '../../../src/agents/AnalyticsAgent.js';
import type { AnalyticsProviders } from '../../../src/agents/AnalyticsAgent.js';
import type { AgentConfig } from '../../../src/types/agent.js';
import type {
  
  PortfolioParams,
  TransactionAnalysisParams,
  GasAnalysisParams,
  PriceHistoryParams,
} from '../../../src/types/specialized-agents.js';
import { JsonRpcProvider } from 'ethers';

const mockEthProvider = {
  getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: 'mainnet' }),
} as unknown as JsonRpcProvider;

describe('AnalyticsAgent', () => {
  let agent: AnalyticsAgent;
  let config: AgentConfig;
  let providers: AnalyticsProviders;

  beforeEach(() => {
    config = {
      id: 'analytics-agent-1',
      name: 'AnalyticsAgent',
      description: 'Analytics and reporting agent',
      capabilities: ['portfolio', 'gas_analysis', 'price_tracking'],
      mcpClient: {},
      maxConcurrentTasks: 3,
      timeout: 30000,
    };

    providers = {
      ethereum: mockEthProvider,
    };

    agent = new AnalyticsAgent(config, providers);
  });

  describe('Initialization', () => {
    it('should create AnalyticsAgent with config and providers', () => {
      expect(agent).toBeDefined();
      expect(agent.getMetadata().name).toBe('AnalyticsAgent');
    });
  });

  describe('getPortfolio', () => {
    it('should handle portfolio request', async () => {
      const portfolioParams: PortfolioParams = {
        address: '0xWallet',
        chains: ['ethereum'],
      };

      const result = await agent.getPortfolio(portfolioParams);

      expect(result).toBeDefined();
    });
  });

  describe('analyzeTransactions', () => {
    it('should handle transaction analysis request', async () => {
      const txParams: TransactionAnalysisParams = {
        address: '0xWallet',
        chain: 'ethereum',
        endBlock: 2000000,
      };

      const result = await agent.analyzeTransactions(txParams);

      expect(result).toBeDefined();
    });
  });

  describe('analyzeGasUsage', () => {
    it('should handle gas analysis request', async () => {
      const gasParams: GasAnalysisParams = {
        address: '0xWallet',
        chain: 'ethereum',
        endBlock: 2000000,
      };

      const result = await agent.analyzeGasUsage(gasParams);

      expect(result).toBeDefined();
    });
  });

  describe('getPriceHistory', () => {
    it('should handle price history request', async () => {
      const priceParams: PriceHistoryParams = {
        token: 'ETH',
        chain: 'ethereum',
        startTime: Date.now() - 86400000,
        endTime: Date.now(),
      };

      const result = await agent.getPriceHistory(priceParams);

      expect(result).toBeDefined();
    });
  });

  describe('plan', () => {
    it('should create portfolio analysis plan', async () => {
      const task = {
        id: 'task-1',
        type: 'analytics_get_portfolio',
        params: {
          address: '0xWallet',
          chains: ['ethereum'],
        } as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.taskId).toBe('task-1');
    });

    it('should create transaction analysis plan', async () => {
      const task = {
        id: 'task-2',
        type: 'analytics_analyze_tx',
        params: {
          address: '0xWallet',
          chain: 'ethereum',
        } as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
    });
  });

  describe('validate', () => {
    it('should validate successful portfolio result', async () => {
      const result = {
        success: true,
        data: {
          totalValueUSD: 10000,
          chains: ['ethereum'],
          assets: [
            {
              token: 'ETH',
              balance: '5',
              valueUSD: 10000,
              percentage: 100,
            },
          ],
          lastUpdated: new Date(),
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(true);
    });

    it('should reject negative total value', async () => {
      const result = {
        success: true,
        data: {
          totalValueUSD: -1000,
          chains: ['ethereum'],
          assets: [],
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Total value cannot be negative');
    });

    it('should reject invalid transaction count', async () => {
      const result = {
        success: true,
        data: {
          totalTransactions: -5,
          uniqueAddresses: 10,
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Transaction count cannot be negative');
    });

    it('should reject invalid gas usage', async () => {
      const result = {
        success: true,
        data: {
          totalGasUsed: '-100',
          totalCostUSD: 50,
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Gas used cannot be negative');
    });

    it('should reject impossible percent return', async () => {
      const result = {
        success: true,
        data: {
          percentReturn: -150, // Can't lose more than 100%
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors?.some((e) => e.includes('percent return'))).toBe(true);
    });
  });
});
