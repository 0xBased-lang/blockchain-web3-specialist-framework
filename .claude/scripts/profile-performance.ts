#!/usr/bin/env ts-node
/**
 * Performance Profiling Tools
 *
 * Tracks gas usage, token consumption, and execution times across
 * the framework to identify optimization opportunities.
 *
 * Features:
 * - Gas profiling for contract functions
 * - Token usage tracking for Claude sessions
 * - Execution time monitoring for scripts
 * - Performance regression detection
 * - Optimization recommendations
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface GasProfile {
  contract: string;
  function: string;
  avgGas: number;
  minGas: number;
  maxGas: number;
  calls: number;
  timestamp: string;
}

interface TokenUsage {
  session: string;
  skillsLoaded: string[];
  contextFilesRead: string[];
  estimatedTokens: number;
  timestamp: string;
}

interface PerformanceMetric {
  operation: string;
  durationMs: number;
  success: boolean;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface PerformanceReport {
  gasProfiles: GasProfile[];
  tokenUsage: TokenUsage[];
  performanceMetrics: PerformanceMetric[];
  summary: {
    totalGasUsed: number;
    avgTokensPerSession: number;
    slowestOperations: string[];
    optimizationOpportunities: string[];
  };
}

class PerformanceProfiler {
  private stateFile = '.claude/state/performance-profile.json';
  private gasProfiles: GasProfile[] = [];
  private tokenUsage: TokenUsage[] = [];
  private performanceMetrics: PerformanceMetric[] = [];

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    if (fs.existsSync(this.stateFile)) {
      const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
      this.gasProfiles = data.gasProfiles || [];
      this.tokenUsage = data.tokenUsage || [];
      this.performanceMetrics = data.performanceMetrics || [];
    }
  }

  private saveState(): void {
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(
      this.stateFile,
      JSON.stringify(
        {
          gasProfiles: this.gasProfiles,
          tokenUsage: this.tokenUsage,
          performanceMetrics: this.performanceMetrics,
        },
        null,
        2
      )
    );
  }

  // Gas Profiling
  async profileGas(contractPath?: string): Promise<void> {
    console.log('Profiling gas usage...\n');

    try {
      // Run forge gas report
      const output = execSync('forge test --gas-report --json', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const testResults = JSON.parse(output);

      // Parse gas reports from test results
      for (const test of Object.values(testResults) as any[]) {
        if (test.gasUsed) {
          // Extract contract and function names
          const match = test.name.match(/test(\w+)/);
          const functionName = match ? match[1] : test.name;

          this.recordGasUsage('TestContract', functionName, test.gasUsed);
        }
      }

      console.log('Gas profiling complete');
      this.saveState();
    } catch (error) {
      console.error('Gas profiling failed:', error);
    }
  }

  recordGasUsage(contract: string, functionName: string, gasUsed: number): void {
    const existing = this.gasProfiles.find(
      p => p.contract === contract && p.function === functionName
    );

    if (existing) {
      existing.calls++;
      existing.avgGas = (existing.avgGas * (existing.calls - 1) + gasUsed) / existing.calls;
      existing.minGas = Math.min(existing.minGas, gasUsed);
      existing.maxGas = Math.max(existing.maxGas, gasUsed);
      existing.timestamp = new Date().toISOString();
    } else {
      this.gasProfiles.push({
        contract,
        function: functionName,
        avgGas: gasUsed,
        minGas: gasUsed,
        maxGas: gasUsed,
        calls: 1,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Token Usage Tracking
  recordTokenUsage(
    sessionId: string,
    skillsLoaded: string[],
    contextFiles: string[],
    estimatedTokens: number
  ): void {
    this.tokenUsage.push({
      session: sessionId,
      skillsLoaded,
      contextFilesRead: contextFiles,
      estimatedTokens,
      timestamp: new Date().toISOString(),
    });

    this.saveState();
  }

  estimateFileTokens(filePath: string): number {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Rough estimate: 1 token ≈ 4 characters
      return Math.ceil(content.length / 4);
    } catch {
      return 0;
    }
  }

  // Performance Metric Tracking
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = Date.now();
    let success = true;
    let error: Error | undefined;

    try {
      const result = await fn();
      return result;
    } catch (e) {
      success = false;
      error = e as Error;
      throw e;
    } finally {
      const durationMs = Date.now() - start;

      this.performanceMetrics.push({
        operation,
        durationMs,
        success,
        timestamp: new Date().toISOString(),
        metadata: {
          ...metadata,
          error: error?.message,
        },
      });

      this.saveState();
    }
  }

  // Reporting
  generateReport(): PerformanceReport {
    const report: PerformanceReport = {
      gasProfiles: this.gasProfiles,
      tokenUsage: this.tokenUsage,
      performanceMetrics: this.performanceMetrics,
      summary: {
        totalGasUsed: 0,
        avgTokensPerSession: 0,
        slowestOperations: [],
        optimizationOpportunities: [],
      },
    };

    // Calculate total gas
    report.summary.totalGasUsed = this.gasProfiles.reduce(
      (sum, p) => sum + p.avgGas * p.calls,
      0
    );

    // Calculate avg tokens per session
    if (this.tokenUsage.length > 0) {
      report.summary.avgTokensPerSession =
        this.tokenUsage.reduce((sum, u) => sum + u.estimatedTokens, 0) / this.tokenUsage.length;
    }

    // Find slowest operations
    const sortedOps = [...this.performanceMetrics].sort((a, b) => b.durationMs - a.durationMs);
    report.summary.slowestOperations = sortedOps
      .slice(0, 5)
      .map(m => `${m.operation}: ${m.durationMs}ms`);

    // Identify optimization opportunities
    const opportunities: string[] = [];

    // High gas functions
    const expensiveFunctions = this.gasProfiles.filter(p => p.avgGas > 100000);
    if (expensiveFunctions.length > 0) {
      opportunities.push(
        `${expensiveFunctions.length} functions use >100k gas (optimize storage/logic)`
      );
    }

    // High token sessions
    const heavySessions = this.tokenUsage.filter(u => u.estimatedTokens > 5000);
    if (heavySessions.length > 0) {
      opportunities.push(
        `${heavySessions.length} sessions used >5000 tokens (review skill loading)`
      );
    }

    // Slow operations
    const slowOps = this.performanceMetrics.filter(m => m.durationMs > 5000);
    if (slowOps.length > 0) {
      opportunities.push(`${slowOps.length} operations took >5s (consider optimization)`);
    }

    // Many context files
    const avgContextFiles =
      this.tokenUsage.reduce((sum, u) => sum + u.contextFilesRead.length, 0) /
      (this.tokenUsage.length || 1);
    if (avgContextFiles > 5) {
      opportunities.push(
        `Avg ${avgContextFiles.toFixed(1)} context files per session (consider caching)`
      );
    }

    report.summary.optimizationOpportunities = opportunities;

    return report;
  }

  printReport(): void {
    const report = this.generateReport();

    console.log('='.repeat(70));
    console.log('Performance Profile Report');
    console.log('='.repeat(70));
    console.log('');

    // Gas Profile
    console.log('Gas Usage Profile:');
    console.log('-'.repeat(70));

    if (report.gasProfiles.length > 0) {
      console.log(
        `${'Contract'.padEnd(20)} ${'Function'.padEnd(20)} ${'Avg Gas'.padStart(10)} ${'Calls'.padStart(8)}`
      );
      console.log('-'.repeat(70));

      const sortedGas = [...report.gasProfiles].sort((a, b) => b.avgGas - a.avgGas);

      for (const profile of sortedGas.slice(0, 10)) {
        console.log(
          `${profile.contract.padEnd(20)} ${profile.function.padEnd(20)} ${Math.round(profile.avgGas).toString().padStart(10)} ${profile.calls.toString().padStart(8)}`
        );
      }

      if (sortedGas.length > 10) {
        console.log(`... and ${sortedGas.length - 10} more functions`);
      }
    } else {
      console.log('  No gas profiling data yet');
    }

    console.log('');

    // Token Usage
    console.log('Token Usage Profile:');
    console.log('-'.repeat(70));

    if (report.tokenUsage.length > 0) {
      console.log(
        `Total Sessions: ${report.tokenUsage.length}, Avg Tokens: ${Math.round(report.summary.avgTokensPerSession)}`
      );

      const recentSessions = report.tokenUsage.slice(-5);
      console.log('\nRecent Sessions:');

      for (const session of recentSessions) {
        console.log(`  ${session.session}: ${session.estimatedTokens} tokens`);
        console.log(`    Skills: ${session.skillsLoaded.join(', ') || 'none'}`);
        console.log(`    Context: ${session.contextFilesRead.length} files`);
      }
    } else {
      console.log('  No token usage data yet');
    }

    console.log('');

    // Performance Metrics
    console.log('Operation Performance:');
    console.log('-'.repeat(70));

    if (report.performanceMetrics.length > 0) {
      const recentMetrics = report.performanceMetrics.slice(-10);

      console.log(`${'Operation'.padEnd(30)} ${'Duration'.padStart(12)} ${'Status'.padStart(10)}`);
      console.log('-'.repeat(70));

      for (const metric of recentMetrics) {
        const status = metric.success ? '✓' : '✗';
        console.log(
          `${metric.operation.padEnd(30)} ${(metric.durationMs + 'ms').padStart(12)} ${status.padStart(10)}`
        );
      }
    } else {
      console.log('  No performance metrics yet');
    }

    console.log('');

    // Optimization Opportunities
    console.log('Optimization Opportunities:');
    console.log('-'.repeat(70));

    if (report.summary.optimizationOpportunities.length > 0) {
      for (const opportunity of report.summary.optimizationOpportunities) {
        console.log(`  • ${opportunity}`);
      }
    } else {
      console.log('  No optimization opportunities detected');
    }

    console.log('');
    console.log('='.repeat(70));
  }

  // Gas Comparison (detect regressions)
  compareGasUsage(baseline: GasProfile[]): { regressions: string[]; improvements: string[] } {
    const regressions: string[] = [];
    const improvements: string[] = [];

    for (const current of this.gasProfiles) {
      const baselineProfile = baseline.find(
        b => b.contract === current.contract && b.function === current.function
      );

      if (baselineProfile) {
        const diff = current.avgGas - baselineProfile.avgGas;
        const pctChange = (diff / baselineProfile.avgGas) * 100;

        if (pctChange > 5) {
          regressions.push(
            `${current.contract}.${current.function}: +${Math.round(pctChange)}% gas (${Math.round(diff)} gas increase)`
          );
        } else if (pctChange < -5) {
          improvements.push(
            `${current.contract}.${current.function}: ${Math.round(pctChange)}% gas (${Math.round(-diff)} gas saved)`
          );
        }
      }
    }

    return { regressions, improvements };
  }

  // Export for CI/CD
  exportJSON(outputPath: string): void {
    const report = this.generateReport();
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`Performance report exported to ${outputPath}`);
  }

  // Clear old data
  clearOldData(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const cutoffISO = cutoffDate.toISOString();

    this.gasProfiles = this.gasProfiles.filter(p => p.timestamp >= cutoffISO);
    this.tokenUsage = this.tokenUsage.filter(u => u.timestamp >= cutoffISO);
    this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp >= cutoffISO);

    this.saveState();
    console.log(`Cleared data older than ${daysToKeep} days`);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const profiler = new PerformanceProfiler();

  switch (command) {
    case 'gas':
      await profiler.profileGas();
      break;

    case 'report':
      profiler.printReport();
      break;

    case 'export':
      const outputPath = args[1] || '.claude/state/performance-report.json';
      profiler.exportJSON(outputPath);
      break;

    case 'clear':
      const days = parseInt(args[1]) || 30;
      profiler.clearOldData(days);
      break;

    case 'track':
      // Manual tracking example
      const operation = args[1];
      const startTime = Date.now();
      // ... operation would run here ...
      const duration = Date.now() - startTime;
      console.log(`${operation} completed in ${duration}ms`);
      break;

    default:
      console.log(`
Performance Profiling Tools

Usage:
  ./profile-performance.ts <command> [options]

Commands:
  gas                  - Profile gas usage from forge tests
  report               - Generate and display performance report
  export [file]        - Export performance data to JSON
  clear [days]         - Clear performance data older than N days (default: 30)
  track <operation>    - Track execution time of an operation

Examples:
  ./profile-performance.ts gas
  ./profile-performance.ts report
  ./profile-performance.ts export performance.json
  ./profile-performance.ts clear 7

Features:
  - Gas profiling for contract functions
  - Token usage tracking across sessions
  - Execution time monitoring
  - Performance regression detection
  - Optimization recommendations
      `);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { PerformanceProfiler };
