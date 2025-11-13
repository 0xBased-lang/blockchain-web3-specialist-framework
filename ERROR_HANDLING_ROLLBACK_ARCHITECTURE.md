# Bulletproof Error Handling and Rollback Architecture
## Comprehensive Guide for Automated Debugging Systems

**Last Updated:** 2025-11-13
**Target:** Blockchain/Web3 Automated Debugging Framework

---

## Table of Contents
1. [Git-Based Rollback](#1-git-based-rollback)
2. [Snapshot-Based Rollback](#2-snapshot-based-rollback)
3. [Verification After Fixes](#3-verification-after-fixes)
4. [Smart Contract Specific Strategies](#4-smart-contract-specific-strategies)
5. [Database Migration Rollback](#5-database-migration-rollback)
6. [Partial Success Handling](#6-partial-success-handling)
7. [Safe Fix Application](#7-safe-fix-application)
8. [Complete Architecture Design](#8-complete-architecture-design)
9. [Implementation Recommendations](#9-implementation-recommendations)

---

## 1. Git-Based Rollback

### 1.1 Automatic Commits Before Fixes

**Strategy:** Create atomic commits before each fix attempt with standardized commit messages.

#### Implementation Pattern:

```python
import subprocess
from datetime import datetime
from typing import Optional, Dict, Any
import json

class GitRollbackManager:
    """Manages git-based rollback for automated debugging."""

    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        self.fix_branch_prefix = "autofix"
        self.commit_prefix = "[AUTOFIX]"

    def create_pre_fix_commit(
        self,
        issue_id: str,
        files_affected: list[str],
        metadata: Dict[str, Any]
    ) -> tuple[str, str]:
        """
        Create a commit before applying fixes.

        Returns: (commit_hash, branch_name)
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        branch_name = f"{self.fix_branch_prefix}/{issue_id}_{timestamp}"

        # Stage the specific files
        for file_path in files_affected:
            subprocess.run(['git', 'add', file_path], cwd=self.repo_path, check=True)

        # Create metadata file
        metadata_file = f".autofix_metadata_{issue_id}.json"
        with open(f"{self.repo_path}/{metadata_file}", 'w') as f:
            json.dump({
                'issue_id': issue_id,
                'timestamp': timestamp,
                'files_affected': files_affected,
                'metadata': metadata
            }, f, indent=2)

        subprocess.run(['git', 'add', metadata_file], cwd=self.repo_path, check=True)

        # Create commit
        commit_msg = f"""{self.commit_prefix} Pre-fix snapshot for {issue_id}

Issue ID: {issue_id}
Files: {', '.join(files_affected)}
Timestamp: {timestamp}

This is an automatic commit created before applying fixes.
Metadata stored in: {metadata_file}
"""

        subprocess.run(
            ['git', 'commit', '-m', commit_msg],
            cwd=self.repo_path,
            check=True
        )

        # Get commit hash
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=self.repo_path,
            capture_output=True,
            text=True,
            check=True
        )
        commit_hash = result.stdout.strip()

        return commit_hash, branch_name

    def create_post_fix_commit(
        self,
        issue_id: str,
        fix_description: str,
        test_results: Dict[str, Any]
    ) -> str:
        """Create a commit after applying fixes."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Stage all changes
        subprocess.run(['git', 'add', '-A'], cwd=self.repo_path, check=True)

        test_status = "PASSED" if test_results.get('success') else "FAILED"

        commit_msg = f"""{self.commit_prefix} Applied fix for {issue_id}

Issue ID: {issue_id}
Fix Description: {fix_description}
Test Status: {test_status}
Timestamp: {timestamp}

Test Results:
{json.dumps(test_results, indent=2)}
"""

        subprocess.run(
            ['git', 'commit', '-m', commit_msg],
            cwd=self.repo_path,
            check=True
        )

        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=self.repo_path,
            capture_output=True,
            text=True,
            check=True
        )

        return result.stdout.strip()
```

### 1.2 Creating Branches for Testing Fixes

**Best Practice:** Create isolated feature branches for each fix attempt to avoid contaminating the main codebase.

#### Branch Naming Convention:
```
autofix/<issue-id>_<timestamp>
autofix/<issue-type>/<issue-id>
autofix/test/<issue-id>  # For testing only
autofix/verified/<issue-id>  # For verified fixes
```

#### Implementation:

```python
def create_fix_branch(
    self,
    issue_id: str,
    base_branch: str = "main",
    branch_type: str = "test"
) -> str:
    """
    Create a new branch for testing fixes.

    Args:
        issue_id: Unique identifier for the issue
        base_branch: Branch to create from
        branch_type: Type of fix branch (test/verified)

    Returns:
        Branch name created
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    branch_name = f"{self.fix_branch_prefix}/{branch_type}/{issue_id}_{timestamp}"

    # Ensure we're on the base branch
    subprocess.run(
        ['git', 'checkout', base_branch],
        cwd=self.repo_path,
        check=True
    )

    # Create and checkout new branch
    subprocess.run(
        ['git', 'checkout', '-b', branch_name],
        cwd=self.repo_path,
        check=True
    )

    return branch_name

def merge_verified_fix(
    self,
    fix_branch: str,
    target_branch: str = "main",
    squash: bool = True
) -> bool:
    """
    Merge a verified fix back to the target branch.

    Args:
        fix_branch: Branch containing the verified fix
        target_branch: Branch to merge into
        squash: Whether to squash commits

    Returns:
        True if merge successful, False otherwise
    """
    try:
        # Checkout target branch
        subprocess.run(
            ['git', 'checkout', target_branch],
            cwd=self.repo_path,
            check=True
        )

        # Merge the fix branch
        merge_cmd = ['git', 'merge']
        if squash:
            merge_cmd.append('--squash')
        merge_cmd.append(fix_branch)

        subprocess.run(merge_cmd, cwd=self.repo_path, check=True)

        # If squash, create a clean commit
        if squash:
            subprocess.run(
                ['git', 'commit', '-m', f'{self.commit_prefix} Merge verified fix from {fix_branch}'],
                cwd=self.repo_path,
                check=True
            )

        return True
    except subprocess.CalledProcessError:
        return False
```

### 1.3 Rollback Mechanisms

**Three Rollback Strategies:**

1. **Soft Rollback** - Keep changes in working directory
2. **Hard Rollback** - Discard all changes
3. **Revert Rollback** - Create new commit that undoes changes (safe for shared branches)

#### Implementation:

```python
from enum import Enum

class RollbackStrategy(Enum):
    SOFT = "soft"      # Keep changes in working directory
    HARD = "hard"      # Discard all changes
    REVERT = "revert"  # Create revert commit

class GitRollback:
    """Handles different rollback strategies."""

    def rollback_to_commit(
        self,
        commit_hash: str,
        strategy: RollbackStrategy = RollbackStrategy.HARD
    ) -> bool:
        """
        Rollback to a specific commit using the specified strategy.

        Args:
            commit_hash: The commit to rollback to
            strategy: Rollback strategy to use

        Returns:
            True if successful, False otherwise
        """
        try:
            if strategy == RollbackStrategy.SOFT:
                # Keep changes in working directory
                subprocess.run(
                    ['git', 'reset', '--soft', commit_hash],
                    cwd=self.repo_path,
                    check=True
                )
            elif strategy == RollbackStrategy.HARD:
                # Discard all changes
                subprocess.run(
                    ['git', 'reset', '--hard', commit_hash],
                    cwd=self.repo_path,
                    check=True
                )
            elif strategy == RollbackStrategy.REVERT:
                # Create revert commit (safe for shared branches)
                subprocess.run(
                    ['git', 'revert', '--no-commit', f'{commit_hash}..HEAD'],
                    cwd=self.repo_path,
                    check=True
                )
                subprocess.run(
                    ['git', 'commit', '-m', f'{self.commit_prefix} Revert to {commit_hash}'],
                    cwd=self.repo_path,
                    check=True
                )

            return True
        except subprocess.CalledProcessError as e:
            print(f"Rollback failed: {e}")
            return False

    def rollback_file(
        self,
        file_path: str,
        commit_hash: Optional[str] = None
    ) -> bool:
        """
        Rollback a specific file to a previous state.

        Args:
            file_path: Path to the file to rollback
            commit_hash: Commit to rollback to (None = last commit)

        Returns:
            True if successful
        """
        try:
            commit_ref = commit_hash or 'HEAD'
            subprocess.run(
                ['git', 'checkout', commit_ref, '--', file_path],
                cwd=self.repo_path,
                check=True
            )
            return True
        except subprocess.CalledProcessError:
            return False

    def create_recovery_point(self, name: str) -> str:
        """
        Create a named tag as a recovery point.

        Returns:
            Tag name created
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        tag_name = f"recovery/{name}_{timestamp}"

        subprocess.run(
            ['git', 'tag', '-a', tag_name, '-m', f'Recovery point: {name}'],
            cwd=self.repo_path,
            check=True
        )

        return tag_name
```

### 1.4 Best Practices for Commit Granularity

**Principles:**
1. **One Logical Change Per Commit** - Each commit should represent a single logical fix
2. **Atomic Commits** - Each commit should leave the codebase in a working state
3. **Descriptive Messages** - Follow conventional commit format
4. **Metadata Inclusion** - Include machine-readable metadata in commits

**Commit Granularity Guidelines:**

| Scenario | Granularity | Example |
|----------|-------------|---------|
| Single file fix | 1 commit | Fix typo in config.js |
| Multi-file related fix | 1 commit | Fix authentication across auth.py, user.py, session.py |
| Multiple independent fixes | N commits | Fix 1: Database connection, Fix 2: API timeout |
| Fix + Tests | 1 commit | Fix user validation + add tests |
| Exploratory fixes | 1 commit per attempt | Attempt 1, Attempt 2, etc. |

#### Commit Message Template:

```
[AUTOFIX] <type>(<scope>): <subject>

<body>

Issue-ID: <issue_id>
Fix-Attempt: <attempt_number>
Files-Changed: <file_count>
Tests-Run: <test_count>
Tests-Passed: <passed_count>
Verification: <manual|automated>
Rollback-Safe: <yes|no>

Metadata:
<json_metadata>
```

---

## 2. Snapshot-Based Rollback

### 2.1 File State Snapshots

**When to Use:**
- Fast rollback needed (faster than git)
- Temporary changes during debugging
- Multiple rollback points within a single fix
- No git history pollution

#### Implementation:

```python
import shutil
import hashlib
from pathlib import Path
from typing import Dict, List, Optional
import pickle

class SnapshotManager:
    """Manages file-based snapshots for quick rollback."""

    def __init__(self, snapshot_dir: str = ".autofix_snapshots"):
        self.snapshot_dir = Path(snapshot_dir)
        self.snapshot_dir.mkdir(exist_ok=True)
        self.snapshots: Dict[str, Snapshot] = {}
        self.manifest_file = self.snapshot_dir / "manifest.pkl"
        self._load_manifest()

    def create_snapshot(
        self,
        files: List[str],
        snapshot_id: str,
        metadata: Optional[Dict] = None
    ) -> 'Snapshot':
        """
        Create a snapshot of specified files.

        Args:
            files: List of file paths to snapshot
            snapshot_id: Unique identifier for this snapshot
            metadata: Optional metadata to store

        Returns:
            Snapshot object
        """
        snapshot = Snapshot(snapshot_id, self.snapshot_dir)

        for file_path in files:
            file_path = Path(file_path)
            if not file_path.exists():
                continue

            # Calculate hash for verification
            file_hash = self._calculate_hash(file_path)

            # Create snapshot path
            snapshot_path = snapshot.get_file_snapshot_path(file_path)
            snapshot_path.parent.mkdir(parents=True, exist_ok=True)

            # Copy file to snapshot
            shutil.copy2(file_path, snapshot_path)

            # Store metadata
            snapshot.add_file(file_path, file_hash)

        snapshot.metadata = metadata or {}
        snapshot.timestamp = datetime.now()

        self.snapshots[snapshot_id] = snapshot
        self._save_manifest()

        return snapshot

    def restore_snapshot(
        self,
        snapshot_id: str,
        verify_hash: bool = True
    ) -> bool:
        """
        Restore files from a snapshot.

        Args:
            snapshot_id: ID of snapshot to restore
            verify_hash: Whether to verify file hashes

        Returns:
            True if restore successful
        """
        if snapshot_id not in self.snapshots:
            return False

        snapshot = self.snapshots[snapshot_id]

        try:
            for file_path, file_hash in snapshot.files.items():
                snapshot_path = snapshot.get_file_snapshot_path(file_path)

                if not snapshot_path.exists():
                    continue

                # Verify hash if requested
                if verify_hash:
                    current_hash = self._calculate_hash(snapshot_path)
                    if current_hash != file_hash:
                        raise ValueError(f"Hash mismatch for {file_path}")

                # Restore file
                shutil.copy2(snapshot_path, file_path)

            return True
        except Exception as e:
            print(f"Restore failed: {e}")
            return False

    def cleanup_snapshot(self, snapshot_id: str) -> bool:
        """Remove a snapshot and its files."""
        if snapshot_id not in self.snapshots:
            return False

        snapshot = self.snapshots[snapshot_id]

        # Remove snapshot directory
        snapshot_base = self.snapshot_dir / snapshot_id
        if snapshot_base.exists():
            shutil.rmtree(snapshot_base)

        # Remove from manifest
        del self.snapshots[snapshot_id]
        self._save_manifest()

        return True

    def _calculate_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def _save_manifest(self):
        """Save snapshot manifest to disk."""
        with open(self.manifest_file, 'wb') as f:
            pickle.dump(self.snapshots, f)

    def _load_manifest(self):
        """Load snapshot manifest from disk."""
        if self.manifest_file.exists():
            with open(self.manifest_file, 'rb') as f:
                self.snapshots = pickle.load(f)

class Snapshot:
    """Represents a file snapshot."""

    def __init__(self, snapshot_id: str, snapshot_dir: Path):
        self.snapshot_id = snapshot_id
        self.snapshot_dir = snapshot_dir
        self.files: Dict[Path, str] = {}  # file_path -> hash
        self.metadata: Dict = {}
        self.timestamp: Optional[datetime] = None

    def add_file(self, file_path: Path, file_hash: str):
        """Add a file to this snapshot."""
        self.files[file_path] = file_hash

    def get_file_snapshot_path(self, file_path: Path) -> Path:
        """Get the snapshot path for a file."""
        return self.snapshot_dir / self.snapshot_id / file_path.name
```

### 2.2 Git vs Snapshot Comparison

| Aspect | Git Commits | File Snapshots |
|--------|-------------|----------------|
| **Speed** | Slower (repo operations) | Faster (direct file copy) |
| **History** | Permanent history | Temporary, cleanup needed |
| **Integrity** | Strong (SHA-1/SHA-256) | Custom (SHA-256) |
| **Granularity** | Commit-level | File-level |
| **Collaboration** | Shareable via push | Local only |
| **Disk Usage** | Efficient (delta compression) | Less efficient (full copies) |
| **Recovery** | Robust (distributed) | Local only, less robust |
| **Best For** | Permanent fixes, team work | Quick iterations, debugging |

**Recommendation:**
- **Use Git** for: Final fixes, shared branches, permanent history
- **Use Snapshots** for: Quick iterations, temporary debugging, multi-step fixes

---

## 3. Verification After Fixes

### 3.1 Comprehensive Test Strategy

```python
from dataclasses import dataclass
from typing import List, Callable, Any
import asyncio

@dataclass
class TestResult:
    """Result of a single test."""
    test_name: str
    passed: bool
    duration: float
    error: Optional[str] = None
    output: Optional[str] = None

@dataclass
class VerificationResult:
    """Complete verification result."""
    success: bool
    tests_run: int
    tests_passed: int
    tests_failed: int
    duration: float
    results: List[TestResult]
    cascading_failures: List[str]

class FixVerifier:
    """Verifies that fixes don't break existing functionality."""

    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        self.test_suites = {
            'unit': [],
            'integration': [],
            'e2e': [],
            'security': [],
            'contract': []
        }

    async def verify_fix(
        self,
        fix_context: Dict[str, Any],
        test_levels: List[str] = ['unit', 'integration']
    ) -> VerificationResult:
        """
        Run comprehensive verification after applying a fix.

        Args:
            fix_context: Context about the fix applied
            test_levels: Which test levels to run

        Returns:
            VerificationResult with test outcomes
        """
        start_time = datetime.now()
        all_results = []

        # 1. Static Analysis
        static_results = await self._run_static_analysis(fix_context)
        all_results.extend(static_results)

        # 2. Unit Tests
        if 'unit' in test_levels:
            unit_results = await self._run_unit_tests(fix_context)
            all_results.extend(unit_results)

        # 3. Integration Tests
        if 'integration' in test_levels:
            integration_results = await self._run_integration_tests(fix_context)
            all_results.extend(integration_results)

        # 4. Contract-specific tests
        if 'contract' in test_levels:
            contract_results = await self._run_contract_tests(fix_context)
            all_results.extend(contract_results)

        # 5. Security scans
        if 'security' in test_levels:
            security_results = await self._run_security_scans(fix_context)
            all_results.extend(security_results)

        # 6. Detect cascading failures
        cascading = self._detect_cascading_failures(all_results, fix_context)

        duration = (datetime.now() - start_time).total_seconds()

        tests_passed = sum(1 for r in all_results if r.passed)
        tests_failed = len(all_results) - tests_passed

        return VerificationResult(
            success=tests_failed == 0 and len(cascading) == 0,
            tests_run=len(all_results),
            tests_passed=tests_passed,
            tests_failed=tests_failed,
            duration=duration,
            results=all_results,
            cascading_failures=cascading
        )

    async def _run_static_analysis(
        self,
        fix_context: Dict[str, Any]
    ) -> List[TestResult]:
        """Run static analysis tools."""
        results = []

        # TypeScript/JavaScript
        if self._has_ts_files(fix_context):
            results.append(await self._run_eslint())
            results.append(await self._run_typescript_check())

        # Python
        if self._has_py_files(fix_context):
            results.append(await self._run_pylint())
            results.append(await self._run_mypy())

        # Solidity
        if self._has_sol_files(fix_context):
            results.append(await self._run_slither())
            results.append(await self._run_mythril())

        return results

    async def _run_unit_tests(
        self,
        fix_context: Dict[str, Any]
    ) -> List[TestResult]:
        """Run unit tests for affected modules."""
        affected_files = fix_context.get('files_changed', [])
        test_files = self._find_related_tests(affected_files)

        results = []
        for test_file in test_files:
            result = await self._run_test_file(test_file)
            results.append(result)

        return results

    async def _run_contract_tests(
        self,
        fix_context: Dict[str, Any]
    ) -> List[TestResult]:
        """Run smart contract specific tests."""
        results = []

        # Hardhat tests
        result = await self._run_command(
            ['npx', 'hardhat', 'test'],
            'hardhat_tests'
        )
        results.append(result)

        # Gas usage analysis
        gas_result = await self._analyze_gas_usage()
        results.append(gas_result)

        return results

    def _detect_cascading_failures(
        self,
        test_results: List[TestResult],
        fix_context: Dict[str, Any]
    ) -> List[str]:
        """
        Detect if a fix caused failures in unrelated areas.

        Returns:
            List of cascading failure descriptions
        """
        cascading = []

        fixed_files = set(fix_context.get('files_changed', []))

        for result in test_results:
            if not result.passed:
                # Check if failure is in unrelated module
                if not self._is_related_to_fix(result.test_name, fixed_files):
                    cascading.append(
                        f"Fix caused failure in unrelated module: {result.test_name}"
                    )

        return cascading

    async def _run_command(
        self,
        cmd: List[str],
        test_name: str
    ) -> TestResult:
        """Run a command and return test result."""
        start = datetime.now()

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.repo_path
            )

            stdout, stderr = await process.communicate()
            duration = (datetime.now() - start).total_seconds()

            return TestResult(
                test_name=test_name,
                passed=process.returncode == 0,
                duration=duration,
                error=stderr.decode() if stderr else None,
                output=stdout.decode() if stdout else None
            )
        except Exception as e:
            duration = (datetime.now() - start).total_seconds()
            return TestResult(
                test_name=test_name,
                passed=False,
                duration=duration,
                error=str(e)
            )
```

### 3.2 Automated vs Manual Verification

**Decision Matrix:**

| Verification Type | When to Use Automated | When to Use Manual |
|-------------------|----------------------|-------------------|
| Syntax Errors | Always automated | Never |
| Unit Tests | Always automated | Complex edge cases |
| Integration Tests | Automated first | If automated fails |
| Security Scans | Always automated | Review findings manually |
| Contract Deployment | Automated on testnet | Manual on mainnet |
| Database Migrations | Automated dry-run | Manual approval |
| UI Changes | Automated screenshots | Manual visual review |
| Performance | Automated benchmarks | Manual load testing |

**Hybrid Verification Workflow:**

```python
class HybridVerifier:
    """Combines automated and manual verification steps."""

    async def verify_with_approval(
        self,
        fix_context: Dict[str, Any],
        require_manual: bool = False
    ) -> tuple[bool, VerificationResult]:
        """
        Run automated tests, optionally requiring manual approval.

        Returns:
            (approved, verification_result)
        """
        # 1. Run automated tests
        auto_result = await self.verifier.verify_fix(fix_context)

        # 2. If tests fail, auto-reject
        if not auto_result.success:
            return False, auto_result

        # 3. If manual approval required
        if require_manual or self._needs_manual_review(fix_context):
            approved = await self._request_manual_approval(
                fix_context,
                auto_result
            )
            return approved, auto_result

        # 4. Auto-approve
        return True, auto_result

    def _needs_manual_review(self, fix_context: Dict[str, Any]) -> bool:
        """Determine if manual review is needed."""

        # Always require manual review for:
        critical_patterns = [
            'migrations',
            'contracts',
            'auth',
            'security',
            'payment',
            'deploy'
        ]

        files = fix_context.get('files_changed', [])

        for file_path in files:
            if any(pattern in file_path.lower() for pattern in critical_patterns):
                return True

        return False
```

---

## 4. Smart Contract Specific Strategies

### 4.1 Immutable Contract Handling

**Key Challenge:** Smart contracts cannot be modified after deployment.

**Strategies:**

1. **Proxy Patterns** - Use upgradeable proxy contracts
2. **Test-Deploy-Verify Cycle** - Extensive testing before mainnet
3. **Deployment Versioning** - Track contract versions
4. **Migration Scripts** - Automated deployment and verification

#### Implementation:

```typescript
// deploymentManager.ts
import { ethers } from "hardhat";
import { Contract } from "ethers";

interface DeploymentConfig {
  network: string;
  contractName: string;
  constructorArgs: any[];
  proxyType?: 'transparent' | 'uups' | 'beacon';
  verify: boolean;
}

interface DeploymentResult {
  address: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: bigint;
  verified: boolean;
}

class SmartContractDeploymentManager {
  private deploymentHistory: Map<string, DeploymentResult[]> = new Map();

  /**
   * Deploy contract with comprehensive verification and rollback capability.
   */
  async deployWithRollback(
    config: DeploymentConfig
  ): Promise<DeploymentResult | null> {

    // 1. Pre-deployment validation
    const validation = await this.validateDeployment(config);
    if (!validation.passed) {
      console.error("Pre-deployment validation failed:", validation.errors);
      return null;
    }

    // 2. Deploy to testnet first
    if (config.network === 'mainnet') {
      const testnetResult = await this.deployToTestnet(config);
      if (!testnetResult.success) {
        console.error("Testnet deployment failed, aborting mainnet deployment");
        return null;
      }
    }

    // 3. Create deployment snapshot
    const snapshotId = await this.createDeploymentSnapshot(config);

    try {
      // 4. Deploy contract
      const contract = await this.deployContract(config);

      // 5. Run post-deployment verification
      const verificationResult = await this.verifyDeployment(contract, config);

      if (!verificationResult.success) {
        console.error("Post-deployment verification failed");
        // Cannot rollback deployed contract, but can mark as failed
        await this.markDeploymentFailed(contract.address, verificationResult);
        return null;
      }

      // 6. Verify on Etherscan if requested
      if (config.verify) {
        await this.verifyOnEtherscan(contract, config);
      }

      // 7. Record successful deployment
      const result: DeploymentResult = {
        address: contract.address,
        transactionHash: contract.deployTransaction.hash,
        blockNumber: contract.deployTransaction.blockNumber!,
        gasUsed: (await contract.deployTransaction.wait()).gasUsed,
        verified: config.verify
      };

      this.recordDeployment(config.contractName, result);

      return result;

    } catch (error) {
      console.error("Deployment failed:", error);
      // Restore deployment snapshot
      await this.restoreDeploymentSnapshot(snapshotId);
      return null;
    }
  }

  /**
   * Deploy upgradeable proxy contract for future upgrades.
   */
  async deployUpgradeable(
    config: DeploymentConfig
  ): Promise<{ proxy: string; implementation: string } | null> {

    const { upgrades } = require("hardhat");

    try {
      // Deploy implementation contract
      const ContractFactory = await ethers.getContractFactory(config.contractName);
      const proxy = await upgrades.deployProxy(
        ContractFactory,
        config.constructorArgs,
        { kind: config.proxyType || 'transparent' }
      );

      await proxy.deployed();

      // Get implementation address
      const implementationAddress = await upgrades.erc1967.getImplementationAddress(
        proxy.address
      );

      console.log("Proxy deployed to:", proxy.address);
      console.log("Implementation deployed to:", implementationAddress);

      // Verify both contracts
      if (config.verify) {
        await this.verifyOnEtherscan(proxy, config);
      }

      return {
        proxy: proxy.address,
        implementation: implementationAddress
      };

    } catch (error) {
      console.error("Upgradeable deployment failed:", error);
      return null;
    }
  }

  /**
   * Upgrade existing proxy contract (rollback mechanism for immutability).
   */
  async upgradeContract(
    proxyAddress: string,
    newImplementationName: string
  ): Promise<boolean> {

    const { upgrades } = require("hardhat");

    try {
      // Get previous implementation
      const previousImpl = await upgrades.erc1967.getImplementationAddress(
        proxyAddress
      );

      console.log("Previous implementation:", previousImpl);

      // Deploy new implementation
      const NewContract = await ethers.getContractFactory(newImplementationName);
      const upgraded = await upgrades.upgradeProxy(proxyAddress, NewContract);

      await upgraded.deployed();

      const newImpl = await upgrades.erc1967.getImplementationAddress(
        proxyAddress
      );

      console.log("New implementation:", newImpl);

      // Store previous implementation for rollback
      this.recordUpgrade(proxyAddress, previousImpl, newImpl);

      return true;

    } catch (error) {
      console.error("Upgrade failed:", error);
      return false;
    }
  }

  /**
   * Rollback to previous implementation (for upgradeable contracts).
   */
  async rollbackUpgrade(proxyAddress: string): Promise<boolean> {
    const { upgrades } = require("hardhat");

    // Get previous implementation from history
    const previousImpl = this.getPreviousImplementation(proxyAddress);

    if (!previousImpl) {
      console.error("No previous implementation found");
      return false;
    }

    try {
      // Upgrade back to previous implementation
      const PreviousContract = await ethers.getContractAt(
        "YourContract",
        previousImpl
      );

      const rolled = await upgrades.upgradeProxy(proxyAddress, PreviousContract);

      console.log("Rolled back to:", previousImpl);

      return true;
    } catch (error) {
      console.error("Rollback failed:", error);
      return false;
    }
  }

  /**
   * Comprehensive post-deployment verification.
   */
  async verifyDeployment(
    contract: Contract,
    config: DeploymentConfig
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    // 1. Verify contract code
    const code = await ethers.provider.getCode(contract.address);
    if (code === '0x') {
      errors.push("No contract code at address");
    }

    // 2. Verify constructor args if applicable
    // ... implementation

    // 3. Run contract-specific tests
    try {
      // Test basic functions
      // ... implementation
    } catch (error) {
      errors.push(`Function test failed: ${error}`);
    }

    // 4. Gas usage check
    // ... implementation

    // 5. Security checks
    // ... implementation

    return {
      success: errors.length === 0,
      errors
    };
  }
}
```

### 4.2 Testnet-First Strategy

**Workflow:**

```
1. Local Testing (Hardhat Network)
   ↓
2. Local Fork Testing (Mainnet Fork)
   ↓
3. Public Testnet Deployment (Sepolia/Goerli)
   ↓
4. Testnet Verification (Run for 24-48 hours)
   ↓
5. Mainnet Deployment (if all tests pass)
   ↓
6. Mainnet Monitoring (24/7 for first week)
```

#### Implementation:

```typescript
class TestnetFirstDeployer {
  /**
   * Execute testnet-first deployment strategy.
   */
  async deployWithTestnetFirst(
    config: DeploymentConfig
  ): Promise<DeploymentResult | null> {

    console.log("Starting Testnet-First Deployment...");

    // Stage 1: Local Hardhat testing
    console.log("\n=== Stage 1: Local Hardhat Testing ===");
    const localResult = await this.testOnLocalNetwork(config);
    if (!localResult.success) {
      console.error("Local tests failed, aborting");
      return null;
    }

    // Stage 2: Mainnet fork testing
    console.log("\n=== Stage 2: Mainnet Fork Testing ===");
    const forkResult = await this.testOnMainnetFork(config);
    if (!forkResult.success) {
      console.error("Fork tests failed, aborting");
      return null;
    }

    // Stage 3: Testnet deployment
    console.log("\n=== Stage 3: Testnet Deployment (Sepolia) ===");
    const testnetConfig = { ...config, network: 'sepolia' };
    const testnetAddress = await this.manager.deployWithRollback(testnetConfig);

    if (!testnetAddress) {
      console.error("Testnet deployment failed, aborting");
      return null;
    }

    // Stage 4: Testnet verification (extended monitoring)
    console.log("\n=== Stage 4: Testnet Verification ===");
    const monitoringResult = await this.monitorTestnetDeployment(
      testnetAddress,
      24 // hours
    );

    if (!monitoringResult.success) {
      console.error("Testnet monitoring found issues, aborting mainnet deployment");
      return null;
    }

    // Stage 5: Mainnet deployment (if approved)
    console.log("\n=== Stage 5: Mainnet Deployment ===");
    const approval = await this.requestMainnetApproval(config, monitoringResult);

    if (!approval) {
      console.log("Mainnet deployment not approved");
      return null;
    }

    const mainnetConfig = { ...config, network: 'mainnet' };
    const mainnetResult = await this.manager.deployWithRollback(mainnetConfig);

    if (mainnetResult) {
      // Stage 6: Mainnet monitoring
      console.log("\n=== Stage 6: Mainnet Monitoring ===");
      this.startMainnetMonitoring(mainnetResult.address);
    }

    return mainnetResult;
  }
}
```

---

## 5. Database Migration Rollback

### 5.1 Supabase Migration Strategies

#### Safe Migration Implementation:

```typescript
// migrationManager.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationFile {
  id: string;
  name: string;
  upSql: string;
  downSql: string;
  timestamp: Date;
}

interface MigrationResult {
  success: boolean;
  migrationId: string;
  error?: string;
  backupId?: string;
}

class SupabaseMigrationManager {
  private supabase: SupabaseClient;
  private migrationDir: string;
  private backupDir: string;

  constructor(url: string, key: string, migrationDir: string) {
    this.supabase = createClient(url, key);
    this.migrationDir = migrationDir;
    this.backupDir = path.join(migrationDir, 'backups');
  }

  /**
   * Apply migration with automatic backup and rollback capability.
   */
  async applyMigrationSafely(
    migrationFile: string
  ): Promise<MigrationResult> {

    const migration = this.loadMigration(migrationFile);

    // 1. Create full database backup
    console.log("Creating database backup...");
    const backupId = await this.createBackup();

    if (!backupId) {
      return {
        success: false,
        migrationId: migration.id,
        error: "Failed to create backup"
      };
    }

    try {
      // 2. Test migration in dry-run mode
      console.log("Testing migration in dry-run mode...");
      const dryRunResult = await this.testMigrationDryRun(migration);

      if (!dryRunResult.success) {
        return {
          success: false,
          migrationId: migration.id,
          error: `Dry-run failed: ${dryRunResult.error}`,
          backupId
        };
      }

      // 3. Apply migration in transaction
      console.log("Applying migration...");
      const { data, error } = await this.supabase.rpc('execute_migration', {
        migration_sql: migration.upSql,
        migration_id: migration.id
      });

      if (error) {
        throw new Error(`Migration failed: ${error.message}`);
      }

      // 4. Verify migration succeeded
      console.log("Verifying migration...");
      const verifyResult = await this.verifyMigration(migration);

      if (!verifyResult.success) {
        console.log("Verification failed, rolling back...");
        await this.rollbackMigration(migration, backupId);

        return {
          success: false,
          migrationId: migration.id,
          error: `Verification failed: ${verifyResult.error}`,
          backupId
        };
      }

      // 5. Record successful migration
      await this.recordMigration(migration);

      console.log("Migration applied successfully!");

      return {
        success: true,
        migrationId: migration.id,
        backupId
      };

    } catch (error) {
      console.error("Migration error:", error);

      // Attempt rollback
      console.log("Attempting rollback...");
      await this.rollbackMigration(migration, backupId);

      return {
        success: false,
        migrationId: migration.id,
        error: error.message,
        backupId
      };
    }
  }

  /**
   * Test migration without applying changes.
   */
  async testMigrationDryRun(
    migration: MigrationFile
  ): Promise<{ success: boolean; error?: string }> {

    try {
      // Use a transaction that we roll back
      const { data, error } = await this.supabase.rpc('test_migration_dry_run', {
        migration_sql: migration.upSql
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create full database backup before migration.
   */
  async createBackup(): Promise<string | null> {
    const timestamp = new Date().toISOString();
    const backupId = `backup_${timestamp}`;

    try {
      // Export database schema and data
      const { data: schema } = await this.supabase.rpc('get_full_schema');
      const { data: tables } = await this.supabase.rpc('get_all_tables');

      const backup = {
        id: backupId,
        timestamp,
        schema,
        data: {}
      };

      // Backup data from each table
      for (const table of tables) {
        const { data } = await this.supabase
          .from(table.name)
          .select('*');

        backup.data[table.name] = data;
      }

      // Save backup to file
      const backupPath = path.join(this.backupDir, `${backupId}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

      console.log(`Backup created: ${backupPath}`);

      return backupId;

    } catch (error) {
      console.error("Backup failed:", error);
      return null;
    }
  }

  /**
   * Rollback migration using down SQL or backup restoration.
   */
  async rollbackMigration(
    migration: MigrationFile,
    backupId: string
  ): Promise<boolean> {

    try {
      // Option 1: Use down migration SQL
      if (migration.downSql) {
        console.log("Rolling back using down migration...");

        const { error } = await this.supabase.rpc('execute_migration', {
          migration_sql: migration.downSql,
          migration_id: `${migration.id}_rollback`
        });

        if (!error) {
          console.log("Rollback successful using down migration");
          return true;
        }

        console.log("Down migration failed, attempting backup restore...");
      }

      // Option 2: Restore from backup
      console.log("Restoring from backup...");
      const restored = await this.restoreBackup(backupId);

      if (restored) {
        console.log("Rollback successful using backup restore");
        return true;
      }

      console.error("Rollback failed");
      return false;

    } catch (error) {
      console.error("Rollback error:", error);
      return false;
    }
  }

  /**
   * Restore database from backup.
   */
  async restoreBackup(backupId: string): Promise<boolean> {
    const backupPath = path.join(this.backupDir, `${backupId}.json`);

    if (!fs.existsSync(backupPath)) {
      console.error("Backup file not found:", backupPath);
      return false;
    }

    try {
      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

      // Restore schema
      await this.supabase.rpc('restore_schema', {
        schema_sql: backup.schema
      });

      // Restore data for each table
      for (const [tableName, tableData] of Object.entries(backup.data)) {
        // Delete existing data
        await this.supabase.from(tableName).delete().neq('id', 0);

        // Insert backup data
        await this.supabase.from(tableName).insert(tableData);
      }

      console.log("Backup restored successfully");
      return true;

    } catch (error) {
      console.error("Restore failed:", error);
      return false;
    }
  }

  /**
   * Generate down migration automatically from schema comparison.
   */
  async generateDownMigration(
    upMigrationSql: string
  ): Promise<string> {

    // Capture current schema
    const beforeSchema = await this.captureSchema();

    // Apply up migration to test database
    // ... apply migration ...

    // Capture new schema
    const afterSchema = await this.captureSchema();

    // Generate reverse operations
    const downSql = this.generateReverseOperations(beforeSchema, afterSchema);

    return downSql;
  }
}
```

### 5.2 Migration Best Practices

**Golden Rules:**

1. **Always Create Backups** - Before every migration
2. **Test First** - Use dry-run mode
3. **Atomic Migrations** - One logical change per migration
4. **Reversible Migrations** - Always provide down migrations
5. **Data Safety** - Never drop columns without data export
6. **Incremental Changes** - Small, frequent migrations vs large, infrequent

**Migration Checklist:**

```typescript
class MigrationChecklist {
  async validateMigration(migration: MigrationFile): Promise<ValidationResult> {
    const checks = [];

    // 1. Syntax check
    checks.push(await this.checkSqlSyntax(migration.upSql));

    // 2. Breaking changes check
    checks.push(await this.checkBreakingChanges(migration));

    // 3. Data loss check
    checks.push(await this.checkDataLoss(migration));

    // 4. Performance impact check
    checks.push(await this.checkPerformanceImpact(migration));

    // 5. Down migration exists
    checks.push({
      name: "Down migration exists",
      passed: migration.downSql !== null && migration.downSql.length > 0
    });

    // 6. Rollback tested
    checks.push(await this.testRollback(migration));

    return {
      passed: checks.every(c => c.passed),
      checks
    };
  }
}
```

---

## 6. Partial Success Handling

### 6.1 Transaction Coordinator

```python
from typing import List, Callable, Any, Dict
from dataclasses import dataclass
from enum import Enum

class OperationStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"

@dataclass
class Operation:
    """Represents a single fix operation."""
    id: str
    description: str
    execute: Callable[[], Any]
    rollback: Callable[[], Any]
    status: OperationStatus = OperationStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    dependencies: List[str] = None

class PartialSuccessHandler:
    """
    Handles scenarios where some fixes succeed and others fail.
    Provides atomic operations, checkpoints, and recovery.
    """

    def __init__(self):
        self.operations: Dict[str, Operation] = {}
        self.checkpoint_stack: List[str] = []
        self.change_log: List[Dict] = []

    async def execute_operations(
        self,
        operations: List[Operation],
        strategy: str = "all_or_nothing"
    ) -> Dict[str, Any]:
        """
        Execute multiple operations with partial success handling.

        Strategies:
        - all_or_nothing: Rollback all if any fails
        - best_effort: Keep successful, rollback failed
        - continue_on_error: Continue despite failures
        - checkpoint: Rollback to last checkpoint on failure

        Returns:
            Dict with execution results and status
        """

        results = {
            'strategy': strategy,
            'total': len(operations),
            'successful': [],
            'failed': [],
            'rolled_back': [],
            'final_status': 'unknown'
        }

        # Register all operations
        for op in operations:
            self.operations[op.id] = op

        try:
            if strategy == "all_or_nothing":
                results = await self._execute_all_or_nothing(operations)
            elif strategy == "best_effort":
                results = await self._execute_best_effort(operations)
            elif strategy == "continue_on_error":
                results = await self._execute_continue_on_error(operations)
            elif strategy == "checkpoint":
                results = await self._execute_with_checkpoints(operations)

        except Exception as e:
            results['final_status'] = 'error'
            results['error'] = str(e)

        return results

    async def _execute_all_or_nothing(
        self,
        operations: List[Operation]
    ) -> Dict[str, Any]:
        """Execute all operations, rollback all if any fails."""

        results = {
            'strategy': 'all_or_nothing',
            'total': len(operations),
            'successful': [],
            'failed': [],
            'rolled_back': [],
            'final_status': 'unknown'
        }

        executed = []

        try:
            for op in operations:
                # Check dependencies
                if not self._check_dependencies(op):
                    raise Exception(f"Dependencies not met for {op.id}")

                # Execute operation
                op.status = OperationStatus.IN_PROGRESS
                result = await self._execute_operation(op)

                op.result = result
                op.status = OperationStatus.SUCCESS
                executed.append(op)
                results['successful'].append(op.id)

                # Log change
                self._log_change(op, result)

            results['final_status'] = 'success'

        except Exception as e:
            # Rollback all executed operations in reverse order
            print(f"Operation failed: {e}. Rolling back all operations...")

            for op in reversed(executed):
                try:
                    await self._rollback_operation(op)
                    op.status = OperationStatus.ROLLED_BACK
                    results['rolled_back'].append(op.id)
                except Exception as rollback_error:
                    print(f"Rollback failed for {op.id}: {rollback_error}")

            results['final_status'] = 'rolled_back'
            results['error'] = str(e)

        return results

    async def _execute_best_effort(
        self,
        operations: List[Operation]
    ) -> Dict[str, Any]:
        """Execute all operations, keep successful ones, rollback only failed."""

        results = {
            'strategy': 'best_effort',
            'total': len(operations),
            'successful': [],
            'failed': [],
            'rolled_back': [],
            'final_status': 'partial'
        }

        for op in operations:
            try:
                # Check dependencies
                if not self._check_dependencies(op):
                    op.status = OperationStatus.FAILED
                    op.error = "Dependencies not met"
                    results['failed'].append(op.id)
                    continue

                # Execute operation
                op.status = OperationStatus.IN_PROGRESS
                result = await self._execute_operation(op)

                op.result = result
                op.status = OperationStatus.SUCCESS
                results['successful'].append(op.id)

                # Log change
                self._log_change(op, result)

            except Exception as e:
                # Mark as failed but don't rollback others
                op.status = OperationStatus.FAILED
                op.error = str(e)
                results['failed'].append(op.id)

                print(f"Operation {op.id} failed: {e}")

        # Determine final status
        if len(results['successful']) == len(operations):
            results['final_status'] = 'success'
        elif len(results['successful']) > 0:
            results['final_status'] = 'partial'
        else:
            results['final_status'] = 'failed'

        return results

    async def _execute_with_checkpoints(
        self,
        operations: List[Operation]
    ) -> Dict[str, Any]:
        """Execute operations with checkpoints, rollback to last checkpoint on failure."""

        results = {
            'strategy': 'checkpoint',
            'total': len(operations),
            'successful': [],
            'failed': [],
            'rolled_back': [],
            'checkpoints': [],
            'final_status': 'unknown'
        }

        checkpoint_operations = []

        for i, op in enumerate(operations):
            try:
                # Create checkpoint every N operations
                if i % 3 == 0:
                    checkpoint_id = f"checkpoint_{i}"
                    self.create_checkpoint(checkpoint_id)
                    results['checkpoints'].append(checkpoint_id)
                    checkpoint_operations = []

                # Execute operation
                op.status = OperationStatus.IN_PROGRESS
                result = await self._execute_operation(op)

                op.result = result
                op.status = OperationStatus.SUCCESS
                results['successful'].append(op.id)
                checkpoint_operations.append(op)

                # Log change
                self._log_change(op, result)

            except Exception as e:
                # Rollback to last checkpoint
                print(f"Operation {op.id} failed: {e}")
                print(f"Rolling back to last checkpoint...")

                for checkpoint_op in reversed(checkpoint_operations):
                    try:
                        await self._rollback_operation(checkpoint_op)
                        checkpoint_op.status = OperationStatus.ROLLED_BACK
                        results['rolled_back'].append(checkpoint_op.id)
                    except Exception as rollback_error:
                        print(f"Rollback failed for {checkpoint_op.id}: {rollback_error}")

                op.status = OperationStatus.FAILED
                op.error = str(e)
                results['failed'].append(op.id)

                # Stop execution
                break

        results['final_status'] = self._determine_status(results)

        return results

    def create_checkpoint(self, checkpoint_id: str):
        """Create a checkpoint for rollback."""
        self.checkpoint_stack.append(checkpoint_id)
        print(f"Checkpoint created: {checkpoint_id}")

    async def rollback_to_checkpoint(self, checkpoint_id: str):
        """Rollback all operations since checkpoint."""

        if checkpoint_id not in self.checkpoint_stack:
            raise ValueError(f"Checkpoint not found: {checkpoint_id}")

        # Find operations after checkpoint
        checkpoint_index = len(self.change_log) - self.checkpoint_stack.index(checkpoint_id)

        # Rollback operations in reverse order
        for change in reversed(self.change_log[checkpoint_index:]):
            op = self.operations[change['operation_id']]
            await self._rollback_operation(op)

        # Remove changes from log
        self.change_log = self.change_log[:checkpoint_index]

    def _log_change(self, operation: Operation, result: Any):
        """Log a successful change for tracking."""
        self.change_log.append({
            'operation_id': operation.id,
            'description': operation.description,
            'timestamp': datetime.now(),
            'result': result
        })

    def get_change_summary(self) -> str:
        """Get a summary of all changes made."""
        summary = "Change Summary:\n"
        summary += "=" * 50 + "\n"

        for i, change in enumerate(self.change_log, 1):
            summary += f"{i}. {change['description']}\n"
            summary += f"   Time: {change['timestamp']}\n"
            summary += f"   Operation ID: {change['operation_id']}\n"
            summary += "\n"

        return summary

    async def resume_from_failure(
        self,
        failed_operation_id: str,
        retry: bool = True
    ) -> Dict[str, Any]:
        """
        Resume execution from a failed operation.

        Args:
            failed_operation_id: ID of the operation that failed
            retry: Whether to retry the failed operation

        Returns:
            Execution results
        """

        # Find the failed operation
        if failed_operation_id not in self.operations:
            raise ValueError(f"Operation not found: {failed_operation_id}")

        failed_op = self.operations[failed_operation_id]

        # Get remaining operations
        all_ops = list(self.operations.values())
        failed_index = all_ops.index(failed_op)

        if retry:
            remaining_ops = all_ops[failed_index:]
        else:
            remaining_ops = all_ops[failed_index + 1:]

        print(f"Resuming from operation: {failed_operation_id}")
        print(f"Remaining operations: {len(remaining_ops)}")

        # Execute remaining operations
        return await self.execute_operations(remaining_ops, strategy="best_effort")
```

### 6.2 Progress Tracking and Recovery

```python
class ProgressTracker:
    """Track progress of multi-step operations for recovery."""

    def __init__(self, state_file: str = ".autofix_state.json"):
        self.state_file = state_file
        self.state = self._load_state()

    def save_progress(
        self,
        operation_id: str,
        completed_steps: List[str],
        pending_steps: List[str],
        context: Dict[str, Any]
    ):
        """Save current progress to disk."""
        self.state[operation_id] = {
            'completed_steps': completed_steps,
            'pending_steps': pending_steps,
            'context': context,
            'last_updated': datetime.now().isoformat()
        }

        self._save_state()

    def get_progress(self, operation_id: str) -> Optional[Dict]:
        """Retrieve saved progress."""
        return self.state.get(operation_id)

    def can_resume(self, operation_id: str) -> bool:
        """Check if operation can be resumed."""
        progress = self.get_progress(operation_id)
        return progress is not None and len(progress['pending_steps']) > 0

    def _load_state(self) -> Dict:
        """Load state from disk."""
        if Path(self.state_file).exists():
            with open(self.state_file, 'r') as f:
                return json.load(f)
        return {}

    def _save_state(self):
        """Save state to disk."""
        with open(self.state_file, 'w') as f:
            json.dump(self.state, f, indent=2)
```

---

## 7. Safe Fix Application

### 7.1 Dry-Run Mode Implementation

```python
from abc import ABC, abstractmethod
from typing import Generic, TypeVar

T = TypeVar('T')

class Action(ABC, Generic[T]):
    """Abstract action that can be executed or dry-run."""

    @abstractmethod
    async def execute(self) -> T:
        """Execute the action for real."""
        pass

    @abstractmethod
    async def dry_run(self) -> T:
        """Simulate the action without side effects."""
        pass

    @abstractmethod
    def get_description(self) -> str:
        """Get human-readable description."""
        pass

class FileEditAction(Action[bool]):
    """Action to edit a file."""

    def __init__(self, file_path: str, old_content: str, new_content: str):
        self.file_path = file_path
        self.old_content = old_content
        self.new_content = new_content

    async def execute(self) -> bool:
        """Actually modify the file."""
        try:
            with open(self.file_path, 'w') as f:
                f.write(self.new_content)
            return True
        except Exception as e:
            print(f"Failed to edit {self.file_path}: {e}")
            return False

    async def dry_run(self) -> bool:
        """Simulate the file edit."""
        print(f"\n[DRY-RUN] Would edit file: {self.file_path}")
        print(f"Current size: {len(self.old_content)} bytes")
        print(f"New size: {len(self.new_content)} bytes")
        print(f"Diff: {len(self.new_content) - len(self.old_content):+d} bytes")

        # Show diff
        import difflib
        diff = difflib.unified_diff(
            self.old_content.splitlines(keepends=True),
            self.new_content.splitlines(keepends=True),
            fromfile=f"{self.file_path} (current)",
            tofile=f"{self.file_path} (proposed)"
        )
        print("\nDiff:")
        print(''.join(diff))

        return True

    def get_description(self) -> str:
        return f"Edit file: {self.file_path}"

class DryRunEngine:
    """Engine for executing actions in dry-run or real mode."""

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.actions: List[Action] = []

    def add_action(self, action: Action):
        """Add an action to the queue."""
        self.actions.append(action)

    async def execute_all(
        self,
        require_confirmation: bool = True
    ) -> Dict[str, Any]:
        """
        Execute all queued actions.

        Args:
            require_confirmation: If True and not dry-run, ask for confirmation

        Returns:
            Execution results
        """

        if self.dry_run:
            print("\n" + "="*60)
            print("DRY-RUN MODE - No actual changes will be made")
            print("="*60 + "\n")

            results = []
            for i, action in enumerate(self.actions, 1):
                print(f"\nAction {i}/{len(self.actions)}: {action.get_description()}")
                result = await action.dry_run()
                results.append(result)

            print("\n" + "="*60)
            print(f"DRY-RUN COMPLETE - Simulated {len(self.actions)} actions")
            print("="*60 + "\n")

            return {
                'dry_run': True,
                'actions_simulated': len(self.actions),
                'results': results
            }

        else:
            # Real execution
            print("\n" + "="*60)
            print("REAL EXECUTION MODE - Changes will be applied")
            print("="*60 + "\n")

            # Show summary
            print(f"About to execute {len(self.actions)} actions:")
            for i, action in enumerate(self.actions, 1):
                print(f"  {i}. {action.get_description()}")

            if require_confirmation:
                response = input("\nProceed with these actions? (yes/no): ")
                if response.lower() != 'yes':
                    print("Aborted by user")
                    return {
                        'dry_run': False,
                        'aborted': True,
                        'actions_executed': 0
                    }

            # Execute actions
            results = []
            for i, action in enumerate(self.actions, 1):
                print(f"\nExecuting {i}/{len(self.actions)}: {action.get_description()}")
                result = await action.execute()
                results.append(result)

                if not result:
                    print(f"Action failed, stopping execution")
                    break

            print("\n" + "="*60)
            print(f"EXECUTION COMPLETE - Executed {len(results)} actions")
            print("="*60 + "\n")

            return {
                'dry_run': False,
                'actions_executed': len(results),
                'results': results,
                'all_successful': all(results)
            }
```

### 7.2 Interactive Diff Review

```python
import difflib
from typing import List, Tuple

class InteractiveDiffReviewer:
    """Interactive diff review before applying changes."""

    def review_changes(
        self,
        changes: List[Tuple[str, str, str]]  # (file_path, old_content, new_content)
    ) -> Dict[str, bool]:
        """
        Review changes interactively.

        Returns:
            Dict mapping file paths to approval status
        """

        approvals = {}

        print("\n" + "="*60)
        print("CHANGE REVIEW - Review each change before applying")
        print("="*60 + "\n")

        for i, (file_path, old_content, new_content) in enumerate(changes, 1):
            print(f"\n{'='*60}")
            print(f"Change {i}/{len(changes)}: {file_path}")
            print('='*60 + "\n")

            # Show diff
            self._show_diff(file_path, old_content, new_content)

            # Get user approval
            while True:
                response = input("\nApprove this change? (yes/no/quit): ").lower()

                if response == 'yes':
                    approvals[file_path] = True
                    print(f"✓ Approved: {file_path}")
                    break
                elif response == 'no':
                    approvals[file_path] = False
                    print(f"✗ Rejected: {file_path}")
                    break
                elif response == 'quit':
                    print("\nReview aborted by user")
                    return approvals
                else:
                    print("Please enter 'yes', 'no', or 'quit'")

        # Summary
        approved = sum(1 for v in approvals.values() if v)
        rejected = len(approvals) - approved

        print("\n" + "="*60)
        print(f"REVIEW COMPLETE")
        print(f"Approved: {approved}")
        print(f"Rejected: {rejected}")
        print("="*60 + "\n")

        return approvals

    def _show_diff(self, file_path: str, old_content: str, new_content: str):
        """Display a colored diff."""

        diff = difflib.unified_diff(
            old_content.splitlines(keepends=True),
            new_content.splitlines(keepends=True),
            fromfile=f"{file_path} (current)",
            tofile=f"{file_path} (proposed)",
            lineterm=''
        )

        for line in diff:
            if line.startswith('+'):
                print(f"\033[92m{line}\033[0m")  # Green
            elif line.startswith('-'):
                print(f"\033[91m{line}\033[0m")  # Red
            elif line.startswith('@@'):
                print(f"\033[94m{line}\033[0m")  # Blue
            else:
                print(line)
```

### 7.3 Confirmation Requirements

```python
from enum import Enum

class ConfirmationLevel(Enum):
    NONE = 0          # No confirmation needed
    AUTOMATIC = 1     # Automatic if tests pass
    SIMPLE = 2        # Simple yes/no confirmation
    DETAILED = 3      # Show detailed changes + confirmation
    INTERACTIVE = 4   # Interactive approval of each change

class ConfirmationManager:
    """Manages confirmation requirements for different types of changes."""

    # Risk levels for different patterns
    RISK_PATTERNS = {
        'critical': [
            'contracts/',
            'migrations/',
            'auth',
            'security',
            'payment',
            'database',
            'deployment'
        ],
        'high': [
            'api/',
            'config',
            'env',
            'credentials'
        ],
        'medium': [
            'src/',
            'lib/',
            'utils/'
        ],
        'low': [
            'tests/',
            'docs/',
            'README'
        ]
    }

    def get_required_confirmation_level(
        self,
        files_changed: List[str],
        change_type: str
    ) -> ConfirmationLevel:
        """
        Determine required confirmation level based on changes.

        Args:
            files_changed: List of file paths being changed
            change_type: Type of change (fix/refactor/feature)

        Returns:
            Required confirmation level
        """

        # Determine risk level
        risk_level = self._assess_risk_level(files_changed)

        # Map risk to confirmation level
        if risk_level == 'critical':
            return ConfirmationLevel.INTERACTIVE
        elif risk_level == 'high':
            return ConfirmationLevel.DETAILED
        elif risk_level == 'medium':
            return ConfirmationLevel.SIMPLE
        else:
            # Low risk - automatic if tests pass
            return ConfirmationLevel.AUTOMATIC

    def _assess_risk_level(self, files_changed: List[str]) -> str:
        """Assess overall risk level of changes."""

        highest_risk = 'low'

        for file_path in files_changed:
            file_path_lower = file_path.lower()

            # Check against risk patterns
            for risk, patterns in self.RISK_PATTERNS.items():
                if any(pattern in file_path_lower for pattern in patterns):
                    if self._risk_value(risk) > self._risk_value(highest_risk):
                        highest_risk = risk

        return highest_risk

    def _risk_value(self, risk: str) -> int:
        """Convert risk level to numeric value."""
        return {
            'low': 1,
            'medium': 2,
            'high': 3,
            'critical': 4
        }.get(risk, 0)
```

---

## 8. Complete Architecture Design

### 8.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Automated Debugging System                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Fix Orchestrator                            │
│  • Manages fix pipeline                                          │
│  • Coordinates rollback strategies                               │
│  • Handles partial successes                                     │
└─────────────────────────────────────────────────────────────────┘
           │                │                │                │
           ▼                ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Git        │  │  Snapshot    │  │ Verification │  │ Progress     │
│   Manager    │  │  Manager     │  │  Engine      │  │ Tracker      │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
       │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ • Pre-commit │  │ • Snapshots  │  │ • Static     │  │ • State      │
│ • Branches   │  │ • Restore    │  │   Analysis   │  │   Save/Load  │
│ • Rollback   │  │ • Cleanup    │  │ • Tests      │  │ • Resume     │
│ • Tags       │  │ • Hash Check │  │ • Security   │  │ • Recovery   │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### 8.2 Complete Workflow

```python
class AutomatedDebuggingSystem:
    """
    Complete automated debugging system with bulletproof error handling.
    """

    def __init__(self, config: Dict[str, Any]):
        self.git_manager = GitRollbackManager(config['repo_path'])
        self.snapshot_manager = SnapshotManager()
        self.verifier = FixVerifier(config['repo_path'])
        self.partial_handler = PartialSuccessHandler()
        self.progress_tracker = ProgressTracker()
        self.dry_run_engine = DryRunEngine(dry_run=config.get('dry_run', True))
        self.confirmation_manager = ConfirmationManager()

    async def apply_fixes(
        self,
        issues: List[Dict[str, Any]],
        strategy: str = "checkpoint"
    ) -> Dict[str, Any]:
        """
        Apply fixes with comprehensive error handling and rollback.

        Complete workflow:
        1. Validate fixes
        2. Create backups (git + snapshots)
        3. Dry-run mode
        4. Get approvals
        5. Apply fixes
        6. Verify fixes
        7. Handle partial successes
        8. Rollback on failure
        """

        print("\n" + "="*70)
        print("AUTOMATED DEBUGGING SYSTEM - Fix Application")
        print("="*70 + "\n")

        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # PHASE 1: Preparation
        print("\n=== PHASE 1: Preparation ===\n")

        # 1.1 Create git branch
        branch_name = self.git_manager.create_fix_branch(
            issue_id=session_id,
            branch_type="test"
        )
        print(f"✓ Created branch: {branch_name}")

        # 1.2 Create pre-fix commit
        files_affected = self._extract_affected_files(issues)
        commit_hash, _ = self.git_manager.create_pre_fix_commit(
            issue_id=session_id,
            files_affected=files_affected,
            metadata={'issues': issues, 'strategy': strategy}
        )
        print(f"✓ Created pre-fix commit: {commit_hash}")

        # 1.3 Create file snapshots
        snapshot_id = f"snapshot_{session_id}"
        self.snapshot_manager.create_snapshot(
            files=files_affected,
            snapshot_id=snapshot_id,
            metadata={'session_id': session_id}
        )
        print(f"✓ Created snapshots: {snapshot_id}")

        # PHASE 2: Dry-Run
        print("\n=== PHASE 2: Dry-Run Mode ===\n")

        operations = self._create_operations(issues)

        for op in operations:
            self.dry_run_engine.add_action(op)

        dry_run_result = await self.dry_run_engine.execute_all(
            require_confirmation=False
        )

        if not dry_run_result['results']:
            print("✗ Dry-run failed")
            return {'success': False, 'phase': 'dry_run'}

        print(f"✓ Dry-run completed: {len(operations)} actions simulated")

        # PHASE 3: Approval
        print("\n=== PHASE 3: Approval ===\n")

        confirmation_level = self.confirmation_manager.get_required_confirmation_level(
            files_changed=files_affected,
            change_type='fix'
        )

        print(f"Required confirmation level: {confirmation_level.name}")

        if confirmation_level != ConfirmationLevel.NONE:
            approved = await self._get_approval(
                operations=operations,
                confirmation_level=confirmation_level
            )

            if not approved:
                print("✗ Changes not approved, aborting")
                return {'success': False, 'phase': 'approval'}

        print("✓ Changes approved")

        # PHASE 4: Execution
        print("\n=== PHASE 4: Execution ===\n")

        execution_result = await self.partial_handler.execute_operations(
            operations=operations,
            strategy=strategy
        )

        print(f"\nExecution Results:")
        print(f"  Total operations: {execution_result['total']}")
        print(f"  Successful: {len(execution_result['successful'])}")
        print(f"  Failed: {len(execution_result['failed'])}")

        # PHASE 5: Verification
        print("\n=== PHASE 5: Verification ===\n")

        verification_result = await self.verifier.verify_fix(
            fix_context={
                'files_changed': files_affected,
                'operations': operations
            },
            test_levels=['unit', 'integration', 'security']
        )

        print(f"\nVerification Results:")
        print(f"  Tests run: {verification_result.tests_run}")
        print(f"  Tests passed: {verification_result.tests_passed}")
        print(f"  Tests failed: {verification_result.tests_failed}")
        print(f"  Cascading failures: {len(verification_result.cascading_failures)}")

        # PHASE 6: Decision
        print("\n=== PHASE 6: Decision ===\n")

        if verification_result.success and execution_result['final_status'] == 'success':
            # SUCCESS - Create post-fix commit
            print("✓ All fixes successful and verified")

            post_commit_hash = self.git_manager.create_post_fix_commit(
                issue_id=session_id,
                fix_description=f"Applied {len(operations)} fixes",
                test_results=verification_result.__dict__
            )

            print(f"✓ Created post-fix commit: {post_commit_hash}")

            # Cleanup snapshots
            self.snapshot_manager.cleanup_snapshot(snapshot_id)

            return {
                'success': True,
                'phase': 'complete',
                'session_id': session_id,
                'branch_name': branch_name,
                'execution': execution_result,
                'verification': verification_result
            }

        else:
            # FAILURE - Rollback
            print("✗ Fixes failed or did not pass verification")
            print("\n=== PHASE 7: Rollback ===\n")

            await self._perform_rollback(
                commit_hash=commit_hash,
                snapshot_id=snapshot_id,
                execution_result=execution_result
            )

            return {
                'success': False,
                'phase': 'rolled_back',
                'session_id': session_id,
                'execution': execution_result,
                'verification': verification_result
            }

    async def _perform_rollback(
        self,
        commit_hash: str,
        snapshot_id: str,
        execution_result: Dict
    ):
        """Perform complete rollback."""

        print("Rolling back changes...")

        # Try snapshot rollback first (faster)
        snapshot_success = self.snapshot_manager.restore_snapshot(snapshot_id)

        if snapshot_success:
            print("✓ Restored from snapshots")
        else:
            # Fall back to git rollback
            print("Snapshot restore failed, using git rollback...")
            git_success = self.git_manager.rollback_to_commit(
                commit_hash=commit_hash,
                strategy=RollbackStrategy.HARD
            )

            if git_success:
                print("✓ Restored from git commit")
            else:
                print("✗ Rollback failed - manual intervention required")
                print(f"   Recovery commit: {commit_hash}")
                print(f"   Snapshot ID: {snapshot_id}")
```

---

## 9. Implementation Recommendations

### 9.1 Priority Implementation Order

**Phase 1: Foundation (Week 1)**
1. Git-based rollback manager
2. Basic snapshot system
3. Simple verification runner

**Phase 2: Safety (Week 2)**
4. Dry-run engine
5. Confirmation system
6. Progress tracker

**Phase 3: Advanced (Week 3-4)**
7. Partial success handler
8. Smart contract deployment manager
9. Database migration manager

**Phase 4: Integration (Week 5)**
10. Complete system integration
11. Testing and validation
12. Documentation

### 9.2 Technology Stack Recommendations

**Python Components:**
- `GitPython` - Git operations
- `pytest` - Testing framework
- `asyncio` - Async operations
- `pydantic` - Data validation
- `rich` - Terminal UI

**TypeScript/Node Components:**
- `simple-git` - Git operations
- `hardhat` - Smart contract testing
- `@supabase/supabase-js` - Database operations
- `vitest` - Testing framework
- `chalk` - Terminal colors

### 9.3 Configuration File Example

```yaml
# autofix-config.yaml
debugging_system:
  # General settings
  repo_path: "."
  dry_run: true  # Always start in dry-run mode

  # Rollback strategy
  rollback:
    default_strategy: "checkpoint"  # all_or_nothing | best_effort | checkpoint
    git:
      auto_commit: true
      commit_granularity: "atomic"  # atomic | batch | manual
      branch_prefix: "autofix"
    snapshots:
      enabled: true
      cleanup_after: 7  # days
      verify_hash: true

  # Verification
  verification:
    required_tests:
      - "unit"
      - "integration"
    optional_tests:
      - "e2e"
      - "security"
    fail_on_cascading: true
    parallel_execution: true

  # Confirmation
  confirmation:
    default_level: "simple"  # none | automatic | simple | detailed | interactive
    critical_patterns:
      - "contracts/"
      - "migrations/"
      - "auth"
    require_manual_for_critical: true

  # Smart contracts
  contracts:
    testnet_first: true
    verify_on_etherscan: true
    deployment_checks:
      - "gas_usage"
      - "constructor_args"
      - "proxy_compatibility"

  # Database
  database:
    backup_before_migration: true
    test_migrations_dry_run: true
    rollback_timeout: 300  # seconds

  # Progress tracking
  progress:
    state_file: ".autofix_state.json"
    checkpoint_interval: 3  # operations
    enable_resume: true
```

### 9.4 Best Practices Summary

1. **Always Use Dry-Run First** - Never apply changes without simulation
2. **Create Recovery Points** - Git commits + snapshots before changes
3. **Test Exhaustively** - Multiple test levels, cascading failure detection
4. **Handle Partial Success** - Use appropriate strategy for the situation
5. **Track Everything** - Maintain audit log of all changes
6. **Fail Safe** - Default to rollback on any uncertainty
7. **Require Approval for Critical** - Manual review for high-risk changes
8. **Monitor After Changes** - Extended monitoring for deployed changes
9. **Document Rollback Procedures** - Clear instructions for manual rollback
10. **Regular Cleanup** - Remove old snapshots and temporary branches

### 9.5 Testing Strategy

```python
# test_rollback_system.py
import pytest
from automated_debugging_system import AutomatedDebuggingSystem

class TestRollbackSystem:
    """Comprehensive tests for rollback system."""

    @pytest.fixture
    def system(self, tmp_path):
        """Create test system instance."""
        config = {
            'repo_path': str(tmp_path),
            'dry_run': False
        }
        return AutomatedDebuggingSystem(config)

    async def test_successful_fix_no_rollback(self, system):
        """Test successful fix application."""
        issues = [
            {'type': 'syntax_error', 'file': 'test.py', 'fix': 'add_semicolon'}
        ]

        result = await system.apply_fixes(issues)

        assert result['success'] == True
        assert result['phase'] == 'complete'

    async def test_failed_fix_triggers_rollback(self, system):
        """Test that failed fixes trigger rollback."""
        issues = [
            {'type': 'breaking_change', 'file': 'test.py', 'fix': 'invalid_change'}
        ]

        result = await system.apply_fixes(issues)

        assert result['success'] == False
        assert result['phase'] == 'rolled_back'

    async def test_partial_success_handling(self, system):
        """Test partial success with best_effort strategy."""
        issues = [
            {'type': 'success', 'file': 'test1.py', 'fix': 'valid_fix'},
            {'type': 'failure', 'file': 'test2.py', 'fix': 'invalid_fix'},
            {'type': 'success', 'file': 'test3.py', 'fix': 'valid_fix'}
        ]

        result = await system.apply_fixes(issues, strategy='best_effort')

        assert len(result['execution']['successful']) == 2
        assert len(result['execution']['failed']) == 1
```

---

## Conclusion

This architecture provides **bulletproof error handling and rollback** capabilities for automated debugging systems:

### Key Features:
1. **Multi-Layer Rollback** - Git + Snapshots for maximum safety
2. **Comprehensive Verification** - Static analysis + tests + security scans
3. **Partial Success Handling** - Flexible strategies for different scenarios
4. **Smart Contract Safety** - Testnet-first with upgrade patterns
5. **Database Safety** - Backup + dry-run + automatic down migrations
6. **Dry-Run Mode** - Test everything before applying
7. **Progress Tracking** - Resume from failures
8. **Risk-Based Confirmations** - Automatic approval for low-risk, manual for critical

### Reliability Guarantees:
- **No data loss** - Multiple backup strategies
- **Fast recovery** - Snapshots for quick rollback
- **Audit trail** - Complete change history
- **Resumable** - Continue after failures
- **Safe by default** - Dry-run mode, confirmations
- **Cascading failure detection** - Catch unintended side effects

This system ensures that automated fixes can be applied safely, with confidence that any issues can be quickly rolled back without data loss or system instability.
