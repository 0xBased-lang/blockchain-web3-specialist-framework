# Project Setup - Step-by-Step Implementation Guide

## Overview

This guide walks through the initial project scaffolding, from `pnpm init` to a fully configured TypeScript project with testing, linting, and build systems.

**Estimated Time**: 45-60 minutes

**Prerequisites**: Completed `00-prerequisites.md`

---

## Phase 1: Initialize Project (10 minutes)

### Step 1.1: Initialize pnpm Project

```bash
# Navigate to project directory
cd blockchain-web3-specialist-framework

# Initialize package.json
pnpm init
```

**Validation**:
```bash
test -f package.json && echo "✓ package.json created" || echo "✗ Failed"
```

### Step 1.2: Configure package.json

Edit `package.json`:

```json
{
  "name": "blockchain-web3-specialist-framework",
  "version": "0.1.0",
  "description": "AI-powered blockchain/Web3 framework with MCP servers, agents, and skills",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.15.0",
  "scripts": {
    "build": "tsup",
    "dev": "tsx watch src/index.ts",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,json,md}\"",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist coverage .turbo node_modules/.cache"
  },
  "keywords": [
    "blockchain",
    "web3",
    "ethereum",
    "solana",
    "mcp",
    "ai-agents",
    "defi",
    "nft"
  ],
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/blockchain-web3-specialist-framework.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/blockchain-web3-specialist-framework/issues"
  },
  "homepage": "https://github.com/yourusername/blockchain-web3-specialist-framework#readme"
}
```

**Validation**:
```bash
pnpm run --help  # Should list all scripts
```

---

## Phase 2: Install Dependencies (15 minutes)

### Step 2.1: Core Dependencies

```bash
# MCP and AI
pnpm add @modelcontextprotocol/sdk @anthropic-ai/sdk

# Blockchain - Ethereum
pnpm add ethers@^6.13.0 viem@^2.21.0

# Blockchain - Solana
pnpm add @solana/web3.js @solana/spl-token

# Utilities
pnpm add zod dotenv winston p-retry p-limit axios

# Build tools
pnpm add tsup tsx esbuild
```

**Validation**:
```bash
pnpm list | grep -E "(ethers|solana|modelcontextprotocol)"
```

### Step 2.2: Development Dependencies

```bash
# TypeScript
pnpm add -D typescript @types/node

# Testing
pnpm add -D vitest @vitest/coverage-v8

# Linting & Formatting
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier

# Hardhat (Ethereum development)
pnpm add -D hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-ethers

# Type generation
pnpm add -D @typechain/ethers-v6 typechain
```

**Validation**:
```bash
pnpm list -D | grep -E "(typescript|vitest|eslint)"
```

---

## Phase 3: TypeScript Configuration (10 minutes)

### Step 3.1: Create tsconfig.json

```bash
pnpm tsc --init
```

Edit `tsconfig.json`:

```json
{
  "compilerOptions": {
    /* Language and Environment */
    "target": "ES2022",
    "lib": ["ES2022"],

    /* Modules */
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "resolveJsonModule": true,

    /* Emit */
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "removeComments": false,
    "newLine": "lf",

    /* Interop Constraints */
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,

    /* Type Checking */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,

    /* Completeness */
    "skipLibCheck": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.spec.ts",
    "**/*.test.ts"
  ]
}
```

**Validation**:
```bash
pnpm typecheck  # Should pass with no errors
```

### Step 3.2: Create tsup.config.ts (Build Config)

Create `tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false, // Set to true for production
  target: 'node18',
  outDir: 'dist',
});
```

---

## Phase 4: Linting & Formatting (10 minutes)

### Step 4.1: ESLint Configuration

Create `.eslintrc.cjs`:

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  rules: {
    // TypeScript specific
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',

    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prettier/prettier': 'error',
  },
  ignorePatterns: ['dist', 'node_modules', '*.cjs', '*.config.ts'],
};
```

**Validation**:
```bash
pnpm lint  # Should run without errors
```

### Step 4.2: Prettier Configuration

Create `.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

Create `.prettierignore`:

```
dist
coverage
node_modules
.pnpm-store
*.log
```

**Validation**:
```bash
pnpm format:check  # Should pass
```

---

## Phase 5: Testing Setup (10 minutes)

### Step 5.1: Vitest Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      threshold: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

### Step 5.2: Create Test Example

Create `src/utils/__tests__/example.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
```

**Validation**:
```bash
pnpm test  # Should pass
```

---

## Phase 6: Project Structure (5 minutes)

### Step 6.1: Create Directory Structure

```bash
mkdir -p src/{agents,subagents,mcp-servers,skills,utils,types,config}
mkdir -p src/mcp-servers/{ethereum,solana,multi-chain}
mkdir -p .claude/{commands,skills}
mkdir -p tests/{unit,integration,e2e}
mkdir -p docs/{planning,architecture,implementation,risks,testing}
mkdir -p scripts
```

### Step 6.2: Create Barrel Exports

Create `src/index.ts`:

```typescript
// Main entry point
export * from './agents/index.js';
export * from './mcp-servers/index.js';
export * from './utils/index.js';

// Re-export types
export type * from './types/index.js';
```

Create `src/types/index.ts`:

```typescript
// Core types
export interface Address {
  value: string;
  chain: 'ethereum' | 'solana' | 'polygon';
}

export type HexString = `0x${string}`;

export interface Transaction {
  hash: string;
  from: Address;
  to: Address;
  value: bigint;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}
```

**Validation**:
```bash
tree -L 2 src/  # Verify structure
```

---

## Phase 7: Configuration Files (5 minutes)

### Step 7.1: Create Config System

Create `src/config/index.ts`:

```typescript
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load environment variables
loadEnv();

// Schema for validation
const ConfigSchema = z.object({
  // Networks
  networks: z.object({
    ethereum: z.object({
      mainnet: z.string().url(),
      sepolia: z.string().url(),
    }),
    solana: z.object({
      mainnet: z.string().url(),
      devnet: z.string().url(),
    }),
  }),

  // MCP Servers
  mcp: z.object({
    ethereum: z.object({
      port: z.number().int().min(1024).max(65535),
      enabled: z.boolean(),
    }),
    solana: z.object({
      port: z.number().int().min(1024).max(65535),
      enabled: z.boolean(),
    }),
  }),

  // Logging
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
  }),
});

// Build configuration object
export const config = ConfigSchema.parse({
  networks: {
    ethereum: {
      mainnet: process.env.ETH_MAINNET_RPC ?? '',
      sepolia: process.env.ETH_SEPOLIA_RPC ?? '',
    },
    solana: {
      mainnet: process.env.SOL_MAINNET_RPC ?? '',
      devnet: process.env.SOL_DEVNET_RPC ?? '',
    },
  },
  mcp: {
    ethereum: {
      port: parseInt(process.env.MCP_ETHEREUM_PORT ?? '3001', 10),
      enabled: true,
    },
    solana: {
      port: parseInt(process.env.MCP_SOLANA_PORT ?? '3002', 10),
      enabled: true,
    },
  },
  logging: {
    level: (process.env.AGENT_LOG_LEVEL as any) ?? 'info',
  },
});

export type Config = z.infer<typeof ConfigSchema>;
```

**Validation**:
```bash
# Create minimal .env for testing
echo "ETH_MAINNET_RPC=https://eth-mainnet.example.com" >> .env
echo "ETH_SEPOLIA_RPC=https://eth-sepolia.example.com" >> .env
echo "SOL_MAINNET_RPC=https://api.mainnet-beta.solana.com" >> .env
echo "SOL_DEVNET_RPC=https://api.devnet.solana.com" >> .env

# Test config loading
pnpm tsx -e "import('./src/config/index.js').then(m => console.log('Config loaded:', m.config.mcp.ethereum.port))"
```

---

## Phase 8: Hardhat Setup (Ethereum) (5 minutes)

### Step 8.1: Initialize Hardhat

```bash
pnpm hardhat init
# Select: Create a TypeScript project
# Install dependencies: Yes
```

### Step 8.2: Configure Hardhat

Edit `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import { config as loadEnv } from 'dotenv';

loadEnv();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    sepolia: {
      url: process.env.ETH_SEPOLIA_RPC ?? '',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: './contracts',
    tests: './tests/contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
```

**Validation**:
```bash
pnpm hardhat compile  # Should compile successfully
```

---

## Phase 9: Git Setup & Initial Commit (5 minutes)

### Step 9.1: Verify .gitignore

Ensure `.gitignore` includes:

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Environment
.env
.env.local

# Build
dist/
build/
*.tsbuildinfo

# Testing
coverage/

# Hardhat
cache/
artifacts/

# Logs
*.log
```

### Step 9.2: Initial Commit

```bash
git add .
git commit -m "chore: initial project setup with TypeScript, testing, and linting"
```

**Validation**:
```bash
git log --oneline  # Should show commit
git status  # Should be clean
```

---

## Phase 10: Verification & Testing (5 minutes)

### Step 10.1: Run All Checks

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Formatting
pnpm format:check

# Tests
pnpm test

# Build
pnpm build
```

### Step 10.2: Verification Checklist

```bash
# Check all files exist
test -f package.json && echo "✓ package.json"
test -f tsconfig.json && echo "✓ tsconfig.json"
test -f vitest.config.ts && echo "✓ vitest.config.ts"
test -f .eslintrc.cjs && echo "✓ .eslintrc.cjs"
test -f .prettierrc && echo "✓ .prettierrc"
test -f hardhat.config.ts && echo "✓ hardhat.config.ts"
test -d src && echo "✓ src/ directory"
test -d dist && echo "✓ dist/ directory (after build)"
```

**Expected Output**:
```
✓ package.json
✓ tsconfig.json
✓ vitest.config.ts
✓ .eslintrc.cjs
✓ .prettierrc
✓ hardhat.config.ts
✓ src/ directory
✓ dist/ directory (after build)
```

---

## Troubleshooting

### Issue: pnpm install fails

**Solution**:
```bash
# Clear pnpm cache
pnpm store prune

# Retry
pnpm install
```

### Issue: TypeScript errors in node_modules

**Solution**:
```bash
# Add to tsconfig.json
"skipLibCheck": true
```

### Issue: ESLint "unable to resolve path to module"

**Solution**:
```bash
# Install missing types
pnpm add -D @types/node
```

### Issue: Hardhat compile fails

**Solution**:
```bash
# Clear cache
pnpm hardhat clean

# Retry
pnpm hardhat compile
```

---

## Success Criteria

✅ All dependencies installed
✅ TypeScript compilation passes
✅ ESLint passes
✅ Prettier check passes
✅ All tests pass
✅ Project builds successfully
✅ Git repository initialized with first commit

---

## Next Steps

**Proceed to**: `docs/implementation/02-mcp-ethereum.md` to implement the Ethereum MCP server.

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-14
**Estimated Time**: 45-60 minutes
