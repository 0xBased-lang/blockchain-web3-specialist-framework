/**
 * TransactionSimulator Tests
 *
 * Tests for transaction simulation and risk assessment.
 *
 * CRITICAL: These tests validate our safety mechanisms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JsonRpcProvider } from 'ethers';
import { TransactionSimulator } from '../../../src/subagents/TransactionSimulator.js';
import {
  type SimulationRequest,
  type RiskIssue,
  SimulationStatus,
  SimulationProvider,
} from '../../../src/types/simulation.js';

describe('TransactionSimulator', () => {
  let provider: JsonRpcProvider;
  let simulator: TransactionSimulator;

  beforeEach(() => {
    // Mock provider
    provider = {
      call: vi.fn().mockResolvedValue('0x'),
      estimateGas: vi.fn().mockResolvedValue(21000n),
      getBlock: vi.fn().mockResolvedValue({
        number: 12345,
        timestamp: Math.floor(Date.now() / 1000),
      }),
    } as unknown as JsonRpcProvider;

    simulator = new TransactionSimulator(provider);
  });

  describe('Successful Simulation', () => {
    it('should simulate successful transaction', async () => {
      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '1000000000000000000', // 1 ETH
      };

      const result = await simulator.simulate(request);

      expect(result.status).toBe(SimulationStatus.SUCCESS);
      expect(result.success).toBe(true);
      expect(result.gasUsed).toBeGreaterThan(0n);
      expect(result.provider).toBe(SimulationProvider.LOCAL);
      expect(result.simulatedAt).toBeInstanceOf(Date);
    });

    it('should simulate contract call with data', async () => {
      provider.call = vi
        .fn()
        .mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000001');

      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        data: '0x70a08231000000000000000000000000' + '1234567890123456789012345678901234567890',
      };

      const result = await simulator.simulate(request);

      expect(result.success).toBe(true);
      expect(result.returnData).toBeDefined();
    });

    it('should estimate gas correctly', async () => {
      provider.estimateGas = vi.fn().mockResolvedValue(50000n);

      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '1000000000000000000',
      };

      const result = await simulator.simulate(request);

      expect(result.gasUsed).toBe(50000n);
    });
  });

  describe('Failed Simulation', () => {
    it('should detect revert', async () => {
      provider.call = vi.fn().mockRejectedValue(new Error('execution reverted'));

      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        data: '0xbadfunction',
      };

      const result = await simulator.simulate(request);

      expect(result.status).toBe(SimulationStatus.REVERT);
      expect(result.success).toBe(false);
      expect(result.error).toContain('reverted');
    });

    it('should detect revert reason', async () => {
      provider.call = vi
        .fn()
        .mockRejectedValue(
          new Error("execution reverted with reason string 'Insufficient balance'")
        );

      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        data: '0x',
      };

      const result = await simulator.simulate(request);

      expect(result.status).toBe(SimulationStatus.REVERT);
      expect(result.revertReason).toBe('Insufficient balance');
    });

    it('should detect out of gas', async () => {
      provider.call = vi.fn().mockRejectedValue(new Error('out of gas'));

      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        gasLimit: '1000',
      };

      const result = await simulator.simulate(request);

      expect(result.status).toBe(SimulationStatus.FAIL);
      expect(result.error).toContain('out of gas');
    });

    it('should detect insufficient balance', async () => {
      provider.call = vi.fn().mockRejectedValue(new Error('insufficient funds for transfer'));

      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '1000000000000000000000', // 1000 ETH
      };

      const result = await simulator.simulate(request);

      expect(result.status).toBe(SimulationStatus.FAIL);
      expect(result.error).toContain('insufficient funds');
    });

    it('should detect nonce errors', async () => {
      provider.call = vi.fn().mockRejectedValue(new Error('nonce too low'));

      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
      };

      const result = await simulator.simulate(request);

      expect(result.error).toContain('nonce too low');
    });
  });

  describe('Risk Assessment', () => {
    it('should assess low risk for successful simple transfer', async () => {
      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '1000000000000000000',
      };

      const { result, risk } = await simulator.simulateWithRiskAssessment(request);

      expect(result.success).toBe(true);
      expect(risk.level).toBe('low');
      expect(risk.recommendations).toContain('Transaction appears safe to execute');
    });

    it('should assess critical risk for reverted transaction', async () => {
      provider.call = vi.fn().mockRejectedValue(new Error('execution reverted'));

      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        data: '0xbadfunction',
      };

      const { result, risk } = await simulator.simulateWithRiskAssessment(request);

      expect(result.success).toBe(false);
      expect(risk.level).toBe('critical');
      expect(risk.issues).toHaveLength(1);
      expect(risk.issues[0]?.severity).toBe('critical');
      expect(risk.recommendations).toContain('DO NOT EXECUTE - Critical issues detected');
    });

    it('should warn about high gas usage', async () => {
      provider.estimateGas = vi.fn().mockResolvedValue(15000000n); // 15M gas

      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        data: '0xcomplex',
      };

      const { result, risk } = await simulator.simulateWithRiskAssessment(request);

      expect(result.success).toBe(true);
      expect(risk.warnings).toContain('Extremely high gas usage detected');
      expect(risk.issues.some((i: RiskIssue) => i.category === 'gas')).toBe(true);
    });

    it('should detect potential reentrancy', async () => {
      provider.call = vi.fn().mockResolvedValue('0x');

      const request: SimulationRequest = {
        chain: 'ethereum',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        data: '0x',
      };

      // Manually inject trace with reentrancy pattern
      const simulateResult = await simulator.simulate(request);
      simulateResult.trace = {
        type: 'CALL',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        calls: [
          {
            type: 'CALL',
            from: '0x0987654321098765432109876543210987654321',
            to: '0x1111111111111111111111111111111111111111',
            calls: [
              {
                type: 'CALL',
                from: '0x1111111111111111111111111111111111111111',
                to: '0x0987654321098765432109876543210987654321', // Reentrancy!
              },
            ],
          },
        ],
      };

      // Create new simulator to test with trace
      const testSimulator = new TransactionSimulator(provider);
      const risk = (testSimulator as any).assessRisk(simulateResult);

      expect(risk.warnings).toContain('CRITICAL: Potential reentrancy detected');
      expect(risk.issues.some((i: RiskIssue) => i.category === 'reentrancy')).toBe(true);
      expect(risk.level).toBe('critical');
    });
  });

  describe('Configuration', () => {
    it('should use custom timeout', () => {
      const customSimulator = new TransactionSimulator(provider, {
        provider: SimulationProvider.LOCAL,
        timeout: 60000,
      });

      const stats = customSimulator.getStats();
      expect(stats.provider).toBe(SimulationProvider.LOCAL);
    });

    it('should enable trace by default', () => {
      const stats = simulator.getStats();
      expect(stats.includeTrace).toBe(true);
      expect(stats.includeStateDiff).toBe(true);
    });

    it('should support disabling trace', () => {
      const customSimulator = new TransactionSimulator(provider, {
        provider: SimulationProvider.LOCAL,
        includeTrace: false,
        includeStateDiff: false,
      });

      const stats = customSimulator.getStats();
      expect(stats.includeTrace).toBe(false);
      expect(stats.includeStateDiff).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should validate simulation request', async () => {
      const invalidRequest = {
        chain: 'invalid-chain',
        from: '0x1234',
      } as any;

      await expect(simulator.simulate(invalidRequest)).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      const invalidRequest = {
        to: '0x0987654321098765432109876543210987654321',
      } as any;

      await expect(simulator.simulate(invalidRequest)).rejects.toThrow();
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', () => {
      const stats = simulator.getStats();

      expect(stats).toHaveProperty('provider');
      expect(stats).toHaveProperty('includeTrace');
      expect(stats).toHaveProperty('includeStateDiff');
      expect(stats.provider).toBe(SimulationProvider.LOCAL);
    });
  });
});
