#!/usr/bin/env node

/**
 * Rollback System
 *
 * Provides safety mechanisms for reverting changes:
 * - Creates git commits as savepoints
 * - Creates file snapshots
 * - Restores from snapshots
 * - Multi-strategy rollback (git reset, file restore)
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const crypto = require('crypto');

class RollbackSystem {
  constructor(rootPath) {
    this.rootPath = rootPath || process.cwd();
    this.snapshotsPath = path.join(this.rootPath, '.claude/snapshots');
    this.currentSnapshot = null;
  }

  async createSavepoint(description = 'Auto-savepoint') {
    console.log(`📸 Creating savepoint: ${description}\n`);

    const savepoint = {
      id: this.generateId(),
      description: description,
      timestamp: new Date().toISOString(),
      git: null,
      files: []
    };

    // Try git commit first (preferred)
    const gitSavepoint = await this.createGitSavepoint(description);
    if (gitSavepoint) {
      savepoint.git = gitSavepoint;
      console.log('  ✓ Git commit created');
    } else {
      console.log('  ⚠️  Git commit failed (using file snapshots)');
    }

    // Create file snapshots as backup
    const fileSnapshots = await this.createFileSnapshots();
    savepoint.files = fileSnapshots;
    console.log(`  ✓ Created ${fileSnapshots.length} file snapshots`);

    // Save savepoint metadata
    await this.saveSavepoint(savepoint);

    this.currentSnapshot = savepoint;
    console.log(`\n✅ Savepoint created: ${savepoint.id}`);

    return savepoint;
  }

  async createGitSavepoint(description) {
    try {
      // Check if git repo exists
      await execPromise('git rev-parse --git-dir', { cwd: this.rootPath });

      // Check for changes
      const { stdout: status } = await execPromise('git status --porcelain', {
        cwd: this.rootPath
      });

      if (status.trim().length === 0) {
        console.log('  ℹ️  No changes to commit');
        // Get current HEAD
        const { stdout: head } = await execPromise('git rev-parse HEAD', {
          cwd: this.rootPath
        });
        return { commit: head.trim(), noChanges: true };
      }

      // Stage all changes
      await execPromise('git add .', { cwd: this.rootPath });

      // Create commit
      const message = `[SAVEPOINT] ${description}`;
      await execPromise(`git commit -m "${message}"`, { cwd: this.rootPath });

      // Get commit hash
      const { stdout: commit } = await execPromise('git rev-parse HEAD', {
        cwd: this.rootPath
      });

      return {
        commit: commit.trim(),
        message: message
      };
    } catch (error) {
      console.log(`  Git error: ${error.message}`);
      return null;
    }
  }

  async createFileSnapshots() {
    const snapshots = [];

    // Snapshot critical files
    const criticalPatterns = [
      'package.json',
      'package-lock.json',
      '.env',
      '.env.local',
      '.env.production',
      'next.config.js',
      'hardhat.config.js',
      'foundry.toml',
      'Anchor.toml',
      'vercel.json'
    ];

    for (const pattern of criticalPatterns) {
      const file = path.join(this.rootPath, pattern);

      try {
        const exists = await fs.promises.access(file).then(() => true).catch(() => false);
        if (!exists) continue;

        const content = await fs.promises.readFile(file, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        const snapshotPath = path.join(
          this.snapshotsPath,
          `${pattern.replace(/\//g, '_')}_${hash.substring(0, 8)}`
        );

        await fs.promises.mkdir(this.snapshotsPath, { recursive: true });
        await fs.promises.writeFile(snapshotPath, content, 'utf-8');

        snapshots.push({
          originalPath: pattern,
          snapshotPath: snapshotPath,
          hash: hash
        });
      } catch (error) {
        console.log(`  ⚠️  Could not snapshot ${pattern}: ${error.message}`);
      }
    }

    return snapshots;
  }

  async rollback(savepointId) {
    console.log(`⏮️  Rolling back to savepoint: ${savepointId}\n`);

    const savepoint = await this.loadSavepoint(savepointId);

    if (!savepoint) {
      console.log('  ✗ Savepoint not found');
      return { success: false, error: 'Savepoint not found' };
    }

    let gitRollback = false;
    let fileRollback = false;

    // Try git rollback first
    if (savepoint.git && !savepoint.git.noChanges) {
      gitRollback = await this.rollbackGit(savepoint.git.commit);
    }

    // Rollback files if git failed or as additional safety
    if (savepoint.files.length > 0) {
      fileRollback = await this.rollbackFiles(savepoint.files);
    }

    if (gitRollback || fileRollback) {
      console.log('\n✅ Rollback completed');
      return { success: true, git: gitRollback, files: fileRollback };
    } else {
      console.log('\n✗ Rollback failed');
      return { success: false, error: 'No rollback method succeeded' };
    }
  }

  async rollbackGit(commitHash) {
    console.log('Git rollback...');

    try {
      // Reset to commit (soft reset to preserve changes in working directory)
      await execPromise(`git reset --soft ${commitHash}`, { cwd: this.rootPath });

      console.log(`  ✓ Reset to commit ${commitHash.substring(0, 8)}`);
      return true;
    } catch (error) {
      console.log(`  ✗ Git rollback failed: ${error.message}`);
      return false;
    }
  }

  async rollbackFiles(fileSnapshots) {
    console.log('File rollback...');

    let restored = 0;

    for (const snapshot of fileSnapshots) {
      try {
        const content = await fs.promises.readFile(snapshot.snapshotPath, 'utf-8');
        const targetPath = path.join(this.rootPath, snapshot.originalPath);

        await fs.promises.writeFile(targetPath, content, 'utf-8');
        restored++;

        console.log(`  ✓ Restored ${snapshot.originalPath}`);
      } catch (error) {
        console.log(`  ✗ Could not restore ${snapshot.originalPath}: ${error.message}`);
      }
    }

    if (restored > 0) {
      console.log(`  ✓ Restored ${restored} files`);
      return true;
    } else {
      return false;
    }
  }

  async listSavepoints() {
    console.log('📋 Available savepoints:\n');

    try {
      const metadataFiles = await fs.promises.readdir(this.snapshotsPath);
      const savepoints = [];

      for (const file of metadataFiles) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.promises.readFile(
              path.join(this.snapshotsPath, file),
              'utf-8'
            );
            const savepoint = JSON.parse(content);
            savepoints.push(savepoint);
          } catch {}
        }
      }

      // Sort by timestamp (newest first)
      savepoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (savepoints.length === 0) {
        console.log('  No savepoints found');
        return [];
      }

      for (const sp of savepoints) {
        const date = new Date(sp.timestamp).toLocaleString();
        console.log(`  ${sp.id}`);
        console.log(`    Description: ${sp.description}`);
        console.log(`    Created: ${date}`);
        console.log(`    Git commit: ${sp.git ? sp.git.commit.substring(0, 8) : 'none'}`);
        console.log(`    File snapshots: ${sp.files.length}`);
        console.log('');
      }

      return savepoints;
    } catch (error) {
      console.log('  ⚠️  Could not list savepoints');
      return [];
    }
  }

  async cleanOldSavepoints(keepCount = 10) {
    console.log(`🧹 Cleaning old savepoints (keeping ${keepCount} most recent)...\n`);

    try {
      const metadataFiles = await fs.promises.readdir(this.snapshotsPath);
      const savepoints = [];

      for (const file of metadataFiles) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.promises.readFile(
              path.join(this.snapshotsPath, file),
              'utf-8'
            );
            const savepoint = JSON.parse(content);
            savepoints.push({ ...savepoint, metadataFile: file });
          } catch {}
        }
      }

      // Sort by timestamp (oldest first)
      savepoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Delete old savepoints
      const toDelete = savepoints.slice(0, Math.max(0, savepoints.length - keepCount));

      for (const sp of toDelete) {
        // Delete metadata
        await fs.promises.unlink(path.join(this.snapshotsPath, sp.metadataFile));

        // Delete file snapshots
        for (const file of sp.files) {
          try {
            await fs.promises.unlink(file.snapshotPath);
          } catch {}
        }

        console.log(`  ✓ Deleted savepoint ${sp.id}`);
      }

      console.log(`\n✅ Cleaned ${toDelete.length} old savepoints`);
    } catch (error) {
      console.log(`  ⚠️  Could not clean savepoints: ${error.message}`);
    }
  }

  // ==================== UTILITY METHODS ====================

  generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `savepoint_${timestamp}_${random}`;
  }

  async saveSavepoint(savepoint) {
    const metadataPath = path.join(this.snapshotsPath, `${savepoint.id}.json`);
    await fs.promises.mkdir(this.snapshotsPath, { recursive: true });
    await fs.promises.writeFile(metadataPath, JSON.stringify(savepoint, null, 2), 'utf-8');
  }

  async loadSavepoint(savepointId) {
    try {
      const metadataPath = path.join(this.snapshotsPath, `${savepointId}.json`);
      const content = await fs.promises.readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const rollback = new RollbackSystem();

  if (command === 'create') {
    const description = args.slice(1).join(' ') || 'Manual savepoint';
    rollback.createSavepoint(description).catch(console.error);
  } else if (command === 'rollback') {
    const savepointId = args[1];
    if (!savepointId) {
      console.log('Usage: rollback-system.js rollback <savepoint-id>');
      process.exit(1);
    }
    rollback.rollback(savepointId).catch(console.error);
  } else if (command === 'list') {
    rollback.listSavepoints().catch(console.error);
  } else if (command === 'clean') {
    const keep = parseInt(args[1]) || 10;
    rollback.cleanOldSavepoints(keep).catch(console.error);
  } else {
    console.log(`
Web3 Debugging Framework - Rollback System

Usage:
  rollback-system.js create [description]     Create a new savepoint
  rollback-system.js rollback <savepoint-id>  Rollback to a savepoint
  rollback-system.js list                     List all savepoints
  rollback-system.js clean [keep-count]       Clean old savepoints (default: keep 10)

Examples:
  node rollback-system.js create "Before applying fixes"
  node rollback-system.js rollback savepoint_abc123
  node rollback-system.js list
  node rollback-system.js clean 5
`);
  }
}

module.exports = { RollbackSystem };
