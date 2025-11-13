# CodeRabbit Integration Patterns for Automated Debugging

## Table of Contents
1. [CLI Integration](#1-cli-integration)
2. [API Integration](#2-api-integration)
3. [GitHub Integration](#3-github-integration)
4. [Configuration](#4-configuration)
5. [Automation Patterns](#5-automation-patterns)

---

## 1. CLI Integration

### 1.1 Installation

```bash
# Install CodeRabbit CLI
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
```

After installation, you must manually go through secure authorization steps.

### 1.2 Available Commands and Flags

#### Primary Review Command
```bash
coderabbit review [options]
```

#### Output Format Flags

| Flag | Description | Use Case |
|------|-------------|----------|
| (default) | Interactive mode with full interface | Manual CLI usage with browsable findings |
| `--plain` | Plain text mode with detailed feedback | Integration with AI agents, CI/CD pipelines |
| `--prompt-only` | Minimal output optimized for AI agents | Direct AI agent integration (Claude Code, Cursor, Gemini) |

**Example Usage:**
```bash
# Review with plain output for AI agents
coderabbit review --plain

# Minimal output for prompt-based AI integration
coderabbit review --prompt-only

# Review only uncommitted changes
coderabbit review --prompt-only --type uncommitted

# Specify custom base branch
coderabbit review --prompt-only --base develop
```

#### Additional Flags

| Flag | Purpose | Example |
|------|---------|---------|
| `--type` | Specify what to review | `--type uncommitted` for unstaged/staged changes |
| `--base` | Set base branch for comparison | `--base develop` or `--base master` |

### 1.3 Parsing CodeRabbit Output

CodeRabbit CLI outputs are designed for programmatic consumption:

**Plain Mode (`--plain`)**: Structured text output with:
- Detailed feedback sections
- Fix suggestions with context
- Can be piped to other tools

**Prompt-Only Mode (`--prompt-only`)**:
- Optimized for AI agent consumption
- Minimal formatting overhead
- Direct integration with coding assistants

**Helper Tool for PR Review Extraction:**
```bash
# Third-party tool: Extract CodeRabbit GitHub PR reviews
# https://github.com/obra/coderabbit-review-helper

# Latest review only (recommended)
python3 extract-coderabbit-feedback.py owner/repo/123

# All accumulated reviews
python3 extract-coderabbit-feedback.py owner/repo/123 --all-reviews

# Debug mode
python3 extract-coderabbit-feedback.py owner/repo/123 --debug
```

**Output Organization Hierarchy:**
1. AI-Actionable Items (🤖 marked)
2. Nitpick Comments
3. Outside Diff Range suggestions

### 1.4 Exit Codes and Error Handling

**Status Values:**
- `success` - Review completed without critical issues
- `failure` - Review found blocking issues
- `in_progress` - Review still running
- `canceled` - Review was canceled

**Success Indicator:**
```
Review completed ✔
```

**Note:** Specific numeric exit codes (0, 1, 2, etc.) are not well-documented. Monitor the CLI output for status messages and the completion indicator.

### 1.5 Performance Characteristics

**Review Duration:**
- **Typical Range:** 7-30+ minutes depending on scope
- **Most Common:** 10-20 minutes for standard PRs
- **Initial Response:** First feedback within a few minutes
- **Recommendation:** Run CodeRabbit in the background and check periodically

**Best Practice for AI Agents:**
```bash
# Run in background
coderabbit review --prompt-only &

# Check status periodically
# Wait for "Review completed ✔" message
```

**Infrastructure Details:**
- Timeout: 3600 seconds (1 hour)
- Concurrency: 8 requests per instance
- Peak capacity: 10 requests/second across 200+ instances

---

## 2. API Integration

### 2.1 API Documentation

**OpenAPI/Swagger Specification:**
```
https://api.coderabbit.ai/api/swagger/
```

**Note:** Direct access may require authentication. The API documentation contains full REST API specifications.

### 2.2 Authentication

**API Key Setup:**
```bash
# Environment variable
export CODERABBIT_API_KEY="cr-xxxxxxxxxxxxx"

# Optional: Custom base URL
export CODERABBIT_BASE_URL="https://api.coderabbit.ai/api/v1"
```

**Generating API Keys:**
1. Navigate to CodeRabbit UI
2. Go to Organizations Settings
3. Select API Keys section
4. Generate new key (format: `cr-xxxxxxxxxxxxx`)

**Authentication Method:**
- API uses `CODERABBIT_API_KEY` environment variable
- Exact header format (Bearer token vs X-API-Key) not explicitly documented
- Likely uses Authorization header with API key

**Example API Request Pattern:**
```bash
# Hypothetical pattern (verify with official docs)
curl -X POST https://api.coderabbit.ai/api/v1/reviews \
  -H "Authorization: Bearer cr-xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "owner/repo",
    "pr_number": 123
  }'
```

### 2.3 Rate Limits

**Free Plan:**
- Lower rate limits (exact numbers not publicly documented)

**Lite Plan ($15/month or $12/month annually):**
- Files reviewed per hour: **Up to 100 files**
- Reviews per hour: **Up to 9 reviews** (including incremental)
- Conversations per hour: **Up to 50 messages**

**Pro Plan ($30/month):**
- Files reviewed per hour: **200 files**
- Reviews: **3 back-to-back, then 4/hour**
- Conversations: **25 back-to-back, then 50/hour**

**Open Source Projects:**
- Free Pro plan access
- Lower rate limits than paid plans

### 2.4 Triggering Reviews Programmatically

**Via CLI:**
```bash
# Automated review trigger
coderabbit review --prompt-only --type uncommitted
```

**Via GitHub Actions:**
```yaml
# Trigger on PR events
on:
  pull_request:
    types: [opened, synchronize, reopened]
```

**Via API (MCP Server Pattern):**
```javascript
// Using MCP server tools
await coderabbit_workflow_start({
  repository: "owner/repo",
  pr_number: 123
});
```

### 2.5 Retrieving Review Results via API

**Using GitHub API to Extract CodeRabbit Comments:**
```bash
# Fetch PR comments using GitHub CLI
gh api repos/owner/repo/pulls/123/comments

# Filter for CodeRabbit bot comments
gh api repos/owner/repo/pulls/123/comments \
  | jq '.[] | select(.user.login == "coderabbitai[bot]")'
```

**Python Example (using obra's helper):**
```python
# Extract CodeRabbit feedback from PR
import subprocess

def get_coderabbit_reviews(repo, pr_number):
    cmd = f"python3 extract-coderabbit-feedback.py {repo}/{pr_number}"
    result = subprocess.run(cmd.split(), capture_output=True, text=True)
    return result.stdout

# Usage
reviews = get_coderabbit_reviews("owner/repo", 123)
```

### 2.6 Webhook Integration Patterns

**CodeRabbit Receives Webhooks FROM Git Platforms:**

CodeRabbit consumes webhooks from GitHub, GitLab, Bitbucket, etc. to trigger reviews.

**Required Webhook Events (GitLab Example):**
- Push events
- Comments
- Issues events
- Merge request events

**Architecture Flow:**
```
GitHub/GitLab → Webhook → CodeRabbit Cloud Run Service
                            ↓
                   Billing/Subscription Check
                            ↓
                   Google Cloud Tasks Queue
                            ↓
                   Review Processing
```

**CodeRabbit DOES NOT appear to send outbound webhooks** - results are posted as PR comments.

To consume CodeRabbit results programmatically:
1. Monitor PR comments via GitHub/GitLab webhooks
2. Filter for coderabbitai[bot] comments
3. Parse comment body for review data

---

## 3. GitHub Integration

### 3.1 How CodeRabbit Comments on PRs

**Automatic Comment Types:**

1. **Summary Comment** - Posted at PR level
   - Overall assessment
   - High-level findings
   - Statistics (files changed, issues found)

2. **Inline Comments** - Posted at specific lines
   - Code-specific suggestions
   - Includes diff context
   - Committable suggestions

3. **Review Comments** - Threaded discussions
   - AI-actionable items marked with 🤖
   - Nitpick suggestions
   - Architectural recommendations

**Comment Structure:**
```markdown
<!-- This is an auto-generated comment: summarize by coderabbit.ai -->

## Summary
- Finding 1
- Finding 2

## Detailed Review
**File: src/example.js**
- Issue description with context
- Suggested fix with diff
```

### 3.2 Extracting Review Data from GitHub PR Comments

**Using GitHub CLI:**
```bash
# Get all PR comments
gh pr view 123 --json comments --jq '.comments'

# Filter CodeRabbit comments
gh api repos/{owner}/{repo}/pulls/123/comments \
  | jq '.[] | select(.user.login | contains("coderabbit"))'

# Extract review bodies
gh api repos/{owner}/{repo}/pulls/123/comments \
  | jq -r '.[] | select(.user.login | contains("coderabbit")) | .body'
```

**Using GitHub Actions:**
```yaml
- name: Extract CodeRabbit Review
  run: |
    gh api repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/comments \
      | jq '.[] | select(.user.login == "coderabbitai[bot]")' > coderabbit-review.json
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Python Script Pattern:**
```python
import requests

def extract_coderabbit_comments(owner, repo, pr_number, token):
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json"
    }

    response = requests.get(url, headers=headers)
    comments = response.json()

    coderabbit_comments = [
        c for c in comments
        if c['user']['login'] == 'coderabbitai[bot]'
    ]

    return coderabbit_comments

# Usage
comments = extract_coderabbit_comments("owner", "repo", 123, "ghp_token")
for comment in comments:
    print(f"File: {comment['path']}")
    print(f"Line: {comment['line']}")
    print(f"Body: {comment['body']}")
```

### 3.3 @coderabbitai Commands

**Review Commands:**
```
@coderabbitai review              # Trigger incremental review
@coderabbitai full review         # Perform full review from scratch
```

**Pause/Resume Controls:**
```
@coderabbitai pause               # Pause automated reviews
@coderabbitai resume              # Resume automated reviews
@coderabbitai ignore              # Prevent automatic reviews (add to PR description)
```

**Information Commands:**
```
@coderabbitai summary             # Regenerate PR summary
@coderabbitai resolve             # Resolve all CodeRabbit review comments
@coderabbitai configuration       # Show current configuration
```

**Generation Commands:**
```
@coderabbitai generate docstrings # Generate documentation
@coderabbitai plan                # Trigger planning for file edits
```

**Interactive Usage:**
```
# Ask questions in PR comments
@coderabbitai Can you explain why this approach is better?

# Request specific actions
@coderabbitai Can you write unit tests for this function?

# Debug assistance
@coderabbitai Help me debug this memory leak
```

### 3.4 GitHub Actions Integration

**Complete Workflow Example:**
```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: CodeRabbit Review
        uses: coderabbitai/ai-pr-reviewer@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        with:
          debug: false
          review_simple_changes: false
          review_comment_lgtm: false
```

**For Forked Repositories:**
```yaml
on:
  pull_request_target:  # Use instead of pull_request for forks
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    concurrency:
      group: ${{ github.repository }}-${{ github.event.number }}
      cancel-in-progress: true
    steps:
      # ... same as above
```

---

## 4. Configuration

### 4.1 .coderabbit.yaml Configuration Options

**File Location:** Repository root (`.coderabbit.yaml` or `.coderabbit.yml`)

**Configuration Schema:** https://coderabbit.ai/integrations/schema.v2.json

### 4.2 Complete Configuration Reference

```yaml
# Language and System Settings
language: "en-US"                    # Review language
system_language: "en-US"             # System message language

# Draft PR Handling
ignore_draft_pr: true                # Skip draft PRs

# Feature Flags
release_notes: false                 # Generate release notes
enable_beta_features: false          # Access beta features
disable_poem: false                  # Disable celebratory poem

# Filtering Options
ignored_branch: "staging,develop"    # Comma-separated, supports wildcards
ignored_titles: "WIP,DO NOT REVIEW"  # Skip PRs with these title snippets
limit_reviews_by_label: "review-me"  # Only review PRs with this label

# Path Filters (GitHub Actions syntax)
path_filters: |
  src/**/*.py
  !dist/**
  !**/*.min.js
  !**/*.lock

# Review Configuration
reviews:
  # Auto Review Settings
  auto_review:
    enabled: true
    base_branches:
      - main
      - master

  # Path-Specific Instructions
  path_instructions:
    - path: "**/*.js"
      instructions: |
        Review against Google JavaScript Style Guide.
        Focus on:
        - ES6+ best practices
        - Async/await patterns
        - Error handling

    - path: "**/*.py"
      instructions: |
        Review against PEP 8 guidelines.
        Check for:
        - Type hints
        - Docstring completeness
        - Security vulnerabilities

    - path: "tests/**.*"
      instructions: |
        Review test quality:
        - Test coverage
        - Edge cases
        - Mock usage

    - path: "*.sol"
      instructions: |
        Review Solidity smart contracts for:
        - Reentrancy vulnerabilities
        - Integer overflow/underflow
        - Gas optimization
        - Access control issues

# Tone and Personality
tone_instructions: |
  You are an expert code reviewer specializing in blockchain and Web3.
  Provide concise, actionable feedback.
  Be encouraging but thorough.
  Focus on security and best practices.

# Chat Settings
chat:
  auto_reply: true
```

### 4.3 Profile-Based Configuration

**Enterprise "Chill" Profile Example:**
```yaml
language: en-US
early_access: true

reviews:
  profile: chill
  auto_review:
    enabled: true
    base_branches:
      - main

  path_instructions:
    - path: "contracts/**/*.sol"
      instructions: |
        Security-first review for smart contracts.
        Flag any potential vulnerabilities immediately.
```

### 4.4 Excluding Files/Directories

**Using Path Filters:**
```yaml
path_filters: |
  # Include patterns (no prefix)
  src/**/*.py
  contracts/**/*.sol

  # Exclude patterns (! prefix)
  !dist/**
  !build/**
  !node_modules/**
  !**/*.min.js
  !**/*.lock
  !**/*.generated.*
```

**Default Exclusions:**
- `!dist/**`
- `!**/*.app`
- `!**/*.bin`
- `!**/*.bz2`
- `!**/*.class`
- `!**/*.db`
- `!**/*.csv`

### 4.5 Integration with Other Linters

**Automatic Integration (No Config Required):**

CodeRabbit automatically integrates with 40+ tools including:
- **JavaScript/TypeScript:** ESLint, Prettier, TSLint
- **Python:** Ruff, Black, Pylint, mypy
- **Security:** Gitleaks, Bandit
- **Shell:** ShellCheck
- **YAML:** yamllint
- **GitHub Actions:** actionlint

**Requirements:**
1. Define dependencies in `package.json` (JS/TS)
2. Include config files (`.eslintrc.js`, `pyproject.toml`, etc.)
3. CodeRabbit respects existing configurations

**ESLint Integration Example:**
```yaml
# .coderabbit.yaml - No special config needed
# Just ensure package.json includes:
# {
#   "devDependencies": {
#     "eslint": "^8.0.0",
#     "eslint-config-prettier": "^9.0.0",
#     "eslint-plugin-prettier": "^5.0.0"
#   }
# }
```

**Benefits:**
- 1-click fixes for linter issues
- Structured output in review comments
- Respects your existing linter configs
- No additional CodeRabbit configuration needed

---

## 5. Automation Patterns

### 5.1 CI/CD Integration

**GitHub Actions Pattern:**
```yaml
name: Automated Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  coderabbit-review:
    runs-on: ubuntu-latest
    timeout-minutes: 30  # Reviews can take 7-30 minutes

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: CodeRabbit Review
        uses: coderabbitai/ai-pr-reviewer@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        with:
          debug: false
          review_simple_changes: false

      - name: Process Review Results
        run: |
          # Extract CodeRabbit comments
          gh api repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/comments \
            | jq '.[] | select(.user.login == "coderabbitai[bot]")' > review.json

          # Check for critical issues
          critical=$(jq '[.[] | select(.body | contains("🚨"))] | length' review.json)
          if [ "$critical" -gt 0 ]; then
            echo "::error::CodeRabbit found $critical critical issues"
            exit 1
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**GitLab CI Pattern:**
```yaml
coderabbit-review:
  stage: review
  script:
    - curl -fsSL https://cli.coderabbit.ai/install.sh | sh
    - coderabbit review --plain > review.txt
    - cat review.txt
  artifacts:
    paths:
      - review.txt
    expire_in: 1 week
  only:
    - merge_requests
```

**Azure DevOps Pattern:**
```yaml
trigger:
  - main

pr:
  - main
  - develop

stages:
  - stage: CodeReview
    jobs:
      - job: CodeRabbit
        steps:
          - bash: |
              curl -fsSL https://cli.coderabbit.ai/install.sh | sh
              coderabbit review --plain
            displayName: 'Run CodeRabbit Review'
```

### 5.2 Using CodeRabbit Output to Drive Automated Fixes

**Pattern 1: MCP Server Automation**
```javascript
// Using MCP server for automated fix application
const { MCPClient } = require('@modelcontextprotocol/client');

async function automatedReviewCycle(repo, prNumber) {
  // 1. Start workflow
  await mcpClient.call('coderabbit_workflow_start', {
    repository: repo,
    pr_number: prNumber
  });

  // 2. Process each review thread
  let thread;
  while (thread = await mcpClient.call('coderabbit_workflow_next')) {
    // 3. Validate suggestion
    const validation = await mcpClient.call('coderabbit_workflow_validate', {
      thread_id: thread.id
    });

    // 4. Auto-apply based on rules
    if (shouldAutoApply(validation)) {
      await mcpClient.call('coderabbit_workflow_apply', {
        thread_id: thread.id,
        commit_message: validation.suggested_message
      });
    }
  }

  // 5. Push all changes
  await mcpClient.call('coderabbit_workflow_finalize');
}

function shouldAutoApply(validation) {
  // Auto-accept security fixes
  if (validation.category === 'security') return true;

  // Auto-accept based on patterns
  const autoAcceptPatterns = ['security/*', 'deps/*'];
  if (autoAcceptPatterns.some(p => matchGlob(validation.path, p))) {
    return true;
  }

  // Reject generated files
  const rejectPatterns = ['*.min.js', '*.lock', 'dist/**'];
  if (rejectPatterns.some(p => matchGlob(validation.path, p))) {
    return false;
  }

  // Default: require manual review
  return false;
}
```

**Pattern 2: Cursor/Claude Code Integration**
```bash
# .cursor/commands/coderabbit-review.sh
#!/bin/bash

# Run CodeRabbit review
echo "Starting CodeRabbit review..."
coderabbit review --prompt-only &

# Wait for completion
while ! grep -q "Review completed ✔" /tmp/coderabbit-output; do
  sleep 30
  echo "Review in progress..."
done

# Extract findings
echo "Review complete. Processing findings..."
coderabbit review --prompt-only > review-output.txt

# Pass to Claude Code for automated fixes
echo "Applying automated fixes..."
# Claude Code will process review-output.txt
```

**Pattern 3: Extract and Apply Committable Suggestions**
```python
import re
import subprocess
from github import Github

def apply_coderabbit_suggestions(repo_name, pr_number, token):
    """
    Extract and apply CodeRabbit's committable suggestions
    """
    g = Github(token)
    repo = g.get_repo(repo_name)
    pr = repo.get_pull(pr_number)

    # Get all review comments
    comments = pr.get_review_comments()

    for comment in comments:
        # Check if it's from CodeRabbit and has a suggestion
        if (comment.user.login == 'coderabbitai[bot]' and
            '```suggestion' in comment.body):

            # Extract the suggested code
            suggestion = extract_suggestion(comment.body)

            # Apply the suggestion
            apply_suggestion(
                file_path=comment.path,
                line=comment.line,
                suggestion=suggestion
            )

            # Commit the change
            subprocess.run([
                'git', 'add', comment.path
            ])
            subprocess.run([
                'git', 'commit', '-m',
                f'Apply CodeRabbit suggestion for {comment.path}'
            ])

def extract_suggestion(comment_body):
    """Extract code from ```suggestion block"""
    pattern = r'```suggestion\n(.*?)\n```'
    match = re.search(pattern, comment_body, re.DOTALL)
    return match.group(1) if match else None

def apply_suggestion(file_path, line, suggestion):
    """Apply suggestion to file"""
    with open(file_path, 'r') as f:
        lines = f.readlines()

    lines[line - 1] = suggestion + '\n'

    with open(file_path, 'w') as f:
        f.writelines(lines)
```

### 5.3 Best Practices for Programmatic Usage

#### 1. **Background Execution Pattern**
```bash
# Long-running reviews should run in background
coderabbit review --prompt-only > review.txt 2>&1 &
CODERABBIT_PID=$!

# Monitor with timeout
timeout 30m tail -f review.txt &
wait $CODERABBIT_PID
```

#### 2. **Retry Logic for Rate Limits**
```python
import time
from requests.exceptions import HTTPError

def review_with_retry(repo, pr_number, max_retries=3):
    for attempt in range(max_retries):
        try:
            result = trigger_coderabbit_review(repo, pr_number)
            return result
        except HTTPError as e:
            if e.response.status_code == 429:  # Rate limited
                wait_time = 2 ** attempt * 60  # Exponential backoff
                print(f"Rate limited. Waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise

    raise Exception("Max retries exceeded")
```

#### 3. **Parallel Review Processing (MCP)**
```json
// coderabbit-mcp.json
{
  "parallelism": 20,
  "auto_accept_patterns": [
    "security/**",
    "deps/**"
  ],
  "auto_reject_patterns": [
    "*.min.js",
    "*.lock",
    "dist/**",
    "build/**"
  ],
  "ci_timeout": 1800,
  "poll_interval": 30
}
```

#### 4. **Structured Logging**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'coderabbit-automation' },
  transports: [
    new winston.transports.File({ filename: 'coderabbit.log' })
  ]
});

async function automatedReview(repo, pr) {
  logger.info('Starting CodeRabbit review', { repo, pr });

  try {
    const result = await triggerReview(repo, pr);
    logger.info('Review completed', {
      repo, pr,
      issues_found: result.issues.length
    });
    return result;
  } catch (error) {
    logger.error('Review failed', {
      repo, pr,
      error: error.message
    });
    throw error;
  }
}
```

#### 5. **Configuration-Driven Automation**
```yaml
# automation-config.yaml
coderabbit:
  enabled: true

  triggers:
    - event: pull_request
      actions: [opened, synchronize]
    - event: comment
      pattern: "@coderabbitai review"

  automation_rules:
    - name: "Auto-fix security issues"
      condition:
        category: security
        severity: [critical, high]
      action: auto_apply

    - name: "Auto-fix linter issues"
      condition:
        source: eslint
        severity: error
      action: auto_apply

    - name: "Skip generated files"
      condition:
        path_pattern: "*.generated.*"
      action: ignore

    - name: "Require review for architecture changes"
      condition:
        category: architecture
      action: require_manual_review
```

#### 6. **Integration Test Pattern**
```javascript
// test-coderabbit-integration.js
const { describe, it, expect } = require('@jest/globals');

describe('CodeRabbit Integration', () => {
  it('should trigger review on PR creation', async () => {
    const pr = await createTestPR();
    const review = await waitForReview(pr.number, timeout=600000);

    expect(review).toBeDefined();
    expect(review.status).toBe('completed');
  });

  it('should extract actionable suggestions', async () => {
    const comments = await getCodeRabbitComments(pr.number);
    const actionable = comments.filter(c =>
      c.body.includes('🤖') || c.body.includes('```suggestion')
    );

    expect(actionable.length).toBeGreaterThan(0);
  });

  it('should apply committable suggestions', async () => {
    const suggestions = await extractSuggestions(pr.number);
    await applySuggestions(suggestions);

    const status = await runTests();
    expect(status).toBe('passing');
  });
});
```

---

## Summary: Key Integration Code Patterns

### Quick Start CLI Integration
```bash
# Install
curl -fsSL https://cli.coderabbit.ai/install.sh | sh

# Basic review
coderabbit review --plain

# AI agent integration
coderabbit review --prompt-only --type uncommitted
```

### Quick Start GitHub Actions
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: coderabbitai/ai-pr-reviewer@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Quick Start Configuration
```yaml
# .coderabbit.yaml
language: en-US
reviews:
  auto_review:
    enabled: true
  path_instructions:
    - path: "**/*.sol"
      instructions: "Focus on security and gas optimization"
```

### Quick Start PR Comment Extraction
```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  | jq '.[] | select(.user.login == "coderabbitai[bot]")' \
  > coderabbit-review.json
```

---

## Additional Resources

- **Official Documentation:** https://docs.coderabbit.ai/
- **API Swagger:** https://api.coderabbit.ai/api/swagger/
- **GitHub Repository:** https://github.com/coderabbitai/coderabbit-docs
- **Awesome CodeRabbit:** https://github.com/coderabbitai/awesome-coderabbit
- **Review Helper Tool:** https://github.com/obra/coderabbit-review-helper
- **MCP Automation:** https://github.com/eHour/coderabbitai-github-mcp

---

**Document Version:** 1.0
**Last Updated:** 2025-11-13
**Research Scope:** CLI, API, GitHub integration, Configuration, and Automation patterns
