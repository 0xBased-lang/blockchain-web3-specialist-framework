/**
 * Contract Analyzer
 *
 * Analyzes smart contracts for security vulnerabilities, dangerous patterns,
 * and provides safety recommendations.
 *
 * Features:
 * - Bytecode pattern analysis (reentrancy, selfdestruct, delegatecall)
 * - ABI analysis for unsafe functions
 * - Source code analysis (if verified)
 * - Known malicious contract detection
 * - Risk scoring and recommendations
 */

import { type JsonRpcProvider } from 'ethers';
import {
  type ContractAnalysisRequest,
  type ContractAnalysisResult,
  type ContractMetadata,
  type VulnerabilityFinding,
  type BytecodeAnalysisResult,
  type ABIAnalysisResult,
  type SourceAnalysisResult,
  VulnerabilityCategory,
  VulnerabilitySeverity,
  ContractAnalysisRequestSchema,
  DANGEROUS_OPCODES,
} from '../types/contract.js';
import { logger } from '../utils/index.js';

/**
 * Contract Analyzer Configuration
 */
export interface ContractAnalyzerConfig {
  ethereumProvider?: JsonRpcProvider;
  etherscanApiKey?: string;
  sourcifyEnabled?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number; // Cache time-to-live in seconds
  deepAnalysis?: boolean; // Enable more thorough analysis (slower)
}

/**
 * Contract Analyzer
 */
export class ContractAnalyzer {
  private readonly ethereumProvider?: JsonRpcProvider;
  private readonly config: Required<
    Omit<ContractAnalyzerConfig, 'ethereumProvider' | 'etherscanApiKey'>
  >;
  private readonly analysisCache: Map<string, ContractAnalysisResult> = new Map();
  private readonly maliciousContractsDB: Set<string> = new Set(); // Known malicious contracts

  constructor(config: ContractAnalyzerConfig) {
    const baseConfig = {
      sourcifyEnabled: config.sourcifyEnabled ?? true,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL ?? 3600, // 1 hour default
      deepAnalysis: config.deepAnalysis ?? false,
    };

    this.config = baseConfig;

    // Conditionally set ethereum provider (exactOptionalPropertyTypes pattern)
    if (config.ethereumProvider !== undefined) {
      (this as unknown as { ethereumProvider: JsonRpcProvider }).ethereumProvider =
        config.ethereumProvider;
    }

    // Initialize known malicious contracts database (in production, load from external source)
    this.initializeMaliciousDB();

    logger.info('ContractAnalyzer initialized', {
      sourcifyEnabled: this.config.sourcifyEnabled,
      cacheEnabled: this.config.cacheEnabled,
      deepAnalysis: this.config.deepAnalysis,
    });
  }

  /**
   * Analyze a contract for security vulnerabilities
   */
  async analyzeContract(request: ContractAnalysisRequest): Promise<ContractAnalysisResult> {
    // Validate request
    const validated = ContractAnalysisRequestSchema.parse(request);

    logger.info('Starting contract analysis', {
      address: validated.address,
      chain: validated.chain,
    });

    // Check cache
    const cacheKey = `${validated.chain}:${validated.address}`;
    if (this.config.cacheEnabled) {
      const cached = this.analysisCache.get(cacheKey);
      if (cached !== undefined) {
        logger.info('Returning cached analysis', { address: validated.address });
        return cached;
      }
    }

    // Get contract metadata
    const metadata: ContractMetadata =
      validated.metadata !== undefined
        ? this.normalizeMetadata(validated.metadata)
        : await this.fetchContractMetadata(validated.address, validated.chain);

    // Check if known malicious
    const isKnownMalicious = this.maliciousContractsDB.has(validated.address.toLowerCase());
    if (isKnownMalicious) {
      logger.warn('CRITICAL: Known malicious contract detected', {
        address: validated.address,
      });
    }

    // Perform analysis
    const bytecodeAnalysis =
      validated.options?.includeBytecodeAnalysis !== false
        ? this.analyzeBytecode(metadata)
        : undefined;

    const abiAnalysis =
      validated.options?.includeABIAnalysis !== false && metadata.abi !== undefined
        ? this.analyzeABI(metadata)
        : undefined;

    const sourceAnalysis =
      validated.options?.includeSourceAnalysis !== false && metadata.sourcecode !== undefined
        ? this.analyzeSource(metadata)
        : undefined;

    // Aggregate all findings
    const allFindings: VulnerabilityFinding[] = [];
    if (bytecodeAnalysis !== undefined) {
      allFindings.push(...bytecodeAnalysis.findings);
    }
    if (abiAnalysis !== undefined) {
      allFindings.push(...abiAnalysis.findings);
    }
    if (sourceAnalysis !== undefined) {
      allFindings.push(...sourceAnalysis.findings);
    }

    // Add finding if known malicious
    if (isKnownMalicious) {
      allFindings.push({
        id: `malicious-${Date.now()}`,
        category: VulnerabilityCategory.OTHER,
        severity: VulnerabilitySeverity.CRITICAL,
        contract: validated.address,
        title: 'Known Malicious Contract',
        description: 'This contract is in the known malicious contracts database',
        impact: 'Interacting with this contract may result in loss of funds',
        recommendation: 'DO NOT INTERACT with this contract under any circumstances',
        confidence: 'high',
      });
    }

    // Calculate summary
    const summary = {
      totalFindings: allFindings.length,
      criticalCount: allFindings.filter((f) => f.severity === VulnerabilitySeverity.CRITICAL)
        .length,
      highCount: allFindings.filter((f) => f.severity === VulnerabilitySeverity.HIGH).length,
      mediumCount: allFindings.filter((f) => f.severity === VulnerabilitySeverity.MEDIUM).length,
      lowCount: allFindings.filter((f) => f.severity === VulnerabilitySeverity.LOW).length,
      infoCount: allFindings.filter((f) => f.severity === VulnerabilitySeverity.INFO).length,
    };

    // Determine overall risk level
    const riskLevel = this.calculateRiskLevel(summary, isKnownMalicious);

    // Generate recommendations
    const recommendations = this.generateRecommendations(allFindings, riskLevel, isKnownMalicious);

    // Build result with conditional property assignment (exactOptionalPropertyTypes)
    const result: ContractAnalysisResult = {
      address: validated.address,
      chain: validated.chain,
      analyzedAt: new Date(),
      analysisVersion: '1.0.0',
      metadata,
      findings: allFindings,
      summary,
      riskLevel,
      isKnownMalicious,
      recommendations,
    };

    // Conditionally add optional analysis results
    if (bytecodeAnalysis !== undefined) {
      (result as { bytecodeAnalysis: BytecodeAnalysisResult }).bytecodeAnalysis = bytecodeAnalysis;
    }
    if (abiAnalysis !== undefined) {
      (result as { abiAnalysis: ABIAnalysisResult }).abiAnalysis = abiAnalysis;
    }
    if (sourceAnalysis !== undefined) {
      (result as { sourceAnalysis: SourceAnalysisResult }).sourceAnalysis = sourceAnalysis;
    }

    // Cache result
    if (this.config.cacheEnabled) {
      this.analysisCache.set(cacheKey, result);
      // Auto-expire cache
      setTimeout(() => {
        this.analysisCache.delete(cacheKey);
      }, this.config.cacheTTL * 1000);
    }

    logger.info('Contract analysis completed', {
      address: validated.address,
      riskLevel,
      totalFindings: summary.totalFindings,
      criticalFindings: summary.criticalCount,
    });

    return result;
  }

  /**
   * Analyze contract bytecode for dangerous patterns
   */
  private analyzeBytecode(metadata: ContractMetadata): BytecodeAnalysisResult {
    logger.info('Analyzing bytecode', { address: metadata.address });

    const findings: VulnerabilityFinding[] = [];
    const bytecode = metadata.bytecode.replace(/^0x/, '');

    // Track opcode statistics
    const opcodeMap = new Map<string, number[]>();

    // Parse bytecode and detect patterns
    let hasReentrancyPattern = false;
    let hasSelfdestructPattern = false;
    let hasDelegatecallPattern = false;
    let hasTimestampDependence = false;
    let hasComplexLoops = false;

    // Scan bytecode for dangerous opcodes
    for (let i = 0; i < bytecode.length; i += 2) {
      const opcode = bytecode.substring(i, i + 2).toLowerCase();

      // Track opcode occurrences
      if (!opcodeMap.has(opcode)) {
        opcodeMap.set(opcode, []);
      }
      opcodeMap.get(opcode)!.push(i / 2);

      // SELFDESTRUCT detection
      if (opcode === DANGEROUS_OPCODES.SELFDESTRUCT.replace(/^0x/, '')) {
        hasSelfdestructPattern = true;
        findings.push({
          id: `selfdestruct-${i}`,
          category: VulnerabilityCategory.SELFDESTRUCT_UNPROTECTED,
          severity: VulnerabilitySeverity.HIGH,
          contract: metadata.address,
          bytecodeOffset: i / 2,
          title: 'SELFDESTRUCT Opcode Detected',
          description:
            'Contract contains SELFDESTRUCT which can destroy the contract and send all ETH',
          impact: 'If unprotected, malicious actors could destroy the contract',
          recommendation: 'Ensure SELFDESTRUCT is protected by proper access controls (onlyOwner)',
          evidence: { opcodes: [opcode] },
          confidence: 'high',
        });
      }

      // DELEGATECALL detection
      if (opcode === DANGEROUS_OPCODES.DELEGATECALL.replace(/^0x/, '')) {
        hasDelegatecallPattern = true;
        findings.push({
          id: `delegatecall-${i}`,
          category: VulnerabilityCategory.DELEGATECALL_INJECTION,
          severity: VulnerabilitySeverity.CRITICAL,
          contract: metadata.address,
          bytecodeOffset: i / 2,
          title: 'DELEGATECALL Detected',
          description:
            'Contract uses DELEGATECALL which executes code in the context of the calling contract',
          impact: 'If target is user-controlled, complete contract takeover is possible',
          recommendation:
            'Only use DELEGATECALL with trusted, immutable contracts. Implement strict validation.',
          evidence: { opcodes: [opcode] },
          confidence: 'high',
        });
      }

      // TIMESTAMP dependency
      if (opcode === DANGEROUS_OPCODES.TIMESTAMP.replace(/^0x/, '')) {
        hasTimestampDependence = true;
      }
    }

    // Detect reentrancy pattern (heuristic: CALL followed by SSTORE)
    // This is a simplified pattern - real reentrancy detection needs call graph analysis
    const hasCALL = opcodeMap.has('f1'); // CALL opcode
    const hasSSTORE = opcodeMap.has('55'); // SSTORE opcode
    if (hasCALL && hasSSTORE) {
      // Check if CALL comes before SSTORE (simplified check)
      const callOffsets = opcodeMap.get('f1') ?? [];
      const sstoreOffsets = opcodeMap.get('55') ?? [];

      for (const callOffset of callOffsets) {
        const hasLaterSSTORE = sstoreOffsets.some((sstoreOffset) => sstoreOffset > callOffset);
        if (hasLaterSSTORE) {
          hasReentrancyPattern = true;
          findings.push({
            id: `reentrancy-${callOffset}`,
            category: VulnerabilityCategory.REENTRANCY,
            severity: VulnerabilitySeverity.CRITICAL,
            contract: metadata.address,
            bytecodeOffset: callOffset,
            title: 'Potential Reentrancy Pattern',
            description: 'Contract makes external calls before updating state (CALL before SSTORE)',
            impact:
              '$47M lost to reentrancy attacks in 2024. State can be manipulated during external calls.',
            recommendation:
              'Use checks-effects-interactions pattern. Move all state updates before external calls. Implement ReentrancyGuard.',
            evidence: { opcodes: ['CALL', 'SSTORE'], pattern: 'CALL -> SSTORE' },
            confidence: 'medium', // Heuristic only
          });
          break; // Only report once
        }
      }
    }

    // Check for complex loops (JUMPI in tight sequence - gas DoS risk)
    const jumpiOffsets = opcodeMap.get('57') ?? []; // JUMPI opcode
    if (jumpiOffsets.length > 10) {
      hasComplexLoops = true;
      findings.push({
        id: `complex-loops-${Date.now()}`,
        category: VulnerabilityCategory.GAS_LIMIT_DOS,
        severity: VulnerabilitySeverity.MEDIUM,
        contract: metadata.address,
        title: 'Complex Loop Structures Detected',
        description: `Contract contains ${jumpiOffsets.length} conditional jumps which may indicate complex loops`,
        impact: 'Unbounded loops can cause gas limit DoS',
        recommendation: 'Ensure all loops have bounded iterations. Consider pagination patterns.',
        confidence: 'low',
      });
    }

    // Timestamp dependence finding (if detected)
    if (hasTimestampDependence) {
      findings.push({
        id: `timestamp-${Date.now()}`,
        category: VulnerabilityCategory.TIMESTAMP_DEPENDENCE,
        severity: VulnerabilitySeverity.MEDIUM,
        contract: metadata.address,
        title: 'Block Timestamp Usage',
        description: 'Contract uses block.timestamp which can be manipulated by miners',
        impact: 'Miners can manipulate timestamp by ±15 seconds',
        recommendation:
          'Avoid using timestamp for critical logic. Use block numbers instead where possible.',
        confidence: 'high',
      });
    }

    // Dangerous opcode statistics
    const dangerousOpcodes = [
      {
        opcode: 'SELFDESTRUCT',
        count: opcodeMap.get(DANGEROUS_OPCODES.SELFDESTRUCT.replace(/^0x/, ''))?.length ?? 0,
        offsets: opcodeMap.get(DANGEROUS_OPCODES.SELFDESTRUCT.replace(/^0x/, '')) ?? [],
      },
      {
        opcode: 'DELEGATECALL',
        count: opcodeMap.get(DANGEROUS_OPCODES.DELEGATECALL.replace(/^0x/, ''))?.length ?? 0,
        offsets: opcodeMap.get(DANGEROUS_OPCODES.DELEGATECALL.replace(/^0x/, '')) ?? [],
      },
      {
        opcode: 'TIMESTAMP',
        count: opcodeMap.get(DANGEROUS_OPCODES.TIMESTAMP.replace(/^0x/, ''))?.length ?? 0,
        offsets: opcodeMap.get(DANGEROUS_OPCODES.TIMESTAMP.replace(/^0x/, '')) ?? [],
      },
    ].filter((op) => op.count > 0);

    return {
      hasReentrancyPattern,
      hasSelfdestructPattern,
      hasDelegatecallPattern,
      hasTimestampDependence,
      hasComplexLoops,
      opcodeStats: {
        totalOpcodes: bytecode.length / 2,
        dangerousOpcodes,
      },
      findings,
    };
  }

  /**
   * Analyze contract ABI for unsafe functions
   */
  private analyzeABI(metadata: ContractMetadata): ABIAnalysisResult {
    logger.info('Analyzing ABI', { address: metadata.address });

    interface ABIFunction {
      type?: string;
      name?: string;
      stateMutability?: string;
      selector?: string;
    }

    const findings: VulnerabilityFinding[] = [];
    const abi = (metadata.abi ?? []) as ABIFunction[];

    // Parse ABI
    const functions = abi.filter((item) => item.type === 'function');

    const publicFunctions = functions.filter(
      (f) => f.stateMutability !== 'private' && f.stateMutability !== 'internal'
    );
    const externalFunctions = functions.filter((f) => f.stateMutability === 'external');
    const payableFunctions = functions.filter((f) => f.stateMutability === 'payable');

    const unprotectedFunctions: ABIAnalysisResult['unprotectedFunctions'][number][] = [];

    // Check for unprotected state-changing functions
    for (const func of functions) {
      if (func.stateMutability === 'nonpayable' || func.stateMutability === 'payable') {
        // Heuristic: Functions without 'only' or 'require' in name might be unprotected
        const hasAccessControl = func.name?.match(/only|require|auth|guard/i) !== null;

        if (!hasAccessControl && func.stateMutability === 'payable') {
          unprotectedFunctions.push({
            name: func.name ?? 'unknown',
            selector: func.selector ?? '0x',
            isPayable: true,
            hasAccessControl: false,
          });

          findings.push({
            id: `unprotected-payable-${func.name ?? 'unknown'}`,
            category: VulnerabilityCategory.ACCESS_CONTROL,
            severity: VulnerabilitySeverity.HIGH,
            contract: metadata.address,
            function: func.name ?? 'unknown',
            title: 'Potentially Unprotected Payable Function',
            description: `Function ${func.name ?? 'unknown'} is payable but may lack access controls`,
            impact: 'Anyone can send ETH to this function, potentially causing unexpected behavior',
            recommendation:
              'Add access control modifiers (onlyOwner, onlyAdmin) or explicit require statements',
            confidence: 'medium',
          });
        }
      }
    }

    return {
      totalFunctions: functions.length,
      publicFunctions: publicFunctions.length,
      externalFunctions: externalFunctions.length,
      payableFunctions: payableFunctions.length,
      unprotectedFunctions,
      findings,
    };
  }

  /**
   * Analyze source code (if available)
   */
  private analyzeSource(metadata: ContractMetadata): SourceAnalysisResult {
    logger.info('Analyzing source code', { address: metadata.address });

    const findings: VulnerabilityFinding[] = [];
    const source = metadata.sourcecode ?? '';

    // Calculate metrics
    const linesOfCode = source.split('\n').length;
    const complexity = this.calculateComplexity(source);
    const contractCount = (source.match(/contract\s+\w+/g) ?? []).length;
    const inheritanceDepth = this.calculateInheritanceDepth(source);

    // Check for security patterns
    const usesReentrancyGuard =
      source.includes('ReentrancyGuard') || source.includes('nonReentrant');
    const usesAccessControl =
      source.includes('Ownable') ||
      source.includes('AccessControl') ||
      source.includes('onlyOwner');
    const usesCheckedMath =
      source.includes('SafeMath') || metadata.compilerVersion?.match(/0\.8\.\d+/) !== null;

    // Check for risky patterns
    if (!usesReentrancyGuard && source.includes('.call{')) {
      findings.push({
        id: `no-reentrancy-guard-${Date.now()}`,
        category: VulnerabilityCategory.REENTRANCY,
        severity: VulnerabilitySeverity.HIGH,
        contract: metadata.address,
        title: 'Missing Reentrancy Protection',
        description: 'Contract uses .call{} but does not implement ReentrancyGuard',
        impact: 'Contract is vulnerable to reentrancy attacks',
        recommendation: 'Inherit from OpenZeppelin ReentrancyGuard and use nonReentrant modifier',
        confidence: 'high',
      });
    }

    if (!usesAccessControl) {
      findings.push({
        id: `no-access-control-${Date.now()}`,
        category: VulnerabilityCategory.ACCESS_CONTROL,
        severity: VulnerabilitySeverity.MEDIUM,
        contract: metadata.address,
        title: 'Missing Access Control Framework',
        description: 'Contract does not use OpenZeppelin Ownable or AccessControl',
        impact: 'Access control may be implemented incorrectly',
        recommendation:
          'Use OpenZeppelin Ownable or AccessControl for standardized access management',
        confidence: 'medium',
      });
    }

    return {
      linesOfCode,
      complexity,
      contractCount,
      inheritanceDepth,
      usesReentrancyGuard,
      usesAccessControl,
      usesCheckedMath,
      findings,
    };
  }

  /**
   * Normalize metadata from Zod validation to ContractMetadata interface
   */
  private normalizeMetadata(metadata: {
    address: string;
    chain: 'ethereum' | 'solana';
    bytecode: string;
    isVerified?: boolean | undefined;
    sourcecode?: string | undefined;
    compilerVersion?: string | undefined;
    optimization?: boolean | undefined;
    abi?: readonly unknown[] | undefined;
  }): ContractMetadata {
    // Build base metadata
    const result: ContractMetadata = {
      address: metadata.address,
      chain: metadata.chain,
      bytecode: metadata.bytecode,
    };

    // Conditionally add optional properties (exactOptionalPropertyTypes pattern)
    if (metadata.isVerified !== undefined) {
      (result as { isVerified: boolean }).isVerified = metadata.isVerified;
    }
    if (metadata.sourcecode !== undefined) {
      (result as { sourcecode: string }).sourcecode = metadata.sourcecode;
    }
    if (metadata.compilerVersion !== undefined) {
      (result as { compilerVersion: string }).compilerVersion = metadata.compilerVersion;
    }
    if (metadata.optimization !== undefined) {
      (result as { optimization: boolean }).optimization = metadata.optimization;
    }
    if (metadata.abi !== undefined) {
      (result as { abi: readonly unknown[] }).abi = metadata.abi;
    }

    return result;
  }

  /**
   * Fetch contract metadata from blockchain and explorers
   */
  private async fetchContractMetadata(
    address: string,
    chain: 'ethereum' | 'solana'
  ): Promise<ContractMetadata> {
    // Otherwise, fetch from blockchain
    if (chain !== 'ethereum') {
      throw new Error('Only Ethereum supported for automatic metadata fetching');
    }

    if (this.ethereumProvider === undefined) {
      throw new Error('Ethereum provider not configured');
    }

    // Fetch bytecode
    const bytecode = await this.ethereumProvider.getCode(address);

    if (bytecode === '0x') {
      throw new Error(`No contract deployed at ${address}`);
    }

    const metadata: ContractMetadata = {
      address,
      chain,
      bytecode,
    };

    // TODO: Fetch from Etherscan/Sourcify if API key provided
    // This would include source code, ABI, compiler version, etc.

    return metadata;
  }

  /**
   * Calculate overall risk level
   */
  private calculateRiskLevel(
    summary: ContractAnalysisResult['summary'],
    isKnownMalicious: boolean
  ): ContractAnalysisResult['riskLevel'] {
    if (isKnownMalicious || summary.criticalCount > 0) {
      return 'critical';
    }

    if (summary.highCount > 2) {
      return 'high';
    }

    if (summary.highCount > 0 || summary.mediumCount > 3) {
      return 'medium';
    }

    if (summary.mediumCount > 0 || summary.lowCount > 5) {
      return 'low';
    }

    return 'minimal';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    findings: readonly VulnerabilityFinding[],
    riskLevel: ContractAnalysisResult['riskLevel'],
    isKnownMalicious: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (isKnownMalicious) {
      recommendations.push(
        '🚨 CRITICAL: Do NOT interact with this contract - it is known to be malicious'
      );
      return recommendations;
    }

    if (riskLevel === 'critical') {
      recommendations.push(
        '⛔ CRITICAL RISK: Do NOT interact with this contract until critical issues are resolved'
      );
      recommendations.push('Have the contract professionally audited before use');
    }

    if (riskLevel === 'high') {
      recommendations.push(
        '⚠️ HIGH RISK: Exercise extreme caution when interacting with this contract'
      );
      recommendations.push('Consider using a test transaction with minimal value first');
    }

    // Specific recommendations based on findings
    const hasReentrancy = findings.some((f) => f.category === VulnerabilityCategory.REENTRANCY);
    if (hasReentrancy) {
      recommendations.push('Implement OpenZeppelin ReentrancyGuard immediately');
    }

    const hasDelegatecall = findings.some(
      (f) => f.category === VulnerabilityCategory.DELEGATECALL_INJECTION
    );
    if (hasDelegatecall) {
      recommendations.push(
        'Review all DELEGATECALL usage - ensure target contracts are immutable and trusted'
      );
    }

    const hasAccessControl = findings.some(
      (f) => f.category === VulnerabilityCategory.ACCESS_CONTROL
    );
    if (hasAccessControl) {
      recommendations.push(
        'Implement proper access controls using OpenZeppelin Ownable or AccessControl'
      );
    }

    if (riskLevel === 'medium' || riskLevel === 'low') {
      recommendations.push(
        'Contract appears relatively safe, but review all findings before interaction'
      );
    }

    if (riskLevel === 'minimal') {
      recommendations.push('✅ Contract appears safe based on automated analysis');
      recommendations.push(
        'Note: Automated analysis cannot detect all vulnerabilities - manual review recommended'
      );
    }

    return recommendations;
  }

  /**
   * Calculate cyclomatic complexity (simplified)
   */
  private calculateComplexity(source: string): number {
    // Count decision points: if, while, for, &&, ||, ?
    const decisionPoints = (source.match(/\b(if|while|for|&&|\|\||switch|case|\?)\b/g) ?? [])
      .length;
    return decisionPoints + 1; // Add 1 for the base path
  }

  /**
   * Calculate inheritance depth
   */
  private calculateInheritanceDepth(source: string): number {
    const inheritanceMatches = source.match(/contract\s+\w+\s+is\s+([^{]+)/g) ?? [];
    let maxDepth = 0;

    for (const match of inheritanceMatches) {
      const inheritedContracts = match.split('is')[1]?.split(',').length ?? 0;
      maxDepth = Math.max(maxDepth, inheritedContracts);
    }

    return maxDepth;
  }

  /**
   * Initialize known malicious contracts database
   */
  private initializeMaliciousDB(): void {
    // In production, this would be loaded from an external database/API
    // For now, just initialize empty
    // Example: this.maliciousContractsDB.add('0xmaliciouscontract...');
  }

  /**
   * Add contract to malicious database
   */
  addMaliciousContract(address: string): void {
    this.maliciousContractsDB.add(address.toLowerCase());
    logger.warn('Contract added to malicious database', { address });
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    logger.info('Analysis cache cleared');
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    cacheSize: number;
    maliciousCount: number;
    config: Required<Omit<ContractAnalyzerConfig, 'ethereumProvider' | 'etherscanApiKey'>>;
  } {
    return {
      cacheSize: this.analysisCache.size,
      maliciousCount: this.maliciousContractsDB.size,
      config: this.config,
    };
  }
}
