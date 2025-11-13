#!/usr/bin/env ts-node
/**
 * Cross-Chain State Validation
 *
 * Ensures contracts behave identically across different chains.
 * Addresses Edge Case 3.4: Cross-chain state inconsistency
 *
 * Features:
 * - Compare contract bytecode across chains
 * - Validate configuration parameters
 * - Check state consistency
 * - Report discrepancies
 */

interface ChainConfig {
  name: string;
  rpcUrl: string;
  contractAddress: string;
}

interface ValidationResult {
  chain: string;
  check: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  value?: any;
}

class CrossChainValidator {
  private chains: ChainConfig[];
  private results: ValidationResult[] = [];

  constructor(chains: ChainConfig[]) {
    this.chains = chains;
  }

  async validateBytecode(): Promise<void> {
    console.log('Validating bytecode consistency...');

    const bytecodes = new Map<string, string>();

    for (const chain of this.chains) {
      const bytecode = await this.getBytecode(chain);
      bytecodes.set(chain.name, bytecode);

      this.results.push({
        chain: chain.name,
        check: 'bytecode_retrieved',
        status: bytecode ? 'pass' : 'fail',
        message: bytecode ? 'Bytecode retrieved' : 'Failed to retrieve bytecode',
      });
    }

    // Compare all bytecodes
    const uniqueBytecodes = new Set(bytecodes.values());

    if (uniqueBytecodes.size === 1) {
      this.results.push({
        chain: 'all',
        check: 'bytecode_consistency',
        status: 'pass',
        message: 'All contracts have identical bytecode',
      });
    } else {
      this.results.push({
        chain: 'all',
        check: 'bytecode_consistency',
        status: 'fail',
        message: `Found ${uniqueBytecodes.size} different bytecode versions across chains`,
      });
    }
  }

  private async getBytecode(chain: ChainConfig): Promise<string> {
    try {
      const response = await fetch(chain.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getCode',
          params: [chain.contractAddress, 'latest'],
          id: 1,
        }),
      });

      const data = await response.json();
      return data.result || '';
    } catch (error) {
      console.error(`Failed to get bytecode from ${chain.name}:`, error);
      return '';
    }
  }

  async validateParameter(
    functionSig: string,
    expectedValue: any,
    valueName: string
  ): Promise<void> {
    console.log(`Validating ${valueName} across chains...`);

    for (const chain of this.chains) {
      const value = await this.callFunction(chain, functionSig);

      const matches = value === expectedValue;

      this.results.push({
        chain: chain.name,
        check: `parameter_${valueName}`,
        status: matches ? 'pass' : 'fail',
        message: matches
          ? `${valueName} matches expected value`
          : `${valueName} mismatch: got ${value}, expected ${expectedValue}`,
        value,
      });
    }
  }

  private async callFunction(chain: ChainConfig, functionSig: string): Promise<any> {
    try {
      const response = await fetch(chain.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: chain.contractAddress,
              data: functionSig,
            },
            'latest',
          ],
          id: 1,
        }),
      });

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error(`Failed to call function on ${chain.name}:`, error);
      return null;
    }
  }

  printReport(): void {
    console.log('\n' + '='.repeat(70));
    console.log('Cross-Chain Validation Report');
    console.log('='.repeat(70) + '\n');

    const grouped = new Map<string, ValidationResult[]>();

    for (const result of this.results) {
      const key = result.chain;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(result);
    }

    for (const [chain, results] of grouped) {
      console.log(`\n${chain.toUpperCase()}:`);

      for (const result of results) {
        const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
        console.log(`  ${icon} ${result.check}: ${result.message}`);
        if (result.value !== undefined) {
          console.log(`    Value: ${result.value}`);
        }
      }
    }

    // Summary
    const passed = this.results.filter((r) => r.status === 'pass').length;
    const failed = this.results.filter((r) => r.status === 'fail').length;
    const warned = this.results.filter((r) => r.status === 'warn').length;

    console.log('\n' + '='.repeat(70));
    console.log(`Summary: ${passed} passed, ${failed} failed, ${warned} warnings`);
    console.log('='.repeat(70));

    if (failed === 0) {
      console.log('\n✓ All cross-chain validations passed');
    } else {
      console.log('\n✗ Cross-chain inconsistencies detected');
      console.log('  Action: Review and fix discrepancies before proceeding');
    }
  }

  hasFailures(): boolean {
    return this.results.some((r) => r.status === 'fail');
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Cross-Chain Validation Tool

Usage:
  ./cross-chain-validate.ts <contract_name> <chain1:address1> <chain2:address2> [...]

Example:
  ./cross-chain-validate.ts StakingRewards \\
    ethereum:0x1234... \\
    bsc:0x5678... \\
    avalanche:0x9abc...

This will validate that the deployed contracts are consistent across chains.
    `);
    process.exit(1);
  }

  const contractName = args[0];
  const chainSpecs = args.slice(1);

  const chains: ChainConfig[] = chainSpecs.map((spec) => {
    const [name, address] = spec.split(':');
    const rpcUrl = process.env[`${name.toUpperCase()}_RPC_URL`] || '';

    if (!rpcUrl) {
      console.error(`Error: RPC URL not configured for ${name}`);
      console.error(`Set with: export ${name.toUpperCase()}_RPC_URL=<url>`);
      process.exit(1);
    }

    return { name, rpcUrl, contractAddress: address };
  });

  console.log(`Validating ${contractName} across ${chains.length} chains...`);
  console.log('Chains:', chains.map((c) => c.name).join(', '));
  console.log('');

  const validator = new CrossChainValidator(chains);

  // Validate bytecode
  await validator.validateBytecode();

  // Could add more validation here based on contract type
  // For example, validate specific parameters:
  // await validator.validateParameter('0x06fdde03', 'StakingToken', 'name');

  validator.printReport();

  process.exit(validator.hasFailures() ? 1 : 0);
}

if (require.main === module) {
  main().catch(console.error);
}

export { CrossChainValidator };
