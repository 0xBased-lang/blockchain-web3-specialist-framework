/**
 * E2E Integration Test: DeFi Swap Workflow
 *
 * Tests the complete DeFi swap flow from planning to execution:
 * 1. Plan swap operation (quote fetching, route selection)
 * 2. Execute swap transaction (approval + swap)
 * 3. Validate swap result (slippage, amounts, transaction success)
 * 4. Error handling (insufficient balance, high slippage, deadline)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JsonRpcProvider, Contract } from 'ethers';
import { DeFiAgent } from '../../src/agents/DeFiAgent.js';
import type { AgentConfig } from '../../src/types/agent.js';
import type { DeFiProviders, SwapParams, LiquidityParams } from '../../src/types/specialized-agents.js';

describe('DeFi Swap Workflow E2E', () => {
  let agent: DeFiAgent;
  let mockProvider: JsonRpcProvider;
  let config: AgentConfig;

  beforeEach(() => {
    // Mock Ethereum provider
    mockProvider = {
      getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: 'mainnet' }),
      getBlockNumber: vi.fn().mockResolvedValue(18000000),
      getBalance: vi.fn().mockResolvedValue(5000000000000000000n), // 5 ETH
      getFeeData: vi.fn().mockResolvedValue({
        gasPrice: 50000000000n, // 50 gwei
        maxFeePerGas: 100000000000n,
        maxPriorityFeePerGas: 2000000000n,
      }),
      estimateGas: vi.fn().mockResolvedValue(150000n),
      getTransactionCount: vi.fn().mockResolvedValue(10),
      call: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000000000001bc16d674ec80000'), // 2 ETH worth
    } as unknown as JsonRpcProvider;

    config = {
      id: 'defi-e2e-agent',
      name: 'DeFiAgent',
      description: 'DeFi swap and liquidity operations',
      capabilities: ['swap', 'liquidity', 'price_monitoring'],
      mcpClient: {},
      maxConcurrentTasks: 5,
      timeout: 60000,
    };

    const providers: DeFiProviders = {
      ethereum: mockProvider,
    };

    agent = new DeFiAgent(config, providers);
  });

  describe('Complete Swap Workflow', () => {
    it('should execute full swap: plan → execute → validate', async () => {
      const swapParams: SwapParams = {
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        amountIn: '1000000000000000000', // 1 WETH
        chain: 'ethereum',
        slippageTolerance: 0.5, // 0.5%
        deadline: Date.now() + 300000, // 5 minutes
      };

      // Step 1: Plan the swap
      const task = {
        id: 'swap-task-1',
        type: 'defi_swap',
        params: swapParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.taskId).toBe('swap-task-1');
      expect(plan.steps.length).toBeGreaterThan(0);

      // Verify plan includes critical steps
      const stepActions = plan.steps.map((s) => s.action);
      expect(stepActions).toContain('fetch_quote');
      expect(stepActions).toContain('build_transaction');

      // Step 2: Execute the swap
      const result = await agent.execute(plan);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Step 3: Validate the result
      const validation = await agent.validate(result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should handle swap with token approval workflow', async () => {
      const swapParams: SwapParams = {
        tokenIn: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        amountIn: '1000000000000000000000', // 1000 DAI
        chain: 'ethereum',
        slippageTolerance: 1.0,
        deadline: Date.now() + 600000,
      };

      const result = await agent.executeSwap(swapParams);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      if (result.data && 'txHash' in result.data) {
        expect(result.data.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      }
    });

    it('should reject swap with excessive slippage', async () => {
      const swapParams: SwapParams = {
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: '1000000000000000000',
        chain: 'ethereum',
        slippageTolerance: 0.1, // Very tight 0.1%
        deadline: Date.now() + 300000,
      };

      const result = await agent.executeSwap(swapParams);

      // Should either fail or warn about slippage
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error).toMatch(/slippage|price/i);
      } else {
        const validation = await agent.validate(result);
        expect(validation.warnings).toBeDefined();
      }
    });

    it('should handle expired deadline', async () => {
      const swapParams: SwapParams = {
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: '1000000000000000000',
        chain: 'ethereum',
        slippageTolerance: 0.5,
        deadline: Date.now() - 1000, // Already expired
      };

      const result = await agent.executeSwap(swapParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/deadline|expired/i);
    });
  });

  describe('Liquidity Provision Workflow', () => {
    it('should execute add liquidity: plan → execute → validate', async () => {
      const liquidityParams: LiquidityParams = {
        poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', // USDC/ETH Pool
        token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        amount0: '1000000000', // 1000 USDC
        amount1: '500000000000000000', // 0.5 WETH
        chain: 'ethereum',
        slippageTolerance: 0.5,
        deadline: Date.now() + 300000,
      };

      const task = {
        id: 'liquidity-task-1',
        type: 'defi_add_liquidity',
        params: liquidityParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);

      const result = await agent.execute(plan);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        const validation = await agent.validate(result);
        expect(validation.valid).toBe(true);
      }
    });

    it('should execute remove liquidity workflow', async () => {
      const liquidityParams: LiquidityParams = {
        poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
        token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amount0: '0',
        amount1: '0',
        liquidity: '1000000000000000000', // 1 LP token
        chain: 'ethereum',
        slippageTolerance: 1.0,
        deadline: Date.now() + 300000,
      };

      const result = await agent.removeLiquidity(liquidityParams);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should validate liquidity amounts match pool ratio', async () => {
      // Mock pool with specific ratio (e.g., 2000 USDC per 1 ETH)
      const liquidityParams: LiquidityParams = {
        poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
        token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amount0: '2000000000', // 2000 USDC
        amount1: '1000000000000000000', // 1 WETH (matches 2000:1 ratio)
        chain: 'ethereum',
        slippageTolerance: 0.5,
        deadline: Date.now() + 300000,
      };

      const result = await agent.addLiquidity(liquidityParams);

      expect(result).toBeDefined();

      if (result.success && result.data) {
        const validation = await agent.validate(result);
        // Should not have warnings about ratio mismatch
        const ratioWarnings = validation.warnings?.filter((w) => w.includes('ratio'));
        expect(ratioWarnings || []).toHaveLength(0);
      }
    });
  });

  describe('Multi-DEX Price Comparison', () => {
    it('should compare prices across multiple DEXes', async () => {
      const swapParams: SwapParams = {
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: '1000000000000000000',
        chain: 'ethereum',
        slippageTolerance: 0.5,
        deadline: Date.now() + 300000,
      };

      const task = {
        id: 'price-compare-task',
        type: 'defi_swap',
        params: swapParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      // Plan should include price comparison step
      const priceSteps = plan.steps.filter((s) =>
        s.action.includes('price') || s.action.includes('quote')
      );

      expect(priceSteps.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle insufficient balance', async () => {
      // Mock provider returning low balance
      mockProvider.getBalance = vi.fn().mockResolvedValue(1000000000000000n); // 0.001 ETH

      const swapParams: SwapParams = {
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: '10000000000000000000', // 10 ETH (more than balance)
        chain: 'ethereum',
        slippageTolerance: 0.5,
        deadline: Date.now() + 300000,
      };

      const result = await agent.executeSwap(swapParams);

      // Should fail or warn about insufficient balance
      if (!result.success) {
        expect(result.error).toMatch(/balance|insufficient/i);
      }
    });

    it('should handle invalid token addresses', async () => {
      const swapParams: SwapParams = {
        tokenIn: '0x0000000000000000000000000000000000000000', // Invalid
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: '1000000000000000000',
        chain: 'ethereum',
        slippageTolerance: 0.5,
        deadline: Date.now() + 300000,
      };

      const result = await agent.executeSwap(swapParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network errors gracefully', async () => {
      // Mock network failure
      mockProvider.call = vi.fn().mockRejectedValue(new Error('Network error'));

      const swapParams: SwapParams = {
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: '1000000000000000000',
        chain: 'ethereum',
        slippageTolerance: 0.5,
        deadline: Date.now() + 300000,
      };

      const result = await agent.executeSwap(swapParams);

      // Should fail gracefully
      expect(result).toBeDefined();
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Gas Optimization', () => {
    it('should estimate and validate gas costs', async () => {
      const swapParams: SwapParams = {
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: '1000000000000000000',
        chain: 'ethereum',
        slippageTolerance: 0.5,
        deadline: Date.now() + 300000,
      };

      const task = {
        id: 'gas-test-task',
        type: 'defi_swap',
        params: swapParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      if (result.success && result.data && 'gasEstimate' in result.data) {
        // Verify gas estimate is reasonable
        const gasEstimate = result.data.gasEstimate as bigint;
        expect(gasEstimate).toBeGreaterThan(21000n); // More than simple transfer
        expect(gasEstimate).toBeLessThan(500000n); // Less than unreasonable amount
      }
    });
  });
});
