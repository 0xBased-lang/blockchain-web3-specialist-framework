/**
 * Blockchain Tools MCP Server
 * Wraps Slither, Mythril, and Echidna for automated security scanning
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';

const execAsync = promisify(exec);

interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: any) => Promise<any>;
}

// Tool 1: Run Slither static analysis
const runSlither: MCPTool = {
  name: 'run_slither',
  description: 'Run Slither static analysis on Solidity contracts. Returns vulnerability findings categorized by severity.',
  inputSchema: {
    type: 'object',
    properties: {
      contract_path: { type: 'string', description: 'Path to Solidity contract or directory' },
      exclude_low: { type: 'boolean', default: true },
      detectors: { type: 'array', items: { type: 'string' }, description: 'Specific detectors to run' }
    },
    required: ['contract_path']
  },
  handler: async (args) => {
    const { contract_path, exclude_low, detectors } = args;

    let command = `slither ${contract_path} --json slither-output.json`;

    if (exclude_low) {
      command += ' --exclude-low';
    }

    if (detectors && detectors.length > 0) {
      command += ` --detect ${detectors.join(',')}`;
    }

    try {
      const { stdout, stderr } = await execAsync(command);

      // Read JSON output
      const report = JSON.parse(await readFile('slither-output.json', 'utf-8'));

      // Parse and categorize findings
      const findings = {
        critical: report.results.detectors.filter((d: any) => d.impact === 'High'),
        medium: report.results.detectors.filter((d: any) => d.impact === 'Medium'),
        low: report.results.detectors.filter((d: any) => d.impact === 'Low'),
        informational: report.results.detectors.filter((d: any) => d.impact === 'Informational')
      };

      return {
        success: true,
        tool: 'slither',
        findings,
        summary: {
          critical: findings.critical.length,
          medium: findings.medium.length,
          low: findings.low.length,
          informational: findings.informational.length
        },
        deployment_safe: findings.critical.length === 0
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr
      };
    }
  }
};

// Tool 2: Run Mythril symbolic execution
const runMythril: MCPTool = {
  name: 'run_mythril',
  description: 'Run Mythril symbolic execution analysis on Solidity contracts. Detects vulnerabilities through symbolic execution.',
  inputSchema: {
    type: 'object',
    properties: {
      contract_path: { type: 'string' },
      timeout: { type: 'number', default: 300 },
      solc_version: { type: 'string', default: '0.8.20' },
      max_depth: { type: 'number', default: 128 }
    },
    required: ['contract_path']
  },
  handler: async (args) => {
    const { contract_path, timeout, solc_version, max_depth } = args;

    const command = `myth analyze ${contract_path} --solv ${solc_version} --execution-timeout ${timeout} --max-depth ${max_depth} -o json`;

    try {
      const { stdout } = await execAsync(command);
      const report = JSON.parse(stdout);

      return {
        success: true,
        tool: 'mythril',
        vulnerabilities: report.issues || [],
        summary: {
          total_issues: report.issues?.length || 0,
          high_severity: report.issues?.filter((i: any) => i.severity === 'High').length || 0
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Tool 3: Run Echidna fuzzing
const runEchidna: MCPTool = {
  name: 'run_echidna',
  description: 'Run Echidna property-based fuzzing tests on smart contracts',
  inputSchema: {
    type: 'object',
    properties: {
      contract_path: { type: 'string' },
      config_path: { type: 'string', description: 'Path to echidna.yaml config' },
      test_limit: { type: 'number', default: 10000 }
    },
    required: ['contract_path']
  },
  handler: async (args) => {
    const { contract_path, config_path, test_limit } = args;

    let command = `echidna-test ${contract_path} --test-limit ${test_limit}`;

    if (config_path) {
      command += ` --config ${config_path}`;
    }

    try {
      const { stdout } = await execAsync(command);

      // Parse Echidna output
      const passedTests = (stdout.match(/✓/g) || []).length;
      const failedTests = (stdout.match(/✗/g) || []).length;

      return {
        success: true,
        tool: 'echidna',
        results: {
          passed: passedTests,
          failed: failedTests,
          output: stdout
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        output: error.stdout
      };
    }
  }
};

// Export all tools
export const tools: MCPTool[] = [
  runSlither,
  runMythril,
  runEchidna
];

// MCP Server configuration
export const mcpConfig = {
  name: 'blockchain-tools-mcp',
  version: '1.0.0',
  description: 'Security analysis tools for smart contracts (Slither, Mythril, Echidna)',
  tools: tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  }))
};

/**
 * Usage in BlockchainOrchestra:
 *
 * The security-auditor subagent can invoke these tools via MCP:
 *
 * 1. security-auditor reads contract files
 * 2. Calls run_slither via MCP
 * 3. Calls run_mythril via MCP
 * 4. Parses results
 * 5. Updates SECURITY_LOG.md
 * 6. Returns audit summary
 *
 * This keeps the main conversation clean while executing heavy tool operations.
 */
