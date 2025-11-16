/**
 * Transaction Simulator
 *
 * Simulates transactions before execution to detect errors, estimate gas,
 * and validate state changes.
 *
 * CRITICAL SECURITY COMPONENT
 * - NEVER execute transactions without simulation
 * - ALWAYS validate simulation results
 * - NEVER ignore revert warnings
 *
 * Supports:
 * - Local fork simulation (via provider)
 * - Tenderly API integration (optional)
 * - Risk assessment and detection
 */

import { JsonRpcProvider } from 'ethers';
import {
  type SimulationRequest,
  type SimulationResult,
  type SimulationConfig,
  type RiskAssessment,
  type RiskIssue,
  type CallTrace,
  SimulationStatus,
  SimulationError,
  SimulationErrorCode,
  SimulationProvider,
  SimulationRequestSchema,
} from '../types/simulation.js';
import { logger } from '../utils/index.js';

/**
 * Transaction Simulator
 *
 * Executes transaction simulations to validate safety before execution.
 */
export class TransactionSimulator {
  private readonly provider: JsonRpcProvider;
  private readonly config: {
    provider: SimulationProvider;
    timeout: number;
    saveIfFails: boolean;
    includeTrace: boolean;
    includeStateDiff: boolean;
    tenderlyAccessKey?: string;
    tenderlyProject?: string;
    forkUrl?: string;
  };

  constructor(provider: JsonRpcProvider, config?: SimulationConfig) {
    this.provider = provider;

    const baseConfig = {
      provider: config?.provider ?? SimulationProvider.LOCAL,
      timeout: config?.timeout ?? 30000, // 30 seconds
      saveIfFails: config?.saveIfFails ?? false,
      includeTrace: config?.includeTrace ?? true,
      includeStateDiff: config?.includeStateDiff ?? true,
    };

    this.config = baseConfig;

    // Conditionally add optional properties
    if (config?.tenderlyAccessKey !== undefined) {
      this.config.tenderlyAccessKey = config.tenderlyAccessKey;
    }
    if (config?.tenderlyProject !== undefined) {
      this.config.tenderlyProject = config.tenderlyProject;
    }
    if (config?.forkUrl !== undefined) {
      this.config.forkUrl = config.forkUrl;
    }

    logger.info('TransactionSimulator initialized', {
      provider: this.config.provider,
      includeTrace: this.config.includeTrace,
      includeStateDiff: this.config.includeStateDiff,
    });
  }

  /**
   * Simulate a transaction
   *
   * @param request - Simulation request parameters
   * @returns Simulation result with detailed information
   */
  async simulate(request: SimulationRequest): Promise<SimulationResult> {
    // Validate request
    const validated = SimulationRequestSchema.parse(request);

    logger.info('Starting transaction simulation', {
      from: validated.from,
      to: validated.to,
      value: validated.value?.toString(),
      provider: this.config.provider,
    });

    // Route to appropriate simulator
    switch (this.config.provider) {
      case SimulationProvider.TENDERLY:
        return await this.simulateWithTenderly(validated as SimulationRequest);

      case SimulationProvider.FORK:
      case SimulationProvider.LOCAL:
        return await this.simulateLocally(validated as SimulationRequest);

      default:
        throw new SimulationError(
          `Unsupported simulation provider: ${this.config.provider}`,
          SimulationErrorCode.PROVIDER_ERROR
        );
    }
  }

  /**
   * Simulate and assess risk
   *
   * @param request - Simulation request
   * @returns Simulation result with risk assessment
   */
  async simulateWithRiskAssessment(
    request: SimulationRequest
  ): Promise<{ result: SimulationResult; risk: RiskAssessment }> {
    const result = await this.simulate(request);
    const risk = this.assessRisk(result);

    logger.info('Simulation completed with risk assessment', {
      status: result.status,
      riskLevel: risk.level,
      warnings: risk.warnings.length,
      issues: risk.issues.length,
    });

    return { result, risk };
  }

  /**
   * Private helper methods
   */

  /**
   * Simulate transaction locally via provider
   *
   * @param request - Validated simulation request
   * @returns Simulation result
   */
  private async simulateLocally(request: SimulationRequest): Promise<SimulationResult> {
    try {
      const startTime = Date.now();

      // Prepare transaction
      const tx: {
        from: string;
        to?: string;
        value?: bigint;
        data?: string;
        gasLimit?: bigint;
        gasPrice?: bigint;
        maxFeePerGas?: bigint;
        maxPriorityFeePerGas?: bigint;
      } = {
        from: request.from,
      };

      if (request.to !== undefined) {
        tx.to = request.to;
      }
      if (request.value !== undefined) {
        tx.value = typeof request.value === 'string' ? BigInt(request.value) : request.value;
      }
      if (request.data !== undefined) {
        tx.data = request.data;
      }
      if (request.gasLimit !== undefined) {
        tx.gasLimit =
          typeof request.gasLimit === 'string' ? BigInt(request.gasLimit) : request.gasLimit;
      }
      if (request.gasPrice !== undefined) {
        tx.gasPrice =
          typeof request.gasPrice === 'string' ? BigInt(request.gasPrice) : request.gasPrice;
      }
      if (request.maxFeePerGas !== undefined) {
        tx.maxFeePerGas =
          typeof request.maxFeePerGas === 'string'
            ? BigInt(request.maxFeePerGas)
            : request.maxFeePerGas;
      }
      if (request.maxPriorityFeePerGas !== undefined) {
        tx.maxPriorityFeePerGas =
          typeof request.maxPriorityFeePerGas === 'string'
            ? BigInt(request.maxPriorityFeePerGas)
            : request.maxPriorityFeePerGas;
      }

      // Call eth_call to simulate
      const result = await this.provider.call(tx);

      // Get gas estimate
      const gasUsed = await this.provider.estimateGas(tx);

      // Get current block
      const block = await this.provider.getBlock('latest');

      const elapsed = Date.now() - startTime;

      logger.debug('Local simulation completed', {
        gasUsed: gasUsed.toString(),
        elapsed,
        returnDataLength: result.length,
      });

      return {
        status: SimulationStatus.SUCCESS,
        success: true,
        gasUsed,
        blockNumber: block?.number ?? 0,
        timestamp: block?.timestamp ?? 0,
        returnData: result,
        provider: SimulationProvider.LOCAL,
        simulatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Local simulation failed', {
        from: request.from,
        to: request.to,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.handleSimulationError(error, request);
    }
  }

  /**
   * Simulate transaction via Tenderly API
   *
   * @param _request - Validated simulation request (unused, for future implementation)
   * @returns Simulation result
   */
  private async simulateWithTenderly(_request: SimulationRequest): Promise<SimulationResult> {
    if (!this.config.tenderlyAccessKey || !this.config.tenderlyProject) {
      throw new SimulationError(
        'Tenderly configuration missing (accessKey and project required)',
        SimulationErrorCode.PROVIDER_ERROR
      );
    }

    // TODO: Implement Tenderly API integration
    // This would require the Tenderly SDK and API key
    // For now, fall back to local simulation

    logger.warn('Tenderly simulation not yet implemented, falling back to local');
    return await this.simulateLocally(_request);
  }

  /**
   * Handle simulation errors and convert to result
   *
   * @param error - Error from simulation
   * @param request - Original request
   * @returns Simulation result with error details
   */
  private handleSimulationError(error: unknown, _request: SimulationRequest): SimulationResult {
    let errorMessage = 'Unknown simulation error';
    let errorCode = SimulationErrorCode.UNKNOWN;
    let revertReason: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Detect specific error types
      if (errorMessage.includes('revert')) {
        errorCode = SimulationErrorCode.REVERT;
        // Try to extract revert reason
        const match = errorMessage.match(/reverted with reason string '([^']*)'/);
        if (match !== null && match[1] !== undefined) {
          revertReason = match[1];
        }
      } else if (errorMessage.includes('out of gas')) {
        errorCode = SimulationErrorCode.OUT_OF_GAS;
      } else if (errorMessage.includes('insufficient funds')) {
        errorCode = SimulationErrorCode.INSUFFICIENT_BALANCE;
      } else if (errorMessage.includes('nonce too low')) {
        errorCode = SimulationErrorCode.NONCE_TOO_LOW;
      } else if (errorMessage.includes('nonce too high')) {
        errorCode = SimulationErrorCode.NONCE_TOO_HIGH;
      }
    }

    const result: SimulationResult = {
      status:
        errorCode === SimulationErrorCode.REVERT ? SimulationStatus.REVERT : SimulationStatus.FAIL,
      success: false,
      gasUsed: 0n,
      blockNumber: 0,
      timestamp: 0,
      error: errorMessage,
      provider: this.config.provider,
      simulatedAt: new Date(),
    };

    // Conditionally add revertReason if it exists
    if (revertReason !== undefined) {
      result.revertReason = revertReason;
    }

    return result;
  }

  /**
   * Assess risk from simulation result
   *
   * @param result - Simulation result
   * @returns Risk assessment
   */
  private assessRisk(result: SimulationResult): RiskAssessment {
    const warnings: string[] = [];
    const issues: RiskIssue[] = [];
    const recommendations: string[] = [];

    // Check simulation success
    if (!result.success) {
      issues.push({
        severity: 'critical',
        category: 'other',
        description: `Transaction will revert: ${result.error ?? 'Unknown error'}`,
        mitigation: 'Do not execute this transaction',
      });

      if (result.revertReason !== undefined) {
        warnings.push(`Revert reason: ${result.revertReason}`);
      }
    }

    // Check gas usage
    if (result.gasUsed > 10000000n) {
      // > 10M gas
      issues.push({
        severity: 'warning',
        category: 'gas',
        description: `Very high gas usage: ${result.gasUsed.toString()} gas`,
        mitigation: 'Review transaction logic for efficiency',
      });
      warnings.push('Extremely high gas usage detected');
    }

    // Check for potential reentrancy in trace
    if (result.trace !== undefined) {
      const reentrancyDetected = this.detectReentrancy(result.trace);
      if (reentrancyDetected) {
        issues.push({
          severity: 'critical',
          category: 'reentrancy',
          description: 'Potential reentrancy pattern detected in call trace',
          mitigation: 'Verify contract has reentrancy guards',
        });
        warnings.push('CRITICAL: Potential reentrancy detected');
      }
    }

    // Check asset changes for suspicious activity
    if (result.assetChanges !== undefined && result.assetChanges.length > 10) {
      warnings.push('Large number of asset transfers detected');
      recommendations.push('Verify all asset transfers are intentional');
    }

    // Determine overall risk level
    const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
    const errorIssues = issues.filter((i) => i.severity === 'error').length;
    const warningIssues = issues.filter((i) => i.severity === 'warning').length;

    let level: RiskAssessment['level'];
    if (criticalIssues > 0) {
      level = 'critical';
      recommendations.push('DO NOT EXECUTE - Critical issues detected');
    } else if (errorIssues > 0) {
      level = 'high';
      recommendations.push('Review and fix errors before executing');
    } else if (warningIssues > 0) {
      level = 'medium';
      recommendations.push('Proceed with caution after reviewing warnings');
    } else {
      level = 'low';
      recommendations.push('Transaction appears safe to execute');
    }

    return { level, warnings, issues, recommendations };
  }

  /**
   * Detect potential reentrancy in call trace
   *
   * @param trace - Call trace to analyze
   * @returns True if potential reentrancy detected
   */
  private detectReentrancy(trace: CallTrace): boolean {
    // Simple reentrancy detection: check for repeated calls to same contract
    const callStack: string[] = [];

    const checkTrace = (t: CallTrace): boolean => {
      if (t.to !== undefined) {
        // If we're calling a contract that's already in the call stack, potential reentrancy
        if (callStack.includes(t.to)) {
          return true;
        }

        callStack.push(t.to);

        // Check nested calls
        if (t.calls !== undefined) {
          for (const nestedCall of t.calls) {
            if (checkTrace(nestedCall)) {
              return true;
            }
          }
        }

        callStack.pop();
      }

      return false;
    };

    return checkTrace(trace);
  }

  /**
   * Get statistics
   *
   * @returns Simulator statistics
   */
  getStats(): {
    provider: SimulationProvider;
    includeTrace: boolean;
    includeStateDiff: boolean;
  } {
    return {
      provider: this.config.provider,
      includeTrace: this.config.includeTrace,
      includeStateDiff: this.config.includeStateDiff,
    };
  }
}
