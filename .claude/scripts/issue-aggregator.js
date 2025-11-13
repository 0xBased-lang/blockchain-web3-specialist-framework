#!/usr/bin/env node

/**
 * Issue Aggregator
 *
 * Aggregates issues from all validators:
 * - Loads all validator results
 * - Deduplicates similar issues
 * - Prioritizes by severity and impact
 * - Groups by category
 * - Generates SARIF format output
 * - Creates actionable summary
 */

const fs = require('fs');
const path = require('path');

class IssueAggregator {
  constructor(rootPath) {
    this.rootPath = rootPath || process.cwd();
    this.debugPath = path.join(this.rootPath, '.claude/debug');
    this.allIssues = [];
    this.deduplicatedIssues = [];
    this.validatorResults = [];
  }

  async aggregate() {
    console.log('🔄 Aggregating validation results...\n');

    await this.loadValidatorResults();
    await this.deduplicateIssues();
    await this.prioritizeIssues();
    await this.generateSummary();
    await this.generateSARIF();

    return this.generateReport();
  }

  async loadValidatorResults() {
    console.log('Loading validator results...');

    const validators = [
      'integration-validator-results.json',
      'package-validator-results.json',
      'quality-validator-results.json',
      'git-validator-results.json',
      'contract-validator-results.json',
      'deployment-validator-results.json',
      'observability-validator-results.json'
    ];

    for (const validatorFile of validators) {
      const filePath = path.join(this.debugPath, validatorFile);

      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const result = JSON.parse(content);

        this.validatorResults.push(result);
        this.allIssues.push(...result.issues);

        console.log(`  ✓ Loaded ${result.issues.length} issues from ${result.validator}`);
      } catch (error) {
        // Validator result not found - skip
        console.log(`  ⊘ ${validatorFile} not found (skipping)`);
      }
    }

    console.log(`\nTotal issues loaded: ${this.allIssues.length}`);
  }

  async deduplicateIssues() {
    console.log('\nDeduplicating issues...');

    if (this.allIssues.length === 0) {
      console.log('  ⊘ No issues to deduplicate');
      return;
    }

    const issueMap = new Map();

    for (const issue of this.allIssues) {
      // Create a fingerprint for deduplication
      const fingerprint = this.createFingerprint(issue);

      if (issueMap.has(fingerprint)) {
        // Issue already exists - merge information
        const existing = issueMap.get(fingerprint);
        existing.occurrences = (existing.occurrences || 1) + 1;
        existing.validators = existing.validators || [existing.id.split('-')[0]];
        existing.validators.push(issue.id.split('-')[0]);
      } else {
        // New unique issue
        issueMap.set(fingerprint, { ...issue, occurrences: 1 });
      }
    }

    this.deduplicatedIssues = Array.from(issueMap.values());

    const duplicatesRemoved = this.allIssues.length - this.deduplicatedIssues.length;
    console.log(`  ✓ Removed ${duplicatesRemoved} duplicates`);
    console.log(`  ✓ ${this.deduplicatedIssues.length} unique issues remaining`);
  }

  createFingerprint(issue) {
    // Create a unique fingerprint based on key attributes
    const parts = [
      issue.category,
      issue.title,
      issue.file || 'no-file',
      issue.severity
    ];

    return parts.join('::');
  }

  async prioritizeIssues() {
    console.log('\nPrioritizing issues...');

    // Sort by severity and impact
    const severityOrder = {
      'critical': 5,
      'high': 4,
      'medium': 3,
      'low': 2,
      'info': 1
    };

    this.deduplicatedIssues.sort((a, b) => {
      // First by severity
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;

      // Then by occurrences (more occurrences = higher priority)
      const occurrenceDiff = (b.occurrences || 1) - (a.occurrences || 1);
      if (occurrenceDiff !== 0) return occurrenceDiff;

      // Then by category priority
      const categoryPriority = {
        'smart-contract-security': 10,
        'security': 9,
        'deployment-security': 8,
        'frontend-blockchain-sync': 7,
        'backend-blockchain-sync': 6,
        'cache-invalidation': 5,
        'transaction-confirmations': 5
      };

      return (categoryPriority[b.category] || 0) - (categoryPriority[a.category] || 0);
    });

    console.log('  ✓ Issues prioritized by severity and impact');
  }

  async generateSummary() {
    console.log('\nGenerating summary...');

    const summary = {
      totalIssues: this.deduplicatedIssues.length,
      bySeverity: {
        critical: this.deduplicatedIssues.filter(i => i.severity === 'critical').length,
        high: this.deduplicatedIssues.filter(i => i.severity === 'high').length,
        medium: this.deduplicatedIssues.filter(i => i.severity === 'medium').length,
        low: this.deduplicatedIssues.filter(i => i.severity === 'low').length,
        info: this.deduplicatedIssues.filter(i => i.severity === 'info').length
      },
      byCategory: {},
      topIssues: this.deduplicatedIssues.slice(0, 10)
    };

    // Group by category
    for (const issue of this.deduplicatedIssues) {
      summary.byCategory[issue.category] = (summary.byCategory[issue.category] || 0) + 1;
    }

    this.summary = summary;

    console.log('  ✓ Summary generated');
  }

  async generateSARIF() {
    console.log('\nGenerating SARIF output...');

    // SARIF (Static Analysis Results Interchange Format) - industry standard
    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'Web3 Debugging Framework',
              version: '1.0.0',
              informationUri: 'https://github.com/your-repo/web3-debugging-framework',
              rules: this.generateSARIFRules()
            }
          },
          results: this.generateSARIFResults()
        }
      ]
    };

    const sarifPath = path.join(this.debugPath, 'results.sarif');
    await fs.promises.writeFile(sarifPath, JSON.stringify(sarif, null, 2), 'utf-8');

    console.log(`  ✓ SARIF output saved: ${sarifPath}`);
    this.sarifPath = sarifPath;
  }

  generateSARIFRules() {
    // Extract unique rule IDs from issues
    const ruleMap = new Map();

    for (const issue of this.deduplicatedIssues) {
      const ruleId = this.getRuleId(issue);

      if (!ruleMap.has(ruleId)) {
        ruleMap.set(ruleId, {
          id: ruleId,
          name: issue.title,
          shortDescription: {
            text: issue.title
          },
          fullDescription: {
            text: issue.description || issue.title
          },
          helpUri: this.getHelpUri(issue),
          properties: {
            category: issue.category,
            severity: issue.severity
          }
        });
      }
    }

    return Array.from(ruleMap.values());
  }

  generateSARIFResults() {
    return this.deduplicatedIssues.map(issue => {
      const result = {
        ruleId: this.getRuleId(issue),
        level: this.getSARIFLevel(issue.severity),
        message: {
          text: issue.description || issue.title
        },
        properties: {
          recommendation: issue.recommendation,
          occurrences: issue.occurrences || 1
        }
      };

      // Add location if file is specified
      if (issue.file) {
        result.locations = [
          {
            physicalLocation: {
              artifactLocation: {
                uri: issue.file
              }
            }
          }
        ];
      }

      return result;
    });
  }

  getRuleId(issue) {
    // Create a stable rule ID
    return `${issue.category}/${issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  getSARIFLevel(severity) {
    const levelMap = {
      'critical': 'error',
      'high': 'error',
      'medium': 'warning',
      'low': 'note',
      'info': 'note'
    };

    return levelMap[severity] || 'warning';
  }

  getHelpUri(issue) {
    // Map categories to documentation URLs
    const docsBase = 'https://github.com/your-repo/web3-debugging-framework/docs';

    const categoryDocs = {
      'smart-contract-security': `${docsBase}/contract-security.md`,
      'frontend-blockchain-sync': `${docsBase}/frontend-sync.md`,
      'cache-invalidation': `${docsBase}/cache-strategy.md`,
      'security': `${docsBase}/security.md`
    };

    return categoryDocs[issue.category] || docsBase;
  }

  generateReport() {
    const bySeverity = this.summary.bySeverity;

    console.log('\n' + '='.repeat(70));
    console.log('AGGREGATE VALIDATION REPORT');
    console.log('='.repeat(70));
    console.log(`\nTotal Issues: ${this.summary.totalIssues}`);
    console.log(`Critical: ${bySeverity.critical}, High: ${bySeverity.high}, Medium: ${bySeverity.medium}, Low: ${bySeverity.low}, Info: ${bySeverity.info}`);

    console.log('\n📊 By Category:');
    const sortedCategories = Object.entries(this.summary.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [category, count] of sortedCategories) {
      console.log(`  - ${category}: ${count}`);
    }

    console.log('\n🔥 Top 10 Issues to Fix:');
    for (let i = 0; i < Math.min(10, this.summary.topIssues.length); i++) {
      const issue = this.summary.topIssues[i];
      const severity = issue.severity.toUpperCase().padEnd(8);
      console.log(`  ${i + 1}. [${severity}] ${issue.title}`);
      if (issue.file) {
        console.log(`     File: ${issue.file}`);
      }
    }

    return {
      summary: this.summary,
      allIssues: this.deduplicatedIssues,
      sarifPath: this.sarifPath,
      timestamp: new Date().toISOString()
    };
  }

  async save() {
    const outputPath = path.join(this.debugPath, 'aggregate-validation.json');
    const report = {
      summary: this.summary,
      issues: this.deduplicatedIssues,
      validatorResults: this.validatorResults,
      timestamp: new Date().toISOString()
    };

    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n✅ Aggregate report saved: ${outputPath}`);
    console.log(`✅ SARIF output saved: ${this.sarifPath}`);

    return outputPath;
  }
}

if (require.main === module) {
  const aggregator = new IssueAggregator();
  aggregator.aggregate()
    .then(() => aggregator.save())
    .catch(console.error);
}

module.exports = { IssueAggregator };
