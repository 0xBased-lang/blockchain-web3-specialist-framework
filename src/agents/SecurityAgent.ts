/**
 * Security Agent
 *
 * Specialized agent for security operations:
 * - Smart contract auditing
 * - Transaction validation (pre-flight checks)
 * - Malicious contract detection
 * - MEV risk analysis
 * - Continuous contract monitoring
 * - Security report generation
 *
 * Integrates with:
 * - ContractAnalyzer (bytecode/ABI analysis)
 * - TransactionSimulator (transaction simulation)
 */

import { JsonRpcProvider } from 'ethers';
import { SpecializedAgentBase } from './SpecializedAgentBase.js';
import { ContractAnalyzer } from '../subagents/ContractAnalyzer.js';
import { TransactionSimulator } from '../subagents/TransactionSimulator.js';
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
  AuditParams,
  AuditResult,
  TransactionValidationParams,
  TransactionValidationResult,
  MaliciousCheckParams,
  MEVAnalysisParams,
  MEVAnalysisResult,
  SecurityAgentConfig,
  SecurityTaskType,
  VulnerabilityFinding,
} from '../types/specialized-agents.js';
import { logger } from '../utils/index.js';

/**
 * Providers for security operations
 */
export interface SecurityProviders {
  ethereum?: JsonRpcProvider;
  polygon?: JsonRpcProvider;
}

/**
 * Security Agent
 *
 * Handles all security-related operations with comprehensive analysis.
 */
export class SecurityAgent extends SpecializedAgentBase {
  private readonly _providers: SecurityProviders;
  private readonly _securityConfig: SecurityAgentConfig;
  private readonly contractAnalyzer: ContractAnalyzer;
  private readonly _simulator: TransactionSimulator;

  // Optimization utilities
  private readonly batchers: Map<string, RPCBatcher> = new Map();

  constructor(
    config: AgentConfig,
    providers: SecurityProviders,
    securityConfig: SecurityAgentConfig = {}
  ) {
    super(config);

    this._providers = providers;
    this._securityConfig = securityConfig;

    // Initialize subagents
    const primaryProvider = providers.ethereum || providers.polygon;
    if (!primaryProvider) {
      throw new Error('At least one provider is required for SecurityAgent');
    }

    this.contractAnalyzer = new ContractAnalyzer({ ethereumProvider: primaryProvider });
    this._simulator = new TransactionSimulator(primaryProvider);

    // Initialize RPC batchers for each provider
    if (providers.ethereum) {
      this.batchers.set('ethereum', new RPCBatcher(providers.ethereum._getConnection().url, {
        maxBatchSize: 50,
        maxWaitTime: 10,
        debug: false,
      }));
    }
    if (providers.polygon) {
      this.batchers.set('polygon', new RPCBatcher(providers.polygon._getConnection().url, {
        maxBatchSize: 50,
        maxWaitTime: 10,
        debug: false,
      }));
    }

    logger.info('SecurityAgent initialized', {
      id: this.id,
      chains: Object.keys(providers),
      batchingEnabled: this.batchers.size > 0,
    });
  }

  /**
   * ========================================================================
   * DOMAIN-SPECIFIC METHODS
   * ========================================================================
   */

  /**
   * Audit a smart contract
   *
   * @param params - Audit parameters
   * @returns Audit result
   */
  async auditContract(params: AuditParams): Promise<AuditResult> {
    try {
      const result = await this.executeDomainTask<AuditResult>(
        'security_audit_contract',
        params as unknown as Record<string, unknown>
      );
      return result;
    } catch (error) {
      logger.error('auditContract failed', { error, params });
      throw error;
    }
  }

  /**
   * Validate a transaction before execution
   *
   * @param params - Transaction parameters
   * @returns Validation result
   */
  async validateTransaction(
    params: TransactionValidationParams
  ): Promise<TransactionValidationResult> {
    try {
      const result = await this.executeDomainTask<TransactionValidationResult>(
        'security_validate_tx',
        params as unknown as Record<string, unknown>
      );
      return result;
    } catch (error) {
      logger.error('validateTransaction failed', { error, params });
      throw error;
    }
  }

  /**
   * Check if a contract is malicious
   *
   * @param params - Check parameters
   * @returns Whether contract is malicious
   */
  async checkMaliciousContract(params: MaliciousCheckParams): Promise<boolean> {
    try {
      const result = await this.executeDomainTask<{ malicious: boolean }>(
        'security_check_malicious',
        params as unknown as Record<string, unknown>
      );
      return result.malicious;
    } catch (error) {
      logger.error('checkMaliciousContract failed', { error, params });
      return false;
    }
  }

  /**
   * Analyze MEV risk for a transaction
   *
   * @param params - MEV analysis parameters
   * @returns MEV analysis result
   */
  async analyzeMEVRisk(params: MEVAnalysisParams): Promise<MEVAnalysisResult> {
    try {
      const result = await this.executeDomainTask<MEVAnalysisResult>(
        'security_analyze_mev',
        params as unknown as Record<string, unknown>
      );
      return result;
    } catch (error) {
      logger.error('analyzeMEVRisk failed', { error, params });
      throw error;
    }
  }

  /**
   * Monitor a contract for security issues
   *
   * @param params - Monitor parameters
   */
  async monitorContract(params: {
    address: string;
    chain: string;
    interval: number;
    alertOnNewFindings?: boolean;
  }): Promise<void> {
    logger.info('Starting contract monitoring', params);

    let previousFindings = 0;

    const check = async (): Promise<void> => {
      try {
        // Cache audit results with 30-second time bucket to avoid duplicate audits
        const timeBucket = Math.floor(Date.now() / 30000) * 30000;
        const cacheKey = `sec-monitor:${params.address}:${timeBucket}`;

        const audit = await sharedCache.get(
          cacheKey,
          async () => {
            return await this.auditContract({
              address: params.address,
              chain: params.chain as 'ethereum',
            });
          },
          30000 // 30 second TTL
        );

        if (params.alertOnNewFindings && audit.findings.length > previousFindings) {
          logger.warn('New security findings detected!', {
            address: params.address,
            newFindings: audit.findings.length - previousFindings,
            totalFindings: audit.findings.length,
          });
        }

        previousFindings = audit.findings.length;
      } catch (error) {
        logger.error('Contract monitoring check failed', { error });
      }
    };

    // Initial check
    await check();

    // Set up interval
    setInterval(() => {
      void check();
    }, params.interval);

    logger.info('Contract monitoring started', {
      address: params.address,
      interval: params.interval,
    });
  }

  /**
   * Generate a security report
   *
   * @param params - Report parameters
   * @returns Report as string
   */
  async generateReport(params: { address: string; chain: string }): Promise<string> {
    try {
      const result = await this.executeDomainTask<{ report: string }>(
        'security_generate_report',
        params
      );
      return result.report;
    } catch (error) {
      logger.error('generateReport failed', { error, params });
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
    logger.info(`SecurityAgent planning task: ${task.type}`, { taskId: task.id });

    const taskType = task.type as SecurityTaskType;

    switch (taskType) {
      case 'security_audit_contract':
        return this.planAuditContract(task);
      case 'security_validate_tx':
        return this.planValidateTransaction(task);
      case 'security_check_malicious':
        return this.planCheckMalicious(task);
      case 'security_analyze_mev':
        return this.planAnalyzeMEV(task);
      case 'security_generate_report':
        return this.planGenerateReport(task);
      default:
        throw new Error(`Unknown Security task type: ${task.type}`);
    }
  }

  /**
   * Plan audit contract task
   */
  private planAuditContract(task: Task): TaskPlan {
    const params = task.params as unknown as AuditParams;
    const stepPrefix = task.id;

    const steps: Step[] = [
      // Step 1: Analyze bytecode
      this.createStep(
        `${stepPrefix}-analyze-bytecode`,
        'analyze_contract_bytecode',
        { address: params.address, chain: params.chain },
        [],
        15000
      ),

      // Step 2: Check known vulnerabilities
      this.createStep(
        `${stepPrefix}-check-vulnerabilities`,
        'check_known_vulnerabilities',
        { address: params.address },
        [],
        10000
      ),

      // Step 3: Generate audit report
      this.createStep(
        `${stepPrefix}-generate-report`,
        'compile_audit_results',
        { address: params.address, includeSourceCode: params.includeSourceCode },
        [`${stepPrefix}-analyze-bytecode`, `${stepPrefix}-check-vulnerabilities`],
        5000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: this.buildDependencies(steps),
      estimatedTime: steps.reduce((sum, s) => sum + s.timeout, 0),
      requiredResources: [{ type: 'rpc', name: `${params.chain}-rpc`, required: true }],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan validate transaction task
   */
  private planValidateTransaction(task: Task): TaskPlan {
    const params = task.params as unknown as TransactionValidationParams;
    const stepPrefix = task.id;

    const steps: Step[] = [
      // Step 1: Analyze target contract
      this.createStep(
        `${stepPrefix}-analyze-target`,
        'analyze_target_contract',
        { address: params.to, chain: params.chain },
        [],
        10000
      ),

      // Step 2: Simulate transaction
      this.createStep(
        `${stepPrefix}-simulate`,
        'simulate_and_assess_risk',
        params as unknown as Record<string, unknown>,
        [`${stepPrefix}-analyze-target`],
        15000
      ),

      // Step 3: Compile validation result
      this.createStep(
        `${stepPrefix}-compile-result`,
        'compile_validation_result',
        {},
        [`${stepPrefix}-simulate`],
        2000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: this.buildDependencies(steps),
      estimatedTime: steps.reduce((sum, s) => sum + s.timeout, 0),
      requiredResources: [{ type: 'rpc', name: `${params.chain}-rpc`, required: true }],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan check malicious task
   */
  private planCheckMalicious(task: Task): TaskPlan {
    const params = task.params as unknown as MaliciousCheckParams;
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-check-patterns`,
        'check_malicious_patterns',
        params as unknown as Record<string, unknown>,
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
   * Plan analyze MEV task
   */
  private planAnalyzeMEV(task: Task): TaskPlan {
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-analyze-mev`,
        'analyze_mev_vulnerability',
        task.params,
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
      requiredResources: [{ type: 'rpc', name: 'ethereum-rpc', required: true }],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan generate report task
   */
  private planGenerateReport(task: Task): TaskPlan {
    const params = task.params as { address: string; chain: string };
    const stepPrefix = task.id;

    const steps: Step[] = [
      // Audit the contract
      this.createStep(
        `${stepPrefix}-audit`,
        'analyze_contract_bytecode',
        params,
        [],
        15000
      ),

      // Generate report
      this.createStep(
        `${stepPrefix}-format-report`,
        'format_security_report',
        {},
        [`${stepPrefix}-audit`],
        5000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: this.buildDependencies(steps),
      estimatedTime: steps.reduce((sum, s) => sum + s.timeout, 0),
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
    logger.debug(`Executing Security step: ${step.action}`, { stepId: step.id });

    try {
      switch (step.action) {
        case 'analyze_contract_bytecode':
          return await this.stepAnalyzeBytecode(step);

        case 'check_known_vulnerabilities':
          return await this.stepCheckVulnerabilities(step);

        case 'compile_audit_results':
          return await this.stepCompileAuditResults(step, previousResults);

        case 'analyze_target_contract':
          return await this.stepAnalyzeTargetContract(step);

        case 'simulate_and_assess_risk':
          return await this.stepSimulateAndAssessRisk(step);

        case 'compile_validation_result':
          return await this.stepCompileValidationResult(step, previousResults);

        case 'check_malicious_patterns':
          return await this.stepCheckMaliciousPatterns(step);

        case 'analyze_mev_vulnerability':
          return await this.stepAnalyzeMEVVulnerability(step);

        case 'format_security_report':
          return await this.stepFormatSecurityReport(step, previousResults);

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
   * Step: Analyze contract bytecode
   */
  private async stepAnalyzeBytecode(step: Step): Promise<Result> {
    const { address, chain } = step.params as { address: string; chain: string };

    logger.info('Analyzing contract bytecode', { address, chain });

    try {
      const analysis = await this.contractAnalyzer.analyzeContract({
        address,
        chain: chain as 'ethereum' | 'solana',
      });

      return this.createSuccessResult(analysis);
    } catch (error) {
      logger.error('Bytecode analysis failed', { error, address });
      return this.createFailureResult('Bytecode analysis failed');
    }
  }

  /**
   * Step: Check known vulnerabilities
   */
  private async stepCheckVulnerabilities(step: Step): Promise<Result> {
    const { address } = step.params as { address: string };

    // Cache vulnerability checks (static data, long TTL)
    const cacheKey = `sec-vulns:${address}`;

    const result = await sharedCache.get(
      cacheKey,
      async () => {
        logger.info('Checking known vulnerabilities', { address });

        // Mock vulnerability check
        // In production: check against vulnerability databases
        const knownVulnerabilities: VulnerabilityFinding[] = [];

        return { vulnerabilities: knownVulnerabilities };
      },
      600000 // 10 minute TTL (vulnerability databases don't change frequently)
    );

    return this.createSuccessResult(result);
  }

  /**
   * Step: Compile audit results
   */
  private async stepCompileAuditResults(
    step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result<AuditResult>> {
    const { address } = step.params as { address: string };
    const stepIds = Array.from(previousResults.keys());

    // Get bytecode analysis
    const bytecodeStepId = stepIds.find((id) => id.includes('analyze-bytecode'));
    const bytecodeAnalysis = bytecodeStepId
      ? this.getStepDataSafe<{ findings: VulnerabilityFinding[]; riskLevel: string }>(
          bytecodeStepId,
          previousResults
        )
      : undefined;

    // Get vulnerability check
    const vulnStepId = stepIds.find((id) => id.includes('check-vulnerabilities'));
    const vulnCheck = vulnStepId
      ? this.getStepDataSafe<{ vulnerabilities: VulnerabilityFinding[] }>(
          vulnStepId,
          previousResults
        )
      : undefined;

    const allFindings = [
      ...(bytecodeAnalysis?.findings || []),
      ...(vulnCheck?.vulnerabilities || []),
    ];

    // Calculate risk score
    const criticalCount = allFindings.filter((f) => f.severity === 'critical').length;
    const highCount = allFindings.filter((f) => f.severity === 'high').length;
    const score = Math.max(0, 100 - criticalCount * 25 - highCount * 10);

    const auditResult: AuditResult = {
      address,
      chain: 'ethereum',
      riskLevel: bytecodeAnalysis?.riskLevel as AuditResult['riskLevel'] || 'low',
      findings: allFindings,
      score,
      recommendations: [
        'Implement reentrancy guards on external calls',
        'Add access control modifiers to critical functions',
        'Consider using SafeMath for arithmetic operations',
      ],
      timestamp: Date.now(),
    };

    logger.info('Audit compiled', {
      address,
      riskLevel: auditResult.riskLevel,
      findingsCount: auditResult.findings.length,
      score: auditResult.score,
    });

    return this.createSuccessResult(auditResult);
  }

  /**
   * Step: Analyze target contract
   */
  private async stepAnalyzeTargetContract(step: Step): Promise<Result> {
    const { address } = step.params as { address: string };

    logger.info('Analyzing target contract', { address });

    // Mock analysis
    return this.createSuccessResult({
      safe: true,
      warnings: [],
    });
  }

  /**
   * Step: Simulate and assess risk
   */
  private async stepSimulateAndAssessRisk(_step: Step): Promise<Result> {
    logger.info('Simulating transaction and assessing risk');

    // Mock simulation
    const simulationResult = {
      success: true,
      gasUsed: '21000',
      safe: true,
      riskLevel: 'low' as const,
      risks: [] as string[],
      warnings: [] as string[],
    };

    return this.createSuccessResult(simulationResult);
  }

  /**
   * Step: Compile validation result
   */
  private async stepCompileValidationResult(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result<TransactionValidationResult>> {
    const stepIds = Array.from(previousResults.keys());

    const simulateStepId = stepIds.find((id) => id.includes('simulate'));
    const simResult = simulateStepId
      ? this.getStepDataSafe<{
          success: boolean;
          gasUsed: string;
          safe: boolean;
          riskLevel: string;
          risks: string[];
          warnings: string[];
        }>(simulateStepId, previousResults)
      : undefined;

    let validationResult: TransactionValidationResult = {
      safe: simResult?.safe ?? false,
      riskLevel: (simResult?.riskLevel as TransactionValidationResult['riskLevel']) || 'high',
      risks: simResult?.risks || [],
      warnings: simResult?.warnings || [],
      recommendation: simResult?.safe
        ? 'Transaction appears safe to execute'
        : 'Exercise caution before executing this transaction',
    };

    if (simResult) {
      validationResult = {
        ...validationResult,
        simulationResult: {
          success: simResult.success,
          gasUsed: simResult.gasUsed,
          stateChanges: [],
        },
      };
    }

    return this.createSuccessResult(validationResult);
  }

  /**
   * Step: Check malicious patterns
   */
  private async stepCheckMaliciousPatterns(step: Step): Promise<Result> {
    const { address } = step.params as { address: string };

    // Cache malicious pattern checks (5 minute TTL)
    const cacheKey = `sec-malicious:${address}`;

    const result = await sharedCache.get(
      cacheKey,
      async () => {
        logger.info('Checking for malicious patterns', { address });

        // Mock check
        const malicious = false;

        return { malicious };
      },
      300000 // 5 minute TTL
    );

    return this.createSuccessResult(result);
  }

  /**
   * Step: Analyze MEV vulnerability
   */
  private async stepAnalyzeMEVVulnerability(step: Step): Promise<Result<MEVAnalysisResult>> {
    const { transaction } = step.params as unknown as MEVAnalysisParams;

    logger.info('Analyzing MEV vulnerability', { to: transaction.to });

    // Mock MEV analysis
    const mevResult: MEVAnalysisResult = {
      vulnerable: false,
      riskLevel: 'low',
      vulnerabilities: [],
      recommendations: [
        'Consider using Flashbots for transaction privacy',
        'Set appropriate slippage tolerance',
      ],
    };

    return this.createSuccessResult(mevResult);
  }

  /**
   * Step: Format security report
   */
  private async stepFormatSecurityReport(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result> {
    const stepIds = Array.from(previousResults.keys());
    const auditStepId = stepIds.find((id) => id.includes('audit'));

    const audit = auditStepId
      ? this.getStepDataSafe<AuditResult>(auditStepId, previousResults)
      : undefined;

    if (!audit) {
      return this.createFailureResult('No audit data available');
    }

    const report = `
# Security Audit Report

**Contract**: ${audit.address}
**Chain**: ${audit.chain}
**Risk Level**: ${audit.riskLevel.toUpperCase()}
**Security Score**: ${audit.score}/100

## Findings (${audit.findings.length})

${audit.findings.map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\n   ${f.description}`).join('\n\n')}

## Recommendations

${audit.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---
Generated: ${new Date(audit.timestamp).toISOString()}
    `.trim();

    return this.createSuccessResult({ report });
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
      | AuditResult
      | TransactionValidationResult
      | MEVAnalysisResult;

    // Validate audit result
    if ('findings' in data) {
      if (!Array.isArray(data.findings)) {
        errors.push('Audit findings must be an array');
      }

      if ('score' in data && (data.score < 0 || data.score > 100)) {
        errors.push('Audit score must be between 0 and 100');
      }
    }

    // Validate transaction validation result
    if ('safe' in data && 'riskLevel' in data) {
      if (typeof data.safe !== 'boolean') {
        errors.push('Safe flag must be boolean');
      }

      if (data.riskLevel === 'critical' || data.riskLevel === 'high') {
        warnings.push(`High risk transaction detected: ${data.riskLevel}`);
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
