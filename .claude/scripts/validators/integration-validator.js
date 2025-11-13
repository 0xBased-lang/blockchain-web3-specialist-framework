#!/usr/bin/env node

/**
 * Integration Validator
 *
 * Checks synchronization between:
 * - Frontend (React/Next.js) ↔ Backend (API/Supabase)
 * - Frontend ↔ Blockchain (RPC/contracts)
 * - Backend ↔ Blockchain (event indexing, state sync)
 * - Cache layer (Redis) ↔ Database ↔ Blockchain
 *
 * Common issues detected:
 * - Stale cache after blockchain transactions
 * - Frontend state not updating after backend changes
 * - Missing event listeners for blockchain state changes
 * - Race conditions in async flows
 * - Network mismatch (frontend vs backend)
 * - ABI version mismatches
 * - Missing transaction confirmations
 */

const fs = require('fs');
const path = require('path');

class IntegrationValidator {
  constructor(rootPath, architectureMap) {
    this.rootPath = rootPath || process.cwd();
    this.architecture = architectureMap;
    this.issues = [];
  }

  async validate() {
    console.log('🔍 Validating integration layers...\n');

    // Load architecture map if not provided
    if (!this.architecture) {
      const mapPath = path.join(this.rootPath, '.claude/debug/architecture-map.json');
      if (fs.existsSync(mapPath)) {
        this.architecture = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
      } else {
        console.error('⚠️  Architecture map not found. Run architecture-mapper.js first.');
        process.exit(1);
      }
    }

    // Run validation checks
    await this.checkFrontendBackendSync();
    await this.checkFrontendBlockchainSync();
    await this.checkBackendBlockchainSync();
    await this.checkCacheInvalidation();
    await this.checkNetworkConfiguration();
    await this.checkTransactionConfirmations();
    await this.checkEventListeners();
    await this.checkRaceConditions();
    await this.checkABIVersions();

    return this.generateReport();
  }

  async checkFrontendBackendSync() {
    console.log('Checking frontend-backend synchronization...');

    if (!this.architecture.frontend.detected || !this.architecture.backend.detected) {
      console.log('  ⊘ Skipped (no frontend or backend detected)');
      return;
    }

    // Check for API call patterns without error handling
    const frontendFiles = this.architecture.frontend.components;

    for (const file of frontendFiles.slice(0, 50)) { // Limit to avoid too many checks
      const content = await this.readFile(file);

      // Check for fetch/axios calls without error handling
      const apiCallPatterns = [
        /fetch\s*\([^)]+\)(?!\s*\.catch)/g,
        /axios\.[get|post|put|delete]+\([^)]+\)(?!\s*\.catch)/g,
        /await\s+fetch\([^)]+\)(?![\s\S]*catch)/g
      ];

      for (const pattern of apiCallPatterns) {
        if (pattern.test(content)) {
          this.addIssue({
            severity: 'medium',
            category: 'frontend-backend-sync',
            file: file,
            title: 'API call without error handling',
            description: 'API calls should have error handling to prevent silent failures',
            recommendation: 'Add .catch() or try-catch block to handle API errors'
          });
        }
      }

      // Check for missing loading states
      if (content.includes('fetch(') || content.includes('axios.')) {
        if (!content.includes('loading') && !content.includes('isLoading') && !content.includes('pending')) {
          this.addIssue({
            severity: 'low',
            category: 'frontend-backend-sync',
            file: file,
            title: 'Missing loading state for API calls',
            description: 'Components making API calls should show loading state',
            recommendation: 'Add loading state indicator (e.g., isLoading, pending)'
          });
        }
      }
    }

    console.log(`  ✓ Checked ${Math.min(frontendFiles.length, 50)} frontend files`);
  }

  async checkFrontendBlockchainSync() {
    console.log('Checking frontend-blockchain synchronization...');

    if (!this.architecture.frontend.detected) {
      console.log('  ⊘ Skipped (no frontend detected)');
      return;
    }

    const hasEVM = this.architecture.chains.evm.detected;
    const hasSolana = this.architecture.chains.solana.detected;

    if (!hasEVM && !hasSolana) {
      console.log('  ⊘ Skipped (no blockchain integration detected)');
      return;
    }

    const frontendFiles = this.architecture.frontend.components;

    for (const file of frontendFiles.slice(0, 50)) {
      const content = await this.readFile(file);

      // EVM-specific checks
      if (hasEVM) {
        // Check for transaction handling without confirmation
        if (content.includes('useContractWrite') || content.includes('writeContract')) {
          if (!content.includes('wait()') && !content.includes('waitForTransaction')) {
            this.addIssue({
              severity: 'high',
              category: 'frontend-blockchain-sync',
              file: file,
              title: 'Transaction sent without waiting for confirmation',
              description: 'EVM transactions should wait for confirmation before updating UI',
              recommendation: 'Use tx.wait() or waitForTransaction() to ensure transaction is mined',
              code: 'const tx = await write(); const receipt = await tx.wait();'
            });
          }
        }

        // Check for missing network validation
        if ((content.includes('useContractWrite') || content.includes('useContractRead')) &&
            !content.includes('chain') && !content.includes('chainId')) {
          this.addIssue({
            severity: 'medium',
            category: 'frontend-blockchain-sync',
            file: file,
            title: 'Missing network validation',
            description: 'Contract interactions should verify correct network',
            recommendation: 'Check chainId before contract interactions'
          });
        }

        // Check for event listening patterns
        if (content.includes('useContract') && !content.includes('useContractEvent')) {
          this.addIssue({
            severity: 'low',
            category: 'frontend-blockchain-sync',
            file: file,
            title: 'Potential missing event listener',
            description: 'Contracts with state changes should listen to events for UI updates',
            recommendation: 'Consider using useContractEvent to listen for state changes'
          });
        }
      }

      // Solana-specific checks
      if (hasSolana) {
        // Check for transaction confirmation
        if (content.includes('sendTransaction') && !content.includes('confirmTransaction')) {
          this.addIssue({
            severity: 'high',
            category: 'frontend-blockchain-sync',
            file: file,
            title: 'Solana transaction without confirmation',
            description: 'Solana transactions should be confirmed before updating UI',
            recommendation: 'Use connection.confirmTransaction() after sending',
            code: 'const signature = await sendTransaction(); await connection.confirmTransaction(signature);'
          });
        }

        // Check for account subscription for real-time updates
        if (content.includes('useConnection') && !content.includes('onAccountChange')) {
          this.addIssue({
            severity: 'low',
            category: 'frontend-blockchain-sync',
            file: file,
            title: 'Missing account change subscription',
            description: 'Consider subscribing to account changes for real-time updates',
            recommendation: 'Use connection.onAccountChange() for reactive updates'
          });
        }
      }
    }

    console.log(`  ✓ Checked ${Math.min(frontendFiles.length, 50)} files for blockchain sync`);
  }

  async checkBackendBlockchainSync() {
    console.log('Checking backend-blockchain synchronization...');

    if (!this.architecture.backend.detected) {
      console.log('  ⊘ Skipped (no backend detected)');
      return;
    }

    const backendFiles = this.architecture.backend.endpoints;

    for (const file of backendFiles) {
      const content = await this.readFile(file);

      // Check for blockchain queries without error handling
      if (content.includes('ethers') || content.includes('web3') || content.includes('@solana/web3.js')) {
        // Check for missing RPC error handling
        if (!content.includes('try') && !content.includes('catch')) {
          this.addIssue({
            severity: 'high',
            category: 'backend-blockchain-sync',
            file: file,
            title: 'Blockchain RPC call without error handling',
            description: 'RPC calls can fail due to network issues, rate limits, or node problems',
            recommendation: 'Wrap blockchain calls in try-catch and handle RPC errors gracefully'
          });
        }

        // Check for event indexing without gap detection
        if (content.includes('getLogs') || content.includes('queryFilter')) {
          if (!content.includes('fromBlock') || !content.includes('toBlock')) {
            this.addIssue({
              severity: 'medium',
              category: 'backend-blockchain-sync',
              file: file,
              title: 'Event querying without block range',
              description: 'Event queries should specify block ranges to avoid gaps',
              recommendation: 'Use fromBlock and toBlock parameters for reliable event indexing'
            });
          }
        }
      }

      // Check for database updates after blockchain queries
      if (content.includes('supabase') && (content.includes('ethers') || content.includes('web3'))) {
        if (!content.includes('transaction') && !content.includes('BEGIN')) {
          this.addIssue({
            severity: 'low',
            category: 'backend-blockchain-sync',
            file: file,
            title: 'Consider using database transactions',
            description: 'Blockchain data persistence should use transactions for consistency',
            recommendation: 'Wrap multi-step database operations in transactions'
          });
        }
      }
    }

    console.log(`  ✓ Checked ${backendFiles.length} backend files`);
  }

  async checkCacheInvalidation() {
    console.log('Checking cache invalidation patterns...');

    if (!this.architecture.cache.detected) {
      console.log('  ⊘ Skipped (no cache layer detected)');
      return;
    }

    const allFiles = [
      ...this.architecture.frontend.components,
      ...this.architecture.backend.endpoints
    ];

    for (const file of allFiles.slice(0, 100)) {
      const content = await this.readFile(file);

      // Check for cache usage
      const hasCacheRead = content.includes('redis.get') || content.includes('cache.get');
      const hasCacheWrite = content.includes('redis.set') || content.includes('cache.set');
      const hasCacheDelete = content.includes('redis.del') || content.includes('cache.delete');

      // If using cache read but no write/delete in same file, might be an issue
      if (hasCacheRead && !hasCacheWrite && !hasCacheDelete) {
        // Check if this file has mutations (POST, PUT, DELETE, transactions)
        const hasMutations =
          content.includes('POST') ||
          content.includes('PUT') ||
          content.includes('DELETE') ||
          content.includes('sendTransaction') ||
          content.includes('writeContract') ||
          content.includes('insert') ||
          content.includes('update');

        if (hasMutations) {
          this.addIssue({
            severity: 'medium',
            category: 'cache-invalidation',
            file: file,
            title: 'Potential missing cache invalidation',
            description: 'File reads from cache but performs mutations without invalidating',
            recommendation: 'Invalidate cache after mutations: await redis.del(cacheKey)'
          });
        }
      }

      // Check for transaction success without cache invalidation
      if (content.includes('tx.wait()') || content.includes('confirmTransaction')) {
        if (!hasCacheDelete) {
          this.addIssue({
            severity: 'high',
            category: 'cache-invalidation',
            file: file,
            title: 'Blockchain transaction without cache invalidation',
            description: 'After blockchain transactions, related cache should be invalidated',
            recommendation: 'Add cache invalidation after transaction confirmation',
            code: 'const receipt = await tx.wait(); await redis.del(`balance:${address}`);'
          });
        }
      }
    }

    console.log(`  ✓ Checked ${Math.min(allFiles.length, 100)} files for cache patterns`);
  }

  async checkNetworkConfiguration() {
    console.log('Checking network configuration consistency...');

    // Check environment variables
    const envFiles = ['.env', '.env.local', '.env.development', '.env.production', '.env.example'];
    const envVars = {};

    for (const envFile of envFiles) {
      if (await this.fileExists(envFile)) {
        const content = await this.readFile(envFile);
        const lines = content.split('\n');

        for (const line of lines) {
          const match = line.match(/^(NEXT_PUBLIC_CHAIN_ID|CHAIN_ID|NETWORK)=(.+)$/);
          if (match) {
            envVars[envFile] = match[2];
          }
        }
      }
    }

    // Check for inconsistencies between environments
    const chainIds = Object.values(envVars);
    const uniqueChainIds = [...new Set(chainIds)];

    if (uniqueChainIds.length > 1) {
      this.addIssue({
        severity: 'high',
        category: 'network-configuration',
        file: '.env files',
        title: 'Inconsistent chain IDs across environments',
        description: `Found different chain IDs: ${uniqueChainIds.join(', ')}`,
        recommendation: 'Ensure CHAIN_ID is consistent or intentionally different per environment',
        details: envVars
      });
    }

    // Check for hardcoded network IDs in code
    const frontendFiles = this.architecture.frontend.components.slice(0, 50);

    for (const file of frontendFiles) {
      const content = await this.readFile(file);

      // Look for hardcoded chain IDs (1 = mainnet, 137 = polygon, etc.)
      const hardcodedChainIds = content.match(/chainId:\s*(\d+)|chain:\s*{\s*id:\s*(\d+)/g);

      if (hardcodedChainIds) {
        this.addIssue({
          severity: 'medium',
          category: 'network-configuration',
          file: file,
          title: 'Hardcoded chain ID detected',
          description: 'Chain IDs should come from environment variables for flexibility',
          recommendation: 'Use process.env.NEXT_PUBLIC_CHAIN_ID instead of hardcoded values',
          code: 'chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID)'
        });
      }
    }

    console.log(`  ✓ Network configuration checked`);
  }

  async checkTransactionConfirmations() {
    console.log('Checking transaction confirmation patterns...');

    const allFiles = [
      ...this.architecture.frontend.components,
      ...this.architecture.backend.endpoints
    ];

    for (const file of allFiles.slice(0, 100)) {
      const content = await this.readFile(file);

      // EVM: Check for proper confirmation handling
      if (content.includes('sendTransaction') || content.includes('writeContract')) {
        // Check if waiting for confirmations
        const hasWait = content.includes('.wait(') || content.includes('waitForTransaction');

        if (!hasWait) {
          // Already flagged in checkFrontendBlockchainSync, skip
          continue;
        }

        // Check if handling reorganizations
        const hasReorgHandling = content.includes('confirmations') &&
                                 (content.includes('>=') || content.includes('>'));

        if (!hasReorgHandling && content.includes('critical')) {
          this.addIssue({
            severity: 'medium',
            category: 'transaction-confirmations',
            file: file,
            title: 'Missing multiple confirmation checks',
            description: 'Critical transactions should wait for multiple confirmations',
            recommendation: 'Wait for 2-3 confirmations for mainnet transactions',
            code: 'const receipt = await tx.wait(3); // 3 confirmations'
          });
        }
      }

      // Solana: Check for commitment level
      if (content.includes('sendTransaction') && content.includes('solana')) {
        if (!content.includes('confirmed') && !content.includes('finalized')) {
          this.addIssue({
            severity: 'high',
            category: 'transaction-confirmations',
            file: file,
            title: 'Missing Solana commitment level',
            description: 'Solana transactions should specify commitment level',
            recommendation: 'Use "confirmed" or "finalized" commitment level',
            code: 'await connection.confirmTransaction(signature, "confirmed");'
          });
        }
      }
    }

    console.log(`  ✓ Checked transaction confirmation patterns`);
  }

  async checkEventListeners() {
    console.log('Checking blockchain event listener patterns...');

    if (!this.architecture.chains.evm.detected && !this.architecture.chains.solana.detected) {
      console.log('  ⊘ Skipped (no blockchain detected)');
      return;
    }

    const frontendFiles = this.architecture.frontend.components;

    for (const file of frontendFiles.slice(0, 50)) {
      const content = await this.readFile(file);

      // Check for contract interaction without event listeners
      if (content.includes('useContract') || content.includes('Contract(')) {
        const hasEventListener =
          content.includes('on(') ||
          content.includes('once(') ||
          content.includes('useContractEvent') ||
          content.includes('onAccountChange');

        if (!hasEventListener && (content.includes('write') || content.includes('send'))) {
          this.addIssue({
            severity: 'low',
            category: 'event-listeners',
            file: file,
            title: 'Contract interactions without event listeners',
            description: 'Components that write to contracts should listen for events',
            recommendation: 'Add event listeners to update UI when contract state changes'
          });
        }
      }

      // Check for cleanup of event listeners
      if (content.includes('.on(') && !content.includes('useEffect')) {
        this.addIssue({
          severity: 'medium',
          category: 'event-listeners',
          file: file,
          title: 'Event listener without useEffect cleanup',
          description: 'Event listeners should be cleaned up to prevent memory leaks',
          recommendation: 'Wrap event listeners in useEffect with cleanup function',
          code: 'useEffect(() => { contract.on(...); return () => contract.off(...); }, []);'
        });
      }
    }

    console.log(`  ✓ Checked event listener patterns`);
  }

  async checkRaceConditions() {
    console.log('Checking for potential race conditions...');

    const allFiles = [
      ...this.architecture.frontend.components,
      ...this.architecture.backend.endpoints
    ];

    for (const file of allFiles.slice(0, 100)) {
      const content = await this.readFile(file);

      // Check for parallel async operations without Promise.all
      const asyncCalls = content.match(/await\s+\w+\([^)]*\)/g) || [];

      if (asyncCalls.length >= 2) {
        const hasPromiseAll = content.includes('Promise.all') || content.includes('Promise.allSettled');

        if (!hasPromiseAll) {
          // This might be intentional sequential execution, so it's a low severity
          this.addIssue({
            severity: 'low',
            category: 'race-conditions',
            file: file,
            title: 'Multiple sequential await calls',
            description: 'If these operations are independent, consider running in parallel',
            recommendation: 'Use Promise.all() for independent async operations',
            code: 'const [result1, result2] = await Promise.all([op1(), op2()]);'
          });
        }
      }

      // Check for state updates after async operations without checking if component is mounted
      if (content.includes('useState') && content.includes('await') && content.includes('set')) {
        if (!content.includes('isMounted') && !content.includes('AbortController')) {
          this.addIssue({
            severity: 'medium',
            category: 'race-conditions',
            file: file,
            title: 'State update after async without mount check',
            description: 'Async operations may complete after component unmounts',
            recommendation: 'Check if component is still mounted before setState',
            code: 'useEffect(() => { let isMounted = true; ...; if (isMounted) setState(...); return () => { isMounted = false }; });'
          });
        }
      }
    }

    console.log(`  ✓ Checked for race conditions`);
  }

  async checkABIVersions() {
    console.log('Checking ABI version consistency...');

    if (!this.architecture.chains.evm.detected) {
      console.log('  ⊘ Skipped (no EVM contracts detected)');
      return;
    }

    // Find ABI files in frontend
    const abiPatterns = ['**/*.abi.json', '**/abis/*.json', '**/contracts/*.json'];
    const abiFiles = [];

    for (const pattern of abiPatterns) {
      // Simple implementation - in real world would use glob
      // For now, just check common locations
      const commonPaths = [
        'frontend/abis',
        'src/abis',
        'abis',
        'frontend/contracts',
        'src/contracts'
      ];

      for (const dir of commonPaths) {
        if (await this.directoryExists(dir)) {
          // Simplified check
          this.addIssue({
            severity: 'info',
            category: 'abi-versions',
            file: dir,
            title: 'ABI directory found',
            description: 'Ensure ABIs are in sync with deployed contracts',
            recommendation: 'Verify ABI versions match deployed contract versions'
          });
        }
      }
    }

    console.log(`  ✓ ABI version check complete`);
  }

  // Helper methods
  addIssue(issue) {
    this.issues.push({
      ...issue,
      id: `integration-${this.issues.length + 1}`,
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
    const byCategory = {};
    const bySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    for (const issue of this.issues) {
      // Group by category
      if (!byCategory[issue.category]) {
        byCategory[issue.category] = [];
      }
      byCategory[issue.category].push(issue);

      // Count by severity
      bySeverity[issue.severity]++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('INTEGRATION VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`\nTotal issues found: ${this.issues.length}`);
    console.log(`\nBy severity:`);
    console.log(`  🔴 Critical: ${bySeverity.critical}`);
    console.log(`  🟠 High: ${bySeverity.high}`);
    console.log(`  🟡 Medium: ${bySeverity.medium}`);
    console.log(`  🟢 Low: ${bySeverity.low}`);
    console.log(`  ℹ️  Info: ${bySeverity.info}`);

    console.log(`\nBy category:`);
    for (const [category, issues] of Object.entries(byCategory)) {
      console.log(`  ${category}: ${issues.length} issues`);
    }

    return {
      summary: {
        totalIssues: this.issues.length,
        bySeverity,
        byCategory: Object.fromEntries(
          Object.entries(byCategory).map(([k, v]) => [k, v.length])
        )
      },
      issues: this.issues,
      timestamp: new Date().toISOString(),
      validator: 'integration'
    };
  }

  async save() {
    const outputPath = path.join(this.rootPath, '.claude/debug/integration-validator-results.json');
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    const report = this.generateReport();
    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`\n✅ Report saved to: ${outputPath}`);
    return outputPath;
  }
}

// CLI usage
if (require.main === module) {
  const validator = new IntegrationValidator();

  validator.validate()
    .then(() => validator.save())
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Validation error:', error);
      process.exit(1);
    });
}

module.exports = { IntegrationValidator };
