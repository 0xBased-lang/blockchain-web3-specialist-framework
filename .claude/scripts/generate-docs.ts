#!/usr/bin/env ts-node
/**
 * Automated Documentation Generation
 *
 * Extracts NatSpec comments, generates contract diagrams, and produces
 * comprehensive documentation for smart contracts.
 *
 * Features:
 * - NatSpec extraction from Solidity contracts
 * - Function signature documentation
 * - State variable documentation
 * - Event documentation
 * - Mermaid diagram generation for contract structure
 * - Markdown output for easy integration
 */

import * as fs from 'fs';
import * as path from 'path';

interface ContractInfo {
  name: string;
  file: string;
  natspec: {
    title?: string;
    author?: string;
    notice?: string;
    dev?: string;
  };
  stateVariables: StateVariable[];
  functions: FunctionInfo[];
  events: EventInfo[];
  inheritedContracts: string[];
}

interface StateVariable {
  name: string;
  type: string;
  visibility: string;
  natspec?: string;
}

interface FunctionInfo {
  name: string;
  visibility: string;
  signature: string;
  params: Parameter[];
  returns: Parameter[];
  modifiers: string[];
  natspec: {
    notice?: string;
    dev?: string;
    param?: Record<string, string>;
    return?: string;
  };
}

interface EventInfo {
  name: string;
  params: Parameter[];
  natspec?: string;
}

interface Parameter {
  name: string;
  type: string;
}

class DocumentationGenerator {
  private contracts: ContractInfo[] = [];

  async generateDocs(contractsDir: string, outputDir: string): Promise<void> {
    console.log('Generating documentation...');

    // Find all Solidity files
    const solidityFiles = this.findSolidityFiles(contractsDir);

    // Parse each contract
    for (const file of solidityFiles) {
      const contract = await this.parseContract(file);
      if (contract) {
        this.contracts.push(contract);
      }
    }

    // Generate output
    await this.generateMarkdownDocs(outputDir);
    await this.generateMermaidDiagrams(outputDir);
    await this.generateIndexPage(outputDir);

    console.log(`Documentation generated in ${outputDir}/`);
  }

  private findSolidityFiles(dir: string): string[] {
    const files: string[] = [];

    const walk = (currentPath: string) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        // Skip node_modules and common ignore patterns
        if (entry.name === 'node_modules' || entry.name === 'lib' || entry.name === 'out') {
          continue;
        }

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.sol')) {
          files.push(fullPath);
        }
      }
    };

    walk(dir);
    return files;
  }

  private async parseContract(filePath: string): Promise<ContractInfo | null> {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Simple regex-based parsing (for production, use proper Solidity parser)
    const contractMatch = content.match(/contract\s+(\w+)(?:\s+is\s+([\w,\s]+))?\s*\{/);
    if (!contractMatch) {
      return null;
    }

    const contractName = contractMatch[1];
    const inherited = contractMatch[2]
      ? contractMatch[2].split(',').map(s => s.trim())
      : [];

    // Extract contract-level NatSpec
    const natspec = this.extractContractNatSpec(content);

    // Extract state variables
    const stateVariables = this.extractStateVariables(content);

    // Extract functions
    const functions = this.extractFunctions(content);

    // Extract events
    const events = this.extractEvents(content);

    return {
      name: contractName,
      file: filePath,
      natspec,
      stateVariables,
      functions,
      events,
      inheritedContracts: inherited,
    };
  }

  private extractContractNatSpec(content: string): ContractInfo['natspec'] {
    const natspec: ContractInfo['natspec'] = {};

    // Extract contract-level documentation
    const contractDocMatch = content.match(/\/\*\*\s*([\s\S]*?)\*\/\s*contract/);
    if (contractDocMatch) {
      const docBlock = contractDocMatch[1];

      const titleMatch = docBlock.match(/@title\s+(.*?)(?:\n|$)/);
      if (titleMatch) natspec.title = titleMatch[1].trim();

      const authorMatch = docBlock.match(/@author\s+(.*?)(?:\n|$)/);
      if (authorMatch) natspec.author = authorMatch[1].trim();

      const noticeMatch = docBlock.match(/@notice\s+(.*?)(?:\n|$)/);
      if (noticeMatch) natspec.notice = noticeMatch[1].trim();

      const devMatch = docBlock.match(/@dev\s+(.*?)(?:\n|$)/);
      if (devMatch) natspec.dev = devMatch[1].trim();
    }

    return natspec;
  }

  private extractStateVariables(content: string): StateVariable[] {
    const variables: StateVariable[] = [];

    // Match state variables with optional NatSpec
    const varPattern = /(?:\/\*\*\s*(.*?)\s*\*\/)?\s*(mapping|uint\d*|int\d*|address|bool|bytes\d*|string)\s+(public|private|internal)?\s+(\w+)\s*(?:=|;)/g;

    let match;
    while ((match = varPattern.exec(content)) !== null) {
      variables.push({
        name: match[4],
        type: match[2],
        visibility: match[3] || 'internal',
        natspec: match[1] ? match[1].replace(/\n\s*\*\s*/g, ' ').trim() : undefined,
      });
    }

    return variables;
  }

  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    // This is simplified - production version would use proper AST parser
    const funcPattern = /(?:\/\*\*\s*([\s\S]*?)\*\/)?\s*function\s+(\w+)\s*\(([\s\S]*?)\)\s+(.*?)(?:returns\s*\((.*?)\))?\s*(?:\{|;)/g;

    let match;
    while ((match = funcPattern.exec(content)) !== null) {
      const [, docBlock, name, paramsStr, modifiersStr, returnsStr] = match;

      // Parse parameters
      const params = this.parseParameters(paramsStr);

      // Parse return values
      const returns = returnsStr ? this.parseParameters(returnsStr) : [];

      // Parse modifiers
      const modifiers = modifiersStr
        .split(/\s+/)
        .filter(m => m && m !== 'external' && m !== 'public' && m !== 'internal' && m !== 'private' && m !== 'view' && m !== 'pure' && m !== 'payable');

      // Determine visibility
      const visibility = modifiersStr.match(/(external|public|internal|private)/)?.[1] || 'public';

      // Parse NatSpec
      const natspec = this.parseFunctionNatSpec(docBlock);

      functions.push({
        name,
        visibility,
        signature: `${name}(${params.map(p => p.type).join(',')})`,
        params,
        returns,
        modifiers,
        natspec,
      });
    }

    return functions;
  }

  private parseFunctionNatSpec(docBlock: string | undefined): FunctionInfo['natspec'] {
    const natspec: FunctionInfo['natspec'] = { param: {} };

    if (!docBlock) return natspec;

    const noticeMatch = docBlock.match(/@notice\s+(.*?)(?:\n|@|$)/s);
    if (noticeMatch) natspec.notice = noticeMatch[1].trim();

    const devMatch = docBlock.match(/@dev\s+(.*?)(?:\n|@|$)/s);
    if (devMatch) natspec.dev = devMatch[1].trim();

    const returnMatch = docBlock.match(/@return\s+(.*?)(?:\n|@|$)/s);
    if (returnMatch) natspec.return = returnMatch[1].trim();

    // Extract @param tags
    const paramPattern = /@param\s+(\w+)\s+(.*?)(?:\n|@|$)/g;
    let paramMatch;
    while ((paramMatch = paramPattern.exec(docBlock)) !== null) {
      natspec.param![paramMatch[1]] = paramMatch[2].trim();
    }

    return natspec;
  }

  private extractEvents(content: string): EventInfo[] {
    const events: EventInfo[] = [];

    const eventPattern = /(?:\/\*\*\s*(.*?)\s*\*\/)?\s*event\s+(\w+)\s*\(([\s\S]*?)\);/g;

    let match;
    while ((match = eventPattern.exec(content)) !== null) {
      events.push({
        name: match[2],
        params: this.parseParameters(match[3]),
        natspec: match[1] ? match[1].replace(/\n\s*\*\s*/g, ' ').trim() : undefined,
      });
    }

    return events;
  }

  private parseParameters(paramsStr: string): Parameter[] {
    if (!paramsStr.trim()) return [];

    return paramsStr.split(',').map(param => {
      const trimmed = param.trim();
      const parts = trimmed.split(/\s+/);

      // Handle indexed event parameters
      const type = parts[0];
      const name = parts[parts.length - 1];

      return { type, name };
    });
  }

  private async generateMarkdownDocs(outputDir: string): Promise<void> {
    fs.mkdirSync(outputDir, { recursive: true });

    for (const contract of this.contracts) {
      const markdown = this.contractToMarkdown(contract);
      const filename = path.join(outputDir, `${contract.name}.md`);
      fs.writeFileSync(filename, markdown);
    }
  }

  private contractToMarkdown(contract: ContractInfo): string {
    let md = `# ${contract.name}\n\n`;

    // Contract metadata
    if (contract.natspec.title) {
      md += `## ${contract.natspec.title}\n\n`;
    }

    if (contract.natspec.author) {
      md += `**Author**: ${contract.natspec.author}\n\n`;
    }

    if (contract.natspec.notice) {
      md += `${contract.natspec.notice}\n\n`;
    }

    if (contract.natspec.dev) {
      md += `**Developer Notes**: ${contract.natspec.dev}\n\n`;
    }

    // Inheritance
    if (contract.inheritedContracts.length > 0) {
      md += `**Inherits**: ${contract.inheritedContracts.join(', ')}\n\n`;
    }

    // Source file
    md += `**Source File**: \`${contract.file}\`\n\n`;

    md += '---\n\n';

    // State Variables
    if (contract.stateVariables.length > 0) {
      md += '## State Variables\n\n';

      for (const variable of contract.stateVariables) {
        md += `### ${variable.name}\n\n`;
        md += `\`\`\`solidity\n${variable.type} ${variable.visibility} ${variable.name}\n\`\`\`\n\n`;

        if (variable.natspec) {
          md += `${variable.natspec}\n\n`;
        }
      }

      md += '---\n\n';
    }

    // Functions
    if (contract.functions.length > 0) {
      md += '## Functions\n\n';

      for (const func of contract.functions) {
        md += `### ${func.name}\n\n`;

        // Signature
        md += `\`\`\`solidity\n`;
        md += `function ${func.name}(${func.params.map(p => `${p.type} ${p.name}`).join(', ')}) ${func.visibility}`;
        if (func.modifiers.length > 0) {
          md += ` ${func.modifiers.join(' ')}`;
        }
        if (func.returns.length > 0) {
          md += ` returns (${func.returns.map(r => `${r.type} ${r.name}`).join(', ')})`;
        }
        md += `\n\`\`\`\n\n`;

        // Documentation
        if (func.natspec.notice) {
          md += `${func.natspec.notice}\n\n`;
        }

        if (func.natspec.dev) {
          md += `**Developer Notes**: ${func.natspec.dev}\n\n`;
        }

        // Parameters
        if (func.params.length > 0 && func.natspec.param) {
          md += '**Parameters**:\n\n';
          for (const param of func.params) {
            const doc = func.natspec.param[param.name];
            md += `- \`${param.name}\` (${param.type})`;
            if (doc) {
              md += `: ${doc}`;
            }
            md += '\n';
          }
          md += '\n';
        }

        // Return values
        if (func.returns.length > 0 && func.natspec.return) {
          md += `**Returns**: ${func.natspec.return}\n\n`;
        }
      }

      md += '---\n\n';
    }

    // Events
    if (contract.events.length > 0) {
      md += '## Events\n\n';

      for (const event of contract.events) {
        md += `### ${event.name}\n\n`;
        md += `\`\`\`solidity\nevent ${event.name}(${event.params.map(p => `${p.type} ${p.name}`).join(', ')})\n\`\`\`\n\n`;

        if (event.natspec) {
          md += `${event.natspec}\n\n`;
        }
      }
    }

    return md;
  }

  private async generateMermaidDiagrams(outputDir: string): Promise<void> {
    let diagram = '```mermaid\nclassDiagram\n';

    for (const contract of this.contracts) {
      // Class definition
      diagram += `  class ${contract.name} {\n`;

      // State variables
      for (const variable of contract.stateVariables) {
        diagram += `    ${variable.visibility === 'public' ? '+' : variable.visibility === 'private' ? '-' : '#'}${variable.type} ${variable.name}\n`;
      }

      // Functions
      for (const func of contract.functions) {
        const prefix = func.visibility === 'public' || func.visibility === 'external' ? '+' : func.visibility === 'private' ? '-' : '#';
        diagram += `    ${prefix}${func.name}()\n`;
      }

      diagram += '  }\n\n';

      // Inheritance
      for (const parent of contract.inheritedContracts) {
        diagram += `  ${parent} <|-- ${contract.name}\n`;
      }
    }

    diagram += '```\n';

    fs.writeFileSync(path.join(outputDir, 'contract-diagram.md'), diagram);
  }

  private async generateIndexPage(outputDir: string): Promise<void> {
    let index = '# Smart Contract Documentation\n\n';

    index += '## Contract Overview\n\n';
    index += '| Contract | Description | Source |\n';
    index += '|----------|-------------|--------|\n';

    for (const contract of this.contracts) {
      const desc = contract.natspec.notice || contract.natspec.title || 'No description';
      const relPath = path.relative(process.cwd(), contract.file);
      index += `| [${contract.name}](${contract.name}.md) | ${desc} | \`${relPath}\` |\n`;
    }

    index += '\n## Contract Architecture\n\n';
    index += '![Contract Diagram](contract-diagram.md)\n\n';

    index += '## Navigation\n\n';
    for (const contract of this.contracts) {
      index += `- [${contract.name}](${contract.name}.md)\n`;

      if (contract.functions.length > 0) {
        index += '  - Functions:\n';
        for (const func of contract.functions.slice(0, 5)) {
          index += `    - [${func.name}](${contract.name}.md#${func.name.toLowerCase()})\n`;
        }
        if (contract.functions.length > 5) {
          index += `    - ... and ${contract.functions.length - 5} more\n`;
        }
      }
    }

    index += '\n---\n\n';
    index += `*Documentation generated on ${new Date().toISOString()}*\n`;

    fs.writeFileSync(path.join(outputDir, 'README.md'), index);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Automated Documentation Generator

Usage:
  ./generate-docs.ts <contracts_dir> <output_dir>

Example:
  ./generate-docs.ts contracts/ docs/generated/

This will:
- Extract NatSpec comments from all Solidity files
- Generate markdown documentation for each contract
- Create Mermaid diagrams showing contract architecture
- Build an index page for easy navigation
    `);
    process.exit(1);
  }

  const contractsDir = args[0];
  const outputDir = args[1];

  if (!fs.existsSync(contractsDir)) {
    console.error(`Error: Contracts directory not found: ${contractsDir}`);
    process.exit(1);
  }

  const generator = new DocumentationGenerator();
  await generator.generateDocs(contractsDir, outputDir);
}

if (require.main === module) {
  main().catch(console.error);
}

export { DocumentationGenerator };
