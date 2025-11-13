#!/usr/bin/env node

/**
 * Verification Pipeline
 *
 * Verifies that fixes haven't broken anything:
 * - Runs linters (ESLint, Prettier)
 * - Runs TypeScript compiler
 * - Runs tests (Jest, Vitest, Foundry, Anchor)
 * - Runs build
 * - Generates verification report
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class VerificationPipeline {
  constructor(rootPath, options = {}) {
    this.rootPath = rootPath || process.cwd();
    this.debugPath = path.join(this.rootPath, '.claude/debug');
    this.quick = options.quick || false; // Skip slow tests
    this.results = {
      linting: {},
      typecheck: {},
      tests: {},
      build: {},
      overall: 'pending'
    };
  }

  async run() {
    console.log('🔍 Verification Pipeline\n');
    console.log(`Mode: ${this.quick ? 'QUICK' : 'FULL'}\n`);

    const startTime = Date.now();

    // Run checks in order
    await this.runLinting();
    await this.runTypeCheck();
    await this.runTests();
    await this.runBuild();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Determine overall result
    this.results.overall = this.determineOverallResult();
    this.results.duration = duration;

    await this.generateReport();
    await this.save();

    return this.results;
  }

  async runLinting() {
    console.log('📋 Running linters...\n');

    // ESLint
    await this.runESLint();

    // Prettier
    await this.runPrettier();

    console.log('');
  }

  async runESLint() {
    console.log('Checking ESLint...');

    try {
      const hasESLint = await this.fileExists('.eslintrc.js') ||
                       await this.fileExists('.eslintrc.json') ||
                       await this.fileExists('eslint.config.js');

      if (!hasESLint) {
        this.results.linting.eslint = { status: 'skipped', reason: 'No ESLint config' };
        console.log('  ⊘ ESLint not configured');
        return;
      }

      const { stdout, stderr } = await execPromise('npx eslint . --format json', {
        cwd: this.rootPath,
        timeout: 120000
      });

      const results = JSON.parse(stdout);
      const totalErrors = results.reduce((sum, file) => sum + file.errorCount, 0);
      const totalWarnings = results.reduce((sum, file) => sum + file.warningCount, 0);

      this.results.linting.eslint = {
        status: totalErrors === 0 ? 'pass' : 'fail',
        errors: totalErrors,
        warnings: totalWarnings
      };

      if (totalErrors === 0) {
        console.log(`  ✓ ESLint passed (${totalWarnings} warnings)`);
      } else {
        console.log(`  ✗ ESLint failed (${totalErrors} errors, ${totalWarnings} warnings)`);
      }
    } catch (error) {
      this.results.linting.eslint = { status: 'error', message: error.message };
      console.log('  ✗ ESLint error');
    }
  }

  async runPrettier() {
    console.log('Checking Prettier...');

    try {
      const hasPrettier = await this.fileExists('.prettierrc') ||
                         await this.fileExists('.prettierrc.json') ||
                         await this.fileExists('prettier.config.js');

      if (!hasPrettier) {
        this.results.linting.prettier = { status: 'skipped', reason: 'No Prettier config' };
        console.log('  ⊘ Prettier not configured');
        return;
      }

      await execPromise('npx prettier --check .', {
        cwd: this.rootPath,
        timeout: 60000
      });

      this.results.linting.prettier = { status: 'pass' };
      console.log('  ✓ Prettier passed');
    } catch (error) {
      // Prettier returns non-zero if files need formatting
      this.results.linting.prettier = { status: 'fail', message: 'Files need formatting' };
      console.log('  ⚠️  Prettier: some files need formatting');
    }
  }

  async runTypeCheck() {
    console.log('🔤 Running TypeScript compiler...\n');

    try {
      const hasTSConfig = await this.fileExists('tsconfig.json');

      if (!hasTSConfig) {
        this.results.typecheck = { status: 'skipped', reason: 'No tsconfig.json' };
        console.log('  ⊘ TypeScript not configured\n');
        return;
      }

      await execPromise('npx tsc --noEmit', {
        cwd: this.rootPath,
        timeout: 180000
      });

      this.results.typecheck = { status: 'pass' };
      console.log('  ✓ TypeScript passed\n');
    } catch (error) {
      const errorCount = (error.stdout || '').split('\n').filter(line =>
        line.includes('error TS')
      ).length;

      this.results.typecheck = { status: 'fail', errors: errorCount };
      console.log(`  ✗ TypeScript failed (${errorCount} errors)\n`);
    }
  }

  async runTests() {
    console.log('🧪 Running tests...\n');

    // Frontend tests (Jest/Vitest)
    await this.runFrontendTests();

    // Smart contract tests
    await this.runContractTests();

    console.log('');
  }

  async runFrontendTests() {
    console.log('Frontend tests...');

    try {
      const packageJson = JSON.parse(await this.readFile('package.json'));
      const scripts = packageJson.scripts || {};

      if (!scripts.test) {
        this.results.tests.frontend = { status: 'skipped', reason: 'No test script' };
        console.log('  ⊘ No test script in package.json');
        return;
      }

      const testCommand = this.quick ? 'npm test -- --run' : 'npm test';

      const { stdout, stderr } = await execPromise(testCommand, {
        cwd: this.rootPath,
        timeout: 300000
      });

      // Parse test results
      const passMatch = stdout.match(/(\d+) pass/);
      const failMatch = stdout.match(/(\d+) fail/);

      const passing = passMatch ? parseInt(passMatch[1]) : 0;
      const failing = failMatch ? parseInt(failMatch[1]) : 0;

      this.results.tests.frontend = {
        status: failing === 0 ? 'pass' : 'fail',
        passing: passing,
        failing: failing
      };

      if (failing === 0) {
        console.log(`  ✓ Frontend tests passed (${passing} tests)`);
      } else {
        console.log(`  ✗ Frontend tests failed (${failing}/${passing + failing})`);
      }
    } catch (error) {
      this.results.tests.frontend = { status: 'error', message: error.message };
      console.log('  ✗ Frontend test error');
    }
  }

  async runContractTests() {
    console.log('Smart contract tests...');

    // Try Foundry first
    const hasFoundry = await this.fileExists('foundry.toml');

    if (hasFoundry) {
      try {
        const { stdout } = await execPromise('forge test --json', {
          cwd: this.rootPath,
          timeout: 300000
        });

        const lines = stdout.split('\n').filter(l => l.trim().startsWith('{'));
        let passing = 0;
        let failing = 0;

        for (const line of lines) {
          try {
            const result = JSON.parse(line);
            if (result.type === 'test') {
              if (result.status === 'Success') passing++;
              if (result.status === 'Failure') failing++;
            }
          } catch {}
        }

        this.results.tests.contracts = {
          status: failing === 0 ? 'pass' : 'fail',
          framework: 'foundry',
          passing: passing,
          failing: failing
        };

        if (failing === 0) {
          console.log(`  ✓ Foundry tests passed (${passing} tests)`);
        } else {
          console.log(`  ✗ Foundry tests failed (${failing}/${passing + failing})`);
        }

        return;
      } catch (error) {
        this.results.tests.contracts = { status: 'error', framework: 'foundry', message: error.message };
        console.log('  ✗ Foundry test error');
        return;
      }
    }

    // Try Anchor if Foundry not present
    const hasAnchor = await this.fileExists('Anchor.toml');

    if (hasAnchor) {
      try {
        const { stdout } = await execPromise('anchor test --skip-local-validator', {
          cwd: this.rootPath,
          timeout: 300000
        });

        const passMatch = stdout.match(/(\d+) passing/);
        const failMatch = stdout.match(/(\d+) failing/);

        const passing = passMatch ? parseInt(passMatch[1]) : 0;
        const failing = failMatch ? parseInt(failMatch[1]) : 0;

        this.results.tests.contracts = {
          status: failing === 0 ? 'pass' : 'fail',
          framework: 'anchor',
          passing: passing,
          failing: failing
        };

        if (failing === 0) {
          console.log(`  ✓ Anchor tests passed (${passing} tests)`);
        } else {
          console.log(`  ✗ Anchor tests failed (${failing}/${passing + failing})`);
        }

        return;
      } catch (error) {
        this.results.tests.contracts = { status: 'error', framework: 'anchor', message: error.message };
        console.log('  ✗ Anchor test error');
        return;
      }
    }

    this.results.tests.contracts = { status: 'skipped', reason: 'No contracts found' };
    console.log('  ⊘ No smart contract tests');
  }

  async runBuild() {
    console.log('🏗️  Running build...\n');

    try {
      const packageJson = JSON.parse(await this.readFile('package.json'));
      const scripts = packageJson.scripts || {};

      if (!scripts.build) {
        this.results.build = { status: 'skipped', reason: 'No build script' };
        console.log('  ⊘ No build script in package.json\n');
        return;
      }

      const { stdout, stderr } = await execPromise('npm run build', {
        cwd: this.rootPath,
        timeout: 600000 // 10 minutes for builds
      });

      this.results.build = { status: 'pass' };
      console.log('  ✓ Build successful\n');
    } catch (error) {
      this.results.build = { status: 'fail', message: error.stderr || error.message };
      console.log('  ✗ Build failed\n');
    }
  }

  determineOverallResult() {
    const criticalChecks = [
      this.results.linting.eslint?.status,
      this.results.typecheck?.status,
      this.results.tests.frontend?.status,
      this.results.tests.contracts?.status,
      this.results.build?.status
    ];

    // Filter out skipped checks
    const relevantChecks = criticalChecks.filter(s => s && s !== 'skipped');

    if (relevantChecks.length === 0) {
      return 'no-checks';
    }

    if (relevantChecks.every(s => s === 'pass')) {
      return 'pass';
    }

    if (relevantChecks.some(s => s === 'fail' || s === 'error')) {
      return 'fail';
    }

    return 'partial';
  }

  async generateReport() {
    console.log('='.repeat(60));
    console.log('VERIFICATION REPORT');
    console.log('='.repeat(60));

    const statusIcon = {
      'pass': '✅',
      'fail': '❌',
      'error': '⚠️',
      'skipped': '⊘',
      'partial': '🟡',
      'no-checks': '⚠️'
    };

    console.log(`\nOverall: ${statusIcon[this.results.overall]} ${this.results.overall.toUpperCase()}`);
    console.log(`Duration: ${this.results.duration}s`);

    console.log('\n📋 Linting:');
    if (this.results.linting.eslint) {
      console.log(`  ESLint: ${statusIcon[this.results.linting.eslint.status]} ${this.results.linting.eslint.status}`);
    }
    if (this.results.linting.prettier) {
      console.log(`  Prettier: ${statusIcon[this.results.linting.prettier.status]} ${this.results.linting.prettier.status}`);
    }

    console.log('\n🔤 Type Check:');
    console.log(`  TypeScript: ${statusIcon[this.results.typecheck.status]} ${this.results.typecheck.status}`);

    console.log('\n🧪 Tests:');
    if (this.results.tests.frontend) {
      console.log(`  Frontend: ${statusIcon[this.results.tests.frontend.status]} ${this.results.tests.frontend.status}`);
    }
    if (this.results.tests.contracts) {
      console.log(`  Contracts: ${statusIcon[this.results.tests.contracts.status]} ${this.results.tests.contracts.status}`);
    }

    console.log('\n🏗️  Build:');
    console.log(`  Status: ${statusIcon[this.results.build.status]} ${this.results.build.status}`);

    if (this.results.overall === 'fail') {
      console.log('\n⚠️  VERIFICATION FAILED');
      console.log('Review errors above and fix before proceeding');
    } else if (this.results.overall === 'pass') {
      console.log('\n✅ ALL CHECKS PASSED');
      console.log('Safe to commit and deploy');
    }
  }

  async save() {
    const outputPath = path.join(this.debugPath, 'verification-results.json');
    await fs.promises.mkdir(this.debugPath, { recursive: true });
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(this.results, null, 2),
      'utf-8'
    );
    console.log(`\n✅ Report saved: ${outputPath}`);
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
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const quick = args.includes('--quick');

  const pipeline = new VerificationPipeline(process.cwd(), { quick });

  pipeline.run()
    .then(results => {
      if (results.overall === 'fail') {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Verification pipeline error:', error);
      process.exit(1);
    });
}

module.exports = { VerificationPipeline };
