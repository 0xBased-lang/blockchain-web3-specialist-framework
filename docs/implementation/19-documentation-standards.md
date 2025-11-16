# Guide 19: Documentation Standards & Validation

**Purpose**: Prevent documentation drift and ensure docs always match reality

**Based on**: Forensics analysis of kektechV0.69 documentation drift issues

**Priority**: 🔴 **CRITICAL** - Documentation drift costs 20+ hours debugging

---

## Table of Contents

1. [Overview](#overview)
2. [Documentation Drift Problem](#documentation-drift-problem)
3. [Validation System](#validation-system)
4. [Writing Standards](#writing-standards)
5. [Validation Rules](#validation-rules)
6. [Pre-Commit Workflow](#pre-commit-workflow)
7. [Common Issues & Fixes](#common-issues--fixes)
8. [Best Practices](#best-practices)

---

## 1. Overview

### What is Documentation Drift?

**Documentation drift** occurs when documentation becomes inconsistent with actual code, configuration, or system behavior. This was a major issue in kektechV0.69 (rated 3/5 for documentation quality).

**Real Cost** (from forensics analysis):
- **20+ hours** debugging issues that docs said were already fixed
- **40+ commits** fixing parameter mismatches docs claimed were correct
- **Multiple incidents** where deployment steps in docs were incomplete

### Solution

Automated validation system that:
- ✅ Validates cross-references between documents
- ✅ Checks file paths mentioned in docs exist
- ✅ Verifies code blocks are syntactically valid
- ✅ Detects broken internal links
- ✅ Ensures consistency across documentation
- ✅ Runs automatically on pre-commit hook

---

## 2. Documentation Drift Problem

### Real Examples from kektechV0.69

#### Example 1: Missing Deployment Steps

**Documentation said:**
```markdown
## Deployment
1. Run `npm run build`
2. Deploy to production
```

**Reality:**
- Missing: environment variable validation
- Missing: database migration step
- Missing: PM2 ecosystem configuration
- **Result**: 3 production crashes, 8 hours downtime

#### Example 2: Outdated API Parameters

**Documentation said:**
```typescript
interface CreateMarketRequest {
  address: string;  // ❌ OLD - docs not updated
  title: string;
}
```

**Reality (in code):**
```typescript
interface CreateMarketRequest {
  creatorAddress: string;  // ✅ ACTUAL - renamed 15 commits ago
  title: string;
}
```

**Result**: 12+ commits debugging "why address field is undefined"

#### Example 3: Broken Cross-References

**Documentation said:**
```markdown
See Guide 10 for wallet management
```

**Reality**: Guide 10 was merged into Guide 7 three weeks ago

**Result**: Developer spent 2 hours searching for non-existent guide

### Prevention Strategy

**zmartV0.69 Solution** (rated 5/5 for documentation):
1. **Incident library** updated with EVERY production issue
2. **Code examples** extracted from actual working code
3. **Validation scripts** run on every commit
4. **Documentation reviews** required for all architecture changes

We implement this same approach in our validation system.

---

## 3. Validation System

### Installation

```bash
# Install dependencies
pnpm install

# Initialize git hooks
pnpm prepare

# Test validation
pnpm validate:docs
```

### Running Validation

```bash
# Basic validation
pnpm validate:docs

# Verbose output (shows all checks)
pnpm validate:docs:verbose

# Auto-fix issues (where possible)
pnpm validate:docs:fix
```

### What Gets Validated

#### 3.1 Code Block Validation

**Checks:**
- Syntax validity (JSON, TypeScript, Bash)
- Balanced braces/parentheses
- No `any` types (violates CLAUDE.md)
- No private keys in examples
- No dangerous commands

**Example Error:**
```
❌ ERROR: docs/implementation/01-project-setup.md:45
   Type: code-block
   Message: Unbalanced braces in typescript code block (3 open, 2 close)
   Suggestion: Check for missing or extra braces
```

#### 3.2 File Path Validation

**Checks:**
- Referenced files exist
- Paths are correct
- No broken `src/` references

**Example Error:**
```
❌ ERROR: docs/implementation/05-agent-base.md:120
   Type: file-path
   Message: Referenced file does not exist: src/agents/orchestrator.ts
   Suggestion: Check if file path is correct or if file has been moved/deleted
```

#### 3.3 Cross-Reference Validation

**Checks:**
- Guide references exist (e.g., "Guide 17")
- Section references are valid
- Incident references documented

**Example Error:**
```
❌ ERROR: docs/implementation/16-edge-case-checklist.md:89
   Type: cross-reference
   Message: Referenced Guide 25 does not exist
   Suggestion: Check if guide number is correct or if guide has been created
```

#### 3.4 Internal Link Validation

**Checks:**
- Markdown links point to existing files
- Anchor links point to existing headings
- No broken relative paths

**Example Error:**
```
❌ ERROR: README.md:15
   Type: link
   Message: Broken link: docs/setup.md (file not found)
   Suggestion: Check if file path is correct or if file has been moved
```

#### 3.5 Consistency Validation

**Checks:**
- Consistent terminology (Ethereum vs ethereum)
- Version number consistency
- Naming conventions

**Example Warning:**
```
⚠️  WARNING: docs/architecture/01-system-architecture.md:67
   Type: consistency
   Message: Multiple Node.js versions mentioned
   Suggestion: Use consistent version numbers throughout documentation
```

---

## 4. Writing Standards

### 4.1 File References

**✅ CORRECT:**
```markdown
See `src/agents/orchestrator.ts` for implementation
See Guide 17, Section 2.4 for deployment steps
Configuration: `ecosystem.config.js`
```

**❌ WRONG:**
```markdown
See orchestrator.ts (no path)
See deployment guide (no guide number)
Check the config file (which one?)
```

### 4.2 Code Blocks

**✅ CORRECT:**
```markdown
```typescript
// Real working code from src/utils/validation.ts
export function validateEnvVars(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing: ${missing.join(', ')}`);
  }
}
```
```

**❌ WRONG:**
```markdown
```typescript
// Pseudocode (not real code)
function validate() {
  // Check environment variables
  // Throw error if missing
}
```
```

### 4.3 Cross-References

**✅ CORRECT:**
```markdown
**Prevention**: See Guide 04, Section 9.3 (PM2 Crash Loops)
**Root Cause**: Documented in INCIDENT-001
**Implementation**: Guide 17, Section 2.4 (Cloudflare Tunnel)
```

**❌ WRONG:**
```markdown
See the PM2 guide (which one?)
Check the incident docs (where?)
Look at deployment section (which section?)
```

### 4.4 Version Numbers

**✅ CORRECT:**
```markdown
**Runtime**: Node.js 18+ (consistent throughout)
**TypeScript**: 5.3+ (matches package.json)
**Ethers.js**: v6 (specific version)
```

**❌ WRONG:**
```markdown
Node.js 18 in one place, Node.js 20 in another
TypeScript latest (vague)
Ethers (no version)
```

### 4.5 Examples Must Be Real

**✅ CORRECT (from actual codebase):**
```typescript
// From packages/backend/src/config/index.ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()),
  DATABASE_URL: z.string().url(),
});
```

**❌ WRONG (made-up example):**
```typescript
// This doesn't actually exist in our codebase
const config = loadConfig();
```

---

## 5. Validation Rules

### 5.1 Code Block Rules

| Language | Validation |
|----------|-----------|
| TypeScript/JavaScript | Balanced braces/parens, no `any` type |
| JSON | Valid JSON syntax |
| Bash | No dangerous commands, no private keys |
| All | Consistent indentation |

### 5.2 Reference Rules

| Reference Type | Format | Example |
|---------------|--------|---------|
| File Path | Backtick-wrapped | \`src/agents/orchestrator.ts\` |
| Guide | "Guide NN" | Guide 17, Section 2.4 |
| Incident | "INCIDENT-NNN" | INCIDENT-001 |
| Link | Markdown link | [Setup Guide](docs/setup.md) |

### 5.3 Severity Levels

| Severity | Meaning | Action |
|----------|---------|--------|
| **Error** | Blocks commit | MUST fix before committing |
| **Warning** | Should fix | Review but can commit |

**Errors** (block commit):
- Broken file references
- Invalid code syntax
- Missing cross-referenced guides
- Broken internal links

**Warnings** (review):
- Inconsistent terminology
- Deep section nesting
- Undocumented incidents
- Missing suggestions

---

## 6. Pre-Commit Workflow

### How It Works

```bash
# Developer makes changes
git add docs/implementation/17-full-stack-deployment.md

# Try to commit
git commit -m "Update deployment guide"

# Pre-commit hook runs automatically
🔍 Running documentation validation...
Validating: docs/implementation/17-full-stack-deployment.md
Validating: docs/implementation/18-integration-patterns.md
...

# If validation passes
✅ Documentation validation passed!
[main abc123] Update deployment guide
 1 file changed, 50 insertions(+)

# If validation fails
❌ Documentation validation failed!
   Fix 3 error(s) before committing.

❌ ERRORS:

  docs/implementation/17-full-stack-deployment.md:245
    Type: file-path
    Message: Referenced file does not exist: config/ecosystem.config.js
    Suggestion: Check if file path is correct or if file has been moved/deleted

# Commit blocked - fix errors first
```

### Bypass Pre-Commit Hook (Emergency Only)

```bash
# Skip validation (NOT RECOMMENDED)
git commit --no-verify -m "Emergency hotfix"
```

**⚠️ WARNING**: Only use `--no-verify` for:
- Emergency production hotfixes
- Temporary work-in-progress commits
- When validation system itself is broken

**ALWAYS** run validation manually after:
```bash
pnpm validate:docs
```

---

## 7. Common Issues & Fixes

### Issue 1: "Referenced file does not exist"

**Symptom:**
```
❌ ERROR: Referenced file does not exist: src/agents/orchestrator.ts
```

**Causes:**
1. File hasn't been created yet
2. File path is wrong
3. File was moved/deleted

**Fixes:**
```bash
# Check if file exists
ls -la src/agents/orchestrator.ts

# If file doesn't exist, create it or update docs
# If file moved, update all references:
grep -r "src/agents/orchestrator.ts" docs/
```

### Issue 2: "Unbalanced braces in code block"

**Symptom:**
```
❌ ERROR: Unbalanced braces in typescript code block (3 open, 2 close)
```

**Cause**: Missing closing brace in example code

**Fix:**
```typescript
// BEFORE (broken)
export function example() {
  if (condition) {
    doSomething();
  }
// Missing closing brace

// AFTER (fixed)
export function example() {
  if (condition) {
    doSomething();
  }
}  // ✅ Added
```

### Issue 3: "Referenced Guide XX does not exist"

**Symptom:**
```
❌ ERROR: Referenced Guide 25 does not exist
```

**Causes:**
1. Guide number is wrong
2. Guide hasn't been written yet
3. Guide was merged into another guide

**Fixes:**
```bash
# List all guides
ls -la docs/implementation/ | grep "^[0-9]"

# Update reference to correct guide number
# Or create the missing guide
```

### Issue 4: "Broken anchor: #section not found"

**Symptom:**
```
⚠️  WARNING: Broken anchor: #deployment-steps not found in deployment.md
```

**Cause**: Heading was renamed or doesn't exist

**Fix:**
```markdown
# BEFORE
[See deployment steps](#deployment-steps)

# Check actual heading in target file
## Deployment Process  ← Actual heading

# AFTER
[See deployment steps](#deployment-process)  ✅ Matches heading
```

### Issue 5: "Code block uses 'any' type"

**Symptom:**
```
⚠️  WARNING: Code block uses "any" type (violates CLAUDE.md guideline)
```

**Cause**: Example uses `any` type

**Fix:**
```typescript
// BEFORE (violates guidelines)
function process(data: any) {  // ❌
  return data.value;
}

// AFTER (follows guidelines)
function process(data: unknown) {  // ✅
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data');
}
```

---

## 8. Best Practices

### 8.1 Write Documentation DURING Development

**❌ WRONG Workflow:**
```
1. Write all code
2. Write documentation later
3. Documentation doesn't match reality
```

**✅ CORRECT Workflow:**
```
1. Write documentation FIRST (what you plan to build)
2. Implement code
3. Update documentation as you go
4. Validation ensures they stay in sync
```

### 8.2 Extract Examples from Real Code

**❌ WRONG:**
```markdown
# Made-up example
```typescript
function doSomething() {
  // Imagine this works
}
```
```

**✅ CORRECT:**
```markdown
# Real code from src/utils/validation.ts:15-25
```typescript
export function validateEnvVars(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
```
```

### 8.3 Use Incident Library Pattern

**Based on**: zmartV0.69's exemplary incident documentation (5/5 rating)

**Template**: `docs/templates/INCIDENT_LIBRARY_TEMPLATE.md`

**Every production incident should be:**
1. **Documented** with incident ID (INCIDENT-001, INCIDENT-002, etc.)
2. **Cross-referenced** in relevant guides
3. **Prevention strategy** added to edge case checklist
4. **Code examples** showing the fix

**Example:**
```markdown
## INCIDENT-001: PM2 Crash Loop

**Severity**: 🔴 Critical
**Duration**: 4 minutes (47 restarts)
**Impact**: Production backend completely down

### Symptoms
- PM2 shows service as "online"
- Service restarts every 5 seconds
- No error logs in PM2 logs

### Root Causes
1. Missing environment variable: `BACKEND_AUTHORITY_PRIVATE_KEY`
2. TypeScript compilation failures not detected

### Prevention
✅ Added to Guide 04, Section 9.3
✅ Added pre-deployment validation script
✅ Added to Guide 17, Section 2.3 (deployment checklist)
```

### 8.4 Review Documentation in PRs

**PR Checklist:**
- [ ] All code changes have corresponding documentation updates
- [ ] `pnpm validate:docs` passes
- [ ] Code examples extracted from actual code
- [ ] Cross-references are valid
- [ ] Version numbers are consistent

### 8.5 Run Validation Locally BEFORE Pushing

```bash
# Before committing
pnpm validate:docs

# Fix any errors
# Then commit
git add .
git commit -m "feat: add wallet manager with documentation"

# Pre-commit hook runs validation again (double-check)
```

---

## Integration with Existing Guides

This guide (19) integrates with:

| Guide | Integration Point |
|-------|------------------|
| **Guide 00** | Prerequisites now include validation setup |
| **Guide 01** | Project setup includes validation installation |
| **Guide 04** | Edge cases referenced in validation rules |
| **Guide 16** | Edge case checklist includes documentation validation |
| **Guide 17** | Deployment includes documentation review step |
| **Guide 18** | Integration patterns enforce consistent docs |
| **CLAUDE.md** | Development workflow includes validation |
| **INCIDENT_LIBRARY_TEMPLATE** | Incidents cross-referenced in docs |

---

## Success Metrics

### How to Measure Documentation Quality

**Weekly Metrics:**
```bash
# Run validation with verbose output
pnpm validate:docs:verbose > validation-report.txt

# Count issues
grep "ERROR" validation-report.txt | wc -l  # Target: 0
grep "WARNING" validation-report.txt | wc -l  # Target: < 5
```

**Quality Targets:**
- ✅ **0 errors** before every commit
- ✅ **< 5 warnings** in total project
- ✅ **100% cross-reference** validity
- ✅ **100% code example** validity

**Compare to Forensics Baseline:**
- kektechV0.69: 3/5 documentation quality (drift issues)
- zmartV0.69: 5/5 documentation quality (our target)

---

## Appendix: Validation Script Architecture

### File: `scripts/validate-docs.ts`

**Capabilities:**
- Scans all `docs/**/*.md` files
- Extracts code blocks, file references, links
- Validates syntax, paths, cross-references
- Generates detailed error reports

**Performance:**
- Scans ~30 documentation files in < 2 seconds
- Suitable for pre-commit hook (fast enough)
- Caches results for repeated runs

**Extensibility:**
```typescript
// Add custom validation rules
function validateCustomRule(
  filePath: string,
  content: string,
  errors: ValidationError[]
): void {
  // Your custom validation logic
}
```

---

## Summary

**Documentation drift** was a critical issue in kektechV0.69, costing 20+ hours of debugging time. Our validation system prevents this by:

✅ **Automated checks** on every commit
✅ **Real-time validation** during development
✅ **Enforced standards** via pre-commit hooks
✅ **Cross-reference validation** ensures doc consistency
✅ **Code example validation** ensures examples match reality

**Result**: Documentation quality matching zmartV0.69's 5/5 rating.

**Next Steps:**
1. Run `pnpm install` to set up validation
2. Run `pnpm validate:docs` to check existing docs
3. Review and integrate into your development workflow
4. Add validation to CI/CD pipeline (future enhancement)

---

**Last Updated**: 2025-11-14
**Related Documents**:
- `docs/analysis/PROJECT_FORENSICS_REPORT.md` - Source of validation requirements
- `docs/templates/INCIDENT_LIBRARY_TEMPLATE.md` - Incident documentation pattern
- `scripts/validate-docs.ts` - Validation implementation
- `CLAUDE.md` - Development workflow integration
