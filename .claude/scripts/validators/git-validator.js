#!/usr/bin/env node

/**
 * Git Validator
 * Checks git repository health, uncommitted changes, branch status
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class GitValidator {
  constructor(rootPath) {
    this.rootPath = rootPath || process.cwd();
    this.issues = [];
  }

  async validate() {
    console.log('🔀 Validating git repository...\n');

    await this.checkGitInit();
    await this.checkUncommittedChanges();
    await this.checkBranchStatus();
    await this.checkGitignore();

    return this.generateReport();
  }

  async checkGitInit() {
    console.log('Checking git initialization...');
    const gitDir = await this.directoryExists('.git');

    if (!gitDir) {
      this.addIssue({
        severity: 'high',
        category: 'git',
        title: 'Not a git repository',
        description: 'This directory is not initialized as a git repository',
        recommendation: 'Run: git init'
      });
      console.log('  ✗ Not a git repository');
      return false;
    }

    console.log('  ✓ Git initialized');
    return true;
  }

  async checkUncommittedChanges() {
    console.log('Checking uncommitted changes...');

    try {
      const { stdout } = await execPromise('git status --porcelain', { cwd: this.rootPath });

      if (stdout.trim().length > 0) {
        const lines = stdout.trim().split('\n');
        const modifiedFiles = lines.filter(l => l.startsWith(' M')).length;
        const untrackedFiles = lines.filter(l => l.startsWith('??')).length;
        const stagedFiles = lines.filter(l => l.startsWith('M ')).length;

        this.addIssue({
          severity: 'medium',
          category: 'git',
          title: 'Uncommitted changes detected',
          description: `${modifiedFiles} modified, ${untrackedFiles} untracked, ${stagedFiles} staged`,
          recommendation: 'Commit changes before deploying or running validators'
        });

        console.log(`  ⚠️  Uncommitted changes: ${lines.length} files`);
      } else {
        console.log('  ✓ Working directory clean');
      }
    } catch (error) {
      console.log('  ⚠️  Could not check git status');
    }
  }

  async checkBranchStatus() {
    console.log('Checking branch status...');

    try {
      const { stdout: branch } = await execPromise('git branch --show-current', { cwd: this.rootPath });
      const currentBranch = branch.trim();

      if (currentBranch === 'main' || currentBranch === 'master') {
        this.addIssue({
          severity: 'low',
          category: 'git',
          title: 'Working directly on main branch',
          description: `Current branch is ${currentBranch}`,
          recommendation: 'Consider using feature branches for development'
        });
      }

      // Check if branch is ahead/behind remote
      try {
        const { stdout: status } = await execPromise('git status -sb', { cwd: this.rootPath });

        if (status.includes('ahead')) {
          this.addIssue({
            severity: 'info',
            category: 'git',
            title: 'Branch ahead of remote',
            description: 'Local commits not pushed to remote',
            recommendation: 'Push changes: git push'
          });
        }

        if (status.includes('behind')) {
          this.addIssue({
            severity: 'medium',
            category: 'git',
            title: 'Branch behind remote',
            description: 'Remote has commits not in local branch',
            recommendation: 'Pull changes: git pull'
          });
        }
      } catch (e) {}

      console.log(`  ✓ Current branch: ${currentBranch}`);
    } catch (error) {
      console.log('  ⚠️  Could not determine current branch');
    }
  }

  async checkGitignore() {
    console.log('Checking .gitignore...');

    const hasGitignore = await this.fileExists('.gitignore');

    if (!hasGitignore) {
      this.addIssue({
        severity: 'medium',
        category: 'git',
        title: 'No .gitignore file found',
        description: 'Missing .gitignore can lead to committing sensitive files',
        recommendation: 'Create .gitignore with common patterns (node_modules, .env, etc.)'
      });
      console.log('  ✗ No .gitignore found');
      return;
    }

    const content = await this.readFile('.gitignore');

    // Check for common patterns
    const requiredPatterns = {
      'node_modules': 'Prevent committing dependencies',
      '.env': 'Prevent committing environment variables',
      'dist': 'Prevent committing build artifacts',
      '.DS_Store': 'Prevent committing macOS files'
    };

    for (const [pattern, reason] of Object.entries(requiredPatterns)) {
      if (!content.includes(pattern)) {
        this.addIssue({
          severity: 'low',
          category: 'git',
          title: `Missing .gitignore pattern: ${pattern}`,
          description: reason,
          recommendation: `Add '${pattern}' to .gitignore`
        });
      }
    }

    console.log('  ✓ .gitignore present');
  }

  addIssue(issue) {
    this.issues.push({ ...issue, id: `git-${this.issues.length + 1}`, timestamp: new Date().toISOString() });
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
    console.log('GIT VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`\nTotal issues: ${this.issues.length}`);
    console.log(`High: ${bySeverity.high}, Medium: ${bySeverity.medium}, Low: ${bySeverity.low}, Info: ${bySeverity.info}`);

    return {
      summary: { totalIssues: this.issues.length, bySeverity },
      issues: this.issues,
      timestamp: new Date().toISOString(),
      validator: 'git'
    };
  }

  async save() {
    const outputPath = path.join(this.rootPath, '.claude/debug/git-validator-results.json');
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    const report = this.generateReport();
    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n✅ Report saved to: ${outputPath}`);
    return outputPath;
  }
}

if (require.main === module) {
  const validator = new GitValidator();
  validator.validate().then(() => validator.save()).catch(console.error);
}

module.exports = { GitValidator };
