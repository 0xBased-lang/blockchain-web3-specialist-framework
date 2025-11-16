# Testing Strategy - Comprehensive Testing Plan

## Testing Philosophy

**Core Principles**:
1. **Test Pyramid**: More unit tests, fewer integration tests, minimal E2E tests
2. **Test Blockchain Interactions**: Mock or use test networks, NEVER mainnet
3. **Security-Critical Code**: 100% coverage for wallet/transaction code
4. **Fast Feedback**: Unit tests run in < 5 seconds
5. **Deterministic**: Tests must be repeatable and not flaky

---

## Testing Levels

### 1. Unit Tests (80% of tests)

**Scope**: Individual functions, classes, utilities

**Tools**: Vitest

**Coverage Target**: 90%+

**Example Locations**:
```
src/utils/__tests__/
src/types/__tests__/
src/config/__tests__/
```

**Example Test**:
```typescript
// src/utils/__tests__/address-validator.test.ts
import { describe, it, expect } from 'vitest';
import { isValidEthereumAddress } from '../address-validator.js';

describe('Address Validator', () => {
  it('should validate correct Ethereum address', () => {
    expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')).toBe(true);
  });

  it('should reject invalid checksum', () => {
    expect(isValidEthereumAddress('0x742d35cc6634c0532925a3b844bc9e7595f0beb')).toBe(false);
  });

  it('should reject non-hex characters', () => {
    expect(isValidEthereumAddress('0xGGGd35Cc6634C0532925a3b844Bc9e7595f0bEb')).toBe(false);
  });
});
```

**Mocking Strategy**:
```typescript
// Mock blockchain providers
vi.mock('ethers', () => ({
  JsonRpcProvider: vi.fn(() => ({
    getBalance: vi.fn().mockResolvedValue(parseEther('1.0')),
    getBlockNumber: vi.fn().mockResolvedValue(12345),
  })),
}));
```

### 2. Integration Tests (15% of tests)

**Scope**: Multiple components working together

**Tools**: Vitest + Test Networks

**Coverage Target**: 70%+

**Example Locations**:
```
tests/integration/
tests/integration/mcp-servers/
tests/integration/agents/
```

**Example Test**:
```typescript
// tests/integration/mcp-servers/ethereum.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EthereumMCPServer } from '../../src/mcp-servers/ethereum/index.js';
import { ethers } from 'ethers';

describe('Ethereum MCP Server Integration', () => {
  let server: EthereumMCPServer;
  let provider: ethers.JsonRpcProvider;

  beforeAll(async () => {
    // Connect to Hardhat local node
    provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    server = new EthereumMCPServer(provider);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should query balance from test network', async () => {
    const testAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Hardhat #0
    const balance = await server.callTool({
      name: 'query_balance',
      arguments: { address: testAddress },
    });

    expect(balance).toBeDefined();
    expect(typeof balance).toBe('bigint');
  });

  it('should handle invalid addresses gracefully', async () => {
    await expect(
      server.callTool({
        name: 'query_balance',
        arguments: { address: 'invalid' },
      })
    ).rejects.toThrow('Invalid address');
  });
});
```

**Test Network Setup**:
```bash
# Start Hardhat node in separate terminal
pnpm hardhat node

# Run integration tests
pnpm test:integration
```

### 3. End-to-End Tests (5% of tests)

**Scope**: Complete user workflows

**Tools**: Playwright (if UI) or Vitest for CLI flows

**Coverage Target**: Critical paths only

**Example Locations**:
```
tests/e2e/
tests/e2e/workflows/
```

**Example Test**:
```typescript
// tests/e2e/workflows/swap-tokens.test.ts
import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../../src/agents/orchestrator.js';

describe('E2E: Token Swap Workflow', () => {
  it('should complete full swap from user command to confirmation', async () => {
    const orchestrator = new Orchestrator();

    // User command
    const result = await orchestrator.executeTask({
      type: 'swap',
      params: {
        from: 'ETH',
        to: 'USDC',
        amount: '0.1',
        network: 'sepolia', // Test network
      },
    });

    expect(result.status).toBe('completed');
    expect(result.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(result.confirmations).toBeGreaterThan(0);
  }, 120000); // 2-minute timeout for blockchain operations
});
```

---

## Testing Blockchain Interactions

### Never Test on Mainnet

**Use Test Networks**:
- Ethereum: Sepolia, Goerli
- Polygon: Mumbai
- Solana: Devnet, Testnet

**Use Local Nodes**:
```bash
# Hardhat for Ethereum
pnpm hardhat node

# Ganache (alternative)
pnpm ganache-cli

# Solana Test Validator
solana-test-validator
```

### Mocking RPC Calls

```typescript
// tests/mocks/ethereum-provider.mock.ts
export function createMockProvider() {
  return {
    getBalance: vi.fn().mockResolvedValue(parseEther('10.0')),
    getBlockNumber: vi.fn().mockResolvedValue(1000000),
    getTransactionCount: vi.fn().mockResolvedValue(5),
    getGasPrice: vi.fn().mockResolvedValue(parseUnits('50', 'gwei')),
    sendTransaction: vi.fn().mockResolvedValue({
      hash: '0x' + '1'.repeat(64),
      wait: vi.fn().mockResolvedValue({
        status: 1,
        blockNumber: 1000001,
      }),
    }),
  };
}
```

### Transaction Simulation

```typescript
// Use Tenderly or Hardhat forking for realistic testing
import { ethers } from 'hardhat';

describe('Transaction Simulation', () => {
  it('should simulate swap on forked mainnet', async () => {
    // Hardhat config includes mainnet fork
    const [signer] = await ethers.getSigners();

    // Simulate transaction without sending to real mainnet
    const tx = await signer.sendTransaction({
      to: '0x...',
      value: parseEther('1.0'),
    });

    expect(tx.hash).toBeDefined();
  });
});
```

---

## Security Testing

### 1. Input Validation Tests

```typescript
describe('Security: Input Validation', () => {
  it('should reject SQL injection attempts', () => {
    const malicious = "'; DROP TABLE users; --";
    expect(() => validateAddress(malicious)).toThrow();
  });

  it('should reject XSS attempts', () => {
    const malicious = '<script>alert("xss")</script>';
    expect(() => validateAddress(malicious)).toThrow();
  });

  it('should reject integer overflow', () => {
    const huge = BigInt(2) ** BigInt(256);
    expect(() => validateAmount(huge)).toThrow();
  });
});
```

### 2. Private Key Safety Tests

```typescript
describe('Security: Private Key Handling', () => {
  it('should never log private keys', () => {
    const logSpy = vi.spyOn(console, 'log');
    const privateKey = '0x' + '1'.repeat(64);

    handlePrivateKey(privateKey);

    // Check no log contains the key
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining(privateKey));
  });

  it('should encrypt keys before storage', async () => {
    const wallet = await WalletManager.create('password123');
    const stored = wallet.exportEncrypted();

    // Should not contain plaintext key
    expect(stored).not.toContain('0x');
    expect(stored.length).toBeGreaterThan(100); // Encrypted is longer
  });
});
```

### 3. Transaction Validation Tests

```typescript
describe('Security: Transaction Validation', () => {
  it('should reject unsigned transactions', async () => {
    const unsigned = { to: '0x123', value: parseEther('1.0') };
    await expect(sendTransaction(unsigned)).rejects.toThrow('Missing signature');
  });

  it('should validate transaction amounts', async () => {
    const balance = parseEther('1.0');
    const amount = parseEther('2.0');

    await expect(sendTransaction({ amount, balance })).rejects.toThrow('Insufficient funds');
  });
});
```

---

## Performance Testing

### Load Testing

```typescript
describe('Performance: RPC Rate Limiting', () => {
  it('should handle 100 concurrent requests', async () => {
    const requests = Array(100)
      .fill(null)
      .map(() => provider.getBlockNumber());

    const results = await Promise.all(requests);

    expect(results).toHaveLength(100);
    expect(results.every((r) => typeof r === 'number')).toBe(true);
  }, 30000);
});
```

### Benchmarking

```typescript
import { bench } from 'vitest';

describe('Performance Benchmarks', () => {
  bench('address validation', () => {
    isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
  });

  bench('signature verification', async () => {
    await verifySignature(message, signature, address);
  });
});
```

---

## Coverage Requirements

### Overall Coverage

```json
{
  "coverage": {
    "lines": 80,
    "functions": 80,
    "branches": 75,
    "statements": 80
  }
}
```

### Critical Code (100% Coverage Required)

- `src/subagents/WalletManager.ts`
- `src/subagents/TransactionBuilder.ts`
- `src/utils/crypto.ts`

### Allowed Lower Coverage

- Generated code (typechain)
- Configuration files
- Type definitions

---

## Continuous Testing

### Pre-commit Hooks

```bash
# .husky/pre-commit
pnpm typecheck
pnpm lint
pnpm test --run --coverage
```

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Type check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Test Data Management

### Fixtures

```typescript
// tests/fixtures/accounts.ts
export const TEST_ACCOUNTS = {
  alice: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  bob: {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
};
```

### Test Contracts

```solidity
// tests/contracts/MockERC20.sol
contract MockERC20 {
    mapping(address => uint256) public balances;

    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }
}
```

---

## Parallel Verification Workflow

### Pattern: Independent Review

Use multiple Claude Code instances for independent verification to catch issues that a single instance might miss.

#### Setup: Multiple Terminal Sessions

```bash
# Terminal 1: Implementation Claude
claude  # Implement feature X

# Terminal 2: Review Claude (separate session)
claude  # Review implementation of feature X independently
```

#### Benefits

- **Independent verification** catches issues single instance misses
- **Parallel development** speeds up implementation
- **Separate contexts** avoid cross-contamination
- **Higher code quality** through multiple perspectives

#### Example Workflow

**Terminal 1 (Implementation)**:
```bash
# Implement Ethereum MCP server
claude

> "Implement the Ethereum MCP server according to guide 02"
> [Claude implements the server]
```

**Terminal 2 (Review)**:
```bash
# Start fresh review session
claude

> "Review the Ethereum MCP server implementation in src/mcp-servers/ethereum/"
> "Check for security issues, validate error handling, ensure all tools are properly implemented"
> [Claude independently reviews and finds issues]
```

#### Git Worktrees for Parallel Work

For working on multiple features simultaneously:

```bash
# Create separate worktrees for parallel features
git worktree add ../framework-ethereum-mcp ethereum-mcp
git worktree add ../framework-solana-mcp solana-mcp

# Work on both simultaneously with different Claude instances
# Terminal 1
cd ../framework-ethereum-mcp && claude

# Terminal 2
cd ../framework-solana-mcp && claude
```

#### When to Use Parallel Verification

- **After major implementations**: New MCP servers, agents, security-critical code
- **Before releases**: Final verification of all changes
- **For security-critical code**: 100% coverage areas (wallet, transactions)
- **Complex refactoring**: When making significant architectural changes

#### Best Practices

1. **Clear session separation**: Use /clear between major tasks in each session
2. **Context independence**: Don't share context between instances - let each work independently
3. **Document findings**: Each instance should document its findings separately
4. **Reconcile differences**: Compare findings and discuss discrepancies
5. **Fresh perspectives**: Start review sessions without bias from implementation

---

## Testing Checklist

Before each release:

- [ ] All unit tests pass (90%+ coverage)
- [ ] All integration tests pass
- [ ] Critical E2E workflows tested
- [ ] Security tests pass
- [ ] Performance benchmarks meet targets
- [ ] No console.log in production code
- [ ] No hardcoded private keys
- [ ] No mainnet tests
- [ ] All mocks properly isolated
- [ ] Flaky tests fixed or marked
- [ ] **Parallel verification completed** for critical code
- [ ] Independent Claude review passed

---

**Document Version**: 1.1.0
**Last Updated**: 2025-11-14 (Added parallel verification workflow)
**Review Frequency**: After each sprint
