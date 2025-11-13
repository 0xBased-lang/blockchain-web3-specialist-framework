#!/usr/bin/env node

/**
 * Deployment Validator
 *
 * Validates deployment configuration and readiness:
 * - Vercel configuration
 * - Environment variables
 * - Build settings
 * - Production safety checks
 * - Framework-specific requirements
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class DeploymentValidator {
  constructor(rootPath) {
    this.rootPath = rootPath || process.cwd();
    this.issues = [];
    this.framework = null;
  }

  async validate() {
    console.log('🚀 Validating deployment configuration...\n');

    await this.detectFramework();
    await this.checkVercelConfig();
    await this.checkEnvironmentVariables();
    await this.checkBuildConfiguration();
    await this.checkProductionSafety();
    await this.checkFrameworkSpecific();

    return this.generateReport();
  }

  async detectFramework() {
    console.log('Detecting framework...');

    const packageJsonPath = path.join(this.rootPath, 'package.json');

    try {
      const packageJson = JSON.parse(await this.readFile('package.json'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.next) {
        this.framework = 'next';
        console.log('  ✓ Detected: Next.js');
      } else if (deps.react || deps['react-dom']) {
        this.framework = 'react';
        console.log('  ✓ Detected: React');
      } else if (deps.vue) {
        this.framework = 'vue';
        console.log('  ✓ Detected: Vue');
      } else {
        this.framework = 'unknown';
        console.log('  ⚠️  Framework not detected');
      }
    } catch {
      console.log('  ⚠️  No package.json found');
    }
  }

  async checkVercelConfig() {
    console.log('Checking Vercel configuration...');

    const hasVercelJson = await this.fileExists('vercel.json');

    if (!hasVercelJson) {
      this.addIssue({
        severity: 'low',
        category: 'deployment-config',
        title: 'No vercel.json found',
        description: 'vercel.json allows custom deployment configuration',
        recommendation: 'Consider adding vercel.json for custom settings'
      });
      console.log('  ⚠️  No vercel.json (using defaults)');
      return;
    }

    try {
      const vercelConfig = JSON.parse(await this.readFile('vercel.json'));

      // Check for common issues
      if (vercelConfig.builds) {
        this.addIssue({
          severity: 'medium',
          category: 'deployment-config',
          title: 'Deprecated "builds" key in vercel.json',
          description: 'The "builds" key is deprecated in Vercel',
          recommendation: 'Remove "builds" and use framework detection'
        });
      }

      // Check for environment variable references
      if (vercelConfig.env || vercelConfig.build?.env) {
        console.log('  ✓ Environment variables configured in vercel.json');
      }

      // Check for rewrites/redirects
      if (vercelConfig.rewrites || vercelConfig.redirects) {
        console.log('  ✓ Rewrites/redirects configured');
      }

      console.log('  ✓ vercel.json present and valid');
    } catch (error) {
      this.addIssue({
        severity: 'medium',
        category: 'deployment-config',
        title: 'Invalid vercel.json',
        description: 'vercel.json contains invalid JSON',
        recommendation: 'Fix JSON syntax errors'
      });
      console.log('  ✗ vercel.json contains errors');
    }
  }

  async checkEnvironmentVariables() {
    console.log('Checking environment variables...');

    const envFiles = [
      '.env',
      '.env.local',
      '.env.production',
      '.env.development',
      '.env.example'
    ];

    let foundEnvFiles = [];
    let hasExample = false;

    for (const file of envFiles) {
      if (await this.fileExists(file)) {
        foundEnvFiles.push(file);
        if (file === '.env.example') hasExample = true;
      }
    }

    if (foundEnvFiles.length === 0) {
      this.addIssue({
        severity: 'medium',
        category: 'deployment-env',
        title: 'No environment variable files found',
        description: 'Web3 apps typically need env vars for RPC URLs, API keys',
        recommendation: 'Create .env.example and .env.local'
      });
      console.log('  ⚠️  No .env files found');
      return;
    }

    if (!hasExample && foundEnvFiles.length > 0) {
      this.addIssue({
        severity: 'low',
        category: 'deployment-env',
        title: 'No .env.example file',
        description: '.env.example documents required environment variables',
        recommendation: 'Create .env.example for documentation'
      });
    }

    // Check for common Web3 environment variables
    const requiredVars = [
      'NEXT_PUBLIC_CHAIN_ID',
      'NEXT_PUBLIC_RPC_URL',
      'NEXT_PUBLIC_HELIUS_API_KEY',
      'NEXT_PUBLIC_SOLANA_RPC_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'UPSTASH_REDIS_REST_URL'
    ];

    for (const envFile of foundEnvFiles) {
      if (envFile === '.env.example') continue; // Skip example file

      const content = await this.readFile(envFile);
      const definedVars = content.match(/^[A-Z_]+=/gm) || [];
      const varNames = definedVars.map(v => v.replace('=', ''));

      // Check for sensitive values in plain text
      if (content.includes('sk_') || content.includes('pk_')) {
        this.addIssue({
          severity: 'critical',
          category: 'deployment-security',
          file: envFile,
          title: 'Potential secret key in environment file',
          description: 'Private keys should NEVER be in code or env files',
          recommendation: 'Remove secret keys, use Vercel environment variables'
        });
      }

      // Check for hardcoded URLs
      if (content.includes('localhost') && envFile === '.env.production') {
        this.addIssue({
          severity: 'high',
          category: 'deployment-env',
          file: envFile,
          title: 'localhost URL in production env file',
          description: 'Production env should not reference localhost',
          recommendation: 'Update URLs to production endpoints'
        });
      }
    }

    console.log(`  ✓ Found ${foundEnvFiles.length} environment files`);
  }

  async checkBuildConfiguration() {
    console.log('Checking build configuration...');

    if (this.framework === 'next') {
      await this.checkNextJSBuild();
    }

    // Check package.json scripts
    try {
      const packageJson = JSON.parse(await this.readFile('package.json'));
      const scripts = packageJson.scripts || {};

      if (!scripts.build) {
        this.addIssue({
          severity: 'high',
          category: 'deployment-build',
          title: 'No build script in package.json',
          description: 'Vercel needs a build script to deploy',
          recommendation: 'Add "build": "next build" or appropriate command'
        });
        console.log('  ✗ No build script found');
      } else {
        console.log(`  ✓ Build script: ${scripts.build}`);
      }

      // Check for start script
      if (!scripts.start && this.framework === 'next') {
        this.addIssue({
          severity: 'low',
          category: 'deployment-build',
          title: 'No start script',
          description: 'start script is useful for local production testing',
          recommendation: 'Add "start": "next start"'
        });
      }

      // Test the build locally
      console.log('Testing build command...');
      try {
        await execPromise('npm run build', {
          cwd: this.rootPath,
          timeout: 300000
        });
        console.log('  ✓ Build succeeds');
      } catch (error) {
        this.addIssue({
          severity: 'critical',
          category: 'deployment-build',
          title: 'Build command fails',
          description: 'npm run build returns errors',
          recommendation: 'Fix build errors before deploying'
        });
        console.log('  ✗ Build fails');
      }
    } catch (error) {
      console.log('  ⚠️  Could not check build configuration');
    }
  }

  async checkNextJSBuild() {
    console.log('Checking Next.js configuration...');

    const hasNextConfig = await this.fileExists('next.config.js') ||
                          await this.fileExists('next.config.mjs');

    if (!hasNextConfig) {
      console.log('  ⊘ No next.config.js (using defaults)');
      return;
    }

    const configFile = await this.fileExists('next.config.js') ? 'next.config.js' : 'next.config.mjs';
    const content = await this.readFile(configFile);

    // Check for common production issues
    if (content.includes('reactStrictMode: false')) {
      this.addIssue({
        severity: 'low',
        category: 'deployment-config',
        file: configFile,
        title: 'React Strict Mode disabled',
        description: 'Strict mode helps catch bugs early',
        recommendation: 'Enable: reactStrictMode: true'
      });
    }

    // Check for image optimization configuration
    if (!content.includes('images:') && !content.includes('images ')) {
      this.addIssue({
        severity: 'low',
        category: 'deployment-config',
        title: 'No image configuration',
        description: 'Next.js image optimization should be configured',
        recommendation: 'Add images: { domains: [...] } to next.config.js'
      });
    }

    // Check for webpack customization issues
    if (content.includes('webpack:') && content.includes('fallback')) {
      console.log('  ⚠️  Custom webpack config detected (verify compatibility)');
    }

    console.log(`  ✓ ${configFile} present`);
  }

  async checkProductionSafety() {
    console.log('Checking production safety...');

    // Check .gitignore
    const hasGitignore = await this.fileExists('.gitignore');

    if (!hasGitignore) {
      this.addIssue({
        severity: 'high',
        category: 'deployment-security',
        title: 'No .gitignore file',
        description: 'Risk of committing sensitive files',
        recommendation: 'Create .gitignore with .env, node_modules, etc.'
      });
      console.log('  ✗ No .gitignore');
    } else {
      const gitignoreContent = await this.readFile('.gitignore');

      const criticalPatterns = ['.env', '.env.local', 'node_modules'];
      const missingPatterns = criticalPatterns.filter(p => !gitignoreContent.includes(p));

      if (missingPatterns.length > 0) {
        this.addIssue({
          severity: 'high',
          category: 'deployment-security',
          title: `Missing critical .gitignore patterns: ${missingPatterns.join(', ')}`,
          description: 'These files should not be committed',
          recommendation: `Add to .gitignore: ${missingPatterns.join(', ')}`
        });
      } else {
        console.log('  ✓ .gitignore has critical patterns');
      }
    }

    // Check for console.log in production code
    const jsFiles = await this.findFiles('.', ['.js', '.jsx', '.ts', '.tsx'], 50);
    let consoleLogCount = 0;

    for (const file of jsFiles) {
      // Skip node_modules, test files
      if (file.includes('node_modules') || file.includes('.test.') || file.includes('.spec.')) {
        continue;
      }

      const content = await this.readFile(file);
      const matches = content.match(/console\.(log|debug|info)/g);
      if (matches) {
        consoleLogCount += matches.length;
      }
    }

    if (consoleLogCount > 20) {
      this.addIssue({
        severity: 'low',
        category: 'deployment-cleanup',
        title: `${consoleLogCount} console.log statements found`,
        description: 'Remove debug console.log before production',
        recommendation: 'Clean up console statements or use proper logging'
      });
      console.log(`  ⚠️  ${consoleLogCount} console.log statements`);
    } else {
      console.log('  ✓ Minimal console.log usage');
    }
  }

  async checkFrameworkSpecific() {
    console.log('Checking framework-specific requirements...');

    if (this.framework === 'next') {
      // Check for API routes security
      const apiRoutes = await this.findFiles('pages/api', ['.js', '.ts'], 50);

      if (apiRoutes.length === 0) {
        console.log('  ⊘ No API routes found');
        return;
      }

      let unsecuredRoutes = 0;

      for (const route of apiRoutes) {
        const content = await this.readFile(route);

        // Check for CORS headers
        if (!content.includes('Access-Control-Allow') && !content.includes('cors')) {
          unsecuredRoutes++;
        }

        // Check for rate limiting
        if (!content.includes('rate') && !content.includes('limit')) {
          // This is a heuristic - not all routes need rate limiting
        }

        // Check for authentication
        if (!content.includes('auth') && !content.includes('session') &&
            !content.includes('token') && route.toLowerCase().includes('api')) {
          // This is informational - not all routes need auth
        }
      }

      if (unsecuredRoutes > 0) {
        this.addIssue({
          severity: 'medium',
          category: 'deployment-security',
          title: `${unsecuredRoutes} API routes without CORS configuration`,
          description: 'API routes should have CORS headers configured',
          recommendation: 'Add CORS headers or use next-cors middleware'
        });
      }

      console.log(`  ✓ Checked ${apiRoutes.length} API routes`);
    }
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
      id: `deployment-${this.issues.length + 1}`,
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
    console.log('DEPLOYMENT VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`\nTotal issues: ${this.issues.length}`);
    console.log(`Critical: ${bySeverity.critical}, High: ${bySeverity.high}, Medium: ${bySeverity.medium}, Low: ${bySeverity.low}`);

    return {
      summary: { totalIssues: this.issues.length, bySeverity },
      issues: this.issues,
      timestamp: new Date().toISOString(),
      validator: 'deployment'
    };
  }

  async save() {
    const outputPath = path.join(this.rootPath, '.claude/debug/deployment-validator-results.json');
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    const report = this.generateReport();
    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n✅ Report saved to: ${outputPath}`);
    return outputPath;
  }
}

if (require.main === module) {
  const validator = new DeploymentValidator();
  validator.validate()
    .then(() => validator.save())
    .catch(console.error);
}

module.exports = { DeploymentValidator };
