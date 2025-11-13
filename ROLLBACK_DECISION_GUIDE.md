# Rollback Strategy Decision Guide
## Choose the Right Strategy for Your Situation

**Last Updated:** 2025-11-13

---

## Quick Decision Tree

```
START: Need to apply a fix?
│
├─ Is this a dry-run/exploration?
│  └─ YES → Use SNAPSHOTS ONLY (fast, temporary)
│
├─ Is this a single, simple fix?
│  └─ YES → Use GIT + ALL_OR_NOTHING
│
├─ Are these related fixes that must succeed together?
│  └─ YES → Use GIT + ALL_OR_NOTHING + SQUASH COMMITS
│
├─ Are these independent fixes?
│  └─ YES → Use GIT + BEST_EFFORT or CHECKPOINTS
│
├─ Is this a smart contract deployment?
│  └─ YES → Use TESTNET-FIRST + UPGRADE PATTERN
│
├─ Is this a database migration?
│  └─ YES → Use BACKUP + DRY-RUN + DOWN MIGRATION
│
├─ Is this a critical production fix?
│  └─ YES → Use ALL SAFETY FEATURES + MANUAL APPROVAL
│
└─ Default: Use CHECKPOINTS + GIT + SNAPSHOTS
```

---

## Detailed Decision Matrices

### Matrix 1: Rollback Mechanism Selection

| Your Situation | Git | Snapshots | Both | Why |
|----------------|-----|-----------|------|-----|
| Need permanent history | ✓ | | | Team collaboration, audit trail |
| Quick iteration/debugging | | ✓ | | Speed, no history pollution |
| Production fix | | | ✓ | Maximum safety |
| Experimental changes | | ✓ | | Fast rollback, cleanup |
| Multi-step refactoring | ✓ | | | Commit granularity |
| Critical path changes | | | ✓ | Belt and suspenders |
| Shared branch work | ✓ | | | Team visibility |
| Local debugging | | ✓ | | Speed, privacy |

### Matrix 2: Execution Strategy Selection

| Number of Fixes | Independence | Risk Level | Strategy | Why |
|----------------|--------------|------------|----------|-----|
| 1 | N/A | Any | all_or_nothing | Simple, atomic |
| 2-5 | Related | Low-Medium | all_or_nothing | Keep related changes together |
| 2-5 | Related | High | all_or_nothing + manual | Safety for critical |
| 2-5 | Independent | Any | best_effort | Maximize successes |
| 6-20 | Mixed | Any | checkpoint | Balance safety/progress |
| 20+ | Independent | Low | best_effort | Optimize throughput |
| 20+ | Independent | High | checkpoint | Safety first |
| Any | Dependent | Any | all_or_nothing | Dependencies must succeed together |

### Matrix 3: Verification Level Selection

| Change Type | Auto Tests | Manual Review | Security Scan | Strategy |
|-------------|-----------|---------------|---------------|----------|
| Syntax fix | ✓ | | | automated |
| Logic fix | ✓ | | | automated + review if critical |
| Security fix | ✓ | ✓ | ✓ | all required |
| Contract code | ✓ | ✓ | ✓ | all required + testnet |
| Database schema | ✓ | ✓ | | required |
| Config change | ✓ | ✓ | | required |
| Auth/Payment | ✓ | ✓ | ✓ | all required + staging |
| Test code | ✓ | | | automated |
| Documentation | | ✓ | | manual review |

---

## Scenario-Based Recommendations

### Scenario 1: Fixing Multiple TypeScript Type Errors

**Context:**
- 15 type errors across different files
- Non-critical code (utility functions)
- No dependencies between fixes
- Development environment

**Recommendation:**
```yaml
rollback_mechanism: git
execution_strategy: best_effort
verification:
  - typescript_check
  - unit_tests
  - build_check
confirmation: simple
dry_run: true
```

**Reasoning:**
- Best_effort allows maximum fixes to succeed
- Git provides good enough history
- Simple confirmation for low-risk changes
- Automated verification sufficient

**Command:**
```python
result = await system.apply_fixes(
    issues=type_errors,
    strategy='best_effort'
)
```

---

### Scenario 2: Fixing Critical Smart Contract Vulnerability

**Context:**
- 1 critical security vulnerability
- Reentrancy in withdraw function
- Production contract
- High stakes

**Recommendation:**
```yaml
rollback_mechanism: both_git_and_snapshots
execution_strategy: all_or_nothing
verification:
  - slither_scan
  - mythril_scan
  - unit_tests
  - integration_tests
  - testnet_deployment
  - 24h_monitoring
confirmation: interactive
dry_run: true
deployment: testnet_first
```

**Reasoning:**
- Maximum safety for high-stakes changes
- Testnet validation required
- Interactive approval for critical code
- Multiple verification layers

**Command:**
```typescript
const result = await manager.deployWithTestnetFirst({
  network: 'mainnet',
  contractName: 'TokenV2Fixed',
  proxyType: 'transparent',
  verify: true
});
```

---

### Scenario 3: Large Refactoring Across Multiple Modules

**Context:**
- Refactoring auth system
- 50+ files affected
- Related but independently testable changes
- Need progressive commits

**Recommendation:**
```yaml
rollback_mechanism: git
execution_strategy: checkpoint
checkpoint_interval: 5
verification:
  - unit_tests
  - integration_tests
  - e2e_tests
confirmation: detailed
dry_run: true
branch_strategy: feature_branch
```

**Reasoning:**
- Checkpoints provide progressive safety
- Git for proper history and team collaboration
- Feature branch keeps main clean
- Detailed confirmation for large changes

**Command:**
```python
result = await system.apply_fixes(
    issues=refactoring_tasks,
    strategy='checkpoint'
)

# Then merge to main if successful
git_manager.merge_verified_fix(
    fix_branch=result['branch_name'],
    target_branch='main',
    squash=True
)
```

---

### Scenario 4: Database Schema Migration

**Context:**
- Adding new columns
- Modifying indexes
- Production database
- Cannot afford data loss

**Recommendation:**
```yaml
rollback_mechanism: database_backup
execution_strategy: transaction
verification:
  - dry_run_test
  - data_integrity_check
  - performance_test
confirmation: detailed
backup: full_database
down_migration: required
```

**Reasoning:**
- Database backup is critical
- Transaction ensures atomicity
- Down migration provides rollback path
- Detailed verification prevents data corruption

**Command:**
```typescript
const result = await migrationManager.applyMigrationSafely(
  '20251113_add_user_roles.sql'
);

if (!result.success) {
  // Automatic rollback using down migration or backup
  await migrationManager.rollbackMigration(
    migration,
    result.backupId
  );
}
```

---

### Scenario 5: Experimental Feature Development

**Context:**
- Trying different approaches
- Rapid iteration needed
- Not ready for team review
- Local development

**Recommendation:**
```yaml
rollback_mechanism: snapshots
execution_strategy: continue_on_error
verification:
  - basic_syntax_check
confirmation: none
dry_run: false
cleanup: auto
```

**Reasoning:**
- Snapshots are fastest for iteration
- No need for git history (yet)
- Minimal verification for experimentation
- Auto-cleanup keeps workspace clean

**Command:**
```python
snapshot_mgr = SnapshotManager()

# Create snapshot before each attempt
snapshot_id = f"attempt_{i}"
snapshot_mgr.create_snapshot(files, snapshot_id, {})

# Try approach
try_approach_n()

# If doesn't work, restore and try again
if not works:
    snapshot_mgr.restore_snapshot(snapshot_id)
```

---

## Risk Assessment Guide

### Calculate Risk Score

```python
def calculate_risk_score(context: Dict) -> int:
    """
    Calculate risk score (0-100).
    Higher score = higher risk = more safety measures needed.
    """

    score = 0

    # File criticality
    critical_patterns = ['contract', 'migration', 'auth', 'payment', 'security']
    high_patterns = ['api', 'database', 'config']
    medium_patterns = ['service', 'component']

    for file in context['files']:
        file_lower = file.lower()
        if any(p in file_lower for p in critical_patterns):
            score += 30
        elif any(p in file_lower for p in high_patterns):
            score += 15
        elif any(p in file_lower for p in medium_patterns):
            score += 5

    # Change scope
    num_files = len(context['files'])
    if num_files > 20:
        score += 20
    elif num_files > 10:
        score += 10
    elif num_files > 5:
        score += 5

    # Environment
    if context['environment'] == 'production':
        score += 25
    elif context['environment'] == 'staging':
        score += 10

    # Change type
    change_type_risk = {
        'security_fix': 20,
        'breaking_change': 15,
        'refactor': 10,
        'feature': 5,
        'bugfix': 5,
        'style': 0
    }
    score += change_type_risk.get(context['change_type'], 5)

    # Has tests?
    if not context.get('has_tests'):
        score += 15

    return min(score, 100)  # Cap at 100


def get_safety_measures_for_risk(risk_score: int) -> Dict:
    """
    Return recommended safety measures based on risk score.
    """

    if risk_score >= 80:
        return {
            'rollback': 'both',
            'strategy': 'all_or_nothing',
            'confirmation': 'interactive',
            'verification': ['static', 'unit', 'integration', 'e2e', 'security'],
            'dry_run': True,
            'manual_approval': True,
            'testnet_first': True,  # if contract
            'backup': True  # if database
        }

    elif risk_score >= 60:
        return {
            'rollback': 'git',
            'strategy': 'checkpoint',
            'confirmation': 'detailed',
            'verification': ['static', 'unit', 'integration'],
            'dry_run': True,
            'manual_approval': True,
            'testnet_first': False,
            'backup': True
        }

    elif risk_score >= 40:
        return {
            'rollback': 'git',
            'strategy': 'best_effort',
            'confirmation': 'simple',
            'verification': ['static', 'unit'],
            'dry_run': True,
            'manual_approval': False,
            'testnet_first': False,
            'backup': False
        }

    else:
        return {
            'rollback': 'snapshots',
            'strategy': 'continue_on_error',
            'confirmation': 'automatic',
            'verification': ['static'],
            'dry_run': True,
            'manual_approval': False,
            'testnet_first': False,
            'backup': False
        }
```

### Usage Example

```python
# Assess risk for a change
context = {
    'files': [
        'contracts/Token.sol',
        'contracts/Vault.sol'
    ],
    'environment': 'production',
    'change_type': 'security_fix',
    'has_tests': True
}

risk_score = calculate_risk_score(context)
print(f"Risk Score: {risk_score}/100")

measures = get_safety_measures_for_risk(risk_score)
print("\nRecommended Safety Measures:")
for key, value in measures.items():
    print(f"  {key}: {value}")

# Output:
# Risk Score: 95/100
#
# Recommended Safety Measures:
#   rollback: both
#   strategy: all_or_nothing
#   confirmation: interactive
#   verification: ['static', 'unit', 'integration', 'e2e', 'security']
#   dry_run: True
#   manual_approval: True
#   testnet_first: True
#   backup: True
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Skipping Dry-Run

**Problem:** Applying changes directly without testing

**Solution:**
```python
# WRONG
config['dry_run'] = False
result = await system.apply_fixes(issues)

# RIGHT
# 1. Dry-run first
config['dry_run'] = True
dry_result = await system.apply_fixes(issues)

# 2. Review results
if dry_result['success']:
    # 3. Then apply for real
    config['dry_run'] = False
    result = await system.apply_fixes(issues)
```

### Pitfall 2: No Rollback Prepared

**Problem:** Applying changes without backup

**Solution:**
```python
# WRONG
apply_fix()  # No backup!

# RIGHT
# 1. Create backups first
commit_hash = git_manager.create_pre_fix_commit(...)
snapshot_id = snapshot_mgr.create_snapshot(...)

# 2. Apply fix
result = apply_fix()

# 3. Rollback if needed
if not result['success']:
    snapshot_mgr.restore_snapshot(snapshot_id)
```

### Pitfall 3: Ignoring Verification Results

**Problem:** Proceeding despite test failures

**Solution:**
```python
# WRONG
result = await verifier.verify_fix(context)
if result.tests_passed < result.tests_run:
    print("Some tests failed but continuing anyway...")  # BAD!

# RIGHT
result = await verifier.verify_fix(context)
if not result.success:
    print("Tests failed, rolling back...")
    await perform_rollback()
    return False
```

### Pitfall 4: Using Hard Reset on Shared Branches

**Problem:** Using git reset --hard on shared branches

**Solution:**
```python
# WRONG (if branch is shared)
git_manager.rollback_to_commit(
    commit_hash,
    strategy=RollbackStrategy.HARD  # Destructive!
)

# RIGHT (for shared branches)
git_manager.rollback_to_commit(
    commit_hash,
    strategy=RollbackStrategy.REVERT  # Creates new commit
)
```

### Pitfall 5: No Partial Success Handling

**Problem:** All-or-nothing when fixes are independent

**Solution:**
```python
# SUBOPTIMAL (loses successful fixes)
result = await system.apply_fixes(issues, strategy='all_or_nothing')
# If one fails, all are rolled back

# BETTER (keeps successful fixes)
result = await system.apply_fixes(issues, strategy='best_effort')
# Each fix is independent, keep the successes
```

---

## Strategy Comparison Table

| Strategy | Best For | Pros | Cons | Recovery Speed |
|----------|----------|------|------|----------------|
| **All-or-Nothing + Git** | Single/related fixes | Clean history, atomic | Lose all on failure | Fast |
| **Best-Effort + Git** | Independent fixes | Max successes | Partial state | Fast |
| **Checkpoint + Git** | Large batches | Progressive safety | Some complexity | Medium |
| **Snapshots Only** | Experimentation | Very fast | No history | Very Fast |
| **Both Git + Snapshots** | Critical fixes | Maximum safety | Overhead | Very Fast |
| **Testnet-First** | Smart contracts | Prevents mainnet issues | Slow process | N/A |
| **Backup + Down SQL** | Database migrations | Data safety | Storage cost | Slow |

---

## When to Escalate to Manual Intervention

Automatically require manual intervention when:

1. **Risk Score > 80**
   ```python
   if calculate_risk_score(context) > 80:
       require_manual_approval = True
   ```

2. **Critical File Patterns**
   ```python
   critical_patterns = ['contracts/', 'migrations/', 'auth', 'payment']
   if any(p in file for file in files for p in critical_patterns):
       require_manual_approval = True
   ```

3. **Cascading Failures Detected**
   ```python
   if len(verification_result.cascading_failures) > 0:
       require_manual_approval = True
       notify_team(verification_result.cascading_failures)
   ```

4. **Test Coverage Degradation**
   ```python
   if new_coverage < old_coverage - 5:  # 5% drop
       require_manual_review = True
   ```

5. **Security Scan Findings**
   ```python
   if security_scan.high_severity_count > 0:
       require_manual_review = True
       block_deployment = True
   ```

---

## Configuration Presets

Pre-configured settings for common scenarios:

### Preset: Development Mode
```yaml
development:
  rollback: snapshots
  strategy: continue_on_error
  confirmation: none
  dry_run: false
  verification: [static]
  cleanup: auto
```

### Preset: Safe Production
```yaml
safe_production:
  rollback: both
  strategy: all_or_nothing
  confirmation: interactive
  dry_run: true
  verification: [static, unit, integration, security]
  manual_approval: true
  backup: true
```

### Preset: Smart Contract
```yaml
smart_contract:
  rollback: git
  strategy: all_or_nothing
  confirmation: interactive
  dry_run: true
  testnet_first: true
  verification: [slither, mythril, tests, gas]
  manual_approval: true
```

### Preset: Database Migration
```yaml
database_migration:
  rollback: backup
  strategy: transaction
  confirmation: detailed
  dry_run: true
  backup: full
  down_migration: required
  verification: [dry_run, integrity, performance]
  manual_approval: true
```

### Usage

```python
# Load preset
config = ConfigLoader.load_preset('safe_production')

# Override specific settings
config['dry_run'] = True

# Apply fixes with preset config
system = AutomatedDebuggingSystem(config)
result = await system.apply_fixes(issues)
```

---

## Final Recommendations

### Default Safe Configuration

When in doubt, use this configuration:

```yaml
default_safe:
  # Rollback
  rollback_mechanism: git  # Primary
  enable_snapshots: true   # Secondary backup
  create_branches: true
  branch_prefix: "autofix"

  # Execution
  strategy: checkpoint
  checkpoint_interval: 3

  # Verification
  verification_levels:
    - static_analysis
    - unit_tests
    - integration_tests
  fail_on_cascading: true

  # Safety
  dry_run: true           # Always start with dry-run
  confirmation: simple     # At least simple confirmation
  manual_approval_for_critical: true

  # Progress
  enable_progress_tracking: true
  enable_resume: true

  # Cleanup
  cleanup_snapshots_after_days: 7
  cleanup_branches_after_merge: true
```

### Golden Rules

1. **Always dry-run first** - No exceptions
2. **Always create backup** - Git or snapshots, preferably both
3. **Always verify** - Run tests after applying fixes
4. **Fail safe** - When in doubt, rollback
5. **Track everything** - Maintain audit trail
6. **Test rollback** - Ensure rollback mechanism works
7. **Monitor after** - Watch for issues after deployment
8. **Document** - Keep clear records of changes

---

## Conclusion

Use this decision guide to:

1. **Assess your situation** - Context, risk, requirements
2. **Calculate risk score** - Determine appropriate safety level
3. **Choose strategy** - Select rollback and execution strategy
4. **Configure system** - Apply recommended settings
5. **Execute safely** - Follow the workflow
6. **Monitor results** - Verify and adjust as needed

**Remember:** When in doubt, err on the side of caution. Better to be slow and safe than fast and broken.
