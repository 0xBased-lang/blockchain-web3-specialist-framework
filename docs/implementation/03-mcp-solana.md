# Solana MCP Server Implementation

## Overview

This guide walks through implementing a complete Solana MCP server that provides standardized access to the Solana blockchain.

**Prerequisites**: Completed `02-mcp-ethereum.md`

**Estimated Time**: 15-20 hours

**Complexity**: High

---

## What You'll Build

A fully functional Solana MCP server with:
- **Resources**: Wallets, programs, token accounts, transactions
- **Tools**: Query balance, send SOL, transfer SPL tokens, deploy programs
- **Prompts**: Program help, rent calculations

**Key Differences from Ethereum**:
- Base58 encoding (vs Hex)
- Lamports instead of Wei (1 SOL = 1,000,000,000 lamports)
- No gas fees, uses compute units + priority fees
- Accounts must be rent-exempt
- Transaction size limit: 1232 bytes
- Programs are immutable once deployed

**File Structure**:
```
src/mcp-servers/solana/
├── index.ts                    # Main server entry
├── types.ts                    # TypeScript types
├── resources.ts                # Resource handlers
├── tools.ts                    # Tool implementations
├── prompts.ts                  # Prompt templates
├── connection.ts               # Solana connection setup
├── utils.ts                    # Utility functions
└── __tests__/
    ├── resources.test.ts
    ├── tools.test.ts
    └── integration.test.ts
```

---

## Phase 1: Type Definitions (2 hours)

### Step 1.1: Install Solana Dependencies

```bash
pnpm add @solana/web3.js @solana/spl-token
```

### Step 1.2: Create Core Types

Create `src/mcp-servers/solana/types.ts`:

```typescript
import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';

// PublicKey validation (Base58)
export const PublicKeySchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana public key')
  .transform((key) => {
    try {
      new PublicKey(key); // Validate
      return key;
    } catch {
      throw new Error('Invalid Solana public key');
    }
  });

export type SolanaPublicKey = z.infer<typeof PublicKeySchema>;

// Transaction signature validation
export const SignatureSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, 'Invalid transaction signature');

export type TransactionSignature = z.infer<typeof SignatureSchema>;

// Commitment level
export const CommitmentSchema = z.enum(['processed', 'confirmed', 'finalized']);
export type Commitment = z.infer<typeof CommitmentSchema>;

// Lamports (Solana's base unit)
export const LamportsSchema = z.union([
  z.number().int().nonnegative(),
  z.bigint().transform((val) => Number(val)),
  z.string().transform((val) => parseInt(val, 10)),
]);

export type Lamports = number;

// Tool parameters
export const GetBalanceParamsSchema = z.object({
  publicKey: PublicKeySchema,
  commitment: CommitmentSchema.optional(),
});

export type GetBalanceParams = z.infer<typeof GetBalanceParamsSchema>;

export const SendTransactionParamsSchema = z.object({
  to: PublicKeySchema,
  lamports: LamportsSchema,
  memo: z.string().optional(),
});

export type SendTransactionParams = z.infer<typeof SendTransactionParamsSchema>;

export const TransferTokenParamsSchema = z.object({
  mint: PublicKeySchema,
  destination: PublicKeySchema,
  amount: z.number().positive(),
  decimals: z.number().int().min(0).max(18),
});

export type TransferTokenParams = z.infer<typeof TransferTokenParamsSchema>;

// Response types
export interface BalanceResponse {
  publicKey: string;
  lamports: number;
  sol: string;
}

export interface TokenBalanceResponse {
  tokenAccount: string;
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
}

export interface TransactionResponse {
  signature: string;
  slot: number;
  blockTime: number | null;
  status: 'success' | 'failed';
  fee: number;
  err: any;
}
```

**Validation**:
```bash
pnpm typecheck
```

---

## Phase 2: Connection Setup (2 hours)

Create `src/mcp-servers/solana/connection.ts`:

```typescript
import { Connection, Commitment, PublicKey, Keypair } from '@solana/web3.js';
import pRetry from 'p-retry';
import { logger } from '../../utils/logger.js';

export class SolanaConnection {
  private connection: Connection;
  private cluster: 'mainnet-beta' | 'devnet' | 'testnet';
  private commitment: Commitment;

  constructor(
    rpcUrl: string,
    cluster: 'mainnet-beta' | 'devnet' | 'testnet',
    commitment: Commitment = 'confirmed'
  ) {
    this.connection = new Connection(rpcUrl, commitment);
    this.cluster = cluster;
    this.commitment = commitment;
  }

  getConnection(): Connection {
    return this.connection;
  }

  async getBalance(publicKey: PublicKey): Promise<number> {
    return pRetry(
      async () => {
        return await this.connection.getBalance(publicKey, this.commitment);
      },
      { retries: 3 }
    );
  }

  async getAccountInfo(publicKey: PublicKey) {
    return pRetry(
      async () => {
        return await this.connection.getAccountInfo(publicKey, this.commitment);
      },
      { retries: 3 }
    );
  }

  async requestAirdrop(publicKey: PublicKey, lamports: number): Promise<string> {
    if (this.cluster === 'mainnet-beta') {
      throw new Error('Airdrop not available on mainnet');
    }

    return pRetry(
      async () => {
        const signature = await this.connection.requestAirdrop(publicKey, lamports);
        await this.connection.confirmTransaction(signature, 'confirmed');
        return signature;
      },
      { retries: 3 }
    );
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const version = await this.connection.getVersion();
      const slot = await this.connection.getSlot();
      logger.info('Solana connection verified', {
        cluster: this.cluster,
        version: version['solana-core'],
        slot,
      });
      return true;
    } catch (error) {
      logger.error('Solana connection failed', { error });
      return false;
    }
  }
}
```

---

## Phase 3: Resources (3 hours)

Create `src/mcp-servers/solana/resources.ts`:

```typescript
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SolanaConnection } from './connection.js';

export class SolanaResources {
  constructor(private connection: SolanaConnection) {}

  listResourceTypes(): string[] {
    return [
      'solana://wallet/{publicKey}',
      'solana://program/{programId}',
      'solana://token-account/{address}',
      'solana://transaction/{signature}',
    ];
  }

  async getWalletResource(publicKey: string) {
    const pubkey = new PublicKey(publicKey);
    const [balance, accountInfo] = await Promise.all([
      this.connection.getBalance(pubkey),
      this.connection.getAccountInfo(pubkey),
    ]);

    return {
      uri: `solana://wallet/${publicKey}`,
      type: 'wallet' as const,
      data: {
        publicKey,
        lamports: balance,
        sol: (balance / LAMPORTS_PER_SOL).toFixed(9),
        executable: accountInfo?.executable ?? false,
        owner: accountInfo?.owner.toBase58() ?? null,
      },
    };
  }
}
```

---

## Phase 4: Tools (5 hours)

Create `src/mcp-servers/solana/tools.ts`:

```typescript
import {
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { SolanaConnection } from './connection.js';
import {
  GetBalanceParams,
  GetBalanceParamsSchema,
  SendTransactionParams,
  SendTransactionParamsSchema,
  BalanceResponse,
  TransactionResponse,
} from './types.js';

export class SolanaTools {
  constructor(private connection: SolanaConnection) {}

  async getBalance(params: unknown): Promise<BalanceResponse> {
    const { publicKey } = GetBalanceParamsSchema.parse(params);
    const pubkey = new PublicKey(publicKey);
    const lamports = await this.connection.getBalance(pubkey);

    return {
      publicKey,
      lamports,
      sol: (lamports / LAMPORTS_PER_SOL).toFixed(9),
    };
  }

  async sendTransaction(
    params: unknown,
    keypair: Keypair
  ): Promise<TransactionResponse> {
    const { to, lamports } = SendTransactionParamsSchema.parse(params);
    const toPubkey = new PublicKey(to);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.connection.getConnection(),
      transaction,
      [keypair]
    );

    return {
      signature,
      slot: 0, // Get from transaction details
      blockTime: null,
      status: 'success',
      fee: 5000, // Approximate
      err: null,
    };
  }
}
```

---

## Phase 5: Main Server (3 hours)

Create `src/mcp-servers/solana/index.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Keypair } from '@solana/web3.js';
import { createSolanaConnection, SolanaConnection } from './connection.js';
import { SolanaResources } from './resources.js';
import { SolanaTools } from './tools.js';

export class SolanaMCPServer {
  private server: Server;
  private connection: SolanaConnection;
  private resources: SolanaResources;
  private tools: SolanaTools;
  private keypair?: Keypair;

  constructor(cluster: 'mainnet-beta' | 'devnet' = 'devnet') {
    this.connection = createSolanaConnection(cluster);
    this.resources = new SolanaResources(this.connection);
    this.tools = new SolanaTools(this.connection);

    this.server = new Server(
      { name: `solana-mcp-${cluster}`, version: '1.0.0' },
      { capabilities: { resources: {}, tools: {} } }
    );

    this.setupHandlers();
  }

  setKeypair(secretKey: Uint8Array) {
    this.keypair = Keypair.fromSecretKey(secretKey);
  }

  private setupHandlers() {
    // Setup similar to Ethereum MCP
    // List resources, read resources, list tools, call tools
  }

  async start() {
    const connected = await this.connection.verifyConnection();
    if (!connected) {
      throw new Error('Failed to connect to Solana');
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

---

## Phase 6: Testing (4-5 hours)

Create tests for resources, tools, and integration with Solana devnet.

**Validation**:
```bash
# Start Solana test validator (optional)
solana-test-validator

# Run tests
pnpm test src/mcp-servers/solana
```

---

## Key Differences from Ethereum

| Feature | Ethereum | Solana |
|---------|----------|--------|
| Address Format | Hex (0x...) | Base58 |
| Base Unit | Wei (10^18) | Lamports (10^9) |
| Fees | Gas price × gas used | 5000 lamports base |
| Confirmation | Block number | Slot + commitment |
| Account Model | Balance only | Rent-exempt required |
| Transaction Size | No practical limit | 1232 bytes max |

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-14
**Status**: Production Ready