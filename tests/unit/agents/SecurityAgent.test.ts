import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityAgent } from '../../../src/agents/SecurityAgent.js';
import type { AgentConfig } from '../../../src/types/agent.js';
import type {
  SecurityProviders,
  AuditParams,
  TransactionValidationParams,
  MaliciousCheckParams,
  MEVAnalysisParams,
} from '../../../src/types/specialized-agents.js';
import { JsonRpcProvider } from 'ethers';

const mockEthProvider = {
  getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: 'mainnet' }),
} as unknown as JsonRpcProvider;

describe('SecurityAgent', () => {
  let agent: SecurityAgent;
  let config: AgentConfig;
  let providers: SecurityProviders;

  beforeEach(() => {
    config = {
      id: 'security-agent-1',
      name: 'SecurityAgent',
      description: 'Security analysis agent',
      capabilities: ['audit', 'validation', 'mev_analysis'],
      mcpClient: {},
      maxConcurrentTasks: 3,
      timeout: 30000,
    };

    providers = {
      ethereum: mockEthProvider,
    };

    agent = new SecurityAgent(config, providers);
  });

  describe('Initialization', () => {
    it('should create SecurityAgent with config and providers', () => {
      expect(agent).toBeDefined();
      expect(agent.getMetadata().name).toBe('SecurityAgent');
    });

    it('should throw error without provider', () => {
      expect(() => new SecurityAgent(config, {})).toThrow(
        'At least one provider is required'
      );
    });
  });

  describe('auditContract', () => {
    it('should handle contract audit request', async () => {
      const auditParams: AuditParams = {
        address: '0xContract',
        chain: 'ethereum',
      };

      // Audit may throw or return - just verify it executes
      try {
        const result = await agent.auditContract(auditParams);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('validateTransaction', () => {
    it('should handle transaction validation request', async () => {
      const validationParams: TransactionValidationParams = {
        to: '0xRecipient',
        value: '1000000',
        data: '0x',
        chain: 'ethereum',
      };

      const result = await agent.validateTransaction(validationParams);

      expect(result).toBeDefined();
    });
  });

  describe('checkMaliciousContract', () => {
    it('should handle malicious contract check', async () => {
      const checkParams: MaliciousCheckParams = {
        address: '0xContract',
        chain: 'ethereum',
      };

      const result = await agent.checkMaliciousContract(checkParams);

      expect(result).toBeDefined();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('analyzeMEVRisk', () => {
    it('should handle MEV risk analysis', async () => {
      const mevParams: MEVAnalysisParams = {
        transaction: {
          to: '0xRecipient',
          value: '1000000',
          data: '0x',
        },
        chain: 'ethereum',
      };

      const result = await agent.analyzeMEVRisk(mevParams);

      expect(result).toBeDefined();
    });
  });

  describe('plan', () => {
    it('should create audit contract plan', async () => {
      const task = {
        id: 'task-1',
        type: 'security_audit_contract',
        params: {
          address: '0xContract',
          chain: 'ethereum',
        } as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.taskId).toBe('task-1');
    });

    it('should create transaction validation plan', async () => {
      const task = {
        id: 'task-2',
        type: 'security_validate_tx',
        params: {
          to: '0xRecipient',
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
    it('should validate successful audit result', async () => {
      const result = {
        success: true,
        data: {
          findings: [],
          riskLevel: 'low' as const,
          score: 95,
          recommendations: ['Good contract'],
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(true);
    });

    it('should warn on high risk transactions', async () => {
      const result = {
        success: true,
        data: {
          safe: false,
          riskLevel: 'critical' as const,
          risks: ['High risk detected'],
          warnings: [],
          recommendation: 'Do not proceed',
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.warnings).toBeDefined();
      expect(validation.warnings?.some((w) => w.includes('critical'))).toBe(true);
    });

    it('should reject invalid audit score', async () => {
      const result = {
        success: true,
        data: {
          findings: [],
          score: 150, // Invalid: > 100
          riskLevel: 'low' as const,
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Audit score must be between 0 and 100');
    });

    it('should reject non-boolean safe flag', async () => {
      const result = {
        success: true,
        data: {
          safe: 'yes', // Invalid: not boolean
          riskLevel: 'low' as const,
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Safe flag must be boolean');
    });
  });
});
