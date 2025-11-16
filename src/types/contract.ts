/**
 * Contract Analysis Types
 *
 * Comprehensive type definitions for smart contract security analysis,
 * vulnerability detection, and safety validation.
 */

import { z } from 'zod';

/**
 * Vulnerability Categories (based on OWASP Smart Contract Top 10)
 */
export enum VulnerabilityCategory {
  // Critical (P0)
  REENTRANCY = 'reentrancy',
  ACCESS_CONTROL = 'access_control',
  ORACLE_MANIPULATION = 'oracle_manipulation',
  DELEGATECALL_INJECTION = 'delegatecall_injection',
  SELFDESTRUCT_UNPROTECTED = 'selfdestruct_unprotected',

  // High (P1)
  MEV_VULNERABILITY = 'mev_vulnerability',
  INTEGER_OVERFLOW = 'integer_overflow',
  TIMESTAMP_DEPENDENCE = 'timestamp_dependence',
  UNSAFE_EXTERNAL_CALL = 'unsafe_external_call',
  UNINITIALIZED_STORAGE = 'uninitialized_storage',

  // Medium (P2)
  GAS_LIMIT_DOS = 'gas_limit_dos',
  UNCHECKED_RETURN_VALUE = 'unchecked_return_value',
  MISSING_EVENTS = 'missing_events',
  FRONT_RUNNING = 'front_running',
  WEAK_RANDOMNESS = 'weak_randomness',

  // Low (P3)
  CODE_COMPLEXITY = 'code_complexity',
  DEPRECATED_FUNCTIONS = 'deprecated_functions',
  FLOATING_PRAGMA = 'floating_pragma',
  MISSING_NATSPEC = 'missing_natspec',

  // General
  OTHER = 'other',
}

/**
 * Vulnerability Severity Levels
 */
export enum VulnerabilitySeverity {
  CRITICAL = 'critical', // Immediate exploitation possible, high impact
  HIGH = 'high', // Exploitation likely, significant impact
  MEDIUM = 'medium', // Exploitation possible under conditions, moderate impact
  LOW = 'low', // Minor issues, best practice violations
  INFO = 'info', // Informational findings, no security impact
}

/**
 * Contract Vulnerability Finding
 */
export interface VulnerabilityFinding {
  // Identification
  readonly id: string; // Unique finding ID
  readonly category: VulnerabilityCategory;
  readonly severity: VulnerabilitySeverity;

  // Location
  readonly contract: string; // Contract address or name
  readonly function?: string; // Function name if applicable
  readonly bytecodeOffset?: number; // Bytecode offset
  readonly sourceLineNumber?: number; // Source code line number if available

  // Details
  readonly title: string; // Short title
  readonly description: string; // Detailed description
  readonly impact: string; // Potential impact
  readonly recommendation: string; // How to fix
  readonly references?: string[]; // External references (SWC, DASP, etc.)

  // Evidence
  readonly evidence?: {
    readonly opcodes?: string[]; // Dangerous opcodes found
    readonly pattern?: string; // Pattern matched
    readonly trace?: string; // Call trace showing vulnerability
  };

  // Confidence
  readonly confidence: 'high' | 'medium' | 'low'; // Detection confidence
}

/**
 * Contract Metadata
 */
export interface ContractMetadata {
  readonly address: string;
  readonly chain: 'ethereum' | 'solana';
  readonly bytecode: string;

  // Optional verified contract data
  readonly isVerified?: boolean;
  readonly sourcecode?: string;
  readonly compilerVersion?: string;
  readonly optimization?: boolean;
  readonly optimizationRuns?: number;
  readonly constructorArguments?: string;
  readonly abi?: readonly unknown[];
  readonly contractName?: string;
  readonly license?: string;

  // Deployment info
  readonly deployedAt?: number; // Block number
  readonly deployer?: string; // Deployer address

  // External analysis
  readonly hasSecurityAudit?: boolean;
  readonly auditReports?: readonly string[]; // URLs to audit reports
  readonly knownVulnerabilities?: readonly string[]; // CVEs or known issues
}

/**
 * Contract Analysis Request
 */
export interface ContractAnalysisRequest {
  readonly address: string;
  readonly chain: 'ethereum' | 'solana';

  // Optional: Provide metadata if already fetched
  readonly metadata?: ContractMetadata;

  // Analysis options
  readonly options?: {
    readonly includeBytecodeAnalysis?: boolean; // Analyze bytecode patterns
    readonly includeABIAnalysis?: boolean; // Analyze ABI for unsafe functions
    readonly includeSourceAnalysis?: boolean; // Analyze source if available
    readonly fetchFromExplorers?: boolean; // Fetch metadata from Etherscan/Sourcify
    readonly checkKnownMalicious?: boolean; // Check against malicious contract DB
    readonly deepAnalysis?: boolean; // More thorough but slower analysis
  };
}

/**
 * Bytecode Pattern Analysis Result
 */
export interface BytecodeAnalysisResult {
  readonly hasReentrancyPattern: boolean;
  readonly hasSelfdestructPattern: boolean;
  readonly hasDelegatecallPattern: boolean;
  readonly hasTimestampDependence: boolean;
  readonly hasComplexLoops: boolean;

  readonly opcodeStats: {
    readonly totalOpcodes: number;
    readonly dangerousOpcodes: readonly {
      readonly opcode: string;
      readonly count: number;
      readonly offsets: readonly number[];
    }[];
  };

  readonly findings: readonly VulnerabilityFinding[];
}

/**
 * ABI Analysis Result
 */
export interface ABIAnalysisResult {
  readonly totalFunctions: number;
  readonly publicFunctions: number;
  readonly externalFunctions: number;
  readonly payableFunctions: number;

  readonly unprotectedFunctions: readonly {
    readonly name: string;
    readonly selector: string;
    readonly isPayable: boolean;
    readonly hasAccessControl: boolean;
  }[];

  readonly findings: readonly VulnerabilityFinding[];
}

/**
 * Source Code Analysis Result
 */
export interface SourceAnalysisResult {
  readonly linesOfCode: number;
  readonly complexity: number; // Cyclomatic complexity
  readonly contractCount: number;
  readonly inheritanceDepth: number;

  readonly usesReentrancyGuard: boolean;
  readonly usesAccessControl: boolean;
  readonly usesCheckedMath: boolean; // SafeMath or Solidity 0.8+

  readonly findings: readonly VulnerabilityFinding[];
}

/**
 * Contract Analysis Result
 */
export interface ContractAnalysisResult {
  readonly address: string;
  readonly chain: 'ethereum' | 'solana';
  readonly analyzedAt: Date;
  readonly analysisVersion: string; // Analyzer version

  // Metadata
  readonly metadata: ContractMetadata;

  // Analysis results
  readonly bytecodeAnalysis?: BytecodeAnalysisResult;
  readonly abiAnalysis?: ABIAnalysisResult;
  readonly sourceAnalysis?: SourceAnalysisResult;

  // All findings aggregated
  readonly findings: readonly VulnerabilityFinding[];

  // Summary
  readonly summary: {
    readonly totalFindings: number;
    readonly criticalCount: number;
    readonly highCount: number;
    readonly mediumCount: number;
    readonly lowCount: number;
    readonly infoCount: number;
  };

  // Overall risk assessment
  readonly riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  readonly isKnownMalicious: boolean;
  readonly recommendations: readonly string[];
}

/**
 * Known Malicious Contract Pattern
 */
export interface MaliciousPattern {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly bytecodeSignature?: string; // Hex pattern to match
  readonly functionSignatures?: readonly string[]; // Function selectors
  readonly severity: VulnerabilitySeverity;
  readonly cveIds?: readonly string[]; // Related CVEs
  readonly references: readonly string[]; // External links
}

/**
 * Contract Safety Score
 */
export interface ContractSafetyScore {
  readonly address: string;
  readonly score: number; // 0-100 (100 = safest)
  readonly breakdown: {
    readonly bytecode: number; // 0-25
    readonly abi: number; // 0-25
    readonly source: number; // 0-25
    readonly reputation: number; // 0-25
  };
  readonly factors: readonly {
    readonly factor: string;
    readonly impact: number; // -100 to +100
    readonly reason: string;
  }[];
}

/**
 * Zod Validation Schemas
 */

export const ContractAnalysisRequestSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  chain: z.enum(['ethereum', 'solana']),
  metadata: z
    .object({
      address: z.string(),
      chain: z.enum(['ethereum', 'solana']),
      bytecode: z.string(),
      isVerified: z.boolean().optional(),
      sourcecode: z.string().optional(),
      compilerVersion: z.string().optional(),
      optimization: z.boolean().optional(),
      abi: z.array(z.unknown()).readonly().optional(),
    })
    .optional(),
  options: z
    .object({
      includeBytecodeAnalysis: z.boolean().optional(),
      includeABIAnalysis: z.boolean().optional(),
      includeSourceAnalysis: z.boolean().optional(),
      fetchFromExplorers: z.boolean().optional(),
      checkKnownMalicious: z.boolean().optional(),
      deepAnalysis: z.boolean().optional(),
    })
    .optional(),
});

export const VulnerabilityFindingSchema = z.object({
  id: z.string(),
  category: z.nativeEnum(VulnerabilityCategory),
  severity: z.nativeEnum(VulnerabilitySeverity),
  contract: z.string(),
  function: z.string().optional(),
  bytecodeOffset: z.number().optional(),
  sourceLineNumber: z.number().optional(),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  recommendation: z.string(),
  references: z.array(z.string()).optional(),
  evidence: z
    .object({
      opcodes: z.array(z.string()).optional(),
      pattern: z.string().optional(),
      trace: z.string().optional(),
    })
    .optional(),
  confidence: z.enum(['high', 'medium', 'low']),
});

/**
 * Dangerous Opcode Patterns
 */
export const DANGEROUS_OPCODES = {
  SELFDESTRUCT: '0xff',
  DELEGATECALL: '0xf4',
  CALLCODE: '0xf2', // Deprecated
  CREATE: '0xf0',
  CREATE2: '0xf5',
  TIMESTAMP: '0x42',
  BLOCKHASH: '0x40',
  NUMBER: '0x43',
  DIFFICULTY: '0x44', // PREVRANDAO post-merge
} as const;

/**
 * Known Malicious Function Signatures
 */
export const MALICIOUS_FUNCTION_SIGNATURES = [
  '0x70a08231', // balanceOf - often used in scam tokens
  '0xa9059cbb', // transfer - can be manipulated
  '0x23b872dd', // transferFrom - reentrancy vector
] as const;

/**
 * Security Best Practices Checklist
 */
export interface SecurityChecklist {
  readonly hasReentrancyGuard: boolean;
  readonly usesAccessControl: boolean;
  readonly usesCheckedMath: boolean;
  readonly hasEmergencyStop: boolean;
  readonly hasUpgradeability: boolean;
  readonly hasTimelock: boolean;
  readonly usesMultisig: boolean;
  readonly hasEvents: boolean;
  readonly hasNatSpec: boolean;
  readonly hasTests: boolean;
  readonly hasAudit: boolean;
}

/**
 * Contract Interaction Safety Check
 */
export interface InteractionSafetyCheck {
  readonly targetContract: string;
  readonly function: string;
  readonly isSafe: boolean;
  readonly warnings: readonly string[];
  readonly requiredApprovals: number; // Multisig approvals needed
  readonly estimatedRisk: 'low' | 'medium' | 'high' | 'critical';
}
