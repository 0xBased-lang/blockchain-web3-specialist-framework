# Active Task Registry

> **Purpose**: Prevent agent duplication of effort through task claiming mechanism
> **Updated by**: All agents before starting work
> **Read by**: All agents before claiming tasks

**Addresses Edge Case 2.2**: Agent duplication of effort → wasted work and conflicting implementations

---

## How Task Registry Works

1. **Before Starting**: Agent checks if task is already claimed
2. **Claim Task**: Agent adds entry to "In Progress" section
3. **During Work**: Task remains claimed (prevents others from duplicating)
4. **On Completion**: Agent moves task to "Completed" section
5. **On Failure**: Agent documents issue and moves to "Blocked"

---

## Task Claiming Protocol

### Step 1: Check for Existing Claim
```markdown
BEFORE starting work, search this file for your intended task.
If task is already in "In Progress", DO NOT start duplicate work.
```

### Step 2: Claim the Task
```markdown
Add your task to "In Progress" section with:
- Unique Task ID
- Clear description
- Your agent name
- Start timestamp
- Estimated completion time
```

### Step 3: Update on Completion
```markdown
When done:
1. Move task from "In Progress" to "Completed Today"
2. Update dependent tasks (mark them as unblocked)
3. Add outcome summary
```

---

## In Progress

| Task ID | Description | Claimed By | Started | ETA | Status |
|---------|-------------|------------|---------|-----|--------|
| *No active tasks* | - | - | - | - | - |

---

## Queued

Tasks waiting for dependencies or agent availability.

| Task ID | Description | Priority | Assigned To | Dependencies | Status |
|---------|-------------|----------|-------------|--------------|--------|
| *No queued tasks* | - | - | - | - | - |

---

## Completed Today

| Task ID | Description | Completed By | Duration | Outcome |
|---------|-------------|--------------|----------|---------|
| *No completed tasks yet* | - | - | - | - |

---

## Blocked

Tasks that cannot proceed due to external factors.

| Task ID | Description | Blocked By | Since | Blocker Details |
|---------|-------------|------------|-------|-----------------|
| *No blocked tasks* | - | - | - | - |

---

## Example Task Entry

```markdown
## In Progress

| Task ID | Description | Claimed By | Started | ETA | Status |
|---------|-------------|------------|---------|-----|--------|
| TASK-001 | Implement pausable to StakingRewards | contract-developer | 2025-11-12 10:00 | 2h | 🟡 In Progress |
| TASK-002 | Security audit of Governance contract | security-auditor | 2025-11-12 10:30 | 3h | 🟡 In Progress |
```

---

## Task ID Format

Use format: `TASK-XXX` where XXX is sequential number

Example IDs:
- `TASK-001` - First task
- `TASK-002` - Second task
- `TASK-025` - Twenty-fifth task

---

## Task Status Indicators

- 🟡 **In Progress** - Agent actively working
- ⏸️ **Paused** - Temporarily stopped
- 🔴 **Blocked** - Cannot proceed
- ✅ **Completed** - Successfully finished
- ❌ **Failed** - Completed with errors

---

## Task Priority Levels

- **CRITICAL** - Deployment blocker, must be done immediately
- **HIGH** - Important feature or fix
- **MEDIUM** - Normal priority
- **LOW** - Nice-to-have, can be deferred

---

## Instructions for Agents

### When Starting New Work

1. **Read this entire file** to check for duplicate work
2. **Search for similar tasks** in "In Progress" section
3. **If duplicate found**:
   - DO NOT start duplicate work
   - Coordinate with existing agent if needed
   - Choose different task or wait
4. **If no duplicate**:
   - Assign next Task ID
   - Add entry to "In Progress"
   - Update this file atomically using `.claude/scripts/update-context.sh`

### While Working

1. **Keep your task entry updated** if ETA changes
2. **Add status indicator** (🟡, ⏸️, etc.)
3. **If blocked**: Move to "Blocked" section with details

### When Complete

1. **Move task** from "In Progress" to "Completed Today"
2. **Add outcome summary** (test coverage, what was built, etc.)
3. **Calculate duration** (actual time spent)
4. **Update dependent tasks** (if any were waiting for yours)

### Handling Conflicts

If you discover another agent is working on same task:
1. **Stop immediately**
2. **Check timestamps** - who claimed first?
3. **Coordinate**: Maybe you can work on different aspects
4. **Document** in DECISIONS.md if coordination needed

---

## Task Dependencies

When a task depends on another:

```markdown
## Queued

| Task ID | Description | Priority | Assigned To | Dependencies | Status |
|---------|-------------|----------|-------------|--------------|--------|
| TASK-003 | Deploy to testnet | deployment-manager | HIGH | TASK-001, TASK-002 | ⏸️ Waiting |
```

When dependencies complete:
- Dependent task moves from "Queued" to "In Progress"
- Agent can claim and begin work

---

## Cleanup Policy

At end of each day:
- Move "Completed Today" to archive (optional)
- Keep only last 7 days of completed tasks
- Long-term history in PROJECT_STATE.md

---

## Example Workflow

```
User: "Add pausable functionality to StakingRewards"

contract-developer:
1. Reads ACTIVE_TASKS.md
2. Checks if "pausable" task already in progress (no)
3. Adds TASK-001 to "In Progress" section:
   - TASK-001 | Add pausable to StakingRewards | contract-developer | 10:00 | 2h | 🟡
4. Works on implementation
5. On completion, moves to "Completed Today":
   - TASK-001 | Add pausable to StakingRewards | contract-developer | 2h | ✅ Tests passing, coverage 95%
```

---

## Integration with Other Context Files

**PROJECT_STATE.md**: Long-term record of completed work
**ACTIVE_TASKS.md**: Short-term tracking of current work
**DECISIONS.md**: Why we chose to do certain tasks

Flow:
```
ACTIVE_TASKS.md (today's work)
    ↓ (at end of day)
PROJECT_STATE.md (permanent record)
```

---

**Last Updated**: 2025-11-12 (Initial template)
**Status**: Active and ready for use
