#!/usr/bin/env node

/**
 * Architecture Mapper for Web3 Multi-Chain Projects
 *
 * Auto-detects project structure including:
 * - EVM contracts (Hardhat, Foundry)
 * - Solana programs (Anchor)
 * - Frontend (Next.js, React)
 * - Backend (API routes, Supabase functions)
 * - Testing frameworks
 * - Deployment configs
 * - Database schemas
 * - RPC configurations
 *
 * Outputs: .claude/debug/architecture-map.json
 */

const fs = require('fs');
const path = require('path');

class ArchitectureMapper {
  constructor(rootPath) {
    this.rootPath = rootPath || process.cwd();
    this.architecture = {
      timestamp: new Date().toISOString(),
      projectType: 'unknown',
      chains: {
        evm: { detected: false, contracts: [], framework: null },
        solana: { detected: false, programs: [], framework: null }
      },
      frontend: { detected: false, framework: null, components: [] },
      backend: { detected: false, type: null, endpoints: [] },
      database: { detected: false, type: null, schema: [] },
      cache: { detected: false, type: null },
      testing: { frameworks: [], testDirs: [] },
      deployment: { platforms: [], configs: [] },
      packageManager: null,
      monorepo: null,
      dependencies: { critical: [], web3: [], testing: [] },
      rpcProviders: [],
      environmentVars: { required: [], detected: [] }
    };
  }

  async map() {
    console.log('🔍 Mapping project architecture...\n');

    await this.detectPackageManager();
    await this.detectMonorepo();
    await this.detectEVMContracts();
    await this.detectSolanaPrograms();
    await this.detectFrontend();
    await this.detectBackend();
    await this.detectDatabase();
    await this.detectCache();
    await this.detectTesting();
    await this.detectDeployment();
    await this.detectDependencies();
    await this.detectRPCProviders();
    await this.detectEnvironmentVars();
    await this.determineProjectType();

    return this.architecture;
  }

  async detectPackageManager() {
    if (await this.fileExists('pnpm-lock.yaml')) {
      this.architecture.packageManager = 'pnpm';
    } else if (await this.fileExists('yarn.lock')) {
      this.architecture.packageManager = 'yarn';
    } else if (await this.fileExists('package-lock.json')) {
      this.architecture.packageManager = 'npm';
    } else if (await this.fileExists('bun.lockb')) {
      this.architecture.packageManager = 'bun';
    }

    if (this.architecture.packageManager) {
      console.log(`✓ Package manager: ${this.architecture.packageManager}`);
    }
  }

  async detectMonorepo() {
    if (await this.fileExists('turbo.json')) {
      this.architecture.monorepo = 'turborepo';
    } else if (await this.fileExists('nx.json')) {
      this.architecture.monorepo = 'nx';
    } else if (await this.fileExists('lerna.json')) {
      this.architecture.monorepo = 'lerna';
    } else if (await this.fileExists('pnpm-workspace.yaml')) {
      this.architecture.monorepo = 'pnpm-workspaces';
    } else {
      const packageJson = await this.readPackageJson();
      if (packageJson?.workspaces) {
        this.architecture.monorepo = 'npm-workspaces';
      }
    }

    if (this.architecture.monorepo) {
      console.log(`✓ Monorepo: ${this.architecture.monorepo}`);
    }
  }

  async detectEVMContracts() {
    // Detect Hardhat
    if (await this.fileExists('hardhat.config.js') || await this.fileExists('hardhat.config.ts')) {
      this.architecture.chains.evm.detected = true;
      this.architecture.chains.evm.framework = 'hardhat';

      // Find contract files
      const contractDirs = ['contracts', 'src/contracts'];
      for (const dir of contractDirs) {
        if (await this.directoryExists(dir)) {
          const contracts = await this.findFilesRecursive(dir, '.sol');
          this.architecture.chains.evm.contracts.push(...contracts);
        }
      }

      console.log(`✓ EVM contracts detected (Hardhat): ${this.architecture.chains.evm.contracts.length} files`);
    }

    // Detect Foundry
    if (await this.fileExists('foundry.toml')) {
      this.architecture.chains.evm.detected = true;
      this.architecture.chains.evm.framework = this.architecture.chains.evm.framework
        ? 'hardhat+foundry'
        : 'foundry';

      // Foundry uses src/ for contracts
      if (await this.directoryExists('src')) {
        const contracts = await this.findFilesRecursive('src', '.sol');
        this.architecture.chains.evm.contracts.push(...contracts.filter(c => !c.includes('/test/')));
      }

      console.log(`✓ Foundry detected: ${this.architecture.chains.evm.contracts.length} contracts`);
    }
  }

  async detectSolanaPrograms() {
    // Detect Anchor
    if (await this.fileExists('Anchor.toml')) {
      this.architecture.chains.solana.detected = true;
      this.architecture.chains.solana.framework = 'anchor';

      // Find Rust program files
      const programDirs = ['programs', 'src/programs'];
      for (const dir of programDirs) {
        if (await this.directoryExists(dir)) {
          const programs = await this.findFilesRecursive(dir, '.rs');
          this.architecture.chains.solana.programs.push(...programs);
        }
      }

      console.log(`✓ Solana programs detected (Anchor): ${this.architecture.chains.solana.programs.length} files`);
    }

    // Detect native Solana programs (without Anchor)
    if (!this.architecture.chains.solana.detected && await this.directoryExists('program')) {
      const programs = await this.findFilesRecursive('program', '.rs');
      if (programs.length > 0) {
        this.architecture.chains.solana.detected = true;
        this.architecture.chains.solana.framework = 'native';
        this.architecture.chains.solana.programs.push(...programs);

        console.log(`✓ Solana programs detected (Native): ${programs.length} files`);
      }
    }
  }

  async detectFrontend() {
    const packageJson = await this.readPackageJson();
    if (!packageJson) return;

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Detect Next.js
    if (deps['next']) {
      this.architecture.frontend.detected = true;
      this.architecture.frontend.framework = 'nextjs';

      // Find pages/components
      const componentDirs = ['pages', 'app', 'components', 'src/components', 'src/pages', 'src/app'];
      for (const dir of componentDirs) {
        if (await this.directoryExists(dir)) {
          const components = await this.findFilesRecursive(dir, ['.tsx', '.ts', '.jsx', '.js']);
          this.architecture.frontend.components.push(...components);
        }
      }

      console.log(`✓ Frontend: Next.js (${this.architecture.frontend.components.length} components)`);
    }
    // Detect Vite + React
    else if (deps['vite'] && deps['react']) {
      this.architecture.frontend.detected = true;
      this.architecture.frontend.framework = 'vite+react';

      const componentDirs = ['src/components', 'src'];
      for (const dir of componentDirs) {
        if (await this.directoryExists(dir)) {
          const components = await this.findFilesRecursive(dir, ['.tsx', '.ts', '.jsx', '.js']);
          this.architecture.frontend.components.push(...components);
        }
      }

      console.log(`✓ Frontend: Vite + React (${this.architecture.frontend.components.length} components)`);
    }
    // Detect Create React App
    else if (deps['react-scripts']) {
      this.architecture.frontend.detected = true;
      this.architecture.frontend.framework = 'create-react-app';

      const srcDir = 'src';
      if (await this.directoryExists(srcDir)) {
        const components = await this.findFilesRecursive(srcDir, ['.tsx', '.ts', '.jsx', '.js']);
        this.architecture.frontend.components.push(...components);
      }

      console.log(`✓ Frontend: Create React App (${this.architecture.frontend.components.length} files)`);
    }
  }

  async detectBackend() {
    // Detect Next.js API routes
    if (await this.directoryExists('pages/api') || await this.directoryExists('app/api')) {
      this.architecture.backend.detected = true;
      this.architecture.backend.type = 'nextjs-api-routes';

      const apiDirs = ['pages/api', 'app/api', 'src/pages/api'];
      for (const dir of apiDirs) {
        if (await this.directoryExists(dir)) {
          const endpoints = await this.findFilesRecursive(dir, ['.ts', '.js']);
          this.architecture.backend.endpoints.push(...endpoints);
        }
      }

      console.log(`✓ Backend: Next.js API routes (${this.architecture.backend.endpoints.length} endpoints)`);
    }

    // Detect Supabase Edge Functions
    if (await this.directoryExists('supabase/functions')) {
      if (!this.architecture.backend.detected) {
        this.architecture.backend.detected = true;
        this.architecture.backend.type = 'supabase-functions';
      } else {
        this.architecture.backend.type += '+supabase-functions';
      }

      const functions = await this.findFilesRecursive('supabase/functions', ['.ts', '.js']);
      this.architecture.backend.endpoints.push(...functions);

      console.log(`✓ Supabase Edge Functions detected: ${functions.length} functions`);
    }

    // Detect Express/Fastify backend
    const packageJson = await this.readPackageJson();
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps['express']) {
        this.architecture.backend.detected = true;
        this.architecture.backend.type = this.architecture.backend.type
          ? this.architecture.backend.type + '+express'
          : 'express';
        console.log(`✓ Backend: Express.js detected`);
      }

      if (deps['fastify']) {
        this.architecture.backend.detected = true;
        this.architecture.backend.type = this.architecture.backend.type
          ? this.architecture.backend.type + '+fastify'
          : 'fastify';
        console.log(`✓ Backend: Fastify detected`);
      }
    }
  }

  async detectDatabase() {
    // Detect Supabase
    const packageJson = await this.readPackageJson();
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps['@supabase/supabase-js']) {
        this.architecture.database.detected = true;
        this.architecture.database.type = 'supabase';

        // Check for schema files
        if (await this.directoryExists('supabase/migrations')) {
          const migrations = await this.findFilesRecursive('supabase/migrations', '.sql');
          this.architecture.database.schema.push(...migrations);
        }

        console.log(`✓ Database: Supabase (${this.architecture.database.schema.length} migrations)`);
      }

      // Detect PostgreSQL
      if (deps['pg'] || deps['postgres']) {
        this.architecture.database.detected = true;
        this.architecture.database.type = this.architecture.database.type
          ? this.architecture.database.type + '+postgres'
          : 'postgres';
        console.log(`✓ Database: PostgreSQL detected`);
      }

      // Detect MongoDB
      if (deps['mongodb'] || deps['mongoose']) {
        this.architecture.database.detected = true;
        this.architecture.database.type = this.architecture.database.type
          ? this.architecture.database.type + '+mongodb'
          : 'mongodb';
        console.log(`✓ Database: MongoDB detected`);
      }
    }
  }

  async detectCache() {
    const packageJson = await this.readPackageJson();
    if (!packageJson) return;

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Detect Upstash Redis
    if (deps['@upstash/redis']) {
      this.architecture.cache.detected = true;
      this.architecture.cache.type = 'upstash-redis';
      console.log(`✓ Cache: Upstash Redis detected`);
    }
    // Detect regular Redis
    else if (deps['redis'] || deps['ioredis']) {
      this.architecture.cache.detected = true;
      this.architecture.cache.type = 'redis';
      console.log(`✓ Cache: Redis detected`);
    }
  }

  async detectTesting() {
    const packageJson = await this.readPackageJson();
    if (!packageJson) return;

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Frontend testing
    if (deps['jest']) {
      this.architecture.testing.frameworks.push('jest');
    }
    if (deps['vitest']) {
      this.architecture.testing.frameworks.push('vitest');
    }
    if (deps['@playwright/test']) {
      this.architecture.testing.frameworks.push('playwright');
    }
    if (deps['cypress']) {
      this.architecture.testing.frameworks.push('cypress');
    }

    // Contract testing is detected via framework (Hardhat, Foundry, Anchor)
    if (this.architecture.chains.evm.framework) {
      const framework = this.architecture.chains.evm.framework;
      if (framework.includes('hardhat')) {
        this.architecture.testing.frameworks.push('hardhat');
      }
      if (framework.includes('foundry')) {
        this.architecture.testing.frameworks.push('foundry');
      }
    }

    if (this.architecture.chains.solana.framework === 'anchor') {
      this.architecture.testing.frameworks.push('anchor');
    }

    // Find test directories
    const testDirs = ['test', 'tests', '__tests__', 'src/test', 'src/__tests__', 'e2e', 'cypress'];
    for (const dir of testDirs) {
      if (await this.directoryExists(dir)) {
        this.architecture.testing.testDirs.push(dir);
      }
    }

    if (this.architecture.testing.frameworks.length > 0) {
      console.log(`✓ Testing: ${this.architecture.testing.frameworks.join(', ')}`);
    }
  }

  async detectDeployment() {
    // Detect Vercel
    if (await this.fileExists('vercel.json')) {
      this.architecture.deployment.platforms.push('vercel');
      this.architecture.deployment.configs.push('vercel.json');
      console.log(`✓ Deployment: Vercel`);
    }

    // Detect Netlify
    if (await this.fileExists('netlify.toml')) {
      this.architecture.deployment.platforms.push('netlify');
      this.architecture.deployment.configs.push('netlify.toml');
      console.log(`✓ Deployment: Netlify`);
    }

    // Detect Docker
    if (await this.fileExists('Dockerfile') || await this.fileExists('docker-compose.yml')) {
      this.architecture.deployment.platforms.push('docker');
      this.architecture.deployment.configs.push(
        await this.fileExists('Dockerfile') ? 'Dockerfile' : null,
        await this.fileExists('docker-compose.yml') ? 'docker-compose.yml' : null
      );
      this.architecture.deployment.configs = this.architecture.deployment.configs.filter(Boolean);
      console.log(`✓ Deployment: Docker`);
    }

    // GitHub Actions
    if (await this.directoryExists('.github/workflows')) {
      this.architecture.deployment.platforms.push('github-actions');
      const workflows = await this.findFilesRecursive('.github/workflows', ['.yml', '.yaml']);
      this.architecture.deployment.configs.push(...workflows);
      console.log(`✓ CI/CD: GitHub Actions (${workflows.length} workflows)`);
    }
  }

  async detectDependencies() {
    const packageJson = await this.readPackageJson();
    if (!packageJson) return;

    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Critical dependencies
    const critical = [
      'react', 'next', 'typescript', 'ethers', '@solana/web3.js',
      '@supabase/supabase-js', 'hardhat', '@coral-xyz/anchor'
    ];

    for (const dep of critical) {
      if (allDeps[dep]) {
        this.architecture.dependencies.critical.push({
          name: dep,
          version: allDeps[dep]
        });
      }
    }

    // Web3 dependencies
    const web3Deps = Object.keys(allDeps).filter(dep =>
      dep.includes('web3') ||
      dep.includes('ethers') ||
      dep.includes('solana') ||
      dep.includes('anchor') ||
      dep.includes('wagmi') ||
      dep.includes('viem') ||
      dep.includes('@openzeppelin')
    );

    for (const dep of web3Deps) {
      this.architecture.dependencies.web3.push({
        name: dep,
        version: allDeps[dep]
      });
    }

    // Testing dependencies
    const testingDeps = Object.keys(allDeps).filter(dep =>
      dep.includes('jest') ||
      dep.includes('vitest') ||
      dep.includes('playwright') ||
      dep.includes('cypress') ||
      dep.includes('testing-library')
    );

    for (const dep of testingDeps) {
      this.architecture.dependencies.testing.push({
        name: dep,
        version: allDeps[dep]
      });
    }

    console.log(`✓ Dependencies analyzed: ${this.architecture.dependencies.critical.length} critical, ${this.architecture.dependencies.web3.length} Web3`);
  }

  async detectRPCProviders() {
    // Check environment files
    const envFiles = ['.env', '.env.local', '.env.development', '.env.production', '.env.example'];

    for (const envFile of envFiles) {
      if (await this.fileExists(envFile)) {
        const content = await this.readFile(envFile);

        // Detect Helius
        if (content.includes('helius') || content.includes('HELIUS')) {
          if (!this.architecture.rpcProviders.includes('helius')) {
            this.architecture.rpcProviders.push('helius');
          }
        }

        // Detect Alchemy
        if (content.includes('alchemy') || content.includes('ALCHEMY')) {
          if (!this.architecture.rpcProviders.includes('alchemy')) {
            this.architecture.rpcProviders.push('alchemy');
          }
        }

        // Detect Infura
        if (content.includes('infura') || content.includes('INFURA')) {
          if (!this.architecture.rpcProviders.includes('infura')) {
            this.architecture.rpcProviders.push('infura');
          }
        }

        // Detect QuickNode
        if (content.includes('quicknode') || content.includes('QUICKNODE')) {
          if (!this.architecture.rpcProviders.includes('quicknode')) {
            this.architecture.rpcProviders.push('quicknode');
          }
        }
      }
    }

    if (this.architecture.rpcProviders.length > 0) {
      console.log(`✓ RPC Providers: ${this.architecture.rpcProviders.join(', ')}`);
    }
  }

  async detectEnvironmentVars() {
    const envFiles = ['.env', '.env.local', '.env.example'];
    const requiredVars = new Set();
    const detectedVars = new Set();

    for (const envFile of envFiles) {
      if (await this.fileExists(envFile)) {
        const content = await this.readFile(envFile);
        const lines = content.split('\n');

        for (const line of lines) {
          const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
          if (match) {
            const varName = match[1];

            // Example file usually lists required vars
            if (envFile.includes('example')) {
              requiredVars.add(varName);
            } else {
              detectedVars.add(varName);
            }
          }
        }
      }
    }

    this.architecture.environmentVars.required = Array.from(requiredVars);
    this.architecture.environmentVars.detected = Array.from(detectedVars);

    // Check for missing required vars
    const missing = this.architecture.environmentVars.required.filter(
      v => !this.architecture.environmentVars.detected.includes(v)
    );

    if (missing.length > 0) {
      console.log(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    }
  }

  async determineProjectType() {
    const hasEVM = this.architecture.chains.evm.detected;
    const hasSolana = this.architecture.chains.solana.detected;
    const hasFrontend = this.architecture.frontend.detected;
    const hasBackend = this.architecture.backend.detected;

    if (hasEVM && hasSolana && hasFrontend && hasBackend) {
      this.architecture.projectType = 'full-stack-multi-chain-dapp';
    } else if (hasEVM && hasSolana && hasFrontend) {
      this.architecture.projectType = 'multi-chain-dapp';
    } else if ((hasEVM || hasSolana) && hasFrontend && hasBackend) {
      this.architecture.projectType = 'full-stack-dapp';
    } else if ((hasEVM || hasSolana) && hasFrontend) {
      this.architecture.projectType = 'frontend-dapp';
    } else if (hasEVM || hasSolana) {
      this.architecture.projectType = 'smart-contracts-only';
    } else if (hasFrontend && hasBackend) {
      this.architecture.projectType = 'full-stack-webapp';
    } else if (hasFrontend) {
      this.architecture.projectType = 'frontend-only';
    }

    console.log(`\n✓ Project type: ${this.architecture.projectType}`);
  }

  // Helper methods
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

  async readFile(filename) {
    try {
      return await fs.promises.readFile(path.join(this.rootPath, filename), 'utf-8');
    } catch {
      return '';
    }
  }

  async readPackageJson() {
    try {
      const content = await this.readFile('package.json');
      return content ? JSON.parse(content) : null;
    } catch {
      return null;
    }
  }

  async findFilesRecursive(dir, extensions) {
    const results = [];
    const exts = Array.isArray(extensions) ? extensions : [extensions];

    try {
      const items = await fs.promises.readdir(path.join(this.rootPath, dir), { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          // Skip node_modules, .git, etc.
          if (!['node_modules', '.git', 'dist', 'build', 'out', '.next'].includes(item.name)) {
            const nested = await this.findFilesRecursive(fullPath, exts);
            results.push(...nested);
          }
        } else if (item.isFile()) {
          if (exts.some(ext => item.name.endsWith(ext))) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return results;
  }

  async save() {
    const outputPath = path.join(this.rootPath, '.claude/debug/architecture-map.json');

    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    // Save with formatting
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(this.architecture, null, 2),
      'utf-8'
    );

    console.log(`\n✅ Architecture map saved to: ${outputPath}`);

    return outputPath;
  }
}

// CLI usage
if (require.main === module) {
  const mapper = new ArchitectureMapper();

  mapper.map()
    .then(() => mapper.save())
    .then(() => {
      console.log('\n🎉 Architecture mapping complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error mapping architecture:', error);
      process.exit(1);
    });
}

module.exports = { ArchitectureMapper };
