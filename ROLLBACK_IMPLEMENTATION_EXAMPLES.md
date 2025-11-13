# Rollback Implementation Examples
## Practical Code Examples for Each Strategy

**Last Updated:** 2025-11-13

---

## Table of Contents
1. [Quick Start Examples](#quick-start-examples)
2. [Git-Based Rollback Examples](#git-based-rollback-examples)
3. [Snapshot-Based Examples](#snapshot-based-examples)
4. [Smart Contract Examples](#smart-contract-examples)
5. [Database Migration Examples](#database-migration-examples)
6. [Integration Examples](#integration-examples)

---

## Quick Start Examples

### Example 1: Simple Fix with Automatic Rollback

```python
# simple_fix_example.py
from automated_debugging_system import AutomatedDebuggingSystem

async def fix_syntax_error():
    """Fix a syntax error with automatic rollback on failure."""

    config = {
        'repo_path': '/path/to/repo',
        'dry_run': True  # Start with dry-run
    }

    system = AutomatedDebuggingSystem(config)

    issues = [
        {
            'id': 'syntax_001',
            'type': 'syntax_error',
            'file': 'src/utils/helper.py',
            'line': 42,
            'fix': 'add_missing_colon',
            'description': 'Missing colon after if statement'
        }
    ]

    # Run in dry-run mode first
    print("=== DRY-RUN MODE ===")
    result = await system.apply_fixes(issues)

    if result['success']:
        # If dry-run looks good, ask for confirmation
        proceed = input("\nDry-run successful. Apply fixes? (yes/no): ")

        if proceed.lower() == 'yes':
            # Apply fixes for real
            config['dry_run'] = False
            system = AutomatedDebuggingSystem(config)

            print("\n=== APPLYING FIXES ===")
            result = await system.apply_fixes(issues)

            if result['success']:
                print("\n✓ Fix applied successfully!")
                print(f"  Branch: {result['branch_name']}")
                print(f"  Session: {result['session_id']}")
            else:
                print("\n✗ Fix failed and was rolled back")
                print(f"  Phase: {result['phase']}")

# Run the example
import asyncio
asyncio.run(fix_syntax_error())
```

### Example 2: Multiple Fixes with Checkpoint Strategy

```python
# checkpoint_example.py
async def fix_multiple_issues_with_checkpoints():
    """Apply multiple fixes with checkpoints for safe rollback."""

    config = {
        'repo_path': '/path/to/repo',
        'dry_run': False
    }

    system = AutomatedDebuggingSystem(config)

    issues = [
        {'id': '001', 'type': 'import_error', 'file': 'module_a.py'},
        {'id': '002', 'type': 'type_error', 'file': 'module_b.py'},
        {'id': '003', 'type': 'null_check', 'file': 'module_c.py'},
        {'id': '004', 'type': 'deprecation', 'file': 'module_d.py'},
        {'id': '005', 'type': 'unused_var', 'file': 'module_e.py'},
    ]

    # Use checkpoint strategy - creates checkpoint every 3 fixes
    # If a fix fails, only rolls back to last checkpoint
    result = await system.apply_fixes(
        issues,
        strategy='checkpoint'  # Rollback to last checkpoint on failure
    )

    print(f"\nResults:")
    print(f"  Strategy: {result['execution']['strategy']}")
    print(f"  Successful: {len(result['execution']['successful'])}")
    print(f"  Failed: {len(result['execution']['failed'])}")
    print(f"  Checkpoints: {result['execution'].get('checkpoints', [])}")

    return result

asyncio.run(fix_multiple_issues_with_checkpoints())
```

---

## Git-Based Rollback Examples

### Example 3: Creating Safe Fix Branches

```python
# git_branch_example.py
from git_rollback_manager import GitRollbackManager

def create_safe_fix_branches():
    """Create isolated branches for testing fixes."""

    git_manager = GitRollbackManager('/path/to/repo')

    # Create test branch for experimental fix
    test_branch = git_manager.create_fix_branch(
        issue_id='ISSUE-123',
        base_branch='main',
        branch_type='test'
    )
    print(f"Created test branch: {test_branch}")
    # Output: autofix/test/ISSUE-123_20251113_123456

    # Apply fix and test...
    # If successful, create verified branch

    verified_branch = git_manager.create_fix_branch(
        issue_id='ISSUE-123',
        base_branch='main',
        branch_type='verified'
    )
    print(f"Created verified branch: {verified_branch}")
    # Output: autofix/verified/ISSUE-123_20251113_123500

    # Merge verified fix to main
    success = git_manager.merge_verified_fix(
        fix_branch=verified_branch,
        target_branch='main',
        squash=True
    )

    if success:
        print("✓ Fix merged to main")
    else:
        print("✗ Merge failed")

create_safe_fix_branches()
```

### Example 4: Automatic Commits with Metadata

```python
# commit_metadata_example.py
def commit_with_rich_metadata():
    """Create commits with machine-readable metadata."""

    git_manager = GitRollbackManager('/path/to/repo')

    # Prepare metadata
    metadata = {
        'issue_id': 'BUG-456',
        'issue_type': 'null_pointer_exception',
        'severity': 'high',
        'files_affected': ['auth.py', 'user.py'],
        'tests_added': True,
        'breaking_change': False,
        'related_issues': ['BUG-123', 'BUG-234'],
        'automated': True,
        'ai_suggested': True,
        'confidence_score': 0.95
    }

    # Create pre-fix commit
    commit_hash, branch = git_manager.create_pre_fix_commit(
        issue_id='BUG-456',
        files_affected=['auth.py', 'user.py'],
        metadata=metadata
    )

    print(f"Pre-fix commit: {commit_hash}")
    print(f"Branch: {branch}")

    # Apply fixes...

    # Create post-fix commit
    test_results = {
        'success': True,
        'tests_run': 45,
        'tests_passed': 45,
        'tests_failed': 0,
        'coverage': 95.5,
        'duration': 12.3
    }

    post_commit = git_manager.create_post_fix_commit(
        issue_id='BUG-456',
        fix_description='Fixed null pointer exception in auth module',
        test_results=test_results
    )

    print(f"Post-fix commit: {post_commit}")

commit_with_rich_metadata()
```

### Example 5: Three Rollback Strategies

```python
# rollback_strategies_example.py
from git_rollback_manager import GitRollbackManager, RollbackStrategy

def demonstrate_rollback_strategies():
    """Show different rollback strategies."""

    git_manager = GitRollbackManager('/path/to/repo')

    # Get the commit to rollback to
    target_commit = 'abc123def'  # Commit hash from before the fix

    print("\n=== Strategy 1: Soft Rollback ===")
    print("Keeps changes in working directory")

    success = git_manager.rollback_to_commit(
        commit_hash=target_commit,
        strategy=RollbackStrategy.SOFT
    )

    if success:
        print("✓ Soft rollback complete")
        print("  - Commit history reset")
        print("  - Changes still in working directory")
        print("  - Can review and recommit with modifications")

    print("\n=== Strategy 2: Hard Rollback ===")
    print("Completely discards all changes")

    success = git_manager.rollback_to_commit(
        commit_hash=target_commit,
        strategy=RollbackStrategy.HARD
    )

    if success:
        print("✓ Hard rollback complete")
        print("  - Commit history reset")
        print("  - All changes discarded")
        print("  - Working directory clean")

    print("\n=== Strategy 3: Revert (Recommended for Shared Branches) ===")
    print("Creates new commit that undoes changes")

    success = git_manager.rollback_to_commit(
        commit_hash=target_commit,
        strategy=RollbackStrategy.REVERT
    )

    if success:
        print("✓ Revert complete")
        print("  - New revert commit created")
        print("  - History preserved")
        print("  - Safe for shared branches")

demonstrate_rollback_strategies()
```

### Example 6: Recovery Points with Tags

```python
# recovery_tags_example.py
def create_recovery_points():
    """Create named recovery points for important milestones."""

    git_manager = GitRollbackManager('/path/to/repo')

    # Create recovery point before major changes
    tag = git_manager.create_recovery_point('before_auth_refactor')
    print(f"Created recovery point: {tag}")
    # Output: recovery/before_auth_refactor_20251113_123456

    # ... perform risky changes ...

    # If something goes wrong, rollback to tag
    success = git_manager.rollback_to_commit(
        commit_hash=tag,
        strategy=RollbackStrategy.HARD
    )

    if success:
        print(f"✓ Rolled back to recovery point: {tag}")

create_recovery_points()
```

---

## Snapshot-Based Examples

### Example 7: Fast Snapshot and Restore

```python
# snapshot_example.py
from snapshot_manager import SnapshotManager

def quick_snapshot_restore():
    """Create and restore snapshots quickly."""

    snapshot_mgr = SnapshotManager()

    # Files to snapshot
    files = [
        'src/auth/login.py',
        'src/auth/session.py',
        'src/database/models.py'
    ]

    # Create snapshot
    print("Creating snapshot...")
    snapshot = snapshot_mgr.create_snapshot(
        files=files,
        snapshot_id='auth_refactor_001',
        metadata={
            'reason': 'Before auth refactor',
            'author': 'automated_system'
        }
    )

    print(f"✓ Snapshot created: {snapshot.snapshot_id}")
    print(f"  Files: {len(snapshot.files)}")
    print(f"  Timestamp: {snapshot.timestamp}")

    # Make changes to files...
    # Simulate changes
    with open('src/auth/login.py', 'a') as f:
        f.write('\n# Modified code')

    # Something goes wrong, restore snapshot
    print("\nRestoring snapshot...")
    success = snapshot_mgr.restore_snapshot(
        snapshot_id='auth_refactor_001',
        verify_hash=True
    )

    if success:
        print("✓ Snapshot restored successfully")
        print("  All files reverted to snapshot state")

    # Cleanup when done
    snapshot_mgr.cleanup_snapshot('auth_refactor_001')
    print("✓ Snapshot cleaned up")

quick_snapshot_restore()
```

### Example 8: Comparing Git vs Snapshots

```python
# git_vs_snapshot_comparison.py
import time

def compare_rollback_speed():
    """Compare speed of git vs snapshot rollback."""

    git_manager = GitRollbackManager('/path/to/repo')
    snapshot_mgr = SnapshotManager()

    files = ['file1.py', 'file2.py', 'file3.py']

    # Test Git rollback speed
    print("Testing Git rollback...")
    start = time.time()

    commit_hash, _ = git_manager.create_pre_fix_commit(
        issue_id='speed_test',
        files_affected=files,
        metadata={}
    )

    # Make changes...
    # Rollback
    git_manager.rollback_to_commit(commit_hash, RollbackStrategy.HARD)

    git_time = time.time() - start
    print(f"Git rollback time: {git_time:.3f}s")

    # Test Snapshot rollback speed
    print("\nTesting Snapshot rollback...")
    start = time.time()

    snapshot_mgr.create_snapshot(files, 'speed_test', {})

    # Make changes...
    # Rollback
    snapshot_mgr.restore_snapshot('speed_test')

    snapshot_time = time.time() - start
    print(f"Snapshot rollback time: {snapshot_time:.3f}s")

    print(f"\nSpeedup: {git_time / snapshot_time:.2f}x faster")
    print("\nRecommendation:")
    if snapshot_time < git_time:
        print("  Use snapshots for: Quick iterations, debugging")
    print("  Use git for: Permanent fixes, team collaboration")

compare_rollback_speed()
```

---

## Smart Contract Examples

### Example 9: Safe Contract Deployment with Testnet-First

```typescript
// safe_deployment_example.ts
import { SmartContractDeploymentManager } from './deploymentManager';
import { ethers } from 'hardhat';

async function deployTokenWithTestnetFirst() {
  const manager = new SmartContractDeploymentManager();

  const config = {
    network: 'mainnet',  // Target network
    contractName: 'MyToken',
    constructorArgs: [
      'MyToken',  // name
      'MTK',      // symbol
      ethers.utils.parseEther('1000000')  // initial supply
    ],
    proxyType: 'transparent',
    verify: true
  };

  console.log('Starting testnet-first deployment...\n');

  // This will automatically:
  // 1. Test on local Hardhat network
  // 2. Test on mainnet fork
  // 3. Deploy to Sepolia testnet
  // 4. Monitor for 24 hours
  // 5. Request approval for mainnet
  // 6. Deploy to mainnet if approved

  const result = await manager.deployWithTestnetFirst(config);

  if (result) {
    console.log('\n✓ Deployment successful!');
    console.log(`  Contract address: ${result.address}`);
    console.log(`  Transaction: ${result.transactionHash}`);
    console.log(`  Gas used: ${result.gasUsed}`);
    console.log(`  Verified: ${result.verified}`);
  } else {
    console.log('\n✗ Deployment failed or was not approved');
  }
}

deployTokenWithTestnetFirst();
```

### Example 10: Upgradeable Contract with Rollback

```typescript
// upgradeable_contract_example.ts
async function deployUpgradeableWithRollback() {
  const manager = new SmartContractDeploymentManager();

  // Initial deployment
  console.log('Deploying upgradeable contract...');

  const deployment = await manager.deployUpgradeable({
    network: 'mainnet',
    contractName: 'MyContractV1',
    constructorArgs: [],
    proxyType: 'transparent',
    verify: true
  });

  if (!deployment) {
    console.error('Initial deployment failed');
    return;
  }

  console.log(`✓ Proxy deployed: ${deployment.proxy}`);
  console.log(`✓ Implementation V1: ${deployment.implementation}`);

  // Later: Upgrade to V2
  console.log('\nUpgrading to V2...');

  const upgradeSuccess = await manager.upgradeContract(
    deployment.proxy,
    'MyContractV2'
  );

  if (upgradeSuccess) {
    console.log('✓ Upgraded to V2');

    // Test V2...
    const v2Works = await testContractV2(deployment.proxy);

    if (!v2Works) {
      // Rollback to V1
      console.log('\n✗ V2 has issues, rolling back to V1...');

      const rollbackSuccess = await manager.rollbackUpgrade(deployment.proxy);

      if (rollbackSuccess) {
        console.log('✓ Successfully rolled back to V1');
      } else {
        console.error('✗ Rollback failed!');
      }
    }
  }
}

async function testContractV2(proxyAddress: string): Promise<boolean> {
  // Run tests on V2
  const contract = await ethers.getContractAt('MyContractV2', proxyAddress);

  try {
    // Test critical functions
    await contract.criticalFunction();
    return true;
  } catch (error) {
    console.error('V2 test failed:', error);
    return false;
  }
}

deployUpgradeableWithRollback();
```

### Example 11: Contract Deployment with Comprehensive Verification

```typescript
// deployment_verification_example.ts
async function deployWithFullVerification() {
  const manager = new SmartContractDeploymentManager();

  const config = {
    network: 'mainnet',
    contractName: 'ComplexContract',
    constructorArgs: [/* args */],
    verify: true
  };

  console.log('Deploying with full verification...\n');

  const result = await manager.deployWithRollback(config);

  if (result) {
    console.log('✓ Deployment successful');

    // Verification includes:
    // - Contract code verification
    // - Constructor args validation
    // - Function tests
    // - Gas usage checks
    // - Security scans

    console.log('\nVerification Results:');
    console.log(`  Code deployed: ✓`);
    console.log(`  Constructor args: ✓`);
    console.log(`  Functions working: ✓`);
    console.log(`  Gas usage: ✓ (within limits)`);
    console.log(`  Security: ✓ (no issues)`);
    console.log(`  Etherscan verified: ✓`);

  } else {
    console.log('✗ Deployment failed verification');
    console.log('  Contract not deployed to mainnet');
    console.log('  Check testnet deployment for details');
  }
}

deployWithFullVerification();
```

---

## Database Migration Examples

### Example 12: Safe Supabase Migration

```typescript
// safe_migration_example.ts
import { SupabaseMigrationManager } from './migrationManager';

async function applySafeMigration() {
  const manager = new SupabaseMigrationManager(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
    './supabase/migrations'
  );

  const migrationFile = '20251113_add_user_roles.sql';

  console.log(`Applying migration: ${migrationFile}\n`);

  // This will:
  // 1. Create full database backup
  // 2. Test migration in dry-run mode
  // 3. Apply migration in transaction
  // 4. Verify migration succeeded
  // 5. Rollback if verification fails

  const result = await manager.applyMigrationSafely(migrationFile);

  if (result.success) {
    console.log('\n✓ Migration applied successfully');
    console.log(`  Migration ID: ${result.migrationId}`);
    console.log(`  Backup ID: ${result.backupId}`);
  } else {
    console.log('\n✗ Migration failed');
    console.log(`  Error: ${result.error}`);
    console.log(`  Backup ID: ${result.backupId}`);
    console.log('  Database restored from backup');
  }
}

applySafeMigration();
```

### Example 13: Migration with Manual Down SQL

```typescript
// migration_with_down_example.ts
async function migrationWithDownSQL() {
  const manager = new SupabaseMigrationManager(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
    './supabase/migrations'
  );

  // Migration file with both up and down SQL
  const migration = {
    id: '20251113_add_status_column',
    name: 'Add status column to users',
    upSql: `
      ALTER TABLE users
      ADD COLUMN status TEXT DEFAULT 'active'
      CHECK (status IN ('active', 'inactive', 'suspended'));

      CREATE INDEX idx_users_status ON users(status);
    `,
    downSql: `
      DROP INDEX IF EXISTS idx_users_status;

      ALTER TABLE users
      DROP COLUMN status;
    `,
    timestamp: new Date()
  };

  console.log('Applying migration with down SQL...\n');

  const result = await manager.applyMigrationSafely(migration);

  if (!result.success) {
    console.log('\nMigration failed, attempting rollback with down SQL...');

    const rollbackSuccess = await manager.rollbackMigration(
      migration,
      result.backupId!
    );

    if (rollbackSuccess) {
      console.log('✓ Rolled back using down SQL');
    } else {
      console.log('✓ Rolled back using backup restore');
    }
  }
}

migrationWithDownSQL();
```

### Example 14: Automated Down Migration Generation

```typescript
// auto_down_migration_example.ts
async function generateDownMigrationAutomatically() {
  const manager = new SupabaseMigrationManager(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
    './supabase/migrations'
  );

  const upSql = `
    ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
    CREATE INDEX idx_email_verified ON users(email_verified);
  `;

  console.log('Generating down migration automatically...\n');

  // This will:
  // 1. Capture current schema
  // 2. Apply up migration to test DB
  // 3. Capture new schema
  // 4. Generate reverse operations

  const downSql = await manager.generateDownMigration(upSql);

  console.log('Generated down SQL:');
  console.log(downSql);
  // Output:
  // DROP INDEX IF EXISTS idx_email_verified;
  // ALTER TABLE users DROP COLUMN email_verified;

  // Save as migration file
  const migration = {
    id: '20251113_auto_generated',
    name: 'Auto-generated migration',
    upSql,
    downSql,
    timestamp: new Date()
  };

  // Now apply with confidence, knowing down migration is available
  const result = await manager.applyMigrationSafely(migration);

  console.log(`\nMigration result: ${result.success ? '✓' : '✗'}`);
}

generateDownMigrationAutomatically();
```

---

## Integration Examples

### Example 15: Complete End-to-End Fix with All Safety Measures

```python
# complete_integration_example.py
from automated_debugging_system import AutomatedDebuggingSystem

async def complete_fix_workflow():
    """
    Complete workflow demonstrating all safety features.
    """

    print("="*70)
    print("COMPLETE FIX WORKFLOW - All Safety Features Enabled")
    print("="*70)

    # Initialize system
    config = {
        'repo_path': '/path/to/web3-project',
        'dry_run': True,
        'confirmation_level': 'detailed',
        'rollback_strategy': 'checkpoint',
        'enable_snapshots': True,
        'enable_git_commits': True,
        'run_security_scans': True
    }

    system = AutomatedDebuggingSystem(config)

    # Define issues to fix
    issues = [
        {
            'id': 'SEC-001',
            'type': 'security_vulnerability',
            'file': 'contracts/Token.sol',
            'severity': 'high',
            'description': 'Reentrancy vulnerability in withdraw function',
            'fix_type': 'add_reentrancy_guard'
        },
        {
            'id': 'BUG-002',
            'type': 'logic_error',
            'file': 'src/api/auth.ts',
            'severity': 'medium',
            'description': 'JWT token not properly validated',
            'fix_type': 'add_token_validation'
        },
        {
            'id': 'TYPE-003',
            'type': 'type_error',
            'file': 'src/utils/helper.ts',
            'severity': 'low',
            'description': 'Type mismatch in helper function',
            'fix_type': 'fix_type_annotation'
        }
    ]

    # PHASE 1: Dry Run
    print("\n" + "="*70)
    print("PHASE 1: DRY RUN")
    print("="*70 + "\n")

    dry_run_result = await system.apply_fixes(issues)

    if not dry_run_result.get('success'):
        print("✗ Dry run failed, aborting")
        return

    print("✓ Dry run successful")
    print(f"  Actions to perform: {len(issues)}")

    # PHASE 2: Review Changes
    print("\n" + "="*70)
    print("PHASE 2: CHANGE REVIEW")
    print("="*70 + "\n")

    # Show diffs for each change
    for issue in issues:
        print(f"\nIssue: {issue['id']} - {issue['description']}")
        print(f"Severity: {issue['severity']}")
        print(f"File: {issue['file']}")
        # Show diff...

    # PHASE 3: Get Approval
    proceed = input("\nProceed with applying fixes? (yes/no): ")

    if proceed.lower() != 'yes':
        print("Aborted by user")
        return

    # PHASE 4: Apply Fixes with All Safety Features
    print("\n" + "="*70)
    print("PHASE 4: APPLYING FIXES")
    print("="*70 + "\n")

    config['dry_run'] = False
    system = AutomatedDebuggingSystem(config)

    result = await system.apply_fixes(issues, strategy='checkpoint')

    # PHASE 5: Results
    print("\n" + "="*70)
    print("PHASE 5: RESULTS")
    print("="*70 + "\n")

    if result['success']:
        print("✓ ALL FIXES APPLIED SUCCESSFULLY")
        print(f"\n  Session ID: {result['session_id']}")
        print(f"  Branch: {result['branch_name']}")
        print(f"  Total fixes: {result['execution']['total']}")
        print(f"  Successful: {len(result['execution']['successful'])}")
        print(f"  Tests run: {result['verification']['tests_run']}")
        print(f"  Tests passed: {result['verification']['tests_passed']}")

        print("\nNext steps:")
        print("  1. Review the changes in the branch")
        print("  2. Run additional manual tests if needed")
        print("  3. Merge to main when satisfied")

    else:
        print("✗ FIXES FAILED OR DID NOT PASS VERIFICATION")
        print(f"\n  Phase failed: {result['phase']}")
        print(f"  Successful: {len(result['execution']['successful'])}")
        print(f"  Failed: {len(result['execution']['failed'])}")

        if result['execution']['failed']:
            print("\nFailed fixes:")
            for failed_id in result['execution']['failed']:
                print(f"  - {failed_id}")

        print("\n✓ All changes were rolled back")
        print("  Repository is in original state")

    print("\n" + "="*70)

# Run the complete workflow
asyncio.run(complete_fix_workflow())
```

### Example 16: Resume from Partial Failure

```python
# resume_from_failure_example.py
async def resume_after_failure():
    """
    Resume fix application after a partial failure.
    """

    config = {
        'repo_path': '/path/to/project',
        'dry_run': False
    }

    system = AutomatedDebuggingSystem(config)

    # Check if there's a previous session to resume
    progress = system.progress_tracker.get_progress('session_20251113_123456')

    if progress and system.progress_tracker.can_resume('session_20251113_123456'):
        print("Found incomplete session, resuming...\n")

        print(f"Completed steps: {len(progress['completed_steps'])}")
        for step in progress['completed_steps']:
            print(f"  ✓ {step}")

        print(f"\nPending steps: {len(progress['pending_steps'])}")
        for step in progress['pending_steps']:
            print(f"  ⏸ {step}")

        resume_choice = input("\nResume from where it left off? (yes/no): ")

        if resume_choice.lower() == 'yes':
            # Resume from the failed operation
            result = await system.partial_handler.resume_from_failure(
                failed_operation_id=progress['pending_steps'][0],
                retry=True  # Retry the failed operation
            )

            if result['final_status'] == 'success':
                print("\n✓ Successfully resumed and completed all fixes")
            else:
                print("\n✗ Still have failures")
                print(f"  Successful: {len(result['successful'])}")
                print(f"  Failed: {len(result['failed'])}")
    else:
        print("No incomplete sessions found")

asyncio.run(resume_after_failure())
```

---

## Best Practices Summary

### When to Use Each Strategy

| Scenario | Recommended Strategy | Reason |
|----------|---------------------|--------|
| Single fix | all_or_nothing + git | Simple, clean history |
| Multiple related fixes | all_or_nothing + git | Atomic change set |
| Multiple independent fixes | best_effort + checkpoints | Max success rate |
| Experimental fixes | snapshots only | Fast iteration |
| Critical production fixes | git + snapshots + manual approval | Maximum safety |
| Smart contract deployment | testnet-first + upgrade pattern | Immutability |
| Database migrations | backup + dry-run + down SQL | Data safety |
| Large refactoring | checkpoints + git branches | Progressive commits |

### Safety Checklist

```python
# safety_checklist.py
class SafetyChecklist:
    """Checklist before applying fixes."""

    @staticmethod
    def check_before_applying(context: Dict) -> List[str]:
        """Return list of warnings/blockers."""

        warnings = []

        # 1. Check if changes are backed up
        if not context.get('git_commit_created'):
            warnings.append("⚠ No git commit created")

        if not context.get('snapshot_created'):
            warnings.append("⚠ No snapshot created")

        # 2. Check if tests will be run
        if not context.get('tests_will_run'):
            warnings.append("⚠ No tests configured")

        # 3. Check if dry-run was performed
        if not context.get('dry_run_performed'):
            warnings.append("⛔ BLOCKER: Dry-run not performed")

        # 4. Check if affects critical files
        critical_patterns = ['contract', 'migration', 'auth', 'payment']
        files = context.get('files_affected', [])

        for file in files:
            if any(p in file.lower() for p in critical_patterns):
                if not context.get('manual_approval'):
                    warnings.append(f"⛔ BLOCKER: Critical file {file} requires manual approval")

        # 5. Check if rollback is possible
        if not context.get('rollback_prepared'):
            warnings.append("⛔ BLOCKER: No rollback mechanism prepared")

        return warnings
```

---

## Conclusion

These examples demonstrate practical implementations of:

1. **Git-based rollback** - Branches, commits, tags, and recovery
2. **Snapshot-based rollback** - Fast file-level backup and restore
3. **Smart contract safety** - Testnet-first, upgradeable patterns
4. **Database migration safety** - Backup, dry-run, down migrations
5. **Partial success handling** - Checkpoints, resume capability
6. **Complete integration** - All safety features working together

Copy and adapt these examples to your specific use case!
