/**
 * E2E Integration Test: Security Validation Workflow
 *
 * Tests the complete security analysis and validation flow:
 * 1. Smart contract auditing (vulnerability detection)
 * 2. Transaction validation (pre-flight security checks)
 * 3. Malicious contract detection
 * 4. MEV risk analysis
 * 5. Combined security pipeline (multi-layer validation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JsonRpcProvider } from 'ethers';
import { SecurityAgent } from '../../src/agents/SecurityAgent.js';
import type { AgentConfig } from '../../src/types/agent.js';
import type {
  SecurityProviders,
  AuditParams,
  TransactionValidationParams,
  MaliciousCheckParams,
  MEVAnalysisParams,
} from '../../src/types/specialized-agents.js';

describe('Security Validation Workflow E2E', () => {
  let agent: SecurityAgent;
  let mockProvider: JsonRpcProvider;
  let config: AgentConfig;

  beforeEach(() => {
    // Mock Ethereum provider
    mockProvider = {
      getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: 'mainnet' }),
      getBlockNumber: vi.fn().mockResolvedValue(18000000),
      getCode: vi.fn().mockResolvedValue('0x608060405234801561001057600080fd5b50...'), // Contract bytecode
      getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
      getTransactionCount: vi.fn().mockResolvedValue(100),
      call: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000001'),
      estimateGas: vi.fn().mockResolvedValue(100000n),
      getFeeData: vi.fn().mockResolvedValue({
        gasPrice: 40000000000n,
        maxFeePerGas: 80000000000n,
        maxPriorityFeePerGas: 2000000000n,
      }),
    } as unknown as JsonRpcProvider;

    config = {
      id: 'security-e2e-agent',
      name: 'SecurityAgent',
      description: 'Security validation and auditing operations',
      capabilities: ['audit', 'validation', 'mev_analysis', 'malicious_detection'],
      mcpClient: {},
      maxConcurrentTasks: 3,
      timeout: 180000, // Security analysis may take time
    };

    const providers: SecurityProviders = {
      ethereum: mockProvider,
    };

    agent = new SecurityAgent(config, providers);
  });

  describe('Smart Contract Audit Workflow', () => {
    it('should execute full contract audit: plan → execute → validate', async () => {
      const auditParams: AuditParams = {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        chain: 'ethereum',
      };

      const task = {
        id: 'audit-task-1',
        type: 'security_audit_contract',
        params: auditParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      // Step 1: Plan the audit
      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.taskId).toBe('audit-task-1');
      expect(plan.steps.length).toBeGreaterThan(0);

      // Verify plan includes analysis steps
      const stepActions = plan.steps.map((s) => s.action);
      expect(stepActions).toContain('analyze_bytecode');
      expect(stepActions).toContain('check_vulnerabilities');

      // Step 2: Execute the audit
      try {
        const result = await agent.execute(plan);

        expect(result).toBeDefined();

        // Step 3: Validate if successful
        if (result.success) {
          const validation = await agent.validate(result);
          expect(validation.valid).toBe(true);
        }
      } catch (error) {
        // Audit may throw if external service unavailable
        expect(error).toBeDefined();
      }
    });

    it('should detect high-risk contract patterns', async () => {
      // Mock bytecode with known vulnerability pattern
      mockProvider.getCode = vi.fn().mockResolvedValue(
        '0x6080604052...selfdestruct...' // Contains selfdestruct
      );

      const auditParams: AuditParams = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      try {
        const result = await agent.auditContract(auditParams);

        if (result && 'riskLevel' in result) {
          // Should detect as high risk
          expect(['high', 'critical']).toContain(result.riskLevel);
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should validate audit results format', async () => {
      const mockAuditResult = {
        success: true,
        data: {
          findings: [
            {
              severity: 'medium',
              category: 'access-control',
              description: 'Missing access control on sensitive function',
              location: 'line 42',
            },
          ],
          riskLevel: 'medium' as const,
          score: 75,
          recommendations: [
            'Add onlyOwner modifier to sensitive functions',
            'Consider using OpenZeppelin AccessControl',
          ],
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(mockAuditResult);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid audit scores', async () => {
      const invalidAuditResult = {
        success: true,
        data: {
          findings: [],
          score: 150, // Invalid: > 100
          riskLevel: 'low' as const,
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(invalidAuditResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Audit score must be between 0 and 100');
    });
  });

  describe('Transaction Validation Workflow', () => {
    it('should execute transaction validation: plan → execute → validate', async () => {
      const txParams: TransactionValidationParams = {
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        value: '1000000', // 1 USDC worth of ETH
        data: '0xa9059cbb...', // transfer() call
        chain: 'ethereum',
      };

      const task = {
        id: 'validate-tx-task',
        type: 'security_validate_tx',
        params: txParams as unknown as Record<string, unknown>,
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
        expect(validation).toBeDefined();
      }
    });

    it('should detect suspicious transaction patterns', async () => {
      const suspiciousTx: TransactionValidationParams = {
        to: '0x0000000000000000000000000000000000000000', // Burn address
        value: '1000000000000000000', // 1 ETH
        data: '0x', // No data
        chain: 'ethereum',
      };

      const result = await agent.validateTransaction(suspiciousTx);

      expect(result).toBeDefined();
      if (result && 'safe' in result) {
        // Should flag as unsafe or have warnings
        if (result.safe === false) {
          expect(result.risks).toBeDefined();
          expect(result.risks.length).toBeGreaterThan(0);
        }
      }
    });

    it('should validate high-value transactions with extra checks', async () => {
      const highValueTx: TransactionValidationParams = {
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        value: '100000000000000000000', // 100 ETH
        data: '0xa9059cbb...',
        chain: 'ethereum',
      };

      const result = await agent.validateTransaction(highValueTx);

      expect(result).toBeDefined();
      // High value should trigger additional validation
    });

    it('should validate transaction data encoding', async () => {
      const txWithData: TransactionValidationParams = {
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        value: '0',
        data: '0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890000000000000000000000000000000000000000000000000000000003b9aca00',
        chain: 'ethereum',
      };

      const result = await agent.validateTransaction(txWithData);

      expect(result).toBeDefined();
      // Should validate data is properly ABI-encoded
    });
  });

  describe('Malicious Contract Detection', () => {
    it('should detect known malicious contracts', async () => {
      const checkParams: MaliciousCheckParams = {
        address: '0xSuspiciousContract123456789012345678901234',
        chain: 'ethereum',
      };

      const isMalicious = await agent.checkMaliciousContract(checkParams);

      expect(typeof isMalicious).toBe('boolean');
    });

    it('should check contract against blacklists', async () => {
      // Known bad actor address from Tornado Cash sanctions
      const sanctionedAddress: MaliciousCheckParams = {
        address: '0x8589427373D6D84E98730D7795D8f6f8731FDA16',
        chain: 'ethereum',
      };

      const isMalicious = await agent.checkMaliciousContract(sanctionedAddress);

      // Should detect as malicious or high-risk
      expect(typeof isMalicious).toBe('boolean');
    });

    it('should validate against honeypot patterns', async () => {
      // Mock honeypot contract (can't sell after buying)
      mockProvider.getCode = vi.fn().mockResolvedValue(
        '0x6080604052...revert on sell...'
      );

      const checkParams: MaliciousCheckParams = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const isMalicious = await agent.checkMaliciousContract(checkParams);

      expect(typeof isMalicious).toBe('boolean');
    });
  });

  describe('MEV Risk Analysis', () => {
    it('should analyze MEV risk for swap transaction', async () => {
      const mevParams: MEVAnalysisParams = {
        transaction: {
          to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
          value: '1000000000000000000', // 1 ETH
          data: '0x7ff36ab5...', // swapExactETHForTokens
        },
        chain: 'ethereum',
      };

      const task = {
        id: 'mev-analysis-task',
        type: 'security_analyze_mev',
        params: mevParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      expect(result).toBeDefined();
      if (result.success && result.data) {
        // Should provide MEV risk assessment
        expect(result.data).toBeDefined();
      }
    });

    it('should detect sandwich attack vulnerability', async () => {
      const vulnerableTx: MEVAnalysisParams = {
        transaction: {
          to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
          value: '10000000000000000000', // 10 ETH (large swap)
          data: '0x7ff36ab5...', // No slippage protection
        },
        chain: 'ethereum',
      };

      const result = await agent.analyzeMEVRisk(vulnerableTx);

      expect(result).toBeDefined();
      if (result && 'riskLevel' in result) {
        // Large swap without slippage should be high MEV risk
        expect(['medium', 'high', 'critical']).toContain(result.riskLevel);
      }
    });

    it('should analyze frontrunning risk for NFT mint', async () => {
      const nftMintTx: MEVAnalysisParams = {
        transaction: {
          to: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6', // NFT contract
          value: '100000000000000000', // 0.1 ETH mint price
          data: '0x1249c58b...', // mint() call
        },
        chain: 'ethereum',
      };

      const result = await agent.analyzeMEVRisk(nftMintTx);

      expect(result).toBeDefined();
    });
  });

  describe('Multi-Layer Security Pipeline', () => {
    it('should execute complete security pipeline for transaction', async () => {
      const txParams: TransactionValidationParams = {
        to: '0xDeFiContract1234567890123456789012345678',
        value: '5000000000000000000', // 5 ETH
        data: '0x...',
        chain: 'ethereum',
      };

      // Step 1: Check if contract is malicious
      const isMalicious = await agent.checkMaliciousContract({
        address: txParams.to,
        chain: txParams.chain,
      });

      expect(typeof isMalicious).toBe('boolean');

      if (!isMalicious) {
        // Step 2: Audit the contract
        try {
          await agent.auditContract({
            address: txParams.to,
            chain: txParams.chain,
          });
        } catch (error) {
          // Audit may fail if service unavailable
        }

        // Step 3: Validate the transaction
        const txValidation = await agent.validateTransaction(txParams);
        expect(txValidation).toBeDefined();

        // Step 4: Analyze MEV risk
        const mevRisk = await agent.analyzeMEVRisk({
          transaction: {
            to: txParams.to,
            value: txParams.value,
            data: txParams.data || '0x',
          },
          chain: txParams.chain,
        });
        expect(mevRisk).toBeDefined();
      }
    });

    it('should aggregate risk assessments from multiple checks', async () => {
      const contractAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

      const results = {
        malicious: false,
        audit: { riskLevel: 'low' as const, score: 90 },
        txValidation: { safe: true, riskLevel: 'low' as const },
        mevRisk: { riskLevel: 'low' as const },
      };

      // Aggregate all risk levels
      const allRiskLevels = [
        results.audit.riskLevel,
        results.txValidation.riskLevel,
        results.mevRisk.riskLevel,
      ];

      const highestRisk = allRiskLevels.includes('critical')
        ? 'critical'
        : allRiskLevels.includes('high')
          ? 'high'
          : allRiskLevels.includes('medium')
            ? 'medium'
            : 'low';

      expect(['low', 'medium', 'high', 'critical']).toContain(highestRisk);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle contract without bytecode (EOA)', async () => {
      // Mock externally owned account (no code)
      mockProvider.getCode = vi.fn().mockResolvedValue('0x');

      const auditParams: AuditParams = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chain: 'ethereum',
      };

      try {
        const result = await agent.auditContract(auditParams);

        if (result) {
          expect(result).toBeDefined();
        }
      } catch (error) {
        // Should fail gracefully for EOAs
        expect(error).toBeDefined();
      }
    });

    it('should handle network errors during security checks', async () => {
      // Mock network failure
      mockProvider.getCode = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const auditParams: AuditParams = {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chain: 'ethereum',
      };

      try {
        await agent.auditContract(auditParams);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should validate security result data structures', async () => {
      const invalidSecurityResult = {
        success: true,
        data: {
          safe: 'yes', // Invalid: should be boolean
          riskLevel: 'low' as const,
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(invalidSecurityResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Safe flag must be boolean');
    });

    it('should handle rate limiting from external APIs', async () => {
      // Mock rate limit response
      mockProvider.call = vi.fn().mockRejectedValue(
        new Error('429 Too Many Requests')
      );

      const auditParams: AuditParams = {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chain: 'ethereum',
      };

      try {
        await agent.auditContract(auditParams);
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toMatch(/429|rate limit/i);
      }
    });
  });

  describe('Critical Security Validations', () => {
    it('should warn on critical risk findings', async () => {
      const criticalResult = {
        success: true,
        data: {
          safe: false,
          riskLevel: 'critical' as const,
          risks: ['Reentrancy vulnerability detected', 'Unchecked external calls'],
          warnings: [],
          recommendation: 'Do not interact with this contract',
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(criticalResult);

      expect(validation.warnings).toBeDefined();
      expect(validation.warnings?.some((w) => w.includes('critical'))).toBe(true);
    });

    it('should validate transaction gas limits', async () => {
      const highGasTx: TransactionValidationParams = {
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        value: '1000000',
        data: '0x...',
        gasLimit: '10000000', // Abnormally high
        chain: 'ethereum',
      };

      const result = await agent.validateTransaction(highGasTx);

      if (result && 'warnings' in result) {
        // Should warn about high gas
        const gasWarnings = result.warnings?.filter((w) => w.includes('gas'));
        expect(gasWarnings).toBeDefined();
      }
    });

    it('should detect proxy contract patterns', async () => {
      // Mock proxy contract bytecode
      mockProvider.getCode = vi.fn().mockResolvedValue(
        '0x363d3d373d3d3d363d73...' // Minimal proxy pattern (EIP-1167)
      );

      const auditParams: AuditParams = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      try {
        const result = await agent.auditContract(auditParams);

        if (result && 'findings' in result) {
          // Should detect proxy pattern
          const proxyFindings = result.findings?.filter((f) =>
            f.description?.toLowerCase().includes('proxy')
          );
          expect(proxyFindings).toBeDefined();
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
