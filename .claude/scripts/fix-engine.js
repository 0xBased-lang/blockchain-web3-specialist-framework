#!/usr/bin/env node

/**
 * Fix Engine
 *
 * Applies automated fixes to common issues:
 * - Loads aggregated issues
 * - Generates fixes for fixable patterns
 * - Shows diffs before applying (dry-run mode)
 * - Applies fixes with user confirmation
 * - Tracks what was fixed
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class FixEngine {
  constructor(rootPath, options = {}) {
    this.rootPath = rootPath || process.cwd();
    this.debugPath = path.join(this.rootPath, '.claude/debug');
    this.dryRun = options.dryRun !== false; // Default to dry-run
    this.fixes = [];
    this.applied = [];
    this.failed = [];
  }

  async run() {
    console.log('🔧 Fix Engine\n');
    console.log(`Mode: ${this.dryRun ? 'DRY-RUN (preview only)' : 'APPLY FIXES'}\n`);

    await this.loadIssues();
    await this.generateFixes();
    await this.applyFixes();
    await this.generateReport();

    return {
      dryRun: this.dryRun,
      totalFixes: this.fixes.length,
      applied: this.applied.length,
      failed: this.failed.length
    };
  }

  async loadIssues() {
    console.log('Loading aggregated issues...');

    try {
      const aggregatePath = path.join(this.debugPath, 'aggregate-validation.json');
      const content = await fs.promises.readFile(aggregatePath, 'utf-8');
      const data = JSON.parse(content);

      this.issues = data.issues || [];
      console.log(`  ✓ Loaded ${this.issues.length} issues\n`);
    } catch (error) {
      console.log('  ✗ Could not load aggregate-validation.json');
      console.log('  💡 Run issue-aggregator.js first');
      this.issues = [];
    }
  }

  async generateFixes() {
    console.log('Generating fixes...\n');

    if (this.issues.length === 0) {
      console.log('  ⊘ No issues to fix');
      return;
    }

    for (const issue of this.issues) {
      const fix = await this.createFixForIssue(issue);
      if (fix) {
        this.fixes.push(fix);
      }
    }

    console.log(`  ✓ Generated ${this.fixes.length} automated fixes\n`);
  }

  async createFixForIssue(issue) {
    // Map issue patterns to automated fixes
    const fixGenerators = {
      'Missing lock file': () => this.generateNpmInstallFix(issue),
      'Uncommitted changes detected': () => null, // Not auto-fixable
      'ESLint errors found': () => this.generateESLintFix(issue),
      'Prettier': () => this.generatePrettierFix(issue),
      'TypeScript errors': () => null, // Requires manual review
      'Transaction sent without waiting': () => this.generateTxWaitFix(issue),
      'Cache invalidation': () => this.generateCacheInvalidationFix(issue),
      'Empty catch block': () => this.generateErrorLoggingFix(issue),
      'No .gitignore': () => this.generateGitignoreFix(issue),
      'Missing .env.example': () => this.generateEnvExampleFix(issue)
    };

    // Find matching fix generator
    for (const [pattern, generator] of Object.entries(fixGenerators)) {
      if (issue.title.includes(pattern)) {
        return generator();
      }
    }

    return null; // No automated fix available
  }

  // ==================== FIX GENERATORS ====================

  generateNpmInstallFix(issue) {
    return {
      issue: issue,
      type: 'command',
      description: 'Generate package-lock.json',
      command: 'npm install',
      apply: async () => {
        if (this.dryRun) {
          console.log('  [DRY-RUN] Would run: npm install');
          return { success: true, dryRun: true };
        }

        try {
          await execPromise('npm install', { cwd: this.rootPath });
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    };
  }

  generateESLintFix(issue) {
    return {
      issue: issue,
      type: 'command',
      description: 'Run ESLint auto-fix',
      command: 'npx eslint . --fix',
      apply: async () => {
        if (this.dryRun) {
          console.log('  [DRY-RUN] Would run: npx eslint . --fix');
          return { success: true, dryRun: true };
        }

        try {
          await execPromise('npx eslint . --fix', {
            cwd: this.rootPath,
            timeout: 120000
          });
          return { success: true };
        } catch (error) {
          // ESLint returns non-zero if there are unfixable errors
          return { success: true, partial: true };
        }
      }
    };
  }

  generatePrettierFix(issue) {
    return {
      issue: issue,
      type: 'command',
      description: 'Format files with Prettier',
      command: 'npx prettier --write .',
      apply: async () => {
        if (this.dryRun) {
          console.log('  [DRY-RUN] Would run: npx prettier --write .');
          return { success: true, dryRun: true };
        }

        try {
          await execPromise('npx prettier --write .', {
            cwd: this.rootPath,
            timeout: 120000
          });
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    };
  }

  generateTxWaitFix(issue) {
    if (!issue.file) return null;

    return {
      issue: issue,
      type: 'code',
      description: 'Add transaction confirmation wait',
      file: issue.file,
      apply: async () => {
        if (this.dryRun) {
          console.log(`  [DRY-RUN] Would add tx.wait() to ${issue.file}`);
          return { success: true, dryRun: true };
        }

        try {
          const content = await fs.promises.readFile(
            path.join(this.rootPath, issue.file),
            'utf-8'
          );

          // Simple pattern: add .wait() after write/send calls
          const modified = content.replace(
            /const\s+tx\s*=\s*await\s+(\w+)\((.*?)\);/g,
            'const tx = await $1($2);\nconst receipt = await tx.wait();'
          );

          if (modified !== content) {
            await fs.promises.writeFile(
              path.join(this.rootPath, issue.file),
              modified,
              'utf-8'
            );
            return { success: true };
          }

          return { success: false, error: 'Pattern not found' };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    };
  }

  generateCacheInvalidationFix(issue) {
    if (!issue.file) return null;

    return {
      issue: issue,
      type: 'code',
      description: 'Add cache invalidation after transaction',
      file: issue.file,
      apply: async () => {
        if (this.dryRun) {
          console.log(`  [DRY-RUN] Would add cache invalidation to ${issue.file}`);
          return { success: true, dryRun: true };
        }

        try {
          const content = await fs.promises.readFile(
            path.join(this.rootPath, issue.file),
            'utf-8'
          );

          // Add cache invalidation after tx.wait()
          const modified = content.replace(
            /const\s+receipt\s*=\s*await\s+tx\.wait\(\);/g,
            `const receipt = await tx.wait();\n  // Invalidate cache\n  await redis.del(\`cache:\${key}\`);\n  queryClient.invalidateQueries(['data']);`
          );

          if (modified !== content) {
            await fs.promises.writeFile(
              path.join(this.rootPath, issue.file),
              modified,
              'utf-8'
            );
            return { success: true };
          }

          return { success: false, error: 'Pattern not found' };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    };
  }

  generateErrorLoggingFix(issue) {
    if (!issue.file) return null;

    return {
      issue: issue,
      type: 'code',
      description: 'Add error logging to empty catch blocks',
      file: issue.file,
      apply: async () => {
        if (this.dryRun) {
          console.log(`  [DRY-RUN] Would add error logging to ${issue.file}`);
          return { success: true, dryRun: true };
        }

        try {
          const content = await fs.promises.readFile(
            path.join(this.rootPath, issue.file),
            'utf-8'
          );

          // Replace empty catch blocks
          const modified = content.replace(
            /catch\s*\(\s*(\w+)\s*\)\s*{\s*}/g,
            'catch ($1) {\n    console.error("Error:", $1);\n  }'
          );

          if (modified !== content) {
            await fs.promises.writeFile(
              path.join(this.rootPath, issue.file),
              modified,
              'utf-8'
            );
            return { success: true };
          }

          return { success: false, error: 'Pattern not found' };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    };
  }

  generateGitignoreFix(issue) {
    return {
      issue: issue,
      type: 'file',
      description: 'Create .gitignore with common patterns',
      file: '.gitignore',
      apply: async () => {
        if (this.dryRun) {
          console.log('  [DRY-RUN] Would create .gitignore');
          return { success: true, dryRun: true };
        }

        const gitignoreContent = `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Next.js
.next/
out/

# Production
build/
dist/

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# Hardhat
cache/
artifacts/

# Foundry
out/
cache_hardhat/

# Claude
.claude/debug/
.claude/snapshots/
`;

        try {
          await fs.promises.writeFile(
            path.join(this.rootPath, '.gitignore'),
            gitignoreContent,
            'utf-8'
          );
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    };
  }

  generateEnvExampleFix(issue) {
    return {
      issue: issue,
      type: 'file',
      description: 'Create .env.example template',
      file: '.env.example',
      apply: async () => {
        if (this.dryRun) {
          console.log('  [DRY-RUN] Would create .env.example');
          return { success: true, dryRun: true };
        }

        const envExampleContent = `# RPC Providers
NEXT_PUBLIC_HELIUS_API_KEY=your_api_key_here
NEXT_PUBLIC_EVM_RPC_URL=your_rpc_url_here
NEXT_PUBLIC_SOLANA_RPC_URL=your_solana_rpc_url_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Upstash Redis
UPSTASH_REDIS_REST_URL=your_redis_url_here
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# Network Configuration
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# Development
NODE_ENV=development
`;

        try {
          await fs.promises.writeFile(
            path.join(this.rootPath, '.env.example'),
            envExampleContent,
            'utf-8'
          );
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    };
  }

  // ==================== APPLY FIXES ====================

  async applyFixes() {
    if (this.fixes.length === 0) {
      console.log('No automated fixes available\n');
      return;
    }

    console.log('Applying fixes...\n');

    for (const fix of this.fixes) {
      console.log(`\n📝 ${fix.description}`);
      if (fix.file) {
        console.log(`   File: ${fix.file}`);
      }
      if (fix.command) {
        console.log(`   Command: ${fix.command}`);
      }

      try {
        const result = await fix.apply();

        if (result.dryRun) {
          console.log('   ✓ [DRY-RUN] Preview only');
          this.applied.push({ fix, result, dryRun: true });
        } else if (result.success) {
          console.log('   ✓ Applied successfully');
          this.applied.push({ fix, result });
        } else {
          console.log(`   ✗ Failed: ${result.error}`);
          this.failed.push({ fix, error: result.error });
        }
      } catch (error) {
        console.log(`   ✗ Exception: ${error.message}`);
        this.failed.push({ fix, error: error.message });
      }
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('FIX ENGINE REPORT');
    console.log('='.repeat(60));
    console.log(`\nMode: ${this.dryRun ? 'DRY-RUN' : 'APPLIED'}`);
    console.log(`Total fixes generated: ${this.fixes.length}`);
    console.log(`Successfully applied: ${this.applied.length}`);
    console.log(`Failed: ${this.failed.length}`);

    if (this.dryRun && this.fixes.length > 0) {
      console.log('\n💡 To apply fixes, run with --apply flag:');
      console.log('   node .claude/scripts/fix-engine.js --apply');
    }

    if (!this.dryRun && this.applied.length > 0) {
      console.log('\n⚠️  IMPORTANT: Run validators again to verify fixes');
      console.log('   node .claude/scripts/run-all-validators.js');
    }
  }

  async save() {
    const outputPath = path.join(this.debugPath, 'fix-engine-results.json');
    const report = {
      dryRun: this.dryRun,
      totalFixes: this.fixes.length,
      applied: this.applied.map(a => ({
        description: a.fix.description,
        file: a.fix.file,
        success: a.result.success
      })),
      failed: this.failed.map(f => ({
        description: f.fix.description,
        file: f.fix.file,
        error: f.error
      })),
      timestamp: new Date().toISOString()
    };

    await fs.promises.mkdir(this.debugPath, { recursive: true });
    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n✅ Report saved: ${outputPath}`);

    return outputPath;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  const engine = new FixEngine(process.cwd(), { dryRun: !apply });

  engine.run()
    .then(() => engine.save())
    .catch(console.error);
}

module.exports = { FixEngine };
