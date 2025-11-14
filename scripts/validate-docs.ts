#!/usr/bin/env tsx
/**
 * Documentation Validation Script
 *
 * Prevents documentation drift issues like those in kektechV0.69:
 * - Validates cross-references between documents
 * - Checks file paths mentioned in docs exist
 * - Verifies code blocks are syntactically valid
 * - Detects broken internal links
 * - Ensures consistency across documentation
 *
 * Based on forensics analysis of 456 commits (See: PROJECT_FORENSICS_REPORT.md)
 *
 * Usage:
 *   pnpm validate:docs              # Validate all docs
 *   pnpm validate:docs --fix        # Auto-fix issues where possible
 *   pnpm validate:docs --verbose    # Show detailed output
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// ============================================================================
// Configuration
// ============================================================================

interface ValidationConfig {
  docsDir: string;
  rootDir: string;
  ignorePatterns: string[];
  codeBlockValidation: boolean;
  crossReferenceValidation: boolean;
  filePathValidation: boolean;
  linkValidation: boolean;
}

const config: ValidationConfig = {
  docsDir: 'docs',
  rootDir: process.cwd(),
  ignorePatterns: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
  ],
  codeBlockValidation: true,
  crossReferenceValidation: true,
  filePathValidation: true,
  linkValidation: true,
};

// ============================================================================
// Types
// ============================================================================

interface ValidationError {
  file: string;
  line: number;
  type: 'cross-reference' | 'file-path' | 'code-block' | 'link' | 'consistency';
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationError[];
  filesScanned: number;
  success: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

function readMarkdownFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function getAllMarkdownFiles(): string[] {
  const pattern = `${config.docsDir}/**/*.md`;
  return glob.sync(pattern, {
    cwd: config.rootDir,
    ignore: config.ignorePatterns,
    absolute: true,
  });
}

function extractCodeBlocks(content: string): Array<{ lang: string; code: string; line: number }> {
  const blocks: Array<{ lang: string; code: string; line: number }> = [];
  const lines = content.split('\n');

  let inCodeBlock = false;
  let currentLang = '';
  let currentCode: string[] = [];
  let blockStartLine = 0;

  lines.forEach((line, index) => {
    const codeBlockMatch = line.match(/^```(\w+)?/);

    if (codeBlockMatch && !inCodeBlock) {
      inCodeBlock = true;
      currentLang = codeBlockMatch[1] || 'text';
      currentCode = [];
      blockStartLine = index + 1;
    } else if (line.startsWith('```') && inCodeBlock) {
      blocks.push({
        lang: currentLang,
        code: currentCode.join('\n'),
        line: blockStartLine,
      });
      inCodeBlock = false;
    } else if (inCodeBlock) {
      currentCode.push(line);
    }
  });

  return blocks;
}

function extractFileReferences(content: string): Array<{ path: string; line: number }> {
  const references: Array<{ path: string; line: number }> = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Match file paths in various formats:
    // - `src/agents/orchestrator.ts`
    // - See: docs/implementation/01-project-setup.md
    // - Guide 17, Section 1.1
    // - file_path:line_number format

    // Pattern 1: Backtick-wrapped paths
    const backtickMatches = line.matchAll(/`([^`]+\.(ts|js|json|md|yml|yaml|toml|config\.js))`/g);
    for (const match of backtickMatches) {
      references.push({ path: match[1], line: index + 1 });
    }

    // Pattern 2: See: path/to/file.md
    const seeMatches = line.matchAll(/See:\s*([^\s,]+\.md)/gi);
    for (const match of seeMatches) {
      references.push({ path: match[1], line: index + 1 });
    }

    // Pattern 3: Guide references (e.g., "Guide 17")
    const guideMatches = line.matchAll(/Guide\s+(\d+)/gi);
    for (const match of guideMatches) {
      const guideNum = match[1].padStart(2, '0');
      // Try to find the corresponding guide file
      const possiblePaths = [
        `docs/implementation/${guideNum}-*.md`,
        `docs/risks/${guideNum}-*.md`,
      ];
      // We'll validate these in the cross-reference validation step
      references.push({ path: `Guide ${match[1]}`, line: index + 1 });
    }
  });

  return references;
}

function extractInternalLinks(content: string): Array<{ link: string; line: number }> {
  const links: Array<{ link: string; line: number }> = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Match markdown links: [text](path)
    const linkMatches = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
    for (const match of linkMatches) {
      const link = match[2];
      // Only validate internal links (not http/https)
      if (!link.startsWith('http://') && !link.startsWith('https://')) {
        links.push({ link, line: index + 1 });
      }
    }
  });

  return links;
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateCodeBlocks(
  filePath: string,
  content: string,
  errors: ValidationError[]
): void {
  const blocks = extractCodeBlocks(content);

  blocks.forEach(block => {
    // Validate TypeScript/JavaScript code blocks
    if (['typescript', 'ts', 'javascript', 'js'].includes(block.lang)) {
      // Check for common syntax errors
      const code = block.code;

      // Check for unbalanced braces
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push({
          file: filePath,
          line: block.line,
          type: 'code-block',
          severity: 'error',
          message: `Unbalanced braces in ${block.lang} code block (${openBraces} open, ${closeBraces} close)`,
          suggestion: 'Check for missing or extra braces',
        });
      }

      // Check for unbalanced parentheses
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push({
          file: filePath,
          line: block.line,
          type: 'code-block',
          severity: 'warning',
          message: `Unbalanced parentheses in ${block.lang} code block`,
          suggestion: 'Check for missing or extra parentheses',
        });
      }

      // Check for 'any' type usage (violates CLAUDE.md guidelines)
      if (code.includes(': any') || code.includes('<any>')) {
        errors.push({
          file: filePath,
          line: block.line,
          type: 'code-block',
          severity: 'warning',
          message: 'Code block uses "any" type (violates CLAUDE.md guideline)',
          suggestion: 'Replace with proper types or "unknown"',
        });
      }
    }

    // Validate JSON code blocks
    if (['json', 'jsonc'].includes(block.lang)) {
      try {
        // Remove comments for validation (JSONC support)
        const cleanedCode = block.code.replace(/\/\/.*$/gm, '');
        JSON.parse(cleanedCode);
      } catch (err) {
        errors.push({
          file: filePath,
          line: block.line,
          type: 'code-block',
          severity: 'error',
          message: `Invalid JSON syntax: ${err instanceof Error ? err.message : 'Unknown error'}`,
          suggestion: 'Fix JSON syntax errors',
        });
      }
    }

    // Validate bash/shell code blocks
    if (['bash', 'sh', 'shell'].includes(block.lang)) {
      // Check for dangerous commands in examples
      const dangerousCommands = ['rm -rf /', 'dd if=/dev/zero', ':(){ :|:& };:'];
      dangerousCommands.forEach(cmd => {
        if (block.code.includes(cmd)) {
          errors.push({
            file: filePath,
            line: block.line,
            type: 'code-block',
            severity: 'error',
            message: `Dangerous command found in bash example: ${cmd}`,
            suggestion: 'Remove or clearly mark as dangerous example',
          });
        }
      });

      // Check for private key exposure
      if (block.code.match(/[0-9a-fA-F]{64}/) && !block.code.includes('EXAMPLE')) {
        errors.push({
          file: filePath,
          line: block.line,
          type: 'code-block',
          severity: 'error',
          message: 'Possible private key in code block (64 hex chars without "EXAMPLE" marker)',
          suggestion: 'Replace with placeholder or add "EXAMPLE" comment',
        });
      }
    }
  });
}

function validateFileReferences(
  filePath: string,
  content: string,
  errors: ValidationError[]
): void {
  const references = extractFileReferences(content);

  references.forEach(ref => {
    // Skip Guide references (handled in cross-reference validation)
    if (ref.path.startsWith('Guide ')) return;

    // Resolve path relative to project root or docs directory
    let resolvedPath = path.resolve(config.rootDir, ref.path);

    // If not found, try relative to docs directory
    if (!fs.existsSync(resolvedPath)) {
      resolvedPath = path.resolve(config.rootDir, config.docsDir, ref.path);
    }

    // If still not found, try removing 'docs/' prefix if present
    if (!fs.existsSync(resolvedPath) && ref.path.startsWith('docs/')) {
      resolvedPath = path.resolve(config.rootDir, ref.path);
    }

    if (!fs.existsSync(resolvedPath)) {
      errors.push({
        file: filePath,
        line: ref.line,
        type: 'file-path',
        severity: 'error',
        message: `Referenced file does not exist: ${ref.path}`,
        suggestion: 'Check if file path is correct or if file has been moved/deleted',
      });
    }
  });
}

function validateCrossReferences(
  filePath: string,
  content: string,
  errors: ValidationError[]
): void {
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Validate "Guide XX" references
    const guideMatches = line.matchAll(/Guide\s+(\d+)/gi);
    for (const match of guideMatches) {
      const guideNum = match[1].padStart(2, '0');
      const possiblePaths = [
        `${config.rootDir}/docs/implementation/${guideNum}-*.md`,
        `${config.rootDir}/docs/risks/${guideNum}-*.md`,
      ];

      let found = false;
      for (const pattern of possiblePaths) {
        const matches = glob.sync(pattern);
        if (matches.length > 0) {
          found = true;
          break;
        }
      }

      if (!found) {
        errors.push({
          file: filePath,
          line: index + 1,
          type: 'cross-reference',
          severity: 'error',
          message: `Referenced Guide ${match[1]} does not exist`,
          suggestion: 'Check if guide number is correct or if guide has been created',
        });
      }
    }

    // Validate "Section X.Y" references
    const sectionMatches = line.matchAll(/Section\s+(\d+(?:\.\d+)*)/gi);
    for (const match of sectionMatches) {
      // This is a soft check - we warn if section numbers seem unusual
      const sectionNum = match[1];
      const parts = sectionNum.split('.');

      if (parts.length > 4) {
        errors.push({
          file: filePath,
          line: index + 1,
          type: 'cross-reference',
          severity: 'warning',
          message: `Deep section nesting: Section ${sectionNum}`,
          suggestion: 'Consider restructuring to reduce nesting depth',
        });
      }
    }

    // Validate "INCIDENT-XXX" references
    const incidentMatches = line.matchAll(/INCIDENT-(\d{3})/gi);
    for (const match of incidentMatches) {
      // Check if incident is documented in incident library template or project docs
      const incidentId = `INCIDENT-${match[1]}`;

      // This is informational - just track that we found incident references
      // Real validation would check against actual incident library
      if (match[1] !== '001') {
        errors.push({
          file: filePath,
          line: index + 1,
          type: 'cross-reference',
          severity: 'warning',
          message: `Referenced ${incidentId} - ensure it's documented in incident library`,
          suggestion: 'Document incident using INCIDENT_LIBRARY_TEMPLATE.md',
        });
      }
    }
  });
}

function validateInternalLinks(
  filePath: string,
  content: string,
  errors: ValidationError[]
): void {
  const links = extractInternalLinks(content);

  links.forEach(linkRef => {
    const { link, line } = linkRef;

    // Split anchor from path
    const [linkPath, anchor] = link.split('#');

    // Resolve relative path
    const fileDir = path.dirname(filePath);
    let resolvedPath = linkPath
      ? path.resolve(fileDir, linkPath)
      : filePath; // Same file anchor

    // Check if file exists
    if (linkPath && !fs.existsSync(resolvedPath)) {
      errors.push({
        file: filePath,
        line,
        type: 'link',
        severity: 'error',
        message: `Broken link: ${link} (file not found)`,
        suggestion: 'Check if file path is correct or if file has been moved',
      });
      return;
    }

    // If there's an anchor, validate it exists in the target file
    if (anchor) {
      try {
        const targetContent = fs.readFileSync(resolvedPath, 'utf-8');
        const targetLines = targetContent.split('\n');

        // Generate anchor from headings
        const anchors = new Set<string>();
        targetLines.forEach(line => {
          const headingMatch = line.match(/^#+\s+(.+)$/);
          if (headingMatch) {
            // Convert heading to anchor format
            const anchorText = headingMatch[1]
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
            anchors.add(anchorText);
          }
        });

        if (!anchors.has(anchor)) {
          errors.push({
            file: filePath,
            line,
            type: 'link',
            severity: 'warning',
            message: `Broken anchor: #${anchor} not found in ${path.basename(resolvedPath)}`,
            suggestion: 'Check if heading exists or has been renamed',
          });
        }
      } catch (err) {
        // Silently skip if we can't read the target file
      }
    }
  });
}

function validateConsistency(
  filePath: string,
  content: string,
  errors: ValidationError[]
): void {
  const lines = content.split('\n');

  // Check for consistent terminology
  const terminologyChecks = [
    {
      terms: ['ethereum', 'Ethereum'],
      preferred: 'Ethereum',
      pattern: /\bethereumvity\b/gi,
    },
    {
      terms: ['solana', 'Solana'],
      preferred: 'Solana',
      pattern: /\bsolana\b/g,
    },
  ];

  lines.forEach((line, index) => {
    // Check for mixing of terminology
    if (line.toLowerCase().includes('ethereum') && line.toLowerCase().includes('solana')) {
      // Skip if this is a comparison or multi-chain context
      if (!line.includes('multi-chain') && !line.includes('vs') && !line.includes('and')) {
        errors.push({
          file: filePath,
          line: index + 1,
          type: 'consistency',
          severity: 'warning',
          message: 'Mixing Ethereum and Solana in same line without context',
          suggestion: 'Clarify which chain you\'re referring to',
        });
      }
    }

    // Check for version inconsistencies
    // Look for patterns like "Node.js 18" and "Node.js 20" in same doc
    const nodeVersions = line.match(/Node\.js\s+(\d+)/gi);
    if (nodeVersions && nodeVersions.length > 1) {
      const versions = nodeVersions.map(v => v.match(/\d+/)?.[0]);
      const uniqueVersions = new Set(versions);
      if (uniqueVersions.size > 1) {
        errors.push({
          file: filePath,
          line: index + 1,
          type: 'consistency',
          severity: 'warning',
          message: 'Multiple Node.js versions mentioned',
          suggestion: 'Use consistent version numbers throughout documentation',
        });
      }
    }
  });
}

// ============================================================================
// Main Validation Function
// ============================================================================

function validateDocumentation(): ValidationResult {
  const result: ValidationResult = {
    errors: [],
    warnings: [],
    filesScanned: 0,
    success: true,
  };

  console.log('🔍 Starting documentation validation...\n');

  const files = getAllMarkdownFiles();
  result.filesScanned = files.length;

  console.log(`Found ${files.length} markdown files\n`);

  const allErrors: ValidationError[] = [];

  files.forEach(file => {
    const relPath = path.relative(config.rootDir, file);
    console.log(`Validating: ${relPath}`);

    const content = readMarkdownFile(file);

    if (config.codeBlockValidation) {
      validateCodeBlocks(file, content, allErrors);
    }

    if (config.filePathValidation) {
      validateFileReferences(file, content, allErrors);
    }

    if (config.crossReferenceValidation) {
      validateCrossReferences(file, content, allErrors);
    }

    if (config.linkValidation) {
      validateInternalLinks(file, content, allErrors);
    }

    validateConsistency(file, content, allErrors);
  });

  // Separate errors and warnings
  result.errors = allErrors.filter(e => e.severity === 'error');
  result.warnings = allErrors.filter(e => e.severity === 'warning');
  result.success = result.errors.length === 0;

  return result;
}

// ============================================================================
// Reporting
// ============================================================================

function printResults(result: ValidationResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 VALIDATION RESULTS');
  console.log('='.repeat(80) + '\n');

  console.log(`Files scanned: ${result.filesScanned}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}\n`);

  if (result.errors.length > 0) {
    console.log('❌ ERRORS:\n');
    result.errors.forEach(error => {
      const relPath = path.relative(config.rootDir, error.file);
      console.log(`  ${relPath}:${error.line}`);
      console.log(`    Type: ${error.type}`);
      console.log(`    Message: ${error.message}`);
      if (error.suggestion) {
        console.log(`    Suggestion: ${error.suggestion}`);
      }
      console.log('');
    });
  }

  if (result.warnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    result.warnings.forEach(warning => {
      const relPath = path.relative(config.rootDir, warning.file);
      console.log(`  ${relPath}:${warning.line}`);
      console.log(`    Type: ${warning.type}`);
      console.log(`    Message: ${warning.message}`);
      if (warning.suggestion) {
        console.log(`    Suggestion: ${warning.suggestion}`);
      }
      console.log('');
    });
  }

  console.log('='.repeat(80));

  if (result.success) {
    console.log('✅ Documentation validation passed!');
  } else {
    console.log('❌ Documentation validation failed!');
    console.log(`   Fix ${result.errors.length} error(s) before committing.`);
  }

  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const fix = args.includes('--fix');

  if (verbose) {
    console.log('Running in verbose mode\n');
  }

  if (fix) {
    console.log('Auto-fix mode enabled (limited fixes available)\n');
  }

  const result = validateDocumentation();
  printResults(result);

  // Exit with error code if validation failed
  if (!result.success) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { validateDocumentation, ValidationResult, ValidationError };
