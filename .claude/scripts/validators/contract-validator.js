#!/usr/bin/env node

/**
 * Contract Validator
 *
 * Validates smart contracts across both EVM and Solana:
 * - EVM: Slither security analysis, Foundry/Hardhat tests, gas analysis
 * - Solana: Anchor tests, program builds, security checks
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class ContractValidator {
  constructor(rootPath) {
    this.rootPath = rootPath || process.cwd();
    this.issues = [];
    this.hasEVM = false;
    this.hasSolana = false;
  }

  async validate() {
    console.log('📜 Validating smart contracts...\n');

    await this.detectContractTypes();

    if (this.hasEVM) {
      console.log('🔷 Validating EVM contracts...\n');
      await this.validateEVMContracts();
    }

    if (this.hasSolana) {
      console.log('🟣 Validating Solana programs...\n');
      await this.validateSolanaPrograms();
    }

    if (!this.hasEVM && !this.hasSolana) {
      console.log('ℹ️  No smart contracts detected in this project');
    }

    return this.generateReport();
  }

  async detectContractTypes() {
    // Check for EVM contracts
    const hasHardhat = await this.fileExists('hardhat.config.js') ||
                      await this.fileExists('hardhat.config.ts');
    const hasFoundry = await this.fileExists('foundry.toml');
    const hasSolidityFiles = await this.findFiles('.', ['.sol'], 10).then(f => f.length > 0);

    this.hasEVM = hasHardhat || hasFoundry || hasSolidityFiles;

    // Check for Solana programs
    const hasAnchor = await this.fileExists('Anchor.toml');
    const hasCargo = await this.fileExists('Cargo.toml');
    const hasProgramsDir = await this.directoryExists('programs');

    this.hasSolana = hasAnchor || (hasCargo && hasProgramsDir);

    console.log(`Detected: ${this.hasEVM ? 'EVM' : ''} ${this.hasSolana ? 'Solana' : ''}`);
  }

  // ==================== EVM VALIDATION ====================

  async validateEVMContracts() {
    await this.checkSlitherInstallation();
    await this.runSlitherAnalysis();
    await this.checkEVMCompilation();
    await this.runEVMTests();
    await this.analyzeGasUsage();
    await this.checkCommonEVMVulnerabilities();
  }

  async checkSlitherInstallation() {
    console.log('Checking Slither installation...');

    try {
      await execPromise('which slither', { cwd: this.rootPath });
      console.log('  ✓ Slither is installed');
      return true;
    } catch {
      this.addIssue({
        severity: 'medium',
        category: 'smart-contract-security',
        title: 'Slither not installed',
        description: 'Slither is a powerful static analyzer for Solidity',
        recommendation: 'Install: pip3 install slither-analyzer'
      });
      console.log('  ⚠️  Slither not found (recommended for security analysis)');
      return false;
    }
  }

  async runSlitherAnalysis() {
    console.log('Running Slither security analysis...');

    try {
      const { stdout, stderr } = await execPromise('slither . --json -', {
        cwd: this.rootPath,
        timeout: 120000
      });

      try {
        const results = JSON.parse(stdout);

        if (results.success === false) {
          console.log('  ⚠️  Slither analysis failed (may need compilation first)');
          return;
        }

        const detectors = results.results?.detectors || [];

        // Categorize by severity
        const high = detectors.filter(d => d.impact === 'High');
        const medium = detectors.filter(d => d.impact === 'Medium');
        const low = detectors.filter(d => d.impact === 'Low');

        if (high.length > 0) {
          for (const issue of high) {
            this.addIssue({
              severity: 'critical',
              category: 'smart-contract-security',
              title: `Slither: ${issue.check}`,
              description: issue.description || issue.check,
              file: issue.elements?.[0]?.source_mapping?.filename_relative,
              recommendation: 'Review and fix this high-severity security issue'
            });
          }
        }

        if (medium.length > 5) {
          this.addIssue({
            severity: 'medium',
            category: 'smart-contract-security',
            title: `${medium.length} medium-severity Slither warnings`,
            description: 'Multiple medium-severity issues detected',
            recommendation: 'Run: slither . --checklist'
          });
        }

        console.log(`  ✓ Slither: ${high.length} high, ${medium.length} medium, ${low.length} low`);
      } catch (parseError) {
        console.log('  ⚠️  Could not parse Slither output');
      }
    } catch (error) {
      // Slither not available or failed - already logged in checkSlitherInstallation
    }
  }

  async checkEVMCompilation() {
    console.log('Checking contract compilation...');

    const hasFoundry = await this.fileExists('foundry.toml');
    const hasHardhat = await this.fileExists('hardhat.config.js') ||
                       await this.fileExists('hardhat.config.ts');

    if (hasFoundry) {
      try {
        const { stdout, stderr } = await execPromise('forge build', {
          cwd: this.rootPath,
          timeout: 120000
        });

        if (stderr && stderr.includes('Error')) {
          this.addIssue({
            severity: 'high',
            category: 'smart-contract-build',
            title: 'Foundry compilation errors',
            description: 'Contracts fail to compile with Foundry',
            recommendation: 'Run: forge build --force'
          });
          console.log('  ✗ Foundry: Compilation errors');
        } else {
          console.log('  ✓ Foundry: Contracts compile successfully');
        }
      } catch (error) {
        this.addIssue({
          severity: 'high',
          category: 'smart-contract-build',
          title: 'Foundry compilation failed',
          description: error.stderr || 'Unknown compilation error',
          recommendation: 'Check compiler version and contract syntax'
        });
        console.log('  ✗ Foundry: Compilation failed');
      }
    }

    if (hasHardhat && !hasFoundry) {
      try {
        const { stdout, stderr } = await execPromise('npx hardhat compile', {
          cwd: this.rootPath,
          timeout: 120000
        });

        console.log('  ✓ Hardhat: Contracts compile successfully');
      } catch (error) {
        this.addIssue({
          severity: 'high',
          category: 'smart-contract-build',
          title: 'Hardhat compilation failed',
          description: 'Contracts fail to compile',
          recommendation: 'Run: npx hardhat compile'
        });
        console.log('  ✗ Hardhat: Compilation failed');
      }
    }

    if (!hasFoundry && !hasHardhat) {
      console.log('  ⊘ No build system detected (Foundry or Hardhat)');
    }
  }

  async runEVMTests() {
    console.log('Running contract tests...');

    const hasFoundry = await this.fileExists('foundry.toml');
    const hasHardhat = await this.fileExists('hardhat.config.js') ||
                       await this.fileExists('hardhat.config.ts');

    if (hasFoundry) {
      try {
        const { stdout, stderr } = await execPromise('forge test --json', {
          cwd: this.rootPath,
          timeout: 180000
        });

        // Parse forge test output
        const lines = stdout.split('\n').filter(l => l.trim().startsWith('{'));
        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;

        for (const line of lines) {
          try {
            const result = JSON.parse(line);
            if (result.type === 'test') {
              totalTests++;
              if (result.status === 'Success') passedTests++;
              if (result.status === 'Failure') failedTests++;
            }
          } catch {}
        }

        if (failedTests > 0) {
          this.addIssue({
            severity: 'high',
            category: 'smart-contract-tests',
            title: `${failedTests} failing Foundry tests`,
            description: `${failedTests} out of ${totalTests} tests are failing`,
            recommendation: 'Fix failing tests before deployment'
          });
          console.log(`  ✗ Foundry: ${passedTests}/${totalTests} tests passing`);
        } else if (totalTests > 0) {
          console.log(`  ✓ Foundry: All ${totalTests} tests passing`);
        } else {
          this.addIssue({
            severity: 'medium',
            category: 'smart-contract-tests',
            title: 'No Foundry tests found',
            description: 'Smart contracts should have comprehensive tests',
            recommendation: 'Add tests in test/ directory'
          });
          console.log('  ⚠️  No tests found');
        }
      } catch (error) {
        console.log('  ⚠️  Could not run Foundry tests');
      }
    }

    if (hasHardhat && !hasFoundry) {
      try {
        const { stdout, stderr } = await execPromise('npx hardhat test', {
          cwd: this.rootPath,
          timeout: 180000
        });

        const passingMatch = stdout.match(/(\d+) passing/);
        const failingMatch = stdout.match(/(\d+) failing/);

        const passing = passingMatch ? parseInt(passingMatch[1]) : 0;
        const failing = failingMatch ? parseInt(failingMatch[1]) : 0;

        if (failing > 0) {
          this.addIssue({
            severity: 'high',
            category: 'smart-contract-tests',
            title: `${failing} failing Hardhat tests`,
            description: 'Some contract tests are failing',
            recommendation: 'Fix failing tests before deployment'
          });
          console.log(`  ✗ Hardhat: ${passing} passing, ${failing} failing`);
        } else if (passing > 0) {
          console.log(`  ✓ Hardhat: All ${passing} tests passing`);
        } else {
          this.addIssue({
            severity: 'medium',
            category: 'smart-contract-tests',
            title: 'No Hardhat tests found',
            description: 'Smart contracts should have tests',
            recommendation: 'Add tests in test/ directory'
          });
          console.log('  ⚠️  No tests found');
        }
      } catch (error) {
        console.log('  ⚠️  Could not run Hardhat tests');
      }
    }
  }

  async analyzeGasUsage() {
    console.log('Analyzing gas usage...');

    const hasFoundry = await this.fileExists('foundry.toml');

    if (hasFoundry) {
      try {
        const { stdout } = await execPromise('forge test --gas-report', {
          cwd: this.rootPath,
          timeout: 180000
        });

        // Look for high gas usage patterns
        const lines = stdout.split('\n');
        const gasReportLines = lines.filter(l => l.includes('gas:'));

        let highGasFunctions = [];
        for (const line of gasReportLines) {
          const gasMatch = line.match(/gas:\s*(\d+)/);
          if (gasMatch) {
            const gasUsed = parseInt(gasMatch[1]);
            if (gasUsed > 1000000) { // More than 1M gas
              highGasFunctions.push({ line, gas: gasUsed });
            }
          }
        }

        if (highGasFunctions.length > 0) {
          this.addIssue({
            severity: 'medium',
            category: 'smart-contract-gas',
            title: `${highGasFunctions.length} functions with high gas usage`,
            description: 'Some functions use more than 1M gas',
            recommendation: 'Optimize gas-intensive functions'
          });
          console.log(`  ⚠️  ${highGasFunctions.length} high-gas functions detected`);
        } else {
          console.log('  ✓ Gas usage looks reasonable');
        }
      } catch (error) {
        console.log('  ⊘ Could not analyze gas (tests may have failed)');
      }
    } else {
      console.log('  ⊘ Gas analysis requires Foundry');
    }
  }

  async checkCommonEVMVulnerabilities() {
    console.log('Checking for common vulnerabilities...');

    const contractFiles = await this.findFiles('.', ['.sol'], 100);
    let vulnerabilities = 0;

    for (const file of contractFiles) {
      const content = await this.readFile(file);

      // Check for tx.origin usage (phishing vulnerability)
      if (content.includes('tx.origin')) {
        this.addIssue({
          severity: 'high',
          category: 'smart-contract-security',
          file: file,
          title: 'Use of tx.origin detected',
          description: 'tx.origin should not be used for authorization',
          recommendation: 'Use msg.sender instead of tx.origin'
        });
        vulnerabilities++;
      }

      // Check for floating pragma
      const pragmaMatch = content.match(/pragma solidity \^/);
      if (pragmaMatch) {
        this.addIssue({
          severity: 'low',
          category: 'smart-contract-best-practices',
          file: file,
          title: 'Floating pragma detected',
          description: 'Using ^ in pragma allows different compiler versions',
          recommendation: 'Lock pragma to specific version (e.g., pragma solidity 0.8.19;)'
        });
      }

      // Check for missing checks-effects-interactions pattern
      if (content.includes('.call{value:') || content.includes('.transfer(')) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('.call{value:') || lines[i].includes('.transfer(')) {
            // Check if state changes happen after external call (reentrancy risk)
            const nextLines = lines.slice(i + 1, i + 5).join('\n');
            if (nextLines.match(/\w+\s*=/) && !nextLines.includes('require(')) {
              this.addIssue({
                severity: 'medium',
                category: 'smart-contract-security',
                file: file,
                title: 'Potential reentrancy vulnerability',
                description: 'State changes after external call detected',
                recommendation: 'Follow checks-effects-interactions pattern'
              });
              vulnerabilities++;
              break;
            }
          }
        }
      }
    }

    if (vulnerabilities === 0) {
      console.log('  ✓ No common vulnerabilities detected');
    } else {
      console.log(`  ⚠️  Found ${vulnerabilities} potential vulnerabilities`);
    }
  }

  // ==================== SOLANA VALIDATION ====================

  async validateSolanaPrograms() {
    await this.checkAnchorInstallation();
    await this.checkSolanaProgramBuild();
    await this.runAnchorTests();
    await this.checkCommonSolanaIssues();
  }

  async checkAnchorInstallation() {
    console.log('Checking Anchor installation...');

    try {
      const { stdout } = await execPromise('anchor --version', { cwd: this.rootPath });
      const version = stdout.trim();
      console.log(`  ✓ Anchor ${version} installed`);
      return true;
    } catch {
      this.addIssue({
        severity: 'high',
        category: 'solana-tooling',
        title: 'Anchor not installed',
        description: 'Anchor framework is required for Solana program development',
        recommendation: 'Install: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force'
      });
      console.log('  ✗ Anchor not found');
      return false;
    }
  }

  async checkSolanaProgramBuild() {
    console.log('Checking Solana program build...');

    const hasAnchor = await this.fileExists('Anchor.toml');

    if (!hasAnchor) {
      console.log('  ⊘ No Anchor.toml found');
      return;
    }

    try {
      const { stdout, stderr } = await execPromise('anchor build', {
        cwd: this.rootPath,
        timeout: 300000 // Rust compilation can be slow
      });

      if (stderr && stderr.includes('error')) {
        this.addIssue({
          severity: 'high',
          category: 'solana-build',
          title: 'Anchor build errors',
          description: 'Solana programs fail to build',
          recommendation: 'Fix Rust compilation errors'
        });
        console.log('  ✗ Build failed');
      } else {
        console.log('  ✓ Programs build successfully');
      }
    } catch (error) {
      this.addIssue({
        severity: 'high',
        category: 'solana-build',
        title: 'Anchor build failed',
        description: error.stderr || 'Unknown build error',
        recommendation: 'Check Rust version and program syntax'
      });
      console.log('  ✗ Build failed');
    }
  }

  async runAnchorTests() {
    console.log('Running Anchor tests...');

    const hasAnchor = await this.fileExists('Anchor.toml');

    if (!hasAnchor) {
      console.log('  ⊘ No Anchor tests to run');
      return;
    }

    try {
      const { stdout, stderr } = await execPromise('anchor test --skip-local-validator', {
        cwd: this.rootPath,
        timeout: 300000
      });

      // Parse test output
      const passMatch = stdout.match(/(\d+) passing/);
      const failMatch = stdout.match(/(\d+) failing/);

      const passing = passMatch ? parseInt(passMatch[1]) : 0;
      const failing = failMatch ? parseInt(failMatch[1]) : 0;

      if (failing > 0) {
        this.addIssue({
          severity: 'high',
          category: 'solana-tests',
          title: `${failing} failing Anchor tests`,
          description: 'Some Solana program tests are failing',
          recommendation: 'Fix failing tests before deployment'
        });
        console.log(`  ✗ ${passing} passing, ${failing} failing`);
      } else if (passing > 0) {
        console.log(`  ✓ All ${passing} tests passing`);
      } else {
        this.addIssue({
          severity: 'medium',
          category: 'solana-tests',
          title: 'No Anchor tests found',
          description: 'Solana programs should have comprehensive tests',
          recommendation: 'Add tests in tests/ directory'
        });
        console.log('  ⚠️  No tests found');
      }
    } catch (error) {
      console.log('  ⚠️  Could not run Anchor tests (validator may be needed)');
    }
  }

  async checkCommonSolanaIssues() {
    console.log('Checking for common Solana issues...');

    const programFiles = await this.findFiles('programs', ['.rs'], 100);
    let issues = 0;

    for (const file of programFiles) {
      const content = await this.readFile(file);

      // Check for missing account validation
      if (content.includes('#[account]') && !content.includes('constraint')) {
        this.addIssue({
          severity: 'medium',
          category: 'solana-security',
          file: file,
          title: 'Potentially missing account constraints',
          description: 'Anchor accounts should have validation constraints',
          recommendation: 'Add constraint checks to #[account] attributes'
        });
        issues++;
      }

      // Check for missing signer validation
      if (content.includes('&mut Account') && !content.includes('Signer')) {
        // This is a heuristic - may have false positives
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.includes('&mut Account') && !line.includes('Signer')) {
            this.addIssue({
              severity: 'low',
              category: 'solana-security',
              file: file,
              title: 'Consider adding signer validation',
              description: 'Mutable accounts often require signer validation',
              recommendation: 'Ensure proper authorization checks are in place'
            });
            issues++;
            break;
          }
        }
      }

      // Check for unchecked arithmetic
      if (content.includes('checked_add') || content.includes('checked_sub') ||
          content.includes('checked_mul') || content.includes('checked_div')) {
        // Good - using checked arithmetic
      } else if (content.match(/\+|\-|\*|\//) && content.includes('pub fn')) {
        this.addIssue({
          severity: 'low',
          category: 'solana-best-practices',
          file: file,
          title: 'Consider using checked arithmetic',
          description: 'Use checked_add, checked_sub, etc. to prevent overflows',
          recommendation: 'Replace arithmetic operators with checked variants'
        });
      }
    }

    if (issues === 0) {
      console.log('  ✓ No common issues detected');
    } else {
      console.log(`  ⚠️  Found ${issues} potential issues`);
    }
  }

  // ==================== UTILITY METHODS ====================

  async findFiles(dir, extensions, limit = 1000) {
    const results = [];
    const maxFiles = limit;

    const walk = async (currentDir, depth = 0) => {
      if (results.length >= maxFiles || depth > 5) return;

      try {
        const items = await fs.promises.readdir(path.join(this.rootPath, currentDir), {
          withFileTypes: true
        });

        for (const item of items) {
          if (results.length >= maxFiles) break;

          const fullPath = path.join(currentDir, item.name);

          if (item.isDirectory()) {
            // Skip common directories
            if (!['node_modules', '.git', 'dist', 'build', 'out', 'target', 'cache'].includes(item.name)) {
              await walk(fullPath, depth + 1);
            }
          } else if (item.isFile()) {
            if (extensions.some(ext => item.name.endsWith(ext))) {
              results.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Directory not accessible, skip
      }
    };

    await walk(dir);
    return results;
  }

  addIssue(issue) {
    this.issues.push({
      ...issue,
      id: `contract-${this.issues.length + 1}`,
      timestamp: new Date().toISOString()
    });
  }

  async readFile(filename) {
    try {
      return await fs.promises.readFile(path.join(this.rootPath, filename), 'utf-8');
    } catch {
      return '';
    }
  }

  async fileExists(filename) {
    try {
      await fs.promises.access(path.join(this.rootPath, filename));
      return true;
    } catch {
      return false;
    }
  }

  async directoryExists(dirname) {
    try {
      const stat = await fs.promises.stat(path.join(this.rootPath, dirname));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  generateReport() {
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const issue of this.issues) {
      bySeverity[issue.severity]++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('SMART CONTRACT VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`\nTotal issues: ${this.issues.length}`);
    console.log(`Critical: ${bySeverity.critical}, High: ${bySeverity.high}, Medium: ${bySeverity.medium}, Low: ${bySeverity.low}`);

    return {
      summary: { totalIssues: this.issues.length, bySeverity },
      issues: this.issues,
      timestamp: new Date().toISOString(),
      validator: 'contract'
    };
  }

  async save() {
    const outputPath = path.join(this.rootPath, '.claude/debug/contract-validator-results.json');
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    const report = this.generateReport();
    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n✅ Report saved to: ${outputPath}`);
    return outputPath;
  }
}

if (require.main === module) {
  const validator = new ContractValidator();
  validator.validate()
    .then(() => validator.save())
    .catch(console.error);
}

module.exports = { ContractValidator };
