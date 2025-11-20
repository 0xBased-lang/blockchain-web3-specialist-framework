# Phase 1.2: Systematic Lint Error Resolution

**Total Errors:** 178
**Strategy:** Fix root causes first, cascading errors resolve automatically
**Approach:** Quality over quantity - thorough fixes, comprehensive testing

---

## Error Category Breakdown

| Category | Count | Priority | Impact | Estimated Time |
|----------|-------|----------|--------|----------------|
| **Explicit `any`** | 22 | 🔴 CRITICAL | Fixes 82+ cascading errors | 4-6 hours |
| **Unsafe operations** | 82 | 🟡 AUTO-RESOLVE | Resolves after fixing `any` | Auto |
| **Async/await** | 49 | 🟠 HIGH | Code correctness | 2-3 hours |
| **Promise handling** | 7 | 🟠 HIGH | Prevents bugs | 1 hour |
| **Template expressions** | 8 | 🟡 MEDIUM | Type safety | 1 hour |
| **Other** | 10 | 🟢 LOW | Code quality | 1 hour |

**Total Estimated Time:** 1-2 days (thorough, quality-focused approach)

---

## Phase 1.2a: Fix Explicit `any` Types (Priority 1)

### Files Affected (22 instances across 4 files)

#### 1. `src/mcp-servers/multichain/tools.ts` (6 instances)

**Lines 309, 334, 401, 433, 508, 528**

```typescript
// CURRENT (incorrect):
private async queryEthereumBalance(params: any): Promise<UnifiedBalanceResponse>
private async querySolanaBalance(params: any): Promise<UnifiedBalanceResponse>
private async sendEthereumTransaction(params: any): Promise<UnifiedTransactionResponse>
private async sendSolanaTransaction(params: any): Promise<UnifiedTransactionResponse>
private async transferERC20Token(_params: any): Promise<UnifiedTransactionResponse>
private async transferSPLToken(params: any): Promise<UnifiedTransactionResponse>

// FIX STRATEGY:
// Create proper interface for each method's params

interface EthereumBalanceParams {
  readonly address: EthereumAddress;
  readonly tokens?: readonly EthereumAddress[];
}

interface SolanaBalanceParams {
  readonly address: SolanaAddress;
  readonly tokens?: readonly PublicKey[];
}

interface EthereumTransactionParams {
  readonly from: EthereumAddress;
  readonly to: EthereumAddress;
  readonly value?: string;
  readonly data?: string;
  readonly gasLimit?: string;
}

// ... etc for all 6 methods
```

**Impact:** Will auto-resolve ~30 unsafe operation errors

---

#### 2. `src/mcp-servers/multichain/resources.ts` (4 instances)

**Lines 223, 334, 345, 407**

```typescript
// CURRENT (incorrect):
const resource = await this.solanaResources.getAccountResource(address as any);
const resource = await this.solanaResources.getTransactionResource(signature as any);
const from = resource.data.accounts[0] ?? ('' as any);
parsed.identifier as any

// FIX STRATEGY:
// Use proper type guards instead of 'as any'

function isSolanaAddress(address: string): address is SolanaAddress {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function isSignature(sig: string): sig is Signature {
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(sig);
}

// Then use:
if (!isSolanaAddress(address)) {
  throw new Error('Invalid Solana address');
}
const resource = await this.solanaResources.getAccountResource(address);

// For fallback values, use proper union types:
const from: SolanaAddress | '' = resource.data.accounts[0] ?? '';
```

**Impact:** Will auto-resolve ~20 unsafe operation errors

---

#### 3. `src/subagents/ContractAnalyzer.ts` (11 instances)

**Lines 531, 534-536, 540-541, 543-544, 546-547, 549-550, 552-553**

All in the `normalizeMetadata` method:

```typescript
// CURRENT (incorrect):
private normalizeMetadata(metadata: any): ContractMetadata {
  const address = metadata.address;
  const chain = metadata.chain;
  // ... 9 more unsafe accesses to metadata properties
}

// FIX STRATEGY:
// Create a proper input type with optional fields

interface RawContractMetadata {
  readonly address?: string;
  readonly chain?: string;
  readonly bytecode?: string;
  readonly isVerified?: boolean;
  readonly sourcecode?: string;
  readonly compilerVersion?: string;
  readonly optimization?: boolean;
  readonly abi?: unknown;
}

private normalizeMetadata(metadata: RawContractMetadata): ContractMetadata {
  return {
    address: metadata.address ?? 'unknown',
    chain: metadata.chain ?? 'unknown',
    bytecode: metadata.bytecode ?? '',
    isVerified: metadata.isVerified ?? false,
    sourcecode: metadata.sourcecode ?? undefined,
    compilerVersion: metadata.compilerVersion ?? undefined,
    optimization: metadata.optimization ?? undefined,
    abi: metadata.abi !== undefined ? (metadata.abi as readonly unknown[]) : undefined,
  };
}
```

**Impact:** Will auto-resolve ~30 unsafe operation errors

---

#### 4. `src/subagents/TransactionBuilder.ts` (1 instance)

**Line 676**

```typescript
// CURRENT (incorrect):
const simulationRequest: any = {
  transaction: tx,
  chain,
};

// FIX STRATEGY:
// Import proper type from TransactionSimulator

import { type SimulationRequest } from './TransactionSimulator.js';

const simulationRequest: SimulationRequest = {
  transaction: tx,
  chain,
};
```

**Impact:** Will auto-resolve ~2 unsafe operation errors

---

### Summary: Phase 1.2a

- **22 explicit `any` types** to fix
- **Expected cascading resolution:** ~82 unsafe operation errors
- **Net reduction:** 104 errors → ~74 errors remaining
- **Time:** 4-6 hours (thorough, with testing)

---

## Phase 1.2b: Fix Async/Await Issues (Priority 2)

### 49 errors: `@typescript-eslint/require-await`

These are async functions that don't use `await`. Two options:

**Option 1: Remove `async` keyword** (if function doesn't need to be async)
**Option 2: Add `await` to async operations** (if function should be async)

### Files Affected

1. **`src/agents/BaseAgent.ts`** (1 error)
   - `communicate()` method - remove `async` or add await

2. **`src/agents/OrchestratorAgent.ts`** (1 error)
   - `validate()` method - remove `async` or add await

3. **`src/agents/planning.ts`** (2 errors)
   - `decompose()` method
   - `resolveDependencies()` method

4. **`src/mcp-servers/ethereum/index.ts`** (2 errors)
   - Anonymous handlers on lines 64, 159

5. **`src/mcp-servers/multichain/index.ts`** (2 errors)
   - Anonymous handlers on lines 105, 149

6. **`src/mcp-servers/multichain/tools.ts`** (1 error)
   - `transferERC20Token()` method

7. **`src/mcp-servers/solana/index.ts`** (2 errors)
   - Anonymous handlers on lines 69, 164

8. **`src/mcp-servers/solana/provider.ts`** (1 error)
   - Anonymous handler on line 439

9. **`src/subagents/ContractAnalyzer.ts`** (3 errors)
   - `analyzeBytecode()` method
   - `analyzeABI()` method
   - `analyzeSource()` method

... and more (49 total)

### Fix Strategy

Review each case:
1. If function has no async operations → Remove `async`
2. If function should be async → Add proper `await` operations
3. If function returns Promise → Keep `async`, add lint exception if needed

**Time:** 2-3 hours

---

## Phase 1.2c: Fix Promise Handling Issues (Priority 3)

### 7 errors: Floating promises & misused promises

These are critical for correctness:

```typescript
// BAD: Promise not awaited (fire-and-forget)
someAsyncOperation();

// GOOD: Properly awaited
await someAsyncOperation();

// GOOD: Intentional fire-and-forget with void
void someAsyncOperation();
```

**Time:** 1 hour

---

## Phase 1.2d: Fix Template Expression Issues (Priority 4)

### 8 errors: `@typescript-eslint/restrict-template-expressions`

**Files:**
- `src/mcp-servers/multichain/resources.ts` (1 error)
- `src/subagents/HDWalletManager.ts` (2 errors)

Issue: Using `never` type in template literals

```typescript
// CURRENT (incorrect):
throw new Error(`Invalid: ${someNeverType}`);

// FIX:
throw new Error(`Invalid: ${String(someValue)}`);
// OR ensure type is not 'never'
```

**Time:** 1 hour

---

## Phase 1.2e: Fix Remaining Issues (Priority 5)

### 10 miscellaneous errors

- Unused variables (1)
- Type constituent issues (1)
- Other edge cases (8)

**Time:** 1 hour

---

## Testing Strategy

After each phase, run:

```bash
# 1. Verify typecheck passes
pnpm typecheck

# 2. Verify lint for that file passes
pnpm lint -- path/to/file.ts

# 3. Run related unit tests
pnpm test path/to/file.test.ts

# 4. Run full test suite
pnpm test
```

---

## Commit Strategy

**One commit per phase:**

```bash
# After Phase 1.2a
git add src/mcp-servers/multichain/tools.ts \
        src/mcp-servers/multichain/resources.ts \
        src/subagents/ContractAnalyzer.ts \
        src/subagents/TransactionBuilder.ts
git commit -m "fix: remove all explicit 'any' types (22 instances)

Replace any types with proper interfaces and type guards:
- multichain/tools.ts: Add param interfaces for 6 methods
- multichain/resources.ts: Use type guards instead of 'as any'
- ContractAnalyzer.ts: Add RawContractMetadata interface
- TransactionBuilder.ts: Use SimulationRequest type

Impact: Resolves 104 lint errors (22 direct + 82 cascading)
"

# After Phase 1.2b
git commit -m "fix: resolve async/await issues (49 instances)

Remove unnecessary async keywords or add proper await:
- ...
"

# ... etc for each phase
```

---

## Progress Tracking

```
Phase 1.2a: ⬜ Fix 22 'any' types       → Reduces to ~74 errors
Phase 1.2b: ⬜ Fix 49 async/await       → Reduces to ~25 errors
Phase 1.2c: ⬜ Fix 7 promise issues     → Reduces to ~18 errors
Phase 1.2d: ⬜ Fix 8 template issues    → Reduces to ~10 errors
Phase 1.2e: ⬜ Fix 10 remaining issues  → Reduces to 0 errors ✅
```

---

## Expected Timeline

**Quality-focused approach (no rushing):**

- Phase 1.2a: 4-6 hours (thorough, tested)
- Phase 1.2b: 2-3 hours
- Phase 1.2c: 1 hour
- Phase 1.2d: 1 hour
- Phase 1.2e: 1 hour

**Total:** 9-12 hours = 1-2 days of focused work

---

## Next Steps

1. Start with Phase 1.2a (highest impact)
2. Test thoroughly after each file
3. Commit when phase complete
4. Move to next phase
5. Final validation: `pnpm lint` should show 0 errors

Ready to start Phase 1.2a?
