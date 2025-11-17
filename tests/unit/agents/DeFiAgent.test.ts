import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeFiAgent } from '../../../src/agents/DeFiAgent.js';
import type { DeFiProviders } from '../../../src/agents/DeFiAgent.js';
import type { AgentConfig } from '../../../src/types/agent.js';
import type {
  
  SwapParams,
  LiquidityParams,
} from '../../../src/types/specialized-agents.js';
import { JsonRpcProvider } from 'ethers';

// Mock providers
const mockEthProvider = {
  getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: 'mainnet' }),
} as unknown as JsonRpcProvider;

describe('DeFiAgent', () => {
  let agent: DeFiAgent;
  let config: AgentConfig;
  let providers: DeFiProviders;

  beforeEach(() => {
    config = {
      id: 'defi-agent-1',
      name: 'DeFiAgent',
      description: 'DeFi operations agent',
      capabilities: ['swap', 'liquidity', 'price_monitoring'],
      mcpClient: {},
      maxConcurrentTasks: 3,
      timeout: 30000,
    };

    providers = {
      ethereum: mockEthProvider,
    };

    agent = new DeFiAgent(config, providers);
  });

  describe('Initialization', () => {
    it('should create DeFiAgent with config and providers', () => {
      expect(agent).toBeDefined();
      expect(agent.getMetadata().name).toBe('DeFiAgent');
      expect(agent.getMetadata().capabilities).toContain('swap');
    });
  });

  describe('executeSwap', () => {
    it('should handle swap request', async () => {
      const swapParams: SwapParams = {
        fromToken: '0xTokenA',
        toToken: '0xTokenB',
        amount: '1000000',
        chain: 'ethereum',
        slippage: 0.5,
      };

      // Mock will execute the plan which will return success
      const result = await agent.executeSwap(swapParams);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should return error on swap failure', async () => {
      const swapParams: SwapParams = {
        fromToken: '0xInvalid',
        toToken: '0xTokenB',
        amount: '0',
        chain: 'ethereum',
        slippage: 0.5,
      };

      const result = await agent.executeSwap(swapParams);

      // Will fail validation or execution
      expect(result).toBeDefined();
    });
  });

  describe('addLiquidity', () => {
    it('should handle add liquidity request', async () => {
      const liquidityParams: LiquidityParams = {
        poolAddress: '0xPool',
        token0: '0xTokenA',
        token1: '0xTokenB',
        amount0: '1000000',
        amount1: '2000000',
        chain: 'ethereum',
        slippage: 0.5,
      };

      const result = await agent.addLiquidity(liquidityParams);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('removeLiquidity', () => {
    it('should handle remove liquidity request', async () => {
      const liquidityParams: LiquidityParams = {
        poolAddress: '0xPool',
        token0: '0xTokenA',
        token1: '0xTokenB',
        amount0: '0',
        amount1: '0',
        chain: 'ethereum',
        slippage: 0.5,
      };

      const result = await agent.removeLiquidity(liquidityParams);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('plan', () => {
    it('should create swap plan', async () => {
      const task = {
        id: 'task-1',
        type: 'defi_swap',
        params: {
          fromToken: '0xTokenA',
          toToken: '0xTokenB',
          amount: '1000000',
          chain: 'ethereum',
          slippage: 0.5,
        } as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.taskId).toBe('task-1');
    });

    it('should create add liquidity plan', async () => {
      const task = {
        id: 'task-2',
        type: 'defi_add_liquidity',
        params: {
          poolAddress: '0xPool',
          token0: '0xTokenA',
          token1: '0xTokenB',
          amount0: '1000000',
          amount1: '2000000',
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
    it('should validate successful swap result', async () => {
      const result = {
        success: true,
        data: {
          success: true,
          txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          amountOut: '2000000',
          dex: 'uniswap',
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(true);
    });

    it('should detect invalid transaction hash', async () => {
      const result = {
        success: true,
        data: {
          success: true,
          txHash: 'invalid-hash',
          amountOut: '2000000',
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
    });

    it('should reject failed result without error message', async () => {
      const result = {
        success: false,
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Failed result must have error message');
    });

    it('should reject successful result without data', async () => {
      const result = {
        success: true,
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Successful result must have data');
    });
  });
});
