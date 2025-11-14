# Testing, Security & Integration (Guides 13-15)

## Guide 13: Testing Setup & Implementation

**Time**: 8-10 hours | **Complexity**: Medium

### Phase 1: Test Utilities (2 hours)

Create `tests/utils/mocks.ts`:

```typescript
import { vi } from 'vitest';
import { parseEther } from 'ethers';

export function createMockProvider() {
  return {
    getBalance: vi.fn().mockResolvedValue(parseEther('10')),
    getBlockNumber: vi.fn().mockResolvedValue(1000000),
    getTransactionCount: vi.fn().mockResolvedValue(5),
    getGasPrice: vi.fn().mockResolvedValue(parseUnits('50', 'gwei')),
    sendTransaction: vi.fn().mockResolvedValue({
      hash: '0x' + '1'.repeat(64),
      wait: vi.fn().mockResolvedValue({ status: 1, blockNumber: 1000001 }),
    }),
    getTransaction: vi.fn().mockResolvedValue({
      hash: '0x' + '1'.repeat(64),
      from: '0x123',
      to: '0x456',
      value: parseEther('1'),
    }),
  };
}

export function createMockMCPClient() {
  return {
    callTool: vi.fn().mockResolvedValue({ success: true }),
    readResource: vi.fn().mockResolvedValue({ data: {} }),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
  };
}

export function createMockAgent() {
  return {
    plan: vi.fn().mockResolvedValue({ steps: [] }),
    execute: vi.fn().mockResolvedValue({ success: true }),
    validate: vi.fn().mockResolvedValue({ valid: true }),
  };
}
```

Create `tests/utils/fixtures.ts`:

```typescript
export const TEST_ACCOUNTS = {
  alice: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey:
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  bob: {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey:
      '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
};

export const TEST_CONTRACTS = {
  erc20: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    abi: [...], // ERC20 ABI
  },
};
```

---

### Phase 2: Integration Test Setup (3 hours)

Create `tests/integration/setup.ts`:

```typescript
import { execSync } from 'child_process';

export class TestEnvironment {
  private hardhatProcess: ChildProcess | null = null;

  async setup() {
    // Start Hardhat node
    this.hardhatProcess = exec('npx hardhat node');
    await this.waitForNode();

    // Deploy test contracts
    await this.deployTestContracts();

    // Fund test accounts
    await this.fundTestAccounts();
  }

  async teardown() {
    if (this.hardhatProcess) {
      this.hardhatProcess.kill();
    }
  }

  private async waitForNode() {
    // Wait for Hardhat node to be ready
    for (let i = 0; i < 30; i++) {
      try {
        await fetch('http://127.0.0.1:8545');
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Hardhat node failed to start');
  }

  private async deployTestContracts() {
    execSync('npx hardhat run scripts/deploy-test.ts --network localhost');
  }

  private async fundTestAccounts() {
    for (const account of Object.values(TEST_ACCOUNTS)) {
      // Send test ETH
      await provider.sendTransaction({
        to: account.address,
        value: parseEther('100'),
      });
    }
  }
}
```

---

### Phase 3: E2E Tests (3-4 hours)

Create `tests/e2e/swap-workflow.test.ts`:

```typescript
describe('E2E: Complete Swap Workflow', () => {
  it('should execute full swap from user command to confirmation', async () => {
    const orchestrator = new OrchestratorAgent(config);

    // Register agents
    orchestrator.registerAgent('analytics', new AnalyticsAgent(config));
    orchestrator.registerAgent('defi', new DeFiAgent(config));
    orchestrator.registerAgent('security', new SecurityAgent(config));

    // Execute task
    const result = await orchestrator.executeTask({
      type: 'defi_swap',
      params: {
        from: 'ETH',
        to: 'USDC',
        amount: '0.1',
        network: 'sepolia',
      },
    });

    // Verify result
    expect(result.success).toBe(true);
    expect(result.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(result.steps).toHaveLength(4);
    expect(result.steps[0]).toMatchObject({
      agent: 'analytics',
      action: 'get_price',
      status: 'completed',
    });

    // Verify transaction on chain
    const tx = await provider.getTransaction(result.transactionHash);
    expect(tx).toBeDefined();
    expect(tx.from).toBe(TEST_ACCOUNTS.alice.address);
  }, 120000);
});
```

---

## Guide 14: Security Hardening

**Time**: 15-20 hours | **Complexity**: Very High

### Phase 1: Input Validation (3 hours)

**Every input must be validated**:

```typescript
// src/utils/validation.ts
import { z } from 'zod';

// Address validation with checksum
export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .refine((addr) => ethers.getAddress(addr) === addr, {
    message: 'Invalid address checksum',
  });

// Amount validation (no negative, no overflow)
export const AmountSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((val) => {
    const amount = BigInt(val);
    if (amount < 0n) throw new Error('Amount cannot be negative');
    if (amount > BigInt(2) ** BigInt(256) - 1n) throw new Error('Amount overflow');
    return amount;
  });

// SQL injection prevention
export const SafeStringSchema = z
  .string()
  .max(1000)
  .refine((str) => !/(union|select|drop|insert|update|delete)/i.test(str), {
    message: 'Invalid characters detected',
  });

// XSS prevention
export const SanitizedStringSchema = z.string().transform((str) =>
  str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
);
```

---

### Phase 2: Private Key Security (4 hours)

**Critical security measures**:

```typescript
// 1. Encryption
export const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  saltLength: 16,
  ivLength: 16,
  iterations: 100000, // PBKDF2 iterations
};

// 2. Memory wiping
export function wipeFromMemory(data: string | Buffer) {
  if (typeof data === 'string') {
    data = '0'.repeat(data.length);
  } else {
    data.fill(0);
  }
}

// 3. Secure logging
export const REDACT_PATTERNS = [
  /0x[a-fA-F0-9]{64}/, // Private keys
  /[a-zA-Z0-9]{88}/, // Base58 private keys
  /password['":\s]+[^'"\s]+/gi, // Passwords
];

export function sanitizeLog(message: string): string {
  let sanitized = message;
  for (const pattern of REDACT_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

// 4. Never expose in errors
class SafeError extends Error {
  constructor(message: string, public code: string, private sensitive?: any) {
    super(sanitizeLog(message));
  }

  toJSON() {
    return {
      message: this.message,
      code: this.code,
      // NEVER include sensitive data
    };
  }
}
```

---

### Phase 3: Transaction Security (3 hours)

```typescript
// Transaction simulation before execution
export async function simulateTransaction(tx: Transaction): Promise<SimulationResult> {
  try {
    // Use Tenderly simulation
    const response = await fetch('https://api.tenderly.co/api/v1/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': TENDERLY_API_KEY,
      },
      body: JSON.stringify({
        network_id: '1',
        from: tx.from,
        to: tx.to,
        input: tx.data,
        value: tx.value.toString(),
        save: false,
      }),
    });

    const result = await response.json();

    return {
      success: !result.transaction.error_message,
      gasUsed: result.transaction.gas_used,
      error: result.transaction.error_message,
      trace: result.transaction.transaction_info.call_trace,
    };
  } catch (error) {
    logger.error('Simulation failed', { error });
    throw new Error('Unable to simulate transaction');
  }
}

// Value limits
export const TRANSACTION_LIMITS = {
  maxValueUSD: 10000, // $10k
  maxGasPrice: parseUnits('500', 'gwei'),
  maxGasLimit: 10_000_000,
};

export function validateTransactionLimits(tx: Transaction, priceUSD: number) {
  const valueUSD = (Number(tx.value) / 1e18) * priceUSD;

  if (valueUSD > TRANSACTION_LIMITS.maxValueUSD) {
    throw new Error(`Transaction value exceeds limit: $${valueUSD}`);
  }

  if (tx.gasPrice && tx.gasPrice > TRANSACTION_LIMITS.maxGasPrice) {
    throw new Error(`Gas price too high: ${tx.gasPrice}`);
  }

  if (tx.gasLimit > TRANSACTION_LIMITS.maxGasLimit) {
    throw new Error(`Gas limit too high: ${tx.gasLimit}`);
  }
}
```

---

### Phase 4: Security Checklist (1 hour)

```markdown
## Security Checklist

### Input Validation
- [ ] All addresses validated with checksum
- [ ] All amounts validated (no negative, no overflow)
- [ ] All strings sanitized (SQL injection, XSS)
- [ ] All user inputs validated with Zod schemas

### Private Key Security
- [ ] Keys encrypted with AES-256-GCM
- [ ] Keys wiped from memory after use
- [ ] No keys in logs
- [ ] No keys in error messages
- [ ] Password never stored
- [ ] PBKDF2 with 100k+ iterations

### Transaction Security
- [ ] Transactions simulated before execution
- [ ] Value limits enforced
- [ ] Gas price limits enforced
- [ ] User confirmation for high-value transactions
- [ ] Slippage protection for swaps

### Code Security
- [ ] Slither analysis passed
- [ ] Mythril analysis passed
- [ ] No hardcoded secrets
- [ ] No console.log in production
- [ ] Rate limiting enabled
- [ ] HTTPS only

### Monitoring
- [ ] Sentry configured
- [ ] Prometheus metrics
- [ ] Alert rules configured
- [ ] Incident response plan documented
```

---

## Guide 15: Integration & Validation

**Time**: 10-12 hours | **Complexity**: Medium

### Phase 1: Component Integration Tests (3 hours)

```typescript
describe('Integration: MCP Servers ↔ Agents', () => {
  it('should query balance through agent', async () => {
    const agent = new BlockchainAgent({
      mcpClient: ethereumMCP,
    });

    const result = await agent.execute({
      action: 'query_balance',
      params: { address: TEST_ACCOUNTS.alice.address },
    });

    expect(result.success).toBe(true);
    expect(result.data.balance).toBeDefined();
  });
});

describe('Integration: Agents ↔ Subagents', () => {
  it('should delegate to wallet manager', async () => {
    const agent = new BlockchainAgent(config);
    agent.registerSubagent('wallet', walletManager);

    const result = await agent.delegate(
      { action: 'sign', params: { data: '0xdata' } },
      'wallet'
    );

    expect(result.signature).toBeDefined();
  });
});
```

---

### Phase 2: End-to-End Workflows (4 hours)

**Test complete user journeys**:

```typescript
describe('E2E: Complete User Workflows', () => {
  it('should execute complete DeFi swap workflow', async () => {
    // 1. User initiates swap
    const task = {
      type: 'defi_swap',
      params: { from: 'ETH', to: 'USDC', amount: '0.1' },
    };

    // 2. Orchestrator plans
    const plan = await orchestrator.plan(task);
    expect(plan.steps).toHaveLength(4);

    // 3. Execute plan
    const result = await orchestrator.execute(plan);

    // 4. Verify each step executed
    expect(result.steps[0]).toMatchObject({
      agent: 'analytics',
      action: 'get_price',
      status: 'completed',
    });

    // 5. Verify transaction on chain
    const tx = await provider.getTransaction(result.transactionHash);
    expect(tx.status).toBe(1);

    // 6. Verify balances updated
    const balance = await mcpClient.callTool({
      name: 'query_balance',
      arguments: { address: TEST_ACCOUNTS.alice.address, token: USDC_ADDRESS },
    });
    expect(balance).toBeGreaterThan(0);
  });
});
```

---

### Phase 3: Performance Validation (2 hours)

```typescript
describe('Performance Benchmarks', () => {
  it('should query balance in < 500ms', async () => {
    const start = Date.now();

    await mcpClient.callTool({
      name: 'query_balance',
      arguments: { address: TEST_ACCOUNTS.alice.address },
    });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  it('should handle 100 concurrent requests', async () => {
    const requests = Array(100)
      .fill(null)
      .map(() =>
        mcpClient.callTool({
          name: 'query_balance',
          arguments: { address: TEST_ACCOUNTS.alice.address },
        })
      );

    const results = await Promise.all(requests);
    expect(results).toHaveLength(100);
    expect(results.every((r) => r.success)).toBe(true);
  }, 30000);
});
```

---

### Phase 4: Final Validation Checklist (1 hour)

```markdown
## Final Validation Checklist

### MCP Servers
- [ ] Ethereum MCP server starts and responds
- [ ] Solana MCP server starts and responds
- [ ] Multi-chain MCP server aggregates correctly
- [ ] All tools execute successfully
- [ ] All resources accessible

### Agents
- [ ] Base agent class functional
- [ ] Orchestrator coordinates agents correctly
- [ ] All 5 specialized agents working
- [ ] Agent communication functional

### Subagents
- [ ] Wallet manager signs transactions
- [ ] Transaction builder creates valid TXs
- [ ] Gas optimizer returns prices
- [ ] Contract analyzer detects vulnerabilities

### Skills & Commands
- [ ] All 6 skills activate in Claude Code
- [ ] All 6 slash commands execute
- [ ] Skills integrate with agents

### Quality Metrics
- [ ] 80%+ code coverage
- [ ] 0 critical security issues
- [ ] All performance benchmarks met
- [ ] Documentation complete

### Production Readiness
- [ ] Environment variables configured
- [ ] Logging configured
- [ ] Monitoring configured
- [ ] Error handling comprehensive
- [ ] Rate limiting enabled
- [ ] Security checklist complete

**Status**: ✅ Ready for v1.0.0 Release
```

---

**Document Version**: 1.0.0
**Status**: Production Ready
**All Guides Complete**: 02-15