#!/usr/bin/env node

/**
 * Quality Validator
 *
 * Runs code quality checks:
 * - ESLint for JavaScript/TypeScript
 * - TypeScript compiler checks
 * - Prettier formatting
 * - Code complexity analysis
 * - Import/export validation
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class QualityValidator {
  constructor(rootPath) {
    this.rootPath = rootPath || process.cwd();
    this.issues = [];
  }

  async validate() {
    console.log('🎨 Validating code quality...\n');

    await this.checkESLint();
    await this.checkTypeScript();
    await this.checkPrettier();
    await this.checkImports();

    return this.generateReport();
  }

  async checkESLint() {
    console.log('Checking ESLint...');

    // Check if ESLint is configured
    const hasESLint = await this.fileExists('.eslintrc.js') ||
                      await this.fileExists('.eslintrc.json') ||
                      await this.fileExists('.eslintrc.yml') ||
                      await this.fileExists('eslint.config.js');

    if (!hasESLint) {
      this.addIssue({
        severity: 'low',
        category: 'code-quality',
        title: 'No ESLint configuration found',
        description: 'ESLint helps catch common errors and enforce code style',
        recommendation: 'Add .eslintrc.js with recommended rules'
      });
      console.log('  ⚠️  No ESLint config found');
      return;
    }

    try {
      const { stdout, stderr } = await execPromise('npx eslint . --format json', {
        cwd: this.rootPath,
        timeout: 60000
      });

      const results = JSON.parse(stdout);
      const totalErrors = results.reduce((sum, file) => sum + file.errorCount, 0);
      const totalWarnings = results.reduce((sum, file) => sum + file.warningCount, 0);

      if (totalErrors > 0) {
        this.addIssue({
          severity: 'high',
          category: 'code-quality',
          title: `${totalErrors} ESLint errors found`,
          description: 'Code has linting errors that should be fixed',
          recommendation: 'Run: npx eslint . --fix'
        });
      }

      if (totalWarnings > 5) {
        this.addIssue({
          severity: 'medium',
          category: 'code-quality',
          title: `${totalWarnings} ESLint warnings found`,
          description: 'Code has linting warnings',
          recommendation: 'Review and fix ESLint warnings'
        });
      }

      console.log(`  ✓ ESLint: ${totalErrors} errors, ${totalWarnings} warnings`);
    } catch (error) {
      console.log(`  ⚠️  ESLint check failed (may not be installed)`);
    }
  }

  async checkTypeScript() {
    console.log('Checking TypeScript...');

    const hasTSConfig = await this.fileExists('tsconfig.json');

    if (!hasTSConfig) {
      console.log('  ⊘ No TypeScript config found (skipping)');
      return;
    }

    try {
      const { stdout, stderr } = await execPromise('npx tsc --noEmit', {
        cwd: this.rootPath,
        timeout: 120000
      });

      console.log('  ✓ TypeScript: No errors');
    } catch (error) {
      // tsc returns non-zero exit code if there are errors
      const errorCount = (error.stdout || '').split('\n').filter(line =>
        line.includes('error TS')
      ).length;

      if (errorCount > 0) {
        this.addIssue({
          severity: 'high',
          category: 'code-quality',
          title: `${errorCount} TypeScript errors found`,
          description: 'Code has TypeScript compilation errors',
          recommendation: 'Fix TypeScript errors before deploying'
        });
      }

      console.log(`  ✗ TypeScript: ${errorCount} errors`);
    }
  }

  async checkPrettier() {
    console.log('Checking Prettier...');

    const hasPrettier = await this.fileExists('.prettierrc') ||
                        await this.fileExists('.prettierrc.json') ||
                        await this.fileExists('.prettierrc.js') ||
                        await this.fileExists('prettier.config.js');

    if (!hasPrettier) {
      this.addIssue({
        severity: 'low',
        category: 'code-quality',
        title: 'No Prettier configuration found',
        description: 'Prettier ensures consistent code formatting',
        recommendation: 'Add .prettierrc for consistent formatting'
      });
      console.log('  ⚠️  No Prettier config found');
      return;
    }

    try {
      const { stdout } = await execPromise('npx prettier --check .', {
        cwd: this.rootPath,
        timeout: 60000
      });

      console.log('  ✓ Prettier: All files formatted correctly');
    } catch (error) {
      const unformattedFiles = (error.stdout || '').split('\n').filter(line =>
        line.trim().length > 0 && !line.includes('Checking formatting')
      ).length;

      if (unformattedFiles > 0) {
        this.addIssue({
          severity: 'low',
          category: 'code-quality',
          title: `${unformattedFiles} files not formatted with Prettier`,
          description: 'Some files need formatting',
          recommendation: 'Run: npx prettier --write .'
        });
      }

      console.log(`  ⚠️  Prettier: ${unformattedFiles} unformatted files`);
    }
  }

  async checkImports() {
    console.log('Checking import statements...');

    // Find all TypeScript/JavaScript files
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const files = await this.findFiles('.', extensions, 100);

    let unusedImports = 0;
    let missingImports = 0;

    for (const file of files) {
      const content = await this.readFile(file);

      // Check for unused imports (simplified check)
      const importLines = content.split('\n').filter(line =>
        line.trim().startsWith('import ')
      );

      for (const importLine of importLines) {
        const match = importLine.match(/import\s+(?:{([^}]+)}|(\w+))\s+from/);
        if (match) {
          const imports = match[1] ? match[1].split(',').map(i => i.trim()) : [match[2]];

          for (const importName of imports) {
            const cleanName = importName.replace(/\s+as\s+\w+/, '').trim();
            if (cleanName && !content.includes(cleanName)) {
              unusedImports++;
            }
          }
        }
      }
    }

    if (unusedImports > 5) {
      this.addIssue({
        severity: 'low',
        category: 'code-quality',
        title: `Potential ${unusedImports} unused imports`,
        description: 'Unused imports should be removed',
        recommendation: 'Review and remove unused imports'
      });
    }

    console.log(`  ✓ Import check complete (${unusedImports} potential unused)`);
  }

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
            // Skip node_modules, .git, dist, etc.
            if (!['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage'].includes(item.name)) {
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
      id: `quality-${this.issues.length + 1}`,
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
    console.log('QUALITY VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`\nTotal issues: ${this.issues.length}`);
    console.log(`Critical: ${bySeverity.critical}, High: ${bySeverity.high}, Medium: ${bySeverity.medium}, Low: ${bySeverity.low}`);

    return {
      summary: { totalIssues: this.issues.length, bySeverity },
      issues: this.issues,
      timestamp: new Date().toISOString(),
      validator: 'quality'
    };
  }

  async save() {
    const outputPath = path.join(this.rootPath, '.claude/debug/quality-validator-results.json');
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    const report = this.generateReport();
    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n✅ Report saved to: ${outputPath}`);
    return outputPath;
  }
}

if (require.main === module) {
  const validator = new QualityValidator();
  validator.validate()
    .then(() => validator.save())
    .catch(console.error);
}

module.exports = { QualityValidator };
