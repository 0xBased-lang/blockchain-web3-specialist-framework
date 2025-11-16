/**
 * Transaction Builder
 *
 * Builds and estimates transactions for Ethereum and Solana.
 *
 * Features:
 * - EIP-1559 (Type 2) and legacy transaction support
 * - Gas estimation with safety margins
 * - Nonce management integration
 * - Contract call encoding (ABI)
 * - Solana instruction building
 * - Recent blockhash management
 *
 * CRITICAL: Always simulate transactions before execution
 */

import { JsonRpcProvider, parseUnits, formatUnits } from 'ethers';
import {
  Connection,
  Transaction as SolanaTransaction,
  SystemProgram,
  PublicKey,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  type TransactionParams,
  type EthereumTransactionParams,
  type SolanaTransactionParams,
  type BuiltTransaction,
  type GasEstimation,
  TransactionType,
  TransactionError,
  TransactionErrorCode,
  TransactionParamsSchema,
} from '../types/transaction.js';
import { NonceManager } from './NonceManager.js';
import { TransactionSimulator } from './TransactionSimulator.js';
import { ContractAnalyzer } from './ContractAnalyzer.js';
import { SimulationStatus, SimulationProvider, type SimulationResult, type RiskAssessment } from '../types/simulation.js';
import { type ContractAnalysisResult, VulnerabilitySeverity, VulnerabilityCategory } from '../types/contract.js';
import { logger } from '../utils/index.js';

/**
 * Transaction Builder Configuration
 */
export interface TransactionBuilderConfig {
  ethereumProvider?: JsonRpcProvider;
  solanaConnection?: Connection;
  gasSafetyMargin?: number; // Percentage (e.g., 20 = 20% buffer)
  maxGasPrice?: bigint; // Maximum gas price in wei (safety limit)
  priorityFee?: bigint; // Default priority fee for EIP-1559
  enableSimulation?: boolean; // Enable automatic transaction simulation (recommended)
  enableContractAnalysis?: boolean; // Enable automatic contract analysis (recommended for contract calls)
}

/**
 * Transaction Builder
 *
 * Builds transactions for multiple chains with proper gas estimation,
 * nonce management, and safety checks.
 */
export class TransactionBuilder {
  private readonly config: Required<Omit<TransactionBuilderConfig, 'enableSimulation' | 'enableContractAnalysis'>> & {
    enableSimulation?: boolean;
    enableContractAnalysis?: boolean;
  };
  private readonly ethereumProvider?: JsonRpcProvider;
  private readonly solanaConnection?: Connection;
  private readonly nonceManager?: NonceManager;
  private readonly simulator?: TransactionSimulator;
  private readonly contractAnalyzer?: ContractAnalyzer;

  constructor(config: TransactionBuilderConfig) {
    const baseConfig = {
      gasSafetyMargin: config.gasSafetyMargin ?? 20, // 20% default buffer
      maxGasPrice: config.maxGasPrice ?? parseUnits('500', 'gwei'), // 500 gwei max
      priorityFee: config.priorityFee ?? parseUnits('2', 'gwei'), // 2 gwei default
    };

    // Conditionally add providers
    if (config.ethereumProvider !== undefined) {
      (baseConfig as any).ethereumProvider = config.ethereumProvider;
    }
    if (config.solanaConnection !== undefined) {
      (baseConfig as any).solanaConnection = config.solanaConnection;
    }

    this.config = baseConfig as Required<Omit<TransactionBuilderConfig, 'enableSimulation' | 'enableContractAnalysis'>> & {
      enableSimulation?: boolean;
      enableContractAnalysis?: boolean;
    };

    // Conditionally add optional flags
    if (config.enableSimulation !== undefined) {
      this.config.enableSimulation = config.enableSimulation;
    }
    if (config.enableContractAnalysis !== undefined) {
      this.config.enableContractAnalysis = config.enableContractAnalysis;
    }

    if (config.ethereumProvider !== undefined) {
      (this as unknown as { ethereumProvider: JsonRpcProvider }).ethereumProvider = config.ethereumProvider;
      // Initialize NonceManager
      (this as unknown as { nonceManager: NonceManager }).nonceManager = new NonceManager(config.ethereumProvider);

      // Initialize Simulator if enabled
      if (this.config.enableSimulation) {
        (this as unknown as { simulator: TransactionSimulator }).simulator = new TransactionSimulator(config.ethereumProvider);
      }

      // Initialize ContractAnalyzer if enabled
      if (this.config.enableContractAnalysis) {
        (this as unknown as { contractAnalyzer: ContractAnalyzer }).contractAnalyzer = new ContractAnalyzer({
          ethereumProvider: config.ethereumProvider,
        });
      }
    }

    if (config.solanaConnection !== undefined) {
      (this as unknown as { solanaConnection: Connection }).solanaConnection = config.solanaConnection;
    }

    logger.info('TransactionBuilder initialized', {
      hasEthereum: !!this.ethereumProvider,
      hasSolana: !!this.solanaConnection,
      gasSafetyMargin: this.config.gasSafetyMargin,
      simulationEnabled: this.config.enableSimulation ?? false,
      contractAnalysisEnabled: this.config.enableContractAnalysis ?? false,
    });
  }

  /**
   * Build a transaction (Ethereum or Solana)
   *
   * @param params - Transaction parameters
   * @returns Built transaction ready to sign
   */
  async buildTransaction(params: TransactionParams): Promise<BuiltTransaction> {
    // Validate params
    const validated = TransactionParamsSchema.parse(params);

    // Route to chain-specific builder
    switch (validated.chain) {
      case 'ethereum':
        return await this.buildEthereumTransaction(validated as EthereumTransactionParams);

      case 'solana':
        return await this.buildSolanaTransaction(validated as SolanaTransactionParams);

      default:
        throw new TransactionError(
          `Unsupported chain: ${(validated as { chain: string }).chain}`,
          TransactionErrorCode.INVALID_PARAMS
        );
    }
  }

  /**
   * Estimate gas for an Ethereum transaction
   *
   * @param params - Ethereum transaction parameters
   * @returns Gas estimation with safety margin
   */
  async estimateGas(params: EthereumTransactionParams): Promise<GasEstimation & { isLegacy?: boolean }> {
    if (!this.ethereumProvider) {
      throw new TransactionError(
        'Ethereum provider not configured',
        TransactionErrorCode.GAS_ESTIMATION_FAILED,
        'ethereum'
      );
    }

    try {
      // Estimate gas limit
      const estimateRequest: {
        from: string;
        to?: string;
        value?: bigint;
        data?: string;
      } = {
        from: params.from,
      };

      if (params.to !== undefined) {
        estimateRequest.to = params.to;
      }
      if (params.value !== undefined) {
        estimateRequest.value = BigInt(params.value);
      }
      if (typeof params.data === 'string') {
        estimateRequest.data = params.data;
      }

      const estimatedGasLimit = await this.ethereumProvider.estimateGas(estimateRequest);

      // Add safety margin
      const gasLimit = this.addSafetyMargin(estimatedGasLimit);

      // Get current gas prices
      const feeData = await this.ethereumProvider.getFeeData();

      // Use EIP-1559 if available
      let maxFeePerGas: bigint;
      let maxPriorityFeePerGas: bigint;
      let isLegacy = false;

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559
        maxFeePerGas = feeData.maxFeePerGas;
        maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      } else if (feeData.gasPrice) {
        // Legacy (use gasPrice as both)
        maxFeePerGas = feeData.gasPrice;
        maxPriorityFeePerGas = this.config.priorityFee;
        isLegacy = true;
      } else {
        throw new Error('No gas price data available');
      }

      // Safety check: ensure gas price is not absurdly high
      if (maxFeePerGas > this.config.maxGasPrice) {
        logger.warn('Gas price exceeds maximum', {
          maxFeePerGas: formatUnits(maxFeePerGas, 'gwei'),
          maxAllowed: formatUnits(this.config.maxGasPrice, 'gwei'),
        });

        throw new TransactionError(
          `Gas price too high: ${formatUnits(maxFeePerGas, 'gwei')} gwei (max: ${formatUnits(this.config.maxGasPrice, 'gwei')} gwei)`,
          TransactionErrorCode.GAS_ESTIMATION_FAILED,
          'ethereum'
        );
      }

      // Calculate total cost
      const estimatedCost = gasLimit * maxFeePerGas;

      logger.debug('Gas estimated', {
        gasLimit: gasLimit.toString(),
        maxFeePerGas: formatUnits(maxFeePerGas, 'gwei'),
        maxPriorityFeePerGas: formatUnits(maxPriorityFeePerGas, 'gwei'),
        estimatedCostETH: formatUnits(estimatedCost, 'ether'),
        isLegacy,
      });

      return {
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCost,
        isLegacy,
      };
    } catch (error) {
      logger.error('Gas estimation failed', {
        from: params.from,
        to: params.to,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new TransactionError(
        `Gas estimation failed: ${error instanceof Error ? error.message : String(error)}`,
        TransactionErrorCode.GAS_ESTIMATION_FAILED,
        'ethereum'
      );
    }
  }

  /**
   * Private helper methods
   */

  /**
   * Build Ethereum transaction
   *
   * @param params - Ethereum transaction parameters
   * @returns Built Ethereum transaction
   */
  private async buildEthereumTransaction(
    params: EthereumTransactionParams
  ): Promise<BuiltTransaction> {
    if (!this.ethereumProvider) {
      throw new TransactionError(
        'Ethereum provider not configured',
        TransactionErrorCode.INVALID_PARAMS,
        'ethereum'
      );
    }

    // Get nonce if not provided
    let nonce = params.nonce;
    if (nonce === undefined && this.nonceManager) {
      nonce = await this.nonceManager.getNextNonce(params.from);
    }

    // Estimate gas if not provided
    let gasEstimation: (GasEstimation & { isLegacy?: boolean }) | undefined;
    if (!params.gasLimit || (!params.maxFeePerGas && !params.gasPrice)) {
      gasEstimation = await this.estimateGas(params);
    }

    // Build transaction request
    const transaction: {
      from: string;
      to?: string;
      value?: bigint;
      data?: string;
      nonce?: number;
      gasLimit?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
      gasPrice?: bigint;
      chainId?: number;
    } = {
      from: params.from,
    };

    // Conditionally add optional properties
    if (params.to !== undefined) {
      transaction.to = params.to;
    }
    if (params.value !== undefined) {
      transaction.value = BigInt(params.value);
    }
    if (typeof params.data === 'string') {
      transaction.data = params.data;
    }
    if (nonce !== undefined) {
      transaction.nonce = nonce;
    }

    // Add gas parameters
    if (params.gasLimit !== undefined) {
      transaction.gasLimit = params.gasLimit;
    } else if (gasEstimation !== undefined) {
      transaction.gasLimit = gasEstimation.gasLimit;
    }

    // EIP-1559 vs Legacy
    // Use legacy if explicitly provided gasPrice OR if gas estimation detected legacy
    if (params.gasPrice !== undefined || gasEstimation?.isLegacy) {
      // Legacy transaction
      if (params.gasPrice !== undefined) {
        transaction.gasPrice = params.gasPrice;
      } else if (gasEstimation?.maxFeePerGas !== undefined) {
        transaction.gasPrice = gasEstimation.maxFeePerGas;
      }
    } else if (params.maxFeePerGas !== undefined || gasEstimation !== undefined) {
      // EIP-1559 transaction
      if (params.maxFeePerGas !== undefined) {
        transaction.maxFeePerGas = params.maxFeePerGas;
      } else if (gasEstimation?.maxFeePerGas !== undefined) {
        transaction.maxFeePerGas = gasEstimation.maxFeePerGas;
      }

      if (params.maxPriorityFeePerGas !== undefined) {
        transaction.maxPriorityFeePerGas = params.maxPriorityFeePerGas;
      } else if (gasEstimation?.maxPriorityFeePerGas !== undefined) {
        transaction.maxPriorityFeePerGas = gasEstimation.maxPriorityFeePerGas;
      }
    }

    // Add chainId
    if (params.chainId !== undefined) {
      transaction.chainId = params.chainId;
    } else {
      const network = await this.ethereumProvider.getNetwork();
      transaction.chainId = Number(network.chainId);
    }

    logger.info('Ethereum transaction built', {
      type: params.type,
      from: params.from,
      to: params.to,
      nonce,
      gasLimit: transaction.gasLimit?.toString(),
    });

    const built: BuiltTransaction = {
      chain: 'ethereum',
      params,
      transaction,
      createdAt: new Date(),
    };

    if (transaction.gasLimit !== undefined) {
      built.estimatedGas = transaction.gasLimit;
    }
    if (gasEstimation?.estimatedCost !== undefined) {
      built.estimatedCost = gasEstimation.estimatedCost;
    }

    return built;
  }

  /**
   * Build Solana transaction
   *
   * @param params - Solana transaction parameters
   * @returns Built Solana transaction
   */
  private async buildSolanaTransaction(
    params: SolanaTransactionParams
  ): Promise<BuiltTransaction> {
    if (!this.solanaConnection) {
      throw new TransactionError(
        'Solana connection not configured',
        TransactionErrorCode.INVALID_PARAMS,
        'solana'
      );
    }

    try {
      // Get recent blockhash if not provided
      let recentBlockhash = params.recentBlockhash;
      if (!recentBlockhash) {
        const { blockhash } = await this.solanaConnection.getLatestBlockhash();
        recentBlockhash = blockhash;
      }

      // Create transaction
      const transaction = new SolanaTransaction({
        recentBlockhash,
        feePayer: params.feePayer ? new PublicKey(params.feePayer) : new PublicKey(params.from),
      });

      // Add instructions based on type
      switch (params.type) {
        case TransactionType.TRANSFER: {
          // SOL transfer
          if (!params.to) {
            throw new TransactionError(
              'Transfer requires "to" address',
              TransactionErrorCode.INVALID_PARAMS,
              'solana'
            );
          }

          const instruction = SystemProgram.transfer({
            fromPubkey: new PublicKey(params.from),
            toPubkey: new PublicKey(params.to),
            lamports: params.value ? BigInt(params.value) : 0n,
          });

          transaction.add(instruction);
          break;
        }

        case TransactionType.CONTRACT_CALL:
        case TransactionType.TOKEN_TRANSFER: {
          // Use provided instructions
          if (!params.instructions || params.instructions.length === 0) {
            throw new TransactionError(
              'Contract call/token transfer requires instructions',
              TransactionErrorCode.INVALID_PARAMS,
              'solana'
            );
          }

          // Add custom instructions
          for (const instr of params.instructions) {
            transaction.add(instr as TransactionInstruction);
          }
          break;
        }

        default:
          throw new TransactionError(
            `Unsupported Solana transaction type: ${params.type}`,
            TransactionErrorCode.INVALID_PARAMS,
            'solana'
          );
      }

      // Estimate fees (5000 lamports base + per-signature)
      const estimatedCost = BigInt(5000 * (transaction.signatures.length + 1));

      logger.info('Solana transaction built', {
        type: params.type,
        from: params.from,
        to: params.to,
        instructions: transaction.instructions.length,
        estimatedCostSOL: Number(estimatedCost) / LAMPORTS_PER_SOL,
      });

      return {
        chain: 'solana',
        params,
        transaction,
        estimatedCost,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Solana transaction building failed', {
        from: params.from,
        to: params.to,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new TransactionError(
        `Solana transaction building failed: ${error instanceof Error ? error.message : String(error)}`,
        TransactionErrorCode.TRANSACTION_FAILED,
        'solana'
      );
    }
  }

  /**
   * Add safety margin to gas estimate
   *
   * @param gasLimit - Base gas limit
   * @returns Gas limit with safety margin
   */
  private addSafetyMargin(gasLimit: bigint): bigint {
    const margin = (gasLimit * BigInt(this.config.gasSafetyMargin)) / 100n;
    return gasLimit + margin;
  }

  /**
   * Build and simulate transaction with optional contract analysis (RECOMMENDED for safety)
   *
   * Security Pipeline:
   * 1. Contract Analysis (if enabled and target is a contract)
   * 2. Transaction Simulation
   * 3. Combined Risk Assessment
   * 4. Build Transaction (only if safe)
   *
   * This is the RECOMMENDED method for production use.
   *
   * @param params - Transaction parameters
   * @returns Built transaction with simulation, contract analysis, and combined risk assessment
   * @throws TransactionError if critical security issues detected
   */
  async buildAndSimulate(
    params: TransactionParams
  ): Promise<{
    transaction: BuiltTransaction;
    simulation: SimulationResult;
    risk: RiskAssessment;
    contractAnalysis?: ContractAnalysisResult;
  }> {
    if (!this.simulator) {
      throw new TransactionError(
        'Simulation not enabled. Enable with { enableSimulation: true } in config',
        TransactionErrorCode.INVALID_PARAMS,
        params.chain
      );
    }

    // Only simulate Ethereum transactions for now
    if (params.chain !== 'ethereum') {
      logger.warn('Simulation only supported for Ethereum, building without simulation', {
        chain: params.chain,
      });
      const transaction = await this.buildTransaction(params);
      // Return dummy simulation result for non-Ethereum chains
      return {
        transaction,
        simulation: {
          status: SimulationStatus.SUCCESS,
          success: true,
          gasUsed: 0n,
          blockNumber: 0,
          timestamp: 0,
          provider: SimulationProvider.LOCAL,
          simulatedAt: new Date(),
        },
        risk: {
          level: 'low',
          warnings: [],
          issues: [],
          recommendations: ['Simulation not available for this chain'],
        },
      };
    }

    // STEP 1: Contract Analysis (if enabled and target is provided)
    let contractAnalysis: ContractAnalysisResult | undefined;
    if (this.contractAnalyzer !== undefined && params.to !== undefined) {
      logger.info('Analyzing target contract before simulation', {
        contract: params.to,
      });

      try {
        contractAnalysis = await this.contractAnalyzer.analyzeContract({
          address: params.to,
          chain: params.chain,
        });

        logger.info('Contract analysis completed', {
          contract: params.to,
          riskLevel: contractAnalysis.riskLevel,
          findings: contractAnalysis.summary.totalFindings,
          criticalFindings: contractAnalysis.summary.criticalCount,
        });

        // CRITICAL CHECK: Block if contract is known malicious or has critical vulnerabilities
        if (contractAnalysis.isKnownMalicious) {
          const error = new TransactionError(
            `CRITICAL: Target contract is known to be malicious. DO NOT INTERACT.`,
            TransactionErrorCode.TRANSACTION_FAILED,
            params.chain
          );
          logger.error('CRITICAL: Known malicious contract detected', {
            contract: params.to,
            recommendations: contractAnalysis.recommendations,
          });
          throw error;
        }

        if (contractAnalysis.riskLevel === 'critical') {
          const error = new TransactionError(
            `CRITICAL: Target contract has critical vulnerabilities. ${contractAnalysis.findings
              .filter((f) => f.severity === VulnerabilitySeverity.CRITICAL)
              .map((f) => f.title)
              .join(', ')}`,
            TransactionErrorCode.TRANSACTION_FAILED,
            params.chain
          );
          logger.error('CRITICAL: Contract analysis detected critical vulnerabilities', {
            contract: params.to,
            criticalFindings: contractAnalysis.summary.criticalCount,
            findings: contractAnalysis.findings.filter((f) => f.severity === VulnerabilitySeverity.CRITICAL),
          });
          throw error;
        }

        // Log warnings for high-risk contracts
        if (contractAnalysis.riskLevel === 'high') {
          logger.warn('HIGH RISK: Target contract has significant security concerns', {
            contract: params.to,
            riskLevel: contractAnalysis.riskLevel,
            highFindings: contractAnalysis.summary.highCount,
            recommendations: contractAnalysis.recommendations,
          });
        }
      } catch (error) {
        // If it's already a TransactionError (critical), re-throw
        if (error instanceof TransactionError) {
          throw error;
        }
        // Otherwise, log but continue (contract might be unverified, etc.)
        logger.warn('Contract analysis failed, continuing with simulation only', {
          contract: params.to,
          error: error instanceof Error ? error.message : String(error),
        });
        contractAnalysis = undefined;
      }
    }

    // STEP 2: Transaction Simulation
    logger.info('Simulating transaction before building', {
      from: params.from,
      to: params.to,
    });

    // Build simulation request with conditional property assignment (exactOptionalPropertyTypes)
    const simulationRequest: any = {
      chain: params.chain,
      from: params.from,
    };

    // Conditionally add optional properties
    if (params.to !== undefined) {
      simulationRequest.to = params.to;
    }
    if (params.value !== undefined) {
      simulationRequest.value = params.value;
    }
    if (typeof params.data === 'string') {
      simulationRequest.data = params.data;
    }
    if ((params as EthereumTransactionParams).gasLimit !== undefined) {
      simulationRequest.gasLimit = (params as EthereumTransactionParams).gasLimit;
    }
    if ((params as EthereumTransactionParams).gasPrice !== undefined) {
      simulationRequest.gasPrice = (params as EthereumTransactionParams).gasPrice;
    }
    if ((params as EthereumTransactionParams).maxFeePerGas !== undefined) {
      simulationRequest.maxFeePerGas = (params as EthereumTransactionParams).maxFeePerGas;
    }
    if ((params as EthereumTransactionParams).maxPriorityFeePerGas !== undefined) {
      simulationRequest.maxPriorityFeePerGas = (params as EthereumTransactionParams).maxPriorityFeePerGas;
    }

    const { result: simulation, risk } = await this.simulator.simulateWithRiskAssessment(simulationRequest);

    // Check risk level
    if (risk.level === 'critical') {
      const error = new TransactionError(
        `Transaction simulation failed: ${simulation.error ?? 'Critical risk detected'}`,
        TransactionErrorCode.TRANSACTION_FAILED,
        params.chain
      );
      logger.error('CRITICAL: Transaction simulation detected critical risk', {
        from: params.from,
        to: params.to,
        riskLevel: risk.level,
        issues: risk.issues,
        error: simulation.error,
      });
      throw error;
    }

    // STEP 3: Combined Risk Assessment (if contract analysis was performed)
    let combinedRisk = risk;
    if (contractAnalysis !== undefined) {
      // Merge warnings from both analyses
      const combinedWarnings = [
        ...risk.warnings,
        ...contractAnalysis.recommendations.filter(r => r.includes('⚠️') || r.includes('WARNING')),
      ];

      // Merge issues from both (map vulnerability category to risk category)
      const mapVulnerabilityCategory = (cat: VulnerabilityCategory): RiskAssessment['issues'][number]['category'] => {
        switch (cat) {
          case VulnerabilityCategory.REENTRANCY:
            return 'reentrancy';
          case VulnerabilityCategory.ACCESS_CONTROL:
          case VulnerabilityCategory.SELFDESTRUCT_UNPROTECTED:
            return 'access-control';
          case VulnerabilityCategory.GAS_LIMIT_DOS:
            return 'gas';
          case VulnerabilityCategory.INTEGER_OVERFLOW:
            return 'overflow';
          case VulnerabilityCategory.ORACLE_MANIPULATION:
          case VulnerabilityCategory.MEV_VULNERABILITY:
            return 'price-manipulation';
          default:
            return 'other';
        }
      };

      const combinedIssues = [
        ...risk.issues,
        ...contractAnalysis.findings.map(f => ({
          severity: f.severity === VulnerabilitySeverity.CRITICAL ? 'critical' as const :
                   f.severity === VulnerabilitySeverity.HIGH ? 'error' as const :
                   f.severity === VulnerabilitySeverity.MEDIUM ? 'warning' as const : 'info' as const,
          category: mapVulnerabilityCategory(f.category),
          description: `[Contract] ${f.title}: ${f.description}`,
          mitigation: f.recommendation,
        })),
      ];

      // Determine combined risk level (take the higher of the two)
      const riskLevels = ['low', 'medium', 'high', 'critical'];
      const simulationRiskIndex = riskLevels.indexOf(risk.level);
      const contractRiskIndex = riskLevels.indexOf(contractAnalysis.riskLevel);
      const combinedRiskLevel = riskLevels[Math.max(simulationRiskIndex, contractRiskIndex)] as RiskAssessment['level'];

      // Merge recommendations
      const combinedRecommendations = [
        ...risk.recommendations,
        ...contractAnalysis.recommendations.filter(r => !r.includes('✅')), // Exclude "safe" messages
      ];

      combinedRisk = {
        level: combinedRiskLevel,
        warnings: combinedWarnings,
        issues: combinedIssues,
        recommendations: combinedRecommendations,
      };

      logger.info('Combined security assessment', {
        contractRisk: contractAnalysis.riskLevel,
        simulationRisk: risk.level,
        combinedRisk: combinedRiskLevel,
        totalFindings: contractAnalysis.summary.totalFindings,
        simulationIssues: risk.issues.length,
      });
    }

    // Log warnings for high/medium risk
    if (combinedRisk.level === 'high' || combinedRisk.level === 'medium') {
      logger.warn('Security assessment detected potential issues', {
        from: params.from,
        to: params.to,
        riskLevel: combinedRisk.level,
        warnings: combinedRisk.warnings,
        issues: combinedRisk.issues.length,
      });
    }

    // Build transaction
    const transaction = await this.buildTransaction(params);

    logger.info('Transaction built with full security validation', {
      from: params.from,
      to: params.to,
      riskLevel: combinedRisk.level,
      gasUsed: simulation.gasUsed.toString(),
      contractAnalyzed: contractAnalysis !== undefined,
    });

    // Build result with conditional property assignment (exactOptionalPropertyTypes)
    const result: {
      transaction: BuiltTransaction;
      simulation: SimulationResult;
      risk: RiskAssessment;
      contractAnalysis?: ContractAnalysisResult;
    } = {
      transaction,
      simulation,
      risk: combinedRisk,
    };

    // Conditionally add contractAnalysis
    if (contractAnalysis !== undefined) {
      (result as { contractAnalysis: ContractAnalysisResult }).contractAnalysis = contractAnalysis;
    }

    return result;
  }

  /**
   * Get NonceManager instance (for advanced usage)
   *
   * @returns NonceManager or undefined
   */
  getNonceManager(): NonceManager | undefined {
    return this.nonceManager;
  }

  /**
   * Get statistics
   *
   * @returns Builder statistics
   */
  getStats(): {
    hasEthereum: boolean;
    hasSolana: boolean;
    nonceManagerStats?: ReturnType<NonceManager['getStats']>;
  } {
    const stats: {
      hasEthereum: boolean;
      hasSolana: boolean;
      nonceManagerStats?: ReturnType<NonceManager['getStats']>;
    } = {
      hasEthereum: !!this.ethereumProvider,
      hasSolana: !!this.solanaConnection,
    };

    const managerStats = this.nonceManager?.getStats();
    if (managerStats !== undefined) {
      stats.nonceManagerStats = managerStats;
    }

    return stats;
  }
}
