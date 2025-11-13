# Rollback Quick Reference Cheat Sheet
## Fast Lookup for Common Operations

**Last Updated:** 2025-11-13

---

## Quick Command Reference

### Git Rollback Commands

```bash
# Create pre-fix commit
git add <files>
git commit -m "[AUTOFIX] Pre-fix snapshot - <issue-id>"

# Create fix branch
git checkout -b autofix/test/<issue-id>_$(date +%Y%m%d_%H%M%S)

# Soft rollback (keep changes in working directory)
git reset --soft <commit-hash>

# Hard rollback (discard all changes)
git reset --hard <commit-hash>

# Revert (safe for shared branches)
git revert --no-commit <commit-hash>..HEAD
git commit -m "Revert to <commit-hash>"

# Create recovery tag
git tag -a recovery/<name>_$(date +%Y%m%d_%H%M%S) -m "Recovery point"

# Rollback single file
git checkout <commit-hash> -- <file-path>
```

### Python Quick Commands

```python
# Import system
from automated_debugging_system import AutomatedDebuggingSystem

# Quick fix with all safety features
config = {'repo_path': '.', 'dry_run': True}
system = AutomatedDebuggingSystem(config)
result = await system.apply_fixes(issues, strategy='checkpoint')

# Create snapshot
from snapshot_manager import SnapshotManager
mgr = SnapshotManager()
mgr.create_snapshot(files=['file.py'], snapshot_id='snap1', metadata={})

# Restore snapshot
mgr.restore_snapshot('snap1', verify_hash=True)

# Git rollback
from git_rollback_manager import GitRollbackManager, RollbackStrategy
git = GitRollbackManager('.')
git.rollback_to_commit('abc123', strategy=RollbackStrategy.HARD)

# Calculate risk
from rollback_decision_guide import calculate_risk_score
score = calculate_risk_score(context)
```

### TypeScript Quick Commands

```typescript
// Smart contract deployment
import { SmartContractDeploymentManager } from './deploymentManager';
const mgr = new SmartContractDeploymentManager();

// Deploy with testnet-first
await mgr.deployWithTestnetFirst(config);

// Deploy upgradeable
await mgr.deployUpgradeable(config);

// Rollback upgrade
await mgr.rollbackUpgrade(proxyAddress);

// Database migration
import { SupabaseMigrationManager } from './migrationManager';
const dbMgr = new SupabaseMigrationManager(url, key, './migrations');

// Safe migration
await dbMgr.applyMigrationSafely('migration.sql');

// Rollback migration
await dbMgr.rollbackMigration(migration, backupId);
```

---

## Strategy Quick Selection

```
┌─────────────────────────────────────────────────────────┐
│  Scenario                →  Strategy                    │
├─────────────────────────────────────────────────────────┤
│  Single fix              →  all_or_nothing + git        │
│  Related fixes           →  all_or_nothing + squash     │
│  Independent fixes       →  best_effort                 │
│  Large batch             →  checkpoint                  │
│  Experimentation         →  snapshots only              │
│  Critical production     →  both + manual approval      │
│  Smart contract          →  testnet-first               │
│  Database migration      →  backup + dry-run + down SQL │
└─────────────────────────────────────────────────────────┘
```

---

## Risk Score Quick Calculator

```python
# Quick manual calculation
score = 0

# File criticality
score += 30 if 'contract|migration|auth|payment' in files else 0
score += 15 if 'api|database|config' in files else 0
score += 5 if 'service|component' in files else 0

# Number of files
score += 20 if num_files > 20 else 0
score += 10 if num_files > 10 else 0
score += 5 if num_files > 5 else 0

# Environment
score += 25 if environment == 'production' else 0
score += 10 if environment == 'staging' else 0

# Change type
scores = {'security_fix': 20, 'breaking_change': 15, 'refactor': 10}
score += scores.get(change_type, 5)

# No tests?
score += 15 if not has_tests else 0

# Result
# 0-39:  Low risk    → Simple safety
# 40-59: Medium risk → Standard safety
# 60-79: High risk   → Enhanced safety
# 80+:   Critical    → Maximum safety
```

---

## Safety Levels by Risk Score

| Score | Level | Git | Snapshots | Strategy | Verification | Approval |
|-------|-------|-----|-----------|----------|--------------|----------|
| 0-39  | Low | ✓ | | best_effort | static, unit | automatic |
| 40-59 | Medium | ✓ | | checkpoint | + integration | simple |
| 60-79 | High | ✓ | ✓ | checkpoint | + e2e | detailed |
| 80-100 | Critical | ✓ | ✓ | all_or_nothing | + security | interactive |

---

## Common Workflows

### Workflow 1: Simple Fix

```python
# 1. Create backup
commit = git.create_pre_fix_commit('issue-123', files, {})

# 2. Dry-run
config['dry_run'] = True
result = await system.apply_fixes(issues)

# 3. Apply if successful
if result['success']:
    config['dry_run'] = False
    result = await system.apply_fixes(issues)

# 4. Rollback if failed
if not result['success']:
    git.rollback_to_commit(commit, RollbackStrategy.HARD)
```

### Workflow 2: Critical Fix

```python
# 1. Create branch
branch = git.create_fix_branch('critical-001', 'main', 'test')

# 2. Create both backups
commit = git.create_pre_fix_commit('critical-001', files, {})
snapshot = mgr.create_snapshot(files, 'critical-001', {})

# 3. Dry-run
dry_result = await system.apply_fixes(issues)

# 4. Review and approve
if review_approved(dry_result):
    # 5. Apply
    result = await system.apply_fixes(issues, dry_run=False)

    # 6. Verify extensively
    verified = await verifier.verify_fix(context, ['unit', 'integration', 'security'])

    if verified.success:
        # Success - merge to main
        git.merge_verified_fix(branch, 'main', squash=True)
    else:
        # Failed - rollback
        mgr.restore_snapshot('critical-001')
```

### Workflow 3: Multiple Independent Fixes

```python
# 1. Create checkpoint-based workflow
result = await system.apply_fixes(
    issues,
    strategy='best_effort'  # or 'checkpoint'
)

# 2. Review results
print(f"Successful: {len(result['execution']['successful'])}")
print(f"Failed: {len(result['execution']['failed'])}")

# 3. Resume failed ones if needed
if result['execution']['failed']:
    await system.resume_from_failure(
        failed_operation_id=result['execution']['failed'][0],
        retry=True
    )
```

### Workflow 4: Smart Contract Deployment

```typescript
// 1. Deploy with testnet-first
const result = await manager.deployWithTestnetFirst({
  network: 'mainnet',
  contractName: 'MyContract',
  constructorArgs: [...],
  verify: true
});

// If deployment succeeded
if (result) {
  console.log(`Deployed to: ${result.address}`);

  // 2. Monitor for issues
  await monitorContract(result.address, 24); // 24 hours

  // 3. If issues, deploy fix via upgrade
  if (hasIssues) {
    await manager.upgradeContract(result.address, 'MyContractV2');

    // 4. If V2 has issues, rollback
    if (v2HasIssues) {
      await manager.rollbackUpgrade(result.address);
    }
  }
}
```

### Workflow 5: Database Migration

```typescript
// 1. Create backup
console.log('Creating backup...');
// Automatic in applyMigrationSafely

// 2. Apply with safety
const result = await migrationManager.applyMigrationSafely(
  'migration_file.sql'
);

if (result.success) {
  console.log('Migration successful');
} else {
  console.log('Migration failed and rolled back');
  console.log(`Backup ID: ${result.backupId}`);
}

// 3. Manual rollback if needed later
if (needsRollback) {
  await migrationManager.restoreBackup(backupId);
}
```

---

## Error Handling Patterns

### Pattern 1: Try-Rollback

```python
snapshot_id = mgr.create_snapshot(files, 'attempt1', {})

try:
    result = apply_fix()
    if not result['success']:
        mgr.restore_snapshot(snapshot_id)
except Exception as e:
    print(f"Error: {e}")
    mgr.restore_snapshot(snapshot_id)
finally:
    mgr.cleanup_snapshot(snapshot_id)
```

### Pattern 2: Checkpoint Chain

```python
checkpoints = []

for i, fix in enumerate(fixes):
    # Create checkpoint
    checkpoint_id = f"checkpoint_{i}"
    mgr.create_snapshot(fix['files'], checkpoint_id, {})
    checkpoints.append(checkpoint_id)

    try:
        apply_fix(fix)
    except Exception:
        # Rollback to last checkpoint
        mgr.restore_snapshot(checkpoint_id)
        break

# Cleanup checkpoints
for cp in checkpoints:
    mgr.cleanup_snapshot(cp)
```

### Pattern 3: Verification Guard

```python
commit = git.create_pre_fix_commit(issue_id, files, {})

try:
    # Apply fix
    apply_fix()

    # Verify
    verified = await verifier.verify_fix(context)

    if not verified.success:
        raise Exception(f"Verification failed: {verified.errors}")

    # Commit if verified
    git.create_post_fix_commit(issue_id, description, verified)

except Exception as e:
    # Rollback on any failure
    git.rollback_to_commit(commit, RollbackStrategy.HARD)
    raise
```

---

## Configuration Templates

### Template: Development

```yaml
development:
  repo_path: "."
  dry_run: false
  rollback:
    mechanism: snapshots
    strategy: continue_on_error
  verification:
    levels: [static]
  confirmation: none
```

### Template: Production

```yaml
production:
  repo_path: "."
  dry_run: true
  rollback:
    mechanism: both
    git: true
    snapshots: true
    strategy: checkpoint
  verification:
    levels: [static, unit, integration, security]
  confirmation: interactive
  manual_approval: true
```

### Template: Smart Contract

```yaml
smart_contract:
  dry_run: true
  testnet_first: true
  networks:
    test: sepolia
    prod: mainnet
  rollback:
    mechanism: git
    strategy: all_or_nothing
  verification:
    levels: [slither, mythril, tests, gas_analysis]
  deployment:
    proxy_type: transparent
    verify_etherscan: true
  confirmation: interactive
```

---

## Troubleshooting Guide

### Issue: Rollback Failed

```python
# Try alternative rollback methods
try:
    # Method 1: Snapshot
    mgr.restore_snapshot(snapshot_id)
except:
    try:
        # Method 2: Git
        git.rollback_to_commit(commit_hash, RollbackStrategy.HARD)
    except:
        # Method 3: Manual
        print(f"Manual intervention required")
        print(f"  Snapshot: {snapshot_id}")
        print(f"  Commit: {commit_hash}")
        print(f"  Files: {files}")
```

### Issue: Partial Success Unknown State

```python
# Get change log
changes = system.partial_handler.get_change_summary()
print(changes)

# Resume from last known good state
progress = system.progress_tracker.get_progress(session_id)

# Option 1: Continue from where it left off
await system.resume_from_failure(failed_op_id, retry=True)

# Option 2: Rollback everything
git.rollback_to_commit(commit_hash, RollbackStrategy.HARD)
```

### Issue: Cascading Failures

```python
# Check verification results
if verification.cascading_failures:
    print("Cascading failures detected:")
    for failure in verification.cascading_failures:
        print(f"  - {failure}")

    # Immediate rollback required
    print("Rolling back all changes...")
    git.rollback_to_commit(pre_fix_commit, RollbackStrategy.HARD)

    # Investigate why unrelated tests failed
    investigate_cascading_failures(verification.cascading_failures)
```

### Issue: Database Migration Stuck

```typescript
// If migration is running too long
// Option 1: Wait for timeout (default 5 minutes)

// Option 2: Manual intervention
// 1. Check migration status
SELECT * FROM schema_migrations WHERE migration_id = '<id>';

// 2. If stuck, rollback transaction manually
ROLLBACK;

// 3. Restore from backup
await migrationManager.restoreBackup(backupId);
```

---

## Performance Tips

### Tip 1: Use Snapshots for Iterations

```python
# SLOW (multiple git operations)
for attempt in attempts:
    commit = git.create_pre_fix_commit(...)
    try_fix(attempt)
    git.rollback_to_commit(commit, ...)

# FAST (snapshot operations)
for attempt in attempts:
    mgr.create_snapshot(files, f'attempt_{i}', {})
    try_fix(attempt)
    mgr.restore_snapshot(f'attempt_{i}')
```

### Tip 2: Parallelize Independent Verifications

```python
# SLOW (sequential)
static_result = await run_static_analysis()
test_result = await run_tests()
security_result = await run_security_scan()

# FAST (parallel)
results = await asyncio.gather(
    run_static_analysis(),
    run_tests(),
    run_security_scan()
)
```

### Tip 3: Cleanup Old Snapshots

```python
# Automatic cleanup after 7 days
mgr.cleanup_old_snapshots(days=7)

# Manual cleanup
for snapshot_id in mgr.list_snapshots():
    if snapshot_age(snapshot_id) > 7:
        mgr.cleanup_snapshot(snapshot_id)
```

---

## Emergency Commands

### Emergency: Immediate Rollback

```bash
# Git - last commit
git reset --hard HEAD~1

# Git - specific commit
git reset --hard <commit-hash>

# Git - recover after push (use with caution)
git revert HEAD

# File - restore single file
git checkout HEAD -- <file>
```

### Emergency: Restore from Tag

```bash
# List recovery tags
git tag -l "recovery/*"

# Rollback to tag
git reset --hard recovery/<tag-name>
```

### Emergency: Database Restore

```typescript
// Immediate restore from backup
await migrationManager.restoreBackup('<backup-id>');

// Or manual SQL restore
psql -U user -d database < backup.sql
```

### Emergency: Contract Issue

```typescript
// If upgradeable - rollback immediately
await manager.rollbackUpgrade(proxyAddress);

// If not upgradeable - pause contract if possible
const contract = await ethers.getContractAt('MyContract', address);
await contract.pause();  // If pausable

// Deploy new version with fix
await manager.deployWithTestnetFirst(fixedConfig);
```

---

## Checklist Before Applying Fixes

```
□ Dry-run completed successfully
□ Backup created (git commit or snapshot)
□ Tests are passing
□ Rollback mechanism tested
□ Change impact assessed
□ Risk score calculated
□ Appropriate strategy selected
□ Verification configured
□ Approval obtained (if required)
□ Monitoring plan ready

If ALL checked → Proceed
If ANY unchecked → STOP and address
```

---

## One-Liners

### Python One-Liners

```python
# Quick dry-run
await AutomatedDebuggingSystem({'repo_path': '.', 'dry_run': True}).apply_fixes(issues)

# Quick snapshot & restore
mgr = SnapshotManager(); mgr.create_snapshot(files, 'snap1', {}); mgr.restore_snapshot('snap1')

# Quick risk assessment
print(f"Risk: {calculate_risk_score(context)}")

# Quick verification
print(await FixVerifier('.').verify_fix(context, ['unit']))
```

### Bash One-Liners

```bash
# Create recovery point
git tag -a recovery/$(date +%s) -m "Recovery point" && git push --tags

# Quick rollback last commit
git reset --hard HEAD~1

# Rollback specific file
git checkout HEAD~1 -- <file>

# List all autofix branches
git branch -a | grep autofix
```

---

## Resources

### File Locations
- Main Architecture: `/ERROR_HANDLING_ROLLBACK_ARCHITECTURE.md`
- Examples: `/ROLLBACK_IMPLEMENTATION_EXAMPLES.md`
- Decision Guide: `/ROLLBACK_DECISION_GUIDE.md`
- This Reference: `/ROLLBACK_QUICK_REFERENCE.md`

### Key Classes
- `AutomatedDebuggingSystem` - Main orchestrator
- `GitRollbackManager` - Git operations
- `SnapshotManager` - File snapshots
- `FixVerifier` - Verification engine
- `PartialSuccessHandler` - Partial success logic
- `SmartContractDeploymentManager` - Contract deployment
- `SupabaseMigrationManager` - Database migrations

### Configuration
- Config file: `autofix-config.yaml`
- State file: `.autofix_state.json`
- Snapshots dir: `.autofix_snapshots/`
- Metadata file: `.autofix_metadata_*.json`

---

## Quick Help

```
Usage: system.apply_fixes(issues, strategy=?)

Strategies:
  - all_or_nothing    Rollback all if any fails
  - best_effort       Keep successful, rollback failed
  - checkpoint        Rollback to last checkpoint
  - continue_on_error Continue despite failures

Options:
  dry_run: bool            Run without making changes
  confirmation: str        none|automatic|simple|detailed|interactive
  verification: list       Tests to run
  manual_approval: bool    Require manual approval

Examples:
  # Safe default
  await system.apply_fixes(issues, strategy='checkpoint')

  # Maximum throughput
  await system.apply_fixes(issues, strategy='best_effort')

  # Maximum safety
  await system.apply_fixes(issues, strategy='all_or_nothing', dry_run=True)
```

---

**Remember:** When in doubt, add more safety. Better safe than sorry!
