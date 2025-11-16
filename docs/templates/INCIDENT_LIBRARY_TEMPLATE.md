# Incident Library

**Purpose**: Document all production incidents, their root causes, solutions, and prevention strategies.

**Why This Matters**: zmartV0.69's incident library (rated 5/5 in forensics analysis) prevented repeated debugging by documenting solutions. kektechV0.69 lacked this and spent hours re-solving similar issues.

**Usage**:
1. Copy the template below for each new incident
2. Fill in all sections immediately after resolution (while details are fresh)
3. Update prevention strategies in relevant guides
4. Cross-reference related incidents

---

## Incident Template

Copy the section below for each new incident:

```markdown
### INCIDENT-XXX: [Brief, Descriptive Title]

**Date**: YYYY-MM-DD
**Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
**Components Affected**: [List all services, code modules, or infrastructure]
**Status**: [RESOLVED/IN-PROGRESS/DEFERRED/WONTFIX]
**Time to Resolution**: [Hours/Days from detection to fix deployed]
**Impact**: [Description of user-facing or operational impact]

---

#### Symptoms

**What Users Experienced**:
- [Observable behavior from user perspective]
- [Error messages users saw]
- [Features that stopped working]

**What Developers Observed**:
- [Logs, metrics, or monitoring alerts]
- [Error messages in code/console]
- [Unexpected behavior in tests or production]

**Error Messages** (exact text):
```
[Paste exact error messages here]
```

**Code Examples** (if applicable):
```[language]
// File: [path/to/your/file.ts:line-number]
[Relevant code snippet showing the issue]
```

**Screenshots/Logs** (if applicable):
[Attach or link to relevant screenshots, log files, or dashboards]

---

#### Root Cause Analysis

**Primary Cause**:
[Single root cause, or mark as "MULTIPLE" if truly multiple independent causes]

**Contributing Factors**:
1. [Factor that enabled or amplified the issue]
2. [Second factor, if applicable]
3. [Additional factors]

**Why It Happened** (Chain of Events):
[Step-by-step explanation of how the issue occurred, from trigger to symptom]

Example:
```
1. Developer renamed field `userId` → `walletAddress` in backend API
2. Frontend code not updated (still using `userId`)
3. TypeScript didn't catch error (using `any` type)
4. API validation not configured (Zod schema missing)
5. Request sent with wrong field name
6. Backend silently ignored unknown field
7. Data not saved to database
8. No error thrown or logged
9. User action appeared successful but data lost
```

**Related Code**:
```[language]
// Before (broken)
[Code showing the problematic state]

// After (fixed)
[Code showing the corrected state]
```

---

#### Investigation Steps (For Future Reference)

**IMPORTANT**: Document the ACTUAL steps you took, not idealized steps. This helps others debug faster.

**Step 1: [First action taken]**
```bash
# Commands run
[Exact commands with output]
```

**What this revealed**:
[What you learned from this step]

**Step 2: [Second action taken]**
```bash
# Commands run
[Exact commands with output]
```

**What this revealed**:
[What you learned from this step]

**Step 3: [Continue for all steps...]**

**Dead Ends Explored** (Important to document):
- ❌ [Hypothesis that was investigated but turned out to be wrong]
- ❌ [Another false lead]
- ⏱️ [Why this mattered: prevents others from wasting time on same dead ends]

---

#### Solution Implementation

**Fix #1: [Description of first fix]**

**File**: `[your-file-path-here].ts` _(example placeholder - replace with actual file path)_

**Changes**:
```[language]
// Before
[Code before fix]

// After
[Code after fix]
```

**Why this works**:
[Explanation of how this fix addresses the root cause]

**Fix #2: [Description of second fix, if applicable]**

[Repeat structure for each fix]

**Deployment Steps**:
```bash
# Commands to deploy the fix
[Exact commands in order]
```

**Rollback Procedure** (if deployment fails):
```bash
# Commands to rollback
[Exact commands to undo changes]
```

---

#### Verification Results

**Before Fix**:
```
[Show the broken state: logs, screenshots, metrics]

Example:
pm2 status
┌─────┬──────────────┬─────────┬─────────┬──────────┬─────────┐
│ id  │ name         │ mode    │ status  │ restart  │ uptime  │
├─────┼──────────────┼─────────┼─────────┼──────────┼─────────┤
│ 0   │ backend-api  │ cluster │ errored │ 47       │ 5s      │
└─────┴──────────────┴─────────┴─────────┴──────────┴─────────┘
```

**After Fix**:
```
[Show the working state: logs, screenshots, metrics]

Example:
pm2 status
┌─────┬──────────────┬─────────┬─────────┬──────────┬─────────┐
│ id  │ name         │ mode    │ status  │ restart  │ uptime  │
├─────┼──────────────┼─────────┼─────────┼──────────┼─────────┤
│ 0   │ backend-api  │ cluster │ online  │ 47       │ 5m      │
└─────┴──────────────┴─────────┴─────────┴──────────┴─────────┘
```

**Verification Tests Run**:
- [ ] [Test 1: Description and result]
- [ ] [Test 2: Description and result]
- [ ] [Test 3: Description and result]

**Monitoring Checks** (24-48 hours post-fix):
- [ ] No errors in logs
- [ ] Restart count stable
- [ ] User reports confirm issue resolved
- [ ] Performance metrics normal

---

#### Prevention Strategies

**To Prevent Root Cause**:

1. ✅ **[Prevention Strategy 1]**
   ```[language]
   // Code example of prevention
   [Working code that prevents this issue]
   ```
   **Where implemented**: [File paths or process changes]

2. ✅ **[Prevention Strategy 2]**
   [Description and implementation]

3. ✅ **[Prevention Strategy 3]**
   [Description and implementation]

**Documentation Updates Required**:
- [ ] Update Guide X, Section Y with this pattern
- [ ] Add to edge case checklist (Guide 16)
- [ ] Update CLAUDE.md gotchas section
- [ ] Add to pre-deployment checklist
- [ ] Add validation script to prevent recurrence

**Process Changes**:
- [ ] [New step in deployment workflow]
- [ ] [New code review checklist item]
- [ ] [New monitoring alert]
- [ ] [New pre-commit hook]

**Automated Prevention** (best):
```[language]
// Example: Pre-commit hook to prevent this issue
[Code for automation]
```

---

#### Related Incidents

**Similar Incidents**:
- INCIDENT-YYY: [Brief description and link]
- INCIDENT-ZZZ: [Brief description and link]

**Caused By** (if this incident was triggered by another):
- INCIDENT-AAA: [Description]

**Led To** (if this incident caused others):
- INCIDENT-BBB: [Description]

**Lessons Learned**:
- [Key takeaway 1]
- [Key takeaway 2]
- [Key takeaway 3]

---

#### Timeline

| Time | Event | Who |
|------|-------|-----|
| YYYY-MM-DD HH:MM | Issue first detected | [Name/System] |
| YYYY-MM-DD HH:MM | Investigation started | [Name] |
| YYYY-MM-DD HH:MM | Root cause identified | [Name] |
| YYYY-MM-DD HH:MM | Fix implemented | [Name] |
| YYYY-MM-DD HH:MM | Fix deployed to production | [Name] |
| YYYY-MM-DD HH:MM | Verification complete | [Name] |

---

#### Metrics

**Detection Time**: [How long from incident start to detection]
**Investigation Time**: [How long to identify root cause]
**Fix Development Time**: [How long to implement fix]
**Deployment Time**: [How long to deploy to production]
**Total Resolution Time**: [Total from detection to resolution]

**Cost Estimate**:
- Developer hours: [X hours × Y developers]
- User impact: [Number of users affected × duration]
- Revenue impact: [If applicable]

---

#### Attachments

- [Link to Slack thread]
- [Link to GitHub issue]
- [Link to pull request with fix]
- [Link to monitoring dashboard]
- [Link to log files]

---

**Incident Owner**: [Name]
**Reviewers**: [Names of people who reviewed this incident doc]
**Last Updated**: YYYY-MM-DD
```

---

## Real-World Example: INCIDENT-001 from zmartV0.69

Below is the actual incident documentation from zmartV0.69 that inspired this template:

### INCIDENT-001: Backend Service Crash Loop (vote-aggregator & market-monitor)

**Date**: 2025-11-09
**Severity**: CRITICAL
**Components Affected**: vote-aggregator, market-monitor, backend infrastructure
**Status**: RESOLVED
**Time to Resolution**: ~4 hours (detection to production fix)
**Impact**: Backend services completely down, unable to aggregate votes or monitor markets

---

#### Symptoms

**What Users Experienced**:
- Markets not updating with vote results
- Market monitoring not functioning
- No visible errors in frontend (backend down silently)

**What Developers Observed**:
- PM2 showing both services restarting continuously
- 47 restarts in 4 minutes (~5 seconds per crash)
- Services showing "online" status but immediately restarting
- Empty log files (no errors because code never ran)

**Error Messages** (exact text):
```bash
pm2 status
┌─────┬─────────────────┬─────────┬─────────┬──────────┬─────────┐
│ id  │ name            │ mode    │ status  │ restart  │ uptime  │
├─────┼─────────────────┼─────────┼─────────┼──────────┼─────────┤
│ 0   │ vote-aggregator │ fork    │ online  │ 47       │ 5s      │
│ 1   │ market-monitor  │ fork    │ online  │ 47       │ 8s      │
└─────┴─────────────────┴─────────┴─────────┴──────────┴─────────┘
```

**Code Examples**:
```typescript
// File: backend/vote-aggregator/src/index.ts:35-37
const DEPLOYER_SECRET_KEY = config.solana.backendAuthorityPrivateKey;
if (!DEPLOYER_SECRET_KEY) {
  throw new Error('Backend authority private key is required');
  // ↑ This throw caused immediate crash
}
```

---

#### Root Cause Analysis

**Primary Cause**: MULTIPLE (2 independent root causes)

**Root Cause #1: Missing Environment Variable**
- `.env` file had `BACKEND_KEYPAIR_PATH` (file path to keypair)
- Code expected `BACKEND_AUTHORITY_PRIVATE_KEY` (base58-encoded private key)
- Environment variable name mismatch
- Code threw error on startup → PM2 restarted → infinite loop

**Root Cause #2: TypeScript Compilation Failures**
- 4 type errors in `backend/src/` prevented compilation
- No compiled JavaScript files in `backend/dist/`
- PM2 tried to run non-existent `dist/index.js`
- Silent failure (no logs because entry point didn't exist)

**Contributing Factors**:
1. No environment variable validation script
2. No pre-deployment build check
3. TypeScript errors not caught in CI/CD
4. PM2 not configured to fail after N restarts
5. No health check endpoints to detect "fake online" status

**Why It Happened** (Chain of Events):
```
1. Refactored config to use base58 private key instead of file path
2. Updated config TypeScript interface
3. Forgot to update .env file with new variable name
4. Introduced 4 TypeScript errors in unrelated code
5. Ran `pm2 start` without running `npm run build` first
6. PM2 started process successfully (no syntax errors in entry file)
7. Code immediately threw on missing env var
8. PM2 auto-restarted
9. Loop repeated 47 times in 4 minutes
```

---

#### Investigation Steps

**Step 1: Check PM2 status**
```bash
pm2 status
```
**What this revealed**: High restart count, very low uptime (red flag for crash loop)

**Step 2: Check logs**
```bash
pm2 logs vote-aggregator --lines 100
```
**What this revealed**: Empty logs (bigger red flag - code never ran)

**Step 3: Verify compiled files exist**
```bash
ls -la backend/dist/vote-aggregator/src/
```
**What this revealed**: Directory doesn't exist - compilation failed

**Step 4: Attempt to build TypeScript**
```bash
cd backend && npm run build
```
**What this revealed**: 4 TypeScript errors preventing compilation

**Step 5: Read entry point source code**
```bash
cat backend/vote-aggregator/src/index.ts | head -50
```
**What this revealed**: Code expects `BACKEND_AUTHORITY_PRIVATE_KEY` environment variable

**Step 6: Check environment file**
```bash
grep BACKEND .env
```
**What this revealed**: Has `BACKEND_KEYPAIR_PATH` but not `BACKEND_AUTHORITY_PRIVATE_KEY`

**Dead Ends Explored**:
- ❌ Checked Solana RPC connection (was fine)
- ❌ Checked database connection (was fine)
- ❌ Restarted PM2 multiple times (didn't help)
- ⏱️ Wasted 30 minutes before checking if files actually compiled

---

#### Solution Implementation

**Fix #1: Add Missing Environment Variable**

**File**: `backend/.env`

**Changes**:
```bash
# Before
BACKEND_KEYPAIR_PATH=/path/to/keypair.json

# After
BACKEND_KEYPAIR_PATH=/path/to/keypair.json  # Legacy, kept for reference
BACKEND_AUTHORITY_PRIVATE_KEY=<base58-encoded-private-key>
```

**How to generate**:
```bash
node -e "
const fs = require('fs');
const bs58 = require('bs58');
const keypair = JSON.parse(fs.readFileSync('/path/to/keypair.json'));
console.log(bs58.encode(Buffer.from(keypair)));
"
```

**Fix #2: Resolve TypeScript Errors**

**Files**: Multiple files in `backend/src/`

**Changes**:
```typescript
// backend/src/__tests__/testConfig.ts (3 locations)
solana: {
  // ... existing config
  backendAuthorityPrivateKey: undefined,  // ADD THIS
}

// backend/src/services/ipfs/snapshot.ts
getStatus(): {
  isRunning: boolean;
  ipfsGateway: string | undefined;  // CHANGE: was 'string'
}
```

**Fix #3: Rebuild and Restart**

**Deployment Steps**:
```bash
# 1. Build TypeScript
npm run build

# Expected output:
# Successfully compiled TypeScript with 0 errors

# 2. Verify compiled files exist
test -f dist/vote-aggregator/src/index.js || { echo "Build failed!"; exit 1; }

# 3. Restart PM2 with new environment
pm2 restart all --update-env

# 4. Check status
pm2 status

# Expected output: restart count stopped increasing, uptime > 1m
```

**Rollback Procedure**:
```bash
# If fix doesn't work:
git reset --hard HEAD~1
npm run build
pm2 restart all
```

---

#### Verification Results

**Before Fix**:
```
pm2 status
┌─────┬─────────────────┬─────────┬─────────┬──────────┬─────────┐
│ id  │ name            │ mode    │ status  │ restart  │ uptime  │
├─────┼─────────────────┼─────────┼─────────┼──────────┼─────────┤
│ 0   │ vote-aggregator │ fork    │ online  │ 47       │ 5s      │ ❌
│ 1   │ market-monitor  │ fork    │ online  │ 47       │ 8s      │ ❌
└─────┴─────────────────┴─────────┴─────────┴──────────┴─────────┘

pm2 logs vote-aggregator --lines 50
[Empty - no output]  ❌
```

**After Fix**:
```
pm2 status
┌─────┬─────────────────┬─────────┬─────────┬──────────┬─────────┐
│ id  │ name            │ mode    │ status  │ restart  │ uptime  │
├─────┼─────────────────┼─────────┼─────────┼──────────┼─────────┤
│ 0   │ vote-aggregator │ fork    │ online  │ 54       │ 5m      │ ✅
│ 1   │ market-monitor  │ fork    │ online  │ 54       │ 5m      │ ✅
└─────┴─────────────────┴─────────┴─────────┴──────────┴─────────┘

pm2 logs vote-aggregator --lines 10
[INFO] Successfully connected to Solana RPC
[INFO] Successfully connected to database
[INFO] Vote aggregator started and listening
```

**Verification Tests Run**:
- [x] PM2 restart count stopped increasing
- [x] Uptime exceeded 5 minutes (indicates stable process)
- [x] Logs showing successful startup
- [x] Health check endpoint returns 200 OK
- [x] Vote aggregation working in test

**Monitoring Checks** (24 hours post-fix):
- [x] No errors in logs
- [x] Restart count: 54 (stable, no new restarts)
- [x] Services processing votes successfully
- [x] No user reports of issues

---

#### Prevention Strategies

**To Prevent Root Cause #1 (Missing Env Var)**:

1. ✅ **Environment Validation Script**
   ```typescript
   // backend/src/utils/validate-env.ts
   export function validateRequiredEnvVars() {
     const required = [
       'BACKEND_AUTHORITY_PRIVATE_KEY',
       'SUPABASE_URL',
       'SUPABASE_SERVICE_ROLE_KEY',
     ];

     const missing = required.filter(key => !process.env[key]);
     if (missing.length > 0) {
       throw new Error(`Missing required env vars: ${missing.join(', ')}`);
     }
   }

   // Call BEFORE connecting to any services
   validateRequiredEnvVars();
   ```
   **Where implemented**: `backend/src/index.ts:5`

2. ✅ **Updated .env.example**
   ```bash
   # backend/.env.example
   BACKEND_AUTHORITY_PRIVATE_KEY=<base58-private-key>  # Required for vote aggregation
   BACKEND_KEYPAIR_PATH=/path/to/keypair.json          # LEGACY - use PRIVATE_KEY instead
   ```

**To Prevent Root Cause #2 (TypeScript Errors)**:

1. ✅ **Pre-deployment Build Check**
   ```javascript
   // backend/ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'vote-aggregator',
       script: './dist/vote-aggregator/src/index.js',
       pre_deploy_local: 'npm run build && npm run test',  // ← BUILD FIRST
     }]
   };
   ```

2. ✅ **CI/CD Build Validation**
   ```yaml
   # .github/workflows/backend.yml
   - name: Build TypeScript
     run: npm run build
   - name: Verify compiled files exist
     run: test -f backend/dist/vote-aggregator/src/index.js || exit 1
   ```

3. ✅ **Manual Check Before PM2 Start**
   ```bash
   # Always run before starting PM2
   test -f dist/index.js || npm run build
   pm2 start ecosystem.config.js
   ```

**Documentation Updates Required**:
- [x] Update Guide 17, Section 2.2 with PM2 configuration
- [x] Add to edge case checklist (Guide 16)
- [x] Update CLAUDE.md gotchas section
- [x] Add to pre-deployment checklist
- [x] Document in INCIDENT_LIBRARY.md (this file)

**Process Changes**:
- [x] Added environment validation to startup sequence
- [x] Added build verification to PM2 config
- [x] Updated deployment runbook with verification steps
- [x] Added health check endpoints to all services

---

#### Related Incidents

**Similar Incidents**:
- None yet (this was the first major crash loop)

**Lessons Learned**:
1. **Empty logs are a red flag** - if logs are empty, entry point likely didn't run
2. **PM2 "online" status is misleading** - can show online even if crashing every 5s
3. **Always verify build artifacts exist** before starting PM2
4. **Environment validation should happen FIRST** in entry point, before any other code
5. **Pre-deployment checklists prevent 90% of issues** like this

---

#### Timeline

| Time | Event | Who |
|------|-------|-----|
| 2025-11-09 14:23 | Deployed code changes to VPS | Developer |
| 2025-11-09 14:24 | PM2 started showing high restart counts | PM2 monitoring |
| 2025-11-09 14:30 | Noticed vote aggregation not working | Developer |
| 2025-11-09 14:32 | Investigation started (checked PM2 status) | Developer |
| 2025-11-09 14:45 | Identified missing compiled files | Developer |
| 2025-11-09 15:00 | Fixed TypeScript errors | Developer |
| 2025-11-09 15:15 | Identified missing environment variable | Developer |
| 2025-11-09 15:30 | Added environment variable, rebuilt, restarted | Developer |
| 2025-11-09 15:35 | Verification complete - services stable | Developer |

---

#### Metrics

**Detection Time**: 6 minutes (from deployment to noticing issue)
**Investigation Time**: 1 hour 3 minutes (to identify both root causes)
**Fix Development Time**: 30 minutes (to implement fixes)
**Deployment Time**: 5 minutes (to deploy fixes)
**Total Resolution Time**: ~4 hours (including documentation)

**Cost Estimate**:
- Developer hours: 4 hours × 1 developer = 4 hours
- User impact: Backend down for 4 hours, but frontend cached data worked
- Revenue impact: None (not revenue-generating yet)

---

**Incident Owner**: Developer Team
**Reviewers**: Senior Developer
**Last Updated**: 2025-11-09

---

## How to Use This Template

### Step 1: Create incident-library.md in Your Project

```bash
# In your project root
mkdir -p docs/incidents
cp docs/templates/INCIDENT_LIBRARY_TEMPLATE.md docs/incidents/incident-library.md
```

### Step 2: When an Incident Occurs

1. Copy the incident template section
2. Fill in all fields (while details are fresh!)
3. Add to your project's incident library (e.g., `docs/incidents/INCIDENT-XXX.md` where XXX is the incident number)
4. Number incidents sequentially: INCIDENT-001, INCIDENT-002, etc.

### Step 3: Update Prevention Strategies

After documenting an incident:

1. Update relevant guides with new edge cases
2. Add items to pre-deployment checklists
3. Create validation scripts if applicable
4. Add to CLAUDE.md gotchas section

### Step 4: Review Periodically

Monthly or quarterly:

1. Review all incidents
2. Look for patterns (e.g., 5 incidents related to env vars → systemic issue)
3. Update prevention strategies
4. Celebrate avoided incidents (track how often you prevented known issues)

---

## Integration with Development Workflow

### Add to Pre-Commit Hook

```.bash
# .husky/pre-commit

# Check if we're committing a fix for an incident
if git diff --cached --name-only | grep -q "INCIDENT"; then
  echo "⚠️  You're committing an incident fix!"
  echo "Have you:"
  echo "  1. Documented the incident in incident-library.md?"
  echo "  2. Added prevention strategies?"
  echo "  3. Updated relevant guides?"
  echo ""
  read -p "Continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
```

### Add to Pull Request Template

```markdown
## Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] **If this fixes a production incident**: Documented in incident library
```

---

## Success Metrics

**Measure the value of your incident library**:

1. **Time to Resolution**: Compare resolution time for new vs repeated incident types
2. **Prevention Rate**: Track incidents prevented by following documented strategies
3. **Knowledge Sharing**: Count how many times incident docs were referenced
4. **Cost Savings**: Calculate developer hours saved by preventing known issues

**Example**:
```
Before Incident Library:
- Deployment issues: 18 hours debugging vercel monorepo config

After Incident Library (with Guide 17):
- Deployment issues: 2 hours (following documented patterns)
- Time saved: 16 hours per deployment
- Over 10 deployments: 160 hours saved
```

---

**Document Version**: 1.0.0
**Based on**: zmartV0.69 INCIDENT_LIBRARY.md (rated 5/5 in forensics analysis)
**Last Updated**: November 14, 2025
**Status**: Ready for Production Use
