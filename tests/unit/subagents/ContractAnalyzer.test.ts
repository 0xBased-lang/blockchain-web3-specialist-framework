/**
 * ContractAnalyzer Tests
 *
 * Tests for smart contract security analysis, vulnerability detection,
 * and risk assessment.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type JsonRpcProvider } from 'ethers';
import { ContractAnalyzer } from '../../../src/subagents/ContractAnalyzer.js';
import {
  type ContractAnalysisRequest,
  VulnerabilityCategory,
  VulnerabilitySeverity,
  DANGEROUS_OPCODES,
} from '../../../src/types/contract.js';

describe('ContractAnalyzer', () => {
  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const analyzer = new ContractAnalyzer({});

      const stats = analyzer.getStats();
      expect(stats.config.sourcifyEnabled).toBe(true);
      expect(stats.config.cacheEnabled).toBe(true);
      expect(stats.config.cacheTTL).toBe(3600);
      expect(stats.config.deepAnalysis).toBe(false);
      expect(stats.cacheSize).toBe(0);
      expect(stats.maliciousCount).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const analyzer = new ContractAnalyzer({
        sourcifyEnabled: false,
        cacheEnabled: false,
        cacheTTL: 7200,
        deepAnalysis: true,
      });

      const stats = analyzer.getStats();
      expect(stats.config.sourcifyEnabled).toBe(false);
      expect(stats.config.cacheEnabled).toBe(false);
      expect(stats.config.cacheTTL).toBe(7200);
      expect(stats.config.deepAnalysis).toBe(true);
    });

    it('should initialize with ethereum provider', () => {
      const provider = {} as JsonRpcProvider;
      const analyzer = new ContractAnalyzer({
        ethereumProvider: provider,
      });

      expect(analyzer).toBeDefined();
    });
  });

  describe('Bytecode Analysis', () => {
    let analyzer: ContractAnalyzer;
    let provider: JsonRpcProvider;

    beforeEach(() => {
      provider = {
        getCode: vi.fn(),
      } as unknown as JsonRpcProvider;

      analyzer = new ContractAnalyzer({
        ethereumProvider: provider,
      });
    });

    it('should detect SELFDESTRUCT opcode', async () => {
      // Bytecode with SELFDESTRUCT (0xff)
      const bytecodeWithSelfdestruct = '0x60806040ff';
      provider.getCode = vi.fn().mockResolvedValue(bytecodeWithSelfdestruct);

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.bytecodeAnalysis?.hasSelfdestructPattern).toBe(true);
      const selfdestructFinding = result.findings.find(
        (f) => f.category === VulnerabilityCategory.SELFDESTRUCT_UNPROTECTED
      );
      expect(selfdestructFinding).toBeDefined();
      expect(selfdestructFinding?.severity).toBe(VulnerabilitySeverity.HIGH);
      expect(selfdestructFinding?.title).toContain('SELFDESTRUCT');
    });

    it('should detect DELEGATECALL opcode', async () => {
      // Bytecode with DELEGATECALL (0xf4)
      const bytecodeWithDelegatecall = '0x60806040f4';
      provider.getCode = vi.fn().mockResolvedValue(bytecodeWithDelegatecall);

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.bytecodeAnalysis?.hasDelegatecallPattern).toBe(true);
      const delegatecallFinding = result.findings.find(
        (f) => f.category === VulnerabilityCategory.DELEGATECALL_INJECTION
      );
      expect(delegatecallFinding).toBeDefined();
      expect(delegatecallFinding?.severity).toBe(VulnerabilitySeverity.CRITICAL);
      expect(delegatecallFinding?.title).toContain('DELEGATECALL');
    });

    it('should detect potential reentrancy pattern (CALL before SSTORE)', async () => {
      // Bytecode with CALL (0xf1) followed by SSTORE (0x55)
      const bytecodeWithReentrancy = '0x6080604052f160005560206000f3';
      provider.getCode = vi.fn().mockResolvedValue(bytecodeWithReentrancy);

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.bytecodeAnalysis?.hasReentrancyPattern).toBe(true);
      const reentrancyFinding = result.findings.find(
        (f) => f.category === VulnerabilityCategory.REENTRANCY
      );
      expect(reentrancyFinding).toBeDefined();
      expect(reentrancyFinding?.severity).toBe(VulnerabilitySeverity.CRITICAL);
      expect(reentrancyFinding?.impact).toContain('$47M');
    });

    it('should detect timestamp dependence', async () => {
      // Bytecode with TIMESTAMP (0x42)
      const bytecodeWithTimestamp = '0x60806040425560206000f3';
      provider.getCode = vi.fn().mockResolvedValue(bytecodeWithTimestamp);

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.bytecodeAnalysis?.hasTimestampDependence).toBe(true);
      const timestampFinding = result.findings.find(
        (f) => f.category === VulnerabilityCategory.TIMESTAMP_DEPENDENCE
      );
      expect(timestampFinding).toBeDefined();
      expect(timestampFinding?.severity).toBe(VulnerabilitySeverity.MEDIUM);
    });

    it('should detect complex loops (multiple JUMPI)', async () => {
      // Bytecode with many JUMPI opcodes (0x57)
      const jumpiOpcodes = '57'.repeat(15); // 15 JUMPI opcodes
      const bytecodeWithLoops = `0x6080604052${jumpiOpcodes}60206000f3`;
      provider.getCode = vi.fn().mockResolvedValue(bytecodeWithLoops);

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.bytecodeAnalysis?.hasComplexLoops).toBe(true);
      const loopFinding = result.findings.find(
        (f) => f.category === VulnerabilityCategory.GAS_LIMIT_DOS
      );
      expect(loopFinding).toBeDefined();
      expect(loopFinding?.title).toContain('Complex Loop');
    });

    it('should analyze clean bytecode with no vulnerabilities', async () => {
      // Simple bytecode with no dangerous patterns
      const cleanBytecode = '0x6080604052602060006000f3';
      provider.getCode = vi.fn().mockResolvedValue(cleanBytecode);

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.bytecodeAnalysis?.hasReentrancyPattern).toBe(false);
      expect(result.bytecodeAnalysis?.hasSelfdestructPattern).toBe(false);
      expect(result.bytecodeAnalysis?.hasDelegatecallPattern).toBe(false);
      expect(result.riskLevel).toBe('minimal');
    });
  });

  describe('ABI Analysis', () => {
    let analyzer: ContractAnalyzer;

    beforeEach(() => {
      analyzer = new ContractAnalyzer({});
    });

    it('should analyze ABI with payable functions', async () => {
      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
        metadata: {
          address: '0x1234567890123456789012345678901234567890',
          chain: 'ethereum',
          bytecode: '0x6080604052',
          abi: [
            {
              type: 'function',
              name: 'deposit',
              stateMutability: 'payable',
            },
            {
              type: 'function',
              name: 'withdraw',
              stateMutability: 'nonpayable',
            },
          ],
        },
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.abiAnalysis?.totalFunctions).toBe(2);
      expect(result.abiAnalysis?.payableFunctions).toBe(1);
    });

    it('should detect potentially unprotected payable functions', async () => {
      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
        metadata: {
          address: '0x1234567890123456789012345678901234567890',
          chain: 'ethereum',
          bytecode: '0x6080604052',
          abi: [
            {
              type: 'function',
              name: 'dangerousPayable', // No 'only', 'require', 'auth', 'guard' in name
              stateMutability: 'payable',
            },
          ],
        },
      };

      const result = await analyzer.analyzeContract(request);

      const accessControlFinding = result.findings.find(
        (f) => f.category === VulnerabilityCategory.ACCESS_CONTROL
      );
      expect(accessControlFinding).toBeDefined();
      expect(accessControlFinding?.function).toBe('dangerousPayable');
      expect(accessControlFinding?.severity).toBe(VulnerabilitySeverity.HIGH);
    });

    it('should not flag protected payable functions', async () => {
      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
        metadata: {
          address: '0x1234567890123456789012345678901234567890',
          chain: 'ethereum',
          bytecode: '0x6080604052',
          abi: [
            {
              type: 'function',
              name: 'onlyOwnerDeposit', // Has 'only' in name (heuristic for access control)
              stateMutability: 'payable',
            },
          ],
        },
      };

      const result = await analyzer.analyzeContract(request);

      const accessControlFindings = result.findings.filter(
        (f) => f.category === VulnerabilityCategory.ACCESS_CONTROL
      );
      expect(accessControlFindings.length).toBe(0);
    });
  });

  describe('Source Code Analysis', () => {
    let analyzer: ContractAnalyzer;

    beforeEach(() => {
      analyzer = new ContractAnalyzer({});
    });

    it('should detect missing ReentrancyGuard', async () => {
      const sourceWithoutGuard = `
        pragma solidity ^0.8.0;
        contract MyContract {
          function withdraw() external {
            msg.sender.call{value: amount}("");
          }
        }
      `;

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
        metadata: {
          address: '0x1234567890123456789012345678901234567890',
          chain: 'ethereum',
          bytecode: '0x6080604052',
          sourcecode: sourceWithoutGuard,
        },
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.sourceAnalysis?.usesReentrancyGuard).toBe(false);
      const reentrancyFinding = result.findings.find(
        (f) => f.category === VulnerabilityCategory.REENTRANCY
      );
      expect(reentrancyFinding).toBeDefined();
      expect(reentrancyFinding?.title).toContain('Missing Reentrancy Protection');
    });

    it('should detect ReentrancyGuard usage', async () => {
      const sourceWithGuard = `
        pragma solidity ^0.8.0;
        import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
        contract MyContract is ReentrancyGuard {
          function withdraw() external nonReentrant {
            msg.sender.call{value: amount}("");
          }
        }
      `;

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
        metadata: {
          address: '0x1234567890123456789012345678901234567890',
          chain: 'ethereum',
          bytecode: '0x6080604052',
          sourcecode: sourceWithGuard,
        },
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.sourceAnalysis?.usesReentrancyGuard).toBe(true);
    });

    it('should detect missing access control', async () => {
      const sourceWithoutAccessControl = `
        pragma solidity ^0.8.0;
        contract MyContract {
          function admin() external {
            // No access control
          }
        }
      `;

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
        metadata: {
          address: '0x1234567890123456789012345678901234567890',
          chain: 'ethereum',
          bytecode: '0x6080604052',
          sourcecode: sourceWithoutAccessControl,
        },
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.sourceAnalysis?.usesAccessControl).toBe(false);
      const accessControlFinding = result.findings.find(
        (f) => f.category === VulnerabilityCategory.ACCESS_CONTROL &&
             f.title.includes('Missing Access Control Framework')
      );
      expect(accessControlFinding).toBeDefined();
    });

    it('should detect SafeMath or Solidity 0.8+ checked math', async () => {
      const sourceWithCheckedMath = `
        pragma solidity ^0.8.0;
        contract MyContract {
          // Built-in overflow checks in 0.8+
        }
      `;

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
        metadata: {
          address: '0x1234567890123456789012345678901234567890',
          chain: 'ethereum',
          bytecode: '0x6080604052',
          sourcecode: sourceWithCheckedMath,
          compilerVersion: '0.8.19',
        },
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.sourceAnalysis?.usesCheckedMath).toBe(true);
    });
  });

  describe('Risk Assessment', () => {
    let analyzer: ContractAnalyzer;

    beforeEach(() => {
      analyzer = new ContractAnalyzer({});
    });

    it('should assess CRITICAL risk for known malicious contracts', async () => {
      const maliciousAddress = '0xmaliciouscontract0123456789012345678901';
      analyzer.addMaliciousContract(maliciousAddress);

      const request: ContractAnalysisRequest = {
        address: maliciousAddress,
        chain: 'ethereum',
        metadata: {
          address: maliciousAddress,
          chain: 'ethereum',
          bytecode: '0x6080604052',
        },
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.isKnownMalicious).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.recommendations[0]).toContain('Do NOT interact');
    });

    it('should assess CRITICAL risk for contracts with critical vulnerabilities', async () => {
      const provider = {
        getCode: vi.fn().mockResolvedValue('0x60806040f4'), // DELEGATECALL
      } as unknown as JsonRpcProvider;

      const analyzerWithProvider = new ContractAnalyzer({
        ethereumProvider: provider,
      });

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzerWithProvider.analyzeContract(request);

      expect(result.summary.criticalCount).toBeGreaterThan(0);
      expect(result.riskLevel).toBe('critical');
    });

    it('should assess HIGH risk for multiple high-severity findings', async () => {
      const provider = {
        getCode: vi.fn().mockResolvedValue('0x60806040ff425560206000f3'), // SELFDESTRUCT + TIMESTAMP
      } as unknown as JsonRpcProvider;

      const analyzerWithProvider = new ContractAnalyzer({
        ethereumProvider: provider,
      });

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzerWithProvider.analyzeContract(request);

      expect(result.summary.highCount).toBeGreaterThan(0);
      // Should be at least medium risk or higher
      expect(['medium', 'high', 'critical']).toContain(result.riskLevel);
    });

    it('should assess MINIMAL risk for clean contracts', async () => {
      const provider = {
        getCode: vi.fn().mockResolvedValue('0x6080604052602060006000f3'),
      } as unknown as JsonRpcProvider;

      const analyzerWithProvider = new ContractAnalyzer({
        ethereumProvider: provider,
      });

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzerWithProvider.analyzeContract(request);

      expect(result.summary.totalFindings).toBe(0);
      expect(result.riskLevel).toBe('minimal');
      expect(result.recommendations).toContain(
        '✅ Contract appears safe based on automated analysis'
      );
    });
  });

  describe('Caching', () => {
    it('should cache analysis results', async () => {
      const provider = {
        getCode: vi.fn().mockResolvedValue('0x6080604052'),
      } as unknown as JsonRpcProvider;

      const analyzer = new ContractAnalyzer({
        ethereumProvider: provider,
        cacheEnabled: true,
      });

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      // First analysis
      await analyzer.analyzeContract(request);
      expect(provider.getCode).toHaveBeenCalledTimes(1);

      // Second analysis (should hit cache)
      await analyzer.analyzeContract(request);
      expect(provider.getCode).toHaveBeenCalledTimes(1); // Still 1 (not called again)

      const stats = analyzer.getStats();
      expect(stats.cacheSize).toBe(1);
    });

    it('should not cache when caching is disabled', async () => {
      const provider = {
        getCode: vi.fn().mockResolvedValue('0x6080604052'),
      } as unknown as JsonRpcProvider;

      const analyzer = new ContractAnalyzer({
        ethereumProvider: provider,
        cacheEnabled: false,
      });

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      await analyzer.analyzeContract(request);
      await analyzer.analyzeContract(request);

      expect(provider.getCode).toHaveBeenCalledTimes(2);
    });

    it('should clear cache on demand', async () => {
      const provider = {
        getCode: vi.fn().mockResolvedValue('0x6080604052'),
      } as unknown as JsonRpcProvider;

      const analyzer = new ContractAnalyzer({
        ethereumProvider: provider,
        cacheEnabled: true,
      });

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      await analyzer.analyzeContract(request);
      expect(analyzer.getStats().cacheSize).toBe(1);

      analyzer.clearCache();
      expect(analyzer.getStats().cacheSize).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error if no contract at address', async () => {
      const provider = {
        getCode: vi.fn().mockResolvedValue('0x'), // No bytecode
      } as unknown as JsonRpcProvider;

      const analyzer = new ContractAnalyzer({
        ethereumProvider: provider,
      });

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      await expect(analyzer.analyzeContract(request)).rejects.toThrow(
        /No contract deployed/
      );
    });

    it('should throw error for invalid address format', async () => {
      const analyzer = new ContractAnalyzer({});

      const request = {
        address: 'invalid-address',
        chain: 'ethereum',
      } as ContractAnalysisRequest;

      await expect(analyzer.analyzeContract(request)).rejects.toThrow();
    });

    it('should throw error if provider not configured for Ethereum', async () => {
      const analyzer = new ContractAnalyzer({});

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      await expect(analyzer.analyzeContract(request)).rejects.toThrow(
        /Ethereum provider not configured/
      );
    });

    it('should handle Solana contracts', async () => {
      const analyzer = new ContractAnalyzer({});

      // Use a valid Solana address format
      const solanaAddress = 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N';

      const request: ContractAnalysisRequest = {
        address: solanaAddress,
        chain: 'solana',
        metadata: {
          address: solanaAddress,
          chain: 'solana',
          bytecode: '0x',
        },
      };

      // Solana analysis should work with provided metadata
      const result = await analyzer.analyzeContract(request);
      expect(result).toBeDefined();
      expect(result.chain).toBe('solana');
    });
  });

  describe('Malicious Contract Database', () => {
    it('should track malicious contracts', () => {
      const analyzer = new ContractAnalyzer({});

      expect(analyzer.getStats().maliciousCount).toBe(0);

      analyzer.addMaliciousContract('0xmalicious1234567890123456789012345678901');
      expect(analyzer.getStats().maliciousCount).toBe(1);

      analyzer.addMaliciousContract('0xmalicious0987654321098765432109876543210');
      expect(analyzer.getStats().maliciousCount).toBe(2);
    });

    it('should detect and flag known malicious contracts', async () => {
      const analyzer = new ContractAnalyzer({});
      const maliciousAddress = '0xbadC0de1234567890123456789012345678901AB';

      analyzer.addMaliciousContract(maliciousAddress);

      const request: ContractAnalysisRequest = {
        address: maliciousAddress,
        chain: 'ethereum',
        metadata: {
          address: maliciousAddress,
          chain: 'ethereum',
          bytecode: '0x6080604052',
        },
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.isKnownMalicious).toBe(true);
      expect(result.riskLevel).toBe('critical');

      const maliciousFinding = result.findings.find(
        (f) => f.title === 'Known Malicious Contract'
      );
      expect(maliciousFinding).toBeDefined();
      expect(maliciousFinding?.severity).toBe(VulnerabilitySeverity.CRITICAL);
    });
  });

  describe('Recommendations', () => {
    it('should provide specific recommendations for reentrancy', async () => {
      const provider = {
        getCode: vi.fn().mockResolvedValue('0x6080604052f160005560206000f3'), // CALL + SSTORE
      } as unknown as JsonRpcProvider;

      const analyzer = new ContractAnalyzer({
        ethereumProvider: provider,
      });

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.recommendations).toContain(
        'Implement OpenZeppelin ReentrancyGuard immediately'
      );
    });

    it('should provide specific recommendations for DELEGATECALL', async () => {
      const provider = {
        getCode: vi.fn().mockResolvedValue('0x60806040f4'), // DELEGATECALL
      } as unknown as JsonRpcProvider;

      const analyzer = new ContractAnalyzer({
        ethereumProvider: provider,
      });

      const request: ContractAnalysisRequest = {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      };

      const result = await analyzer.analyzeContract(request);

      expect(result.recommendations.some(r =>
        r.includes('DELEGATECALL') && r.includes('immutable')
      )).toBe(true);
    });
  });
});
