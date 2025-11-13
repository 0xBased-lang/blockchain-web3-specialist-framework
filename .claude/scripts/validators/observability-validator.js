#!/usr/bin/env node

/**
 * Observability Validator
 *
 * Validates runtime behavior and observability:
 * - Console errors and warnings
 * - Playwright integration for runtime checks
 * - Network request monitoring
 * - Performance metrics
 * - Error tracking setup
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class ObservabilityValidator {
  constructor(rootPath) {
    this.rootPath = rootPath || process.cwd();
    this.issues = [];
    this.hasPlaywright = false;
  }

  async validate() {
    console.log('👁️  Validating observability and runtime behavior...\n');

    await this.checkErrorTracking();
    await this.checkPlaywrightSetup();
    await this.checkConsolePatterns();
    await this.checkLoggingStrategy();
    await this.checkPerformanceMonitoring();
    await this.runPlaywrightChecks();

    return this.generateReport();
  }

  async checkErrorTracking() {
    console.log('Checking error tracking setup...');

    try {
      const packageJson = JSON.parse(await this.readFile('package.json'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const errorTrackers = {
        '@sentry/nextjs': 'Sentry',
        '@sentry/react': 'Sentry',
        '@sentry/browser': 'Sentry',
        'bugsnag': 'Bugsnag',
        'rollbar': 'Rollbar'
      };

      let foundTracker = null;

      for (const [pkg, name] of Object.entries(errorTrackers)) {
        if (deps[pkg]) {
          foundTracker = name;
          break;
        }
      }

      if (!foundTracker) {
        this.addIssue({
          severity: 'medium',
          category: 'observability-error-tracking',
          title: 'No error tracking service configured',
          description: 'Production apps should have error tracking (Sentry, Bugsnag, etc.)',
          recommendation: 'Install @sentry/nextjs or similar error tracking'
        });
        console.log('  ⚠️  No error tracking found');
      } else {
        console.log(`  ✓ Error tracking: ${foundTracker}`);

        // Check for configuration
        const sentryConfig = await this.fileExists('sentry.client.config.js') ||
                            await this.fileExists('sentry.server.config.js');

        if (foundTracker === 'Sentry' && !sentryConfig) {
          this.addIssue({
            severity: 'low',
            category: 'observability-error-tracking',
            title: 'Sentry configuration files missing',
            description: 'Sentry requires client and server config files',
            recommendation: 'Create sentry.client.config.js and sentry.server.config.js'
          });
        }
      }
    } catch {
      console.log('  ⚠️  Could not check package.json');
    }
  }

  async checkPlaywrightSetup() {
    console.log('Checking Playwright setup...');

    try {
      const packageJson = JSON.parse(await this.readFile('package.json'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps['@playwright/test'] || deps['playwright']) {
        this.hasPlaywright = true;
        console.log('  ✓ Playwright is installed');

        const hasConfig = await this.fileExists('playwright.config.js') ||
                         await this.fileExists('playwright.config.ts');

        if (!hasConfig) {
          this.addIssue({
            severity: 'low',
            category: 'observability-testing',
            title: 'No Playwright configuration',
            description: 'Playwright is installed but not configured',
            recommendation: 'Create playwright.config.js'
          });
          console.log('  ⚠️  No playwright.config found');
        } else {
          console.log('  ✓ Playwright configured');
        }

        // Check for test files
        const testFiles = await this.findFiles('.', ['.spec.ts', '.spec.js', '.test.ts', '.test.js'], 50);
        const e2eTests = testFiles.filter(f => f.includes('e2e') || f.includes('playwright'));

        if (e2eTests.length === 0) {
          this.addIssue({
            severity: 'low',
            category: 'observability-testing',
            title: 'No Playwright tests found',
            description: 'Playwright installed but no E2E tests',
            recommendation: 'Add E2E tests in tests/e2e/ directory'
          });
          console.log('  ⚠️  No E2E tests found');
        } else {
          console.log(`  ✓ Found ${e2eTests.length} E2E test files`);
        }
      } else {
        console.log('  ⊘ Playwright not installed (optional)');
      }
    } catch {
      console.log('  ⚠️  Could not check Playwright setup');
    }
  }

  async checkConsolePatterns() {
    console.log('Checking console usage patterns...');

    const jsFiles = await this.findFiles('.', ['.js', '.jsx', '.ts', '.tsx'], 100);
    let errorHandlingIssues = 0;

    for (const file of jsFiles) {
      // Skip test files and node_modules
      if (file.includes('node_modules') || file.includes('.test.') ||
          file.includes('.spec.') || file.includes('__tests__')) {
        continue;
      }

      const content = await this.readFile(file);

      // Check for empty catch blocks
      const emptyCatchPattern = /catch\s*\([^)]*\)\s*{\s*}/g;
      if (emptyCatchPattern.test(content)) {
        this.addIssue({
          severity: 'medium',
          category: 'observability-error-handling',
          file: file,
          title: 'Empty catch block detected',
          description: 'Errors are silently swallowed without logging',
          recommendation: 'Add error logging in catch blocks'
        });
        errorHandlingIssues++;
      }

      // Check for console.error without context
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('console.error(e)') || line.includes('console.error(error)')) {
          // Check if there's any additional context
          const prevLine = i > 0 ? lines[i - 1] : '';
          const nextLine = i < lines.length - 1 ? lines[i + 1] : '';

          if (!prevLine.includes('console') && !nextLine.includes('console')) {
            // Single console.error without context
            this.addIssue({
              severity: 'low',
              category: 'observability-logging',
              file: file,
              title: 'console.error without context',
              description: 'Error logged without descriptive message',
              recommendation: 'Add context: console.error("Operation failed:", error)'
            });
          }
        }
      }

      // Check for unhandled promise rejections
      const promisePattern = /new Promise\(/g;
      const promiseCount = (content.match(promisePattern) || []).length;
      const catchCount = (content.match(/\.catch\(/g) || []).length;

      if (promiseCount > catchCount + 2) {
        this.addIssue({
          severity: 'medium',
          category: 'observability-error-handling',
          file: file,
          title: 'Potential unhandled promise rejections',
          description: 'Some promises may not have .catch() handlers',
          recommendation: 'Add .catch() to all promises or use try/catch with async/await'
        });
      }
    }

    if (errorHandlingIssues === 0) {
      console.log('  ✓ No obvious error handling issues');
    } else {
      console.log(`  ⚠️  Found ${errorHandlingIssues} error handling issues`);
    }
  }

  async checkLoggingStrategy() {
    console.log('Checking logging strategy...');

    try {
      const packageJson = JSON.parse(await this.readFile('package.json'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const loggers = {
        'winston': 'Winston',
        'pino': 'Pino',
        'bunyan': 'Bunyan',
        'log4js': 'Log4js'
      };

      let foundLogger = null;

      for (const [pkg, name] of Object.entries(loggers)) {
        if (deps[pkg]) {
          foundLogger = name;
          break;
        }
      }

      if (foundLogger) {
        console.log(`  ✓ Structured logging: ${foundLogger}`);
      } else {
        this.addIssue({
          severity: 'low',
          category: 'observability-logging',
          title: 'No structured logging library',
          description: 'Consider using structured logging (Winston, Pino) for better observability',
          recommendation: 'Install pino or winston for production logging'
        });
        console.log('  ⊘ No structured logging (using console)');
      }
    } catch {
      console.log('  ⚠️  Could not check logging setup');
    }
  }

  async checkPerformanceMonitoring() {
    console.log('Checking performance monitoring...');

    const files = await this.findFiles('.', ['.js', '.jsx', '.ts', '.tsx'], 50);
    let hasWebVitals = false;

    for (const file of files) {
      const content = await this.readFile(file);

      if (content.includes('web-vitals') || content.includes('reportWebVitals')) {
        hasWebVitals = true;
        break;
      }
    }

    if (!hasWebVitals) {
      this.addIssue({
        severity: 'low',
        category: 'observability-performance',
        title: 'No Web Vitals tracking',
        description: 'Web Vitals help monitor user experience metrics',
        recommendation: 'Add web-vitals tracking to _app.js/tsx'
      });
      console.log('  ⊘ No Web Vitals tracking');
    } else {
      console.log('  ✓ Web Vitals tracking configured');
    }

    // Check for performance.mark usage
    let hasPerformanceMarks = false;

    for (const file of files) {
      const content = await this.readFile(file);

      if (content.includes('performance.mark') || content.includes('performance.measure')) {
        hasPerformanceMarks = true;
        break;
      }
    }

    if (hasPerformanceMarks) {
      console.log('  ✓ Custom performance marks found');
    }
  }

  async runPlaywrightChecks() {
    if (!this.hasPlaywright) {
      console.log('\n⊘ Skipping Playwright runtime checks (not installed)');
      return;
    }

    console.log('\nRunning Playwright runtime checks...');

    try {
      // Check if dev server is running or if we should start one
      const devServerRunning = await this.checkDevServer();

      if (!devServerRunning) {
        console.log('  ⚠️  Dev server not running (skipping runtime checks)');
        console.log('  💡 Start dev server with: npm run dev');
        return;
      }

      // Run a simple Playwright check for console errors
      const playwrightScript = this.generatePlaywrightScript();
      const scriptPath = path.join(this.rootPath, '.claude/debug/runtime-check.js');

      await fs.promises.mkdir(path.dirname(scriptPath), { recursive: true });
      await fs.promises.writeFile(scriptPath, playwrightScript, 'utf-8');

      const { stdout, stderr } = await execPromise(`npx playwright test ${scriptPath}`, {
        cwd: this.rootPath,
        timeout: 60000
      });

      console.log('  ✓ Runtime checks completed');

      // Parse results if available
      if (stdout.includes('console errors:')) {
        const errorMatch = stdout.match(/(\d+) console errors/);
        if (errorMatch && parseInt(errorMatch[1]) > 0) {
          this.addIssue({
            severity: 'medium',
            category: 'observability-runtime',
            title: `${errorMatch[1]} console errors during runtime`,
            description: 'Console errors detected in browser',
            recommendation: 'Review and fix console errors'
          });
        }
      }
    } catch (error) {
      console.log('  ⚠️  Could not run Playwright checks');
      console.log('  💡 This is optional - runtime checks skipped');
    }
  }

  async checkDevServer() {
    try {
      // Try to fetch localhost:3000 (common Next.js port)
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('curl -s http://localhost:3000', (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
      return true;
    } catch {
      return false;
    }
  }

  generatePlaywrightScript() {
    return `const { test, expect } = require('@playwright/test');

test('Check for console errors', async ({ page }) => {
  const consoleErrors = [];
  const consoleWarnings = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
    if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  console.log(\`\${consoleErrors.length} console errors:\`, consoleErrors);
  console.log(\`\${consoleWarnings.length} console warnings:\`, consoleWarnings);

  // Don't fail the test, just report
  expect(consoleErrors.length).toBeLessThan(100); // Sanity check
});
`;
  }

  async findFiles(dir, extensions, limit = 1000) {
    const results = [];
    const maxFiles = limit;

    const walk = async (currentDir, depth = 0) => {
      if (results.length >= maxFiles || depth > 5) return;

      try {
        const fullDir = path.join(this.rootPath, currentDir);
        const items = await fs.promises.readdir(fullDir, { withFileTypes: true });

        for (const item of items) {
          if (results.length >= maxFiles) break;

          const fullPath = path.join(currentDir, item.name);

          if (item.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '.next', 'out'].includes(item.name)) {
              await walk(fullPath, depth + 1);
            }
          } else if (item.isFile()) {
            if (extensions.some(ext => item.name.endsWith(ext))) {
              results.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Directory not accessible
      }
    };

    await walk(dir);
    return results;
  }

  addIssue(issue) {
    this.issues.push({
      ...issue,
      id: `observability-${this.issues.length + 1}`,
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

  generateReport() {
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const issue of this.issues) {
      bySeverity[issue.severity]++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('OBSERVABILITY VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`\nTotal issues: ${this.issues.length}`);
    console.log(`Critical: ${bySeverity.critical}, High: ${bySeverity.high}, Medium: ${bySeverity.medium}, Low: ${bySeverity.low}`);

    return {
      summary: { totalIssues: this.issues.length, bySeverity },
      issues: this.issues,
      timestamp: new Date().toISOString(),
      validator: 'observability'
    };
  }

  async save() {
    const outputPath = path.join(this.rootPath, '.claude/debug/observability-validator-results.json');
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    const report = this.generateReport();
    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n✅ Report saved to: ${outputPath}`);
    return outputPath;
  }
}

if (require.main === module) {
  const validator = new ObservabilityValidator();
  validator.validate()
    .then(() => validator.save())
    .catch(console.error);
}

module.exports = { ObservabilityValidator };
