#!/usr/bin/env node
/**
 * Master Validator Runner
 * Runs all validators in parallel and aggregates results
 */
const { IntegrationValidator } = require('./validators/integration-validator.js');
const { PackageValidator } = require('./validators/package-validator.js');
const { QualityValidator } = require('./validators/quality-validator.js');
const { GitValidator } = require('./validators/git-validator.js');
const { ContractValidator } = require('./validators/contract-validator.js');
const { DeploymentValidator } = require('./validators/deployment-validator.js');
const { ObservabilityValidator } = require('./validators/observability-validator.js');
const { IssueAggregator } = require('./issue-aggregator.js');
const fs = require('fs');
const path = require('path');

async function runAll() {
  console.log('🚀 Running all validators...\n');

  const rootPath = process.cwd();
  const results = {};

  // Run validators in parallel
  const validators = [
    { name: 'integration', Validator: IntegrationValidator },
    { name: 'package', Validator: PackageValidator },
    { name: 'quality', Validator: QualityValidator },
    { name: 'git', Validator: GitValidator },
    { name: 'contract', Validator: ContractValidator },
    { name: 'deployment', Validator: DeploymentValidator },
    { name: 'observability', Validator: ObservabilityValidator }
  ];
  
  const promises = validators.map(async ({ name, Validator }) => {
    try {
      console.log(`Starting ${name} validator...`);
      const validator = new Validator(rootPath);
      const result = await validator.validate();
      results[name] = result;
      console.log(`✓ ${name} validator complete\n`);
    } catch (error) {
      console.error(`✗ ${name} validator failed:`, error.message);
      results[name] = { error: error.message };
    }
  });
  
  await Promise.all(promises);
  
  // Generate aggregate report
  console.log('\n' + '='.repeat(70));
  console.log('AGGREGATE VALIDATION REPORT');
  console.log('='.repeat(70));
  
  let totalIssues = 0;
  const aggregateSeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  
  for (const [name, result] of Object.entries(results)) {
    if (result.error) continue;
    totalIssues += result.summary.totalIssues;
    for (const [severity, count] of Object.entries(result.summary.bySeverity)) {
      aggregateSeverity[severity] = (aggregateSeverity[severity] || 0) + count;
    }
  }
  
  console.log(`\nTotal issues across all validators: ${totalIssues}`);
  console.log(`\nBy severity:`);
  console.log(`  🔴 Critical: ${aggregateSeverity.critical}`);
  console.log(`  🟠 High: ${aggregateSeverity.high}`);
  console.log(`  🟡 Medium: ${aggregateSeverity.medium}`);
  console.log(`  🟢 Low: ${aggregateSeverity.low}`);
  console.log(`  ℹ️  Info: ${aggregateSeverity.info}`);
  
  // Save aggregate report
  const outputPath = path.join(rootPath, '.claude/debug/aggregate-validation.json');
  await fs.promises.writeFile(
    outputPath,
    JSON.stringify({ results, aggregate: { totalIssues, bySeverity: aggregateSeverity } }, null, 2),
    'utf-8'
  );

  console.log(`\n✅ Aggregate report saved to: ${outputPath}`);

  // Run Issue Aggregator to deduplicate and prioritize
  console.log('\n🔄 Running Issue Aggregator...\n');
  try {
    const aggregator = new IssueAggregator(rootPath);
    await aggregator.aggregate();
    await aggregator.save();
  } catch (error) {
    console.error('⚠️  Issue aggregator failed:', error.message);
  }

  console.log('');

  return results;
}

if (require.main === module) {
  runAll().catch(console.error);
}

module.exports = { runAll };
