# Guide 18: Backend/Frontend Integration Patterns

**Prerequisites**: Guide 02-04 (MCP servers), Guide 05-06 (Agents), TypeScript knowledge

**Time Estimate**: 6-8 hours (first setup), 1-2 hours (subsequent projects)

**Prevents**: 40+ parameter mismatch commits, database schema drift, environment variable issues

---

## Table of Contents

- [Part 1: API Contract Strategy](#part-1-api-contract-strategy)
  - [1.1 Shared TypeScript Types](#11-shared-typescript-types)
  - [1.2 API Schema Validation (Zod)](#12-api-schema-validation-zod)
  - [1.3 Contract Testing](#13-contract-testing)
  - [1.4 Breaking Change Prevention](#14-breaking-change-prevention)
- [Part 2: Database Integration](#part-2-database-integration)
  - [2.1 Schema Synchronization](#21-schema-synchronization)
  - [2.2 Migration Strategies](#22-migration-strategies)
  - [2.3 Type Generation](#23-type-generation)
  - [2.4 Schema Validation](#24-schema-validation)
- [Part 3: Environment Management](#part-3-environment-management)
  - [3.1 Environment Variable Architecture](#31-environment-variable-architecture)
  - [3.2 Validation Scripts](#32-validation-scripts)
  - [3.3 Build-Time vs Runtime](#33-build-time-vs-runtime)
  - [3.4 Secret Management](#34-secret-management)
- [Part 4: Real-World Patterns](#part-4-real-world-patterns)
  - [4.1 Lazy Initialization (Prisma)](#41-lazy-initialization-prisma)
  - [4.2 API Client Generation](#42-api-client-generation)
  - [4.3 Error Propagation](#43-error-propagation)
  - [4.4 Integration Testing](#44-integration-testing)
- [Part 5: Common Issues & Solutions](#part-5-common-issues--solutions)

---

## Overview

This guide is based on forensic analysis of kektechV0.69 and zmartV0.69, which revealed:

**Critical Discovery**: kektechV0.69 had **40+ commits fixing parameter mismatches** between frontend and backend (e.g., `address` vs `walletAddress`, `userId` vs `id`).

**Top Integration Issues**:
1. ⏱️ Parameter name mismatches (40+ commits in kektechV0.69)
2. ⏱️ Database schema drift (zmartV0.69 INCIDENT-001)
3. ⏱️ Environment variable issues (15 incidents combined)
4. ⏱️ Build-time vs runtime confusion (multiple Prisma-related commits)
5. ⏱️ Type errors after API changes (cascading failures)

**This guide helps you prevent all of these.**

---

## Part 1: API Contract Strategy

### Problem Statement

**Real-World Example** (kektechV0.69):

```typescript
// Backend API (commit 1)
export async function voteOnProposal(userId: string, proposalId: string) {
  // ...
}

// Frontend (calls this API)
await fetch('/api/proposals/vote', {
  body: JSON.stringify({ id: userId, proposalId }), // ✅ Works
});

// Later: Backend renamed parameter (commit 50)
export async function voteOnProposal(walletAddress: string, proposalId: string) {
  // Changed userId → walletAddress
}

// Frontend NOT updated
await fetch('/api/proposals/vote', {
  body: JSON.stringify({ id: userId, proposalId }), // ❌ Broken! "id" not recognized
});

// Result: Silent failure, data not saved, no error thrown
```

**Cost**: 40+ commits fixing these mismatches across kektechV0.69

**Solution**: Shared TypeScript types + Zod validation

---

### 1.1 Shared TypeScript Types

#### 1.1.1 Project Structure for Monorepo

**Recommended Structure**:

```
my-project/
├── packages/
│   ├── shared/              # Shared types and schemas
│   │   ├── src/
│   │   │   ├── types/       # TypeScript types
│   │   │   │   ├── api.ts
│   │   │   │   ├── models.ts
│   │   │   │   └── index.ts
│   │   │   └── schemas/     # Zod schemas
│   │   │       ├── api.ts
│   │   │       ├── models.ts
│   │   │       └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── frontend/            # Next.js app
│   │   └── package.json     # Depends on @my-project/shared
│   └── backend/             # Express/Fastify API
│       └── package.json     # Depends on @my-project/shared
├── pnpm-workspace.yaml
└── package.json
```

#### 1.1.2 Create Shared Package

**packages/shared/package.json**:

```json
{
  "name": "@my-project/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js",
    "./schemas": "./dist/schemas/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

**packages/shared/tsconfig.json**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 1.1.3 Define Shared Types

**packages/shared/src/types/models.ts**:

```typescript
// Core domain models (used by both frontend and backend)

export interface User {
  id: string;
  walletAddress: string; // ✅ Single source of truth for field name
  username: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Market {
  id: string;
  title: string;
  description: string;
  creatorAddress: string; // ✅ Consistent naming
  outcomeCount: number;
  totalVolume: string; // BigInt as string
  resolutionTime: Date;
  status: MarketStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum MarketStatus {
  PROPOSED = 'PROPOSED',
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  DISPUTED = 'DISPUTED',
}

export interface Trade {
  id: string;
  marketId: string;
  userAddress: string; // ✅ Consistent naming
  outcomeIndex: number;
  shares: string; // BigInt as string
  cost: string; // BigInt as string
  tradeType: 'BUY' | 'SELL';
  timestamp: Date;
}
```

**packages/shared/src/types/api.ts**:

```typescript
// API request/response types

import { Market, MarketStatus, User, Trade } from './models';

//=============================================================================
// Market API
//=============================================================================

export interface CreateMarketRequest {
  title: string;
  description: string;
  outcomeCount: number;
  resolutionTime: Date;
  creatorAddress: string; // ✅ Must match Market.creatorAddress
}

export interface CreateMarketResponse {
  market: Market;
  transactionHash: string;
}

export interface GetMarketsRequest {
  status?: MarketStatus;
  creatorAddress?: string;
  limit?: number;
  offset?: number;
}

export interface GetMarketsResponse {
  markets: Market[];
  total: number;
  hasMore: boolean;
}

//=============================================================================
// Trade API
//=============================================================================

export interface CreateTradeRequest {
  marketId: string;
  outcomeIndex: number;
  shares: string; // BigInt as string
  userAddress: string; // ✅ Must match Trade.userAddress
  tradeType: 'BUY' | 'SELL';
}

export interface CreateTradeResponse {
  trade: Trade;
  transactionHash: string;
  newBalance: string;
}

//=============================================================================
// User API
//=============================================================================

export interface GetUserRequest {
  walletAddress: string; // ✅ Must match User.walletAddress
}

export interface GetUserResponse {
  user: User;
  positions: UserPosition[];
}

export interface UserPosition {
  marketId: string;
  outcomeIndex: number;
  shares: string;
  averageCost: string;
}

//=============================================================================
// Error Response
//=============================================================================

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}
```

**packages/shared/src/types/index.ts**:

```typescript
export * from './models';
export * from './api';
```

#### 1.1.4 Use in Frontend and Backend

**Frontend (packages/frontend/package.json)**:

```json
{
  "dependencies": {
    "@my-project/shared": "workspace:*"
  }
}
```

**Frontend Usage**:

```typescript
// app/api/markets/create/route.ts
import type { CreateMarketRequest, CreateMarketResponse } from '@my-project/shared/types';

export async function POST(request: Request) {
  const body: CreateMarketRequest = await request.json();

  // TypeScript enforces correct field names
  const response = await fetch(`${API_URL}/markets`, {
    method: 'POST',
    body: JSON.stringify({
      title: body.title,
      description: body.description,
      outcomeCount: body.outcomeCount,
      resolutionTime: body.resolutionTime,
      creatorAddress: body.creatorAddress, // ✅ TypeScript error if wrong name
    }),
  });

  const data: CreateMarketResponse = await response.json();
  return Response.json(data);
}
```

**Backend Usage**:

```typescript
// backend/src/routes/markets.ts
import type { CreateMarketRequest, CreateMarketResponse } from '@my-project/shared/types';

app.post('/markets', async (req, res) => {
  const body: CreateMarketRequest = req.body;

  // TypeScript enforces correct field names
  const market = await createMarket({
    title: body.title,
    creatorAddress: body.creatorAddress, // ✅ TypeScript error if wrong name
    // ...
  });

  const response: CreateMarketResponse = {
    market,
    transactionHash: '0x...',
  };

  res.json(response);
});
```

**Benefits**:
- ✅ **Compile-time errors** if field names don't match
- ✅ **Autocomplete** for all API fields
- ✅ **Single source of truth** for field names
- ✅ **Prevents 40+ parameter mismatch commits**

---

### 1.2 API Schema Validation (Zod)

**Problem**: TypeScript types are compile-time only. Runtime data (from API requests) needs validation.

**Real-World Issue**: kektechV0.69 had silent failures when frontend sent wrong field names.

#### 1.2.1 Create Zod Schemas

**packages/shared/src/schemas/models.ts**:

```typescript
import { z } from 'zod';

// Zod schemas mirror TypeScript types
export const MarketStatusSchema = z.enum(['PROPOSED', 'ACTIVE', 'RESOLVED', 'DISPUTED']);

export const UserSchema = z.object({
  id: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/), // Ethereum address
  username: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const MarketSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  creatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  outcomeCount: z.number().int().min(2).max(10),
  totalVolume: z.string(), // BigInt as string
  resolutionTime: z.coerce.date(),
  status: MarketStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const TradeSchema = z.object({
  id: z.string().uuid(),
  marketId: z.string().uuid(),
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  outcomeIndex: z.number().int().min(0),
  shares: z.string(), // BigInt as string
  cost: z.string(), // BigInt as string
  tradeType: z.enum(['BUY', 'SELL']),
  timestamp: z.coerce.date(),
});
```

**packages/shared/src/schemas/api.ts**:

```typescript
import { z } from 'zod';
import { MarketStatusSchema } from './models';

//=============================================================================
// Market API Schemas
//=============================================================================

export const CreateMarketRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  outcomeCount: z.number().int().min(2).max(10),
  resolutionTime: z.coerce.date().refine(
    (date) => date > new Date(),
    'Resolution time must be in the future'
  ),
  creatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const GetMarketsRequestSchema = z.object({
  status: MarketStatusSchema.optional(),
  creatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

//=============================================================================
// Trade API Schemas
//=============================================================================

export const CreateTradeRequestSchema = z.object({
  marketId: z.string().uuid(),
  outcomeIndex: z.number().int().min(0),
  shares: z.string().regex(/^\d+$/), // Numeric string
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tradeType: z.enum(['BUY', 'SELL']),
});

//=============================================================================
// User API Schemas
//=============================================================================

export const GetUserRequestSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});
```

**packages/shared/src/schemas/index.ts**:

```typescript
export * from './models';
export * from './api';
```

#### 1.2.2 Use in Backend (Validation Middleware)

**Create Validation Middleware**:

```typescript
// backend/src/middleware/validate.ts
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and parse request body
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Return detailed validation errors
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      } else {
        next(error);
      }
    }
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      } else {
        next(error);
      }
    }
  };
}
```

**Use in Routes**:

```typescript
// backend/src/routes/markets.ts
import { CreateMarketRequestSchema, GetMarketsRequestSchema } from '@my-project/shared/schemas';
import { validateBody, validateQuery } from '../middleware/validate';

app.post('/markets', validateBody(CreateMarketRequestSchema), async (req, res) => {
  // req.body is now validated AND typed
  const { title, description, creatorAddress } = req.body;

  // If client sends wrong field name (e.g., "address" instead of "creatorAddress"),
  // validation fails BEFORE this code runs
  // Client receives: { error: "Validation failed", details: [...] }

  const market = await createMarket(req.body);
  res.json({ market });
});

app.get('/markets', validateQuery(GetMarketsRequestSchema), async (req, res) => {
  // req.query is validated
  const { status, creatorAddress, limit, offset } = req.query;

  const markets = await getMarkets({ status, creatorAddress, limit, offset });
  res.json({ markets });
});
```

**Benefits**:
- ✅ **Runtime validation** catches wrong field names immediately
- ✅ **Detailed error messages** help frontend developers debug
- ✅ **Type coercion** (e.g., string "10" → number 10)
- ✅ **Prevents silent failures** (kektechV0.69 issue)

---

### 1.3 Contract Testing

**Goal**: Automatically verify that frontend and backend agree on API contracts.

#### 1.3.1 Create Contract Tests

**packages/shared/tests/api-contract.test.ts**:

```typescript
import { describe, it, expect } from 'vitest';
import {
  CreateMarketRequestSchema,
  CreateTradeRequestSchema,
  GetUserRequestSchema,
} from '../src/schemas/api';

describe('API Contract Tests', () => {
  describe('CreateMarketRequest', () => {
    it('should accept valid request', () => {
      const validRequest = {
        title: 'Will ETH reach $5000?',
        description: 'Prediction market for ETH price',
        outcomeCount: 2,
        resolutionTime: new Date(Date.now() + 86400000), // Tomorrow
        creatorAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      };

      expect(() => CreateMarketRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should reject invalid creatorAddress', () => {
      const invalidRequest = {
        title: 'Test',
        description: 'Test',
        outcomeCount: 2,
        resolutionTime: new Date(Date.now() + 86400000),
        creatorAddress: 'invalid-address', // ❌ Not an Ethereum address
      };

      expect(() => CreateMarketRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject past resolutionTime', () => {
      const invalidRequest = {
        title: 'Test',
        description: 'Test',
        outcomeCount: 2,
        resolutionTime: new Date(Date.now() - 86400000), // Yesterday ❌
        creatorAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      };

      expect(() => CreateMarketRequestSchema.parse(invalidRequest)).toThrow(
        'Resolution time must be in the future'
      );
    });

    // Test field name changes (catches renames)
    it('should require creatorAddress field (not address or walletAddress)', () => {
      const wrongFieldName = {
        title: 'Test',
        description: 'Test',
        outcomeCount: 2,
        resolutionTime: new Date(Date.now() + 86400000),
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // ❌ Wrong field name
      };

      expect(() => CreateMarketRequestSchema.parse(wrongFieldName)).toThrow();
    });
  });

  describe('CreateTradeRequest', () => {
    it('should accept valid request', () => {
      const validRequest = {
        marketId: '123e4567-e89b-12d3-a456-426614174000',
        outcomeIndex: 0,
        shares: '1000000',
        userAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        tradeType: 'BUY' as const,
      };

      expect(() => CreateTradeRequestSchema.parse(validRequest)).not.toThrow();
    });

    // Test field name (catches parameter mismatches)
    it('should require userAddress field (not address or walletAddress)', () => {
      const wrongFieldName = {
        marketId: '123e4567-e89b-12d3-a456-426614174000',
        outcomeIndex: 0,
        shares: '1000000',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // ❌ Wrong field name
        tradeType: 'BUY' as const,
      };

      expect(() => CreateTradeRequestSchema.parse(wrongFieldName)).toThrow();
    });
  });
});
```

**Run Contract Tests in CI**:

```yaml
# .github/workflows/contract-tests.yml
name: API Contract Tests

on:
  pull_request:
    paths:
      - 'packages/shared/**'
      - 'packages/backend/**'
      - 'packages/frontend/**'

jobs:
  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - name: Install dependencies
        run: pnpm install
      - name: Run contract tests
        run: pnpm --filter @my-project/shared test
```

**Benefits**:
- ✅ **Catches field name changes** before they break production
- ✅ **Documents expected API behavior**
- ✅ **Runs in CI/CD** (fails build if contract broken)
- ✅ **Prevents parameter mismatch commits**

---

### 1.4 Breaking Change Prevention

#### 1.4.1 Versioned API Types

**Strategy**: Use versioned types for breaking changes

```typescript
// packages/shared/src/types/api-v1.ts
export interface CreateMarketRequestV1 {
  title: string;
  description: string;
  creatorAddress: string; // v1 field name
}

// packages/shared/src/types/api-v2.ts
export interface CreateMarketRequestV2 {
  title: string;
  description: string;
  creatorWalletAddress: string; // v2 renamed field
}

// Backend supports both versions
app.post('/v1/markets', validateBody(CreateMarketRequestV1Schema), handlerV1);
app.post('/v2/markets', validateBody(CreateMarketRequestV2Schema), handlerV2);
```

#### 1.4.2 Deprecation Warnings

```typescript
// packages/shared/src/schemas/api.ts
export const CreateMarketRequestSchema = z.object({
  title: z.string(),
  description: z.string(),

  // Old field (deprecated)
  creatorAddress: z.string().optional(),

  // New field
  creatorWalletAddress: z.string(),
}).refine(
  (data) => data.creatorAddress || data.creatorWalletAddress,
  'Either creatorAddress (deprecated) or creatorWalletAddress is required'
);

// Backend logs deprecation warning
if (req.body.creatorAddress && !req.body.creatorWalletAddress) {
  logger.warn('creatorAddress is deprecated, use creatorWalletAddress');
}
```

---

## Part 2: Database Integration

### 2.1 Schema Synchronization

**Real-World Issue**: zmartV0.69 INCIDENT-001 - Database schema mismatch caused production crash

**Problem**: Database schema and application types get out of sync

**Solution**: Generate TypeScript types from database schema

#### 2.1.1 Prisma Setup (Recommended)

**Install Prisma**:

```bash
pnpm add prisma @prisma/client
pnpm add -D prisma
```

**Initialize Prisma**:

```bash
npx prisma init
```

**Define Schema** (packages/backend/prisma/schema.prisma):

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(uuid())
  walletAddress String   @unique @map("wallet_address") // ✅ Consistent with API types
  username      String?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  markets Market[]
  trades  Trade[]

  @@map("users")
}

model Market {
  id              String       @id @default(uuid())
  title           String
  description     String
  creatorAddress  String       @map("creator_address") // ✅ Matches CreateMarketRequest
  outcomeCount    Int          @map("outcome_count")
  totalVolume     String       @default("0") @map("total_volume") // BigInt as string
  resolutionTime  DateTime     @map("resolution_time")
  status          MarketStatus @default(PROPOSED)
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  creator User    @relation(fields: [creatorAddress], references: [walletAddress])
  trades  Trade[]

  @@map("markets")
}

enum MarketStatus {
  PROPOSED
  ACTIVE
  RESOLVED
  DISPUTED
}

model Trade {
  id           String    @id @default(uuid())
  marketId     String    @map("market_id")
  userAddress  String    @map("user_address") // ✅ Matches CreateTradeRequest
  outcomeIndex Int       @map("outcome_index")
  shares       String    // BigInt as string
  cost         String    // BigInt as string
  tradeType    TradeType @map("trade_type")
  timestamp    DateTime  @default(now())

  market Market @relation(fields: [marketId], references: [id])
  user   User   @relation(fields: [userAddress], references: [walletAddress])

  @@map("trades")
}

enum TradeType {
  BUY
  SELL
}
```

**Generate Prisma Client**:

```bash
npx prisma generate
```

**Generated Types** (automatically in `node_modules/.prisma/client`):

```typescript
// Auto-generated by Prisma
export type User = {
  id: string;
  walletAddress: string; // ✅ Matches our shared types
  username: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Market = {
  id: string;
  title: string;
  description: string;
  creatorAddress: string; // ✅ Matches our shared types
  // ...
};
```

#### 2.1.2 Keep Shared Types in Sync with Database

**Option 1**: Export Prisma types to shared package

```typescript
// packages/shared/src/types/models.ts
import type { User as PrismaUser, Market as PrismaMarket } from '@prisma/client';

// Re-export Prisma types
export type User = PrismaUser;
export type Market = PrismaMarket;

// Or extend if needed
export type UserWithPositions = PrismaUser & {
  positions: UserPosition[];
};
```

**Option 2**: Generate both independently, validate they match

```typescript
// packages/shared/tests/type-sync.test.ts
import { describe, it, expect } from 'vitest';
import type { User as SharedUser } from '../src/types/models';
import type { User as PrismaUser } from '@prisma/client';

describe('Type Synchronization', () => {
  it('SharedUser should match PrismaUser', () => {
    // TypeScript will error if types don't match
    const testAssignment = (prismaUser: PrismaUser): SharedUser => prismaUser;
    const reverseAssignment = (sharedUser: SharedUser): PrismaUser => sharedUser;

    expect(testAssignment).toBeDefined();
    expect(reverseAssignment).toBeDefined();
  });
});
```

---

### 2.2 Migration Strategies

**Problem**: Database schema changes break production if not coordinated with code changes

**Real-World Issue**: zmartV0.69 had database schema mismatch in market-monitor service

#### 2.2.1 Migration Workflow

**Development**:

```bash
# 1. Edit prisma/schema.prisma
# 2. Create migration
npx prisma migrate dev --name add_user_reputation

# 3. Migration file created in prisma/migrations/
# 4. Database updated
# 5. Prisma client regenerated
```

**Production**:

```bash
# Run migrations BEFORE deploying new code
npx prisma migrate deploy

# Then deploy new application code
./scripts/deploy.sh
```

**Add to Deployment Script**:

```bash
#!/bin/bash
# scripts/deploy.sh

echo "🗄️  Running database migrations..."
pnpm prisma migrate deploy

if [ $? -ne 0 ]; then
  echo "❌ Migration failed! Aborting deployment."
  exit 1
fi

echo "✅ Migrations complete"

# Continue with deployment...
```

#### 2.2.2 Backward-Compatible Migrations

**BAD Migration** (breaks old code):

```prisma
// Renaming field (breaking change)
model User {
  address String // Was: walletAddress
}
```

**GOOD Migration** (backward-compatible):

```prisma
// Step 1: Add new field, keep old field
model User {
  walletAddress String // Old field (keep for now)
  address       String // New field
}

// Step 2: Update code to use new field

// Step 3: Migrate data
// UPDATE users SET address = wallet_address;

// Step 4: Remove old field (in next migration)
```

---

### 2.3 Type Generation

**Goal**: Automatically generate TypeScript types from various sources

#### 2.3.1 Generate API Client from OpenAPI

**Install OpenAPI Generator**:

```bash
pnpm add -D @openapitools/openapi-generator-cli
```

**Create OpenAPI Spec** (optional, if using OpenAPI):

```yaml
# backend/openapi.yaml
openapi: 3.0.0
info:
  title: Prediction Market API
  version: 1.0.0
paths:
  /markets:
    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateMarketRequest'
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CreateMarketResponse'
components:
  schemas:
    CreateMarketRequest:
      type: object
      required:
        - title
        - description
        - creatorAddress
      properties:
        title:
          type: string
        description:
          type: string
        creatorAddress:
          type: string
          pattern: '^0x[a-fA-F0-9]{40}$'
```

**Generate Client**:

```bash
npx openapi-generator-cli generate \
  -i backend/openapi.yaml \
  -g typescript-fetch \
  -o packages/frontend/src/generated/api
```

#### 2.3.2 Generate Zod Schemas from Prisma

**Install Zod Prisma Generator**:

```bash
pnpm add -D zod-prisma-generator
```

**Add to Prisma Schema**:

```prisma
generator zod {
  provider = "zod-prisma-generator"
  output   = "../shared/src/schemas/generated"
}
```

**Generate**:

```bash
npx prisma generate
```

**Result**: Zod schemas automatically generated from Prisma models

---

### 2.4 Schema Validation

**Goal**: Validate database data matches expected types

#### 2.4.1 Runtime Validation on Read

```typescript
// backend/src/services/markets.ts
import { MarketSchema } from '@my-project/shared/schemas';

export async function getMarket(id: string) {
  const market = await prisma.market.findUnique({ where: { id } });

  if (!market) {
    throw new Error('Market not found');
  }

  // Validate data from database matches expected schema
  try {
    return MarketSchema.parse(market);
  } catch (error) {
    // Database schema drift detected!
    logger.error('Database schema mismatch', { market, error });
    throw new Error('Data integrity error');
  }
}
```

#### 2.4.2 Pre-Deployment Schema Validation

**Create Validation Script**:

```typescript
// scripts/validate-schema.ts
import { PrismaClient } from '@prisma/client';
import { UserSchema, MarketSchema } from '@my-project/shared/schemas';

const prisma = new PrismaClient();

async function validateDatabaseSchema() {
  console.log('🔍 Validating database schema...');

  // Sample data from each table
  const users = await prisma.user.findMany({ take: 10 });
  const markets = await prisma.market.findMany({ take: 10 });

  let errors = 0;

  // Validate users
  for (const user of users) {
    try {
      UserSchema.parse(user);
    } catch (error) {
      console.error('User schema mismatch:', user.id, error);
      errors++;
    }
  }

  // Validate markets
  for (const market of markets) {
    try {
      MarketSchema.parse(market);
    } catch (error) {
      console.error('Market schema mismatch:', market.id, error);
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`❌ ${errors} schema validation errors found`);
    process.exit(1);
  }

  console.log('✅ Database schema validation passed');
}

validateDatabaseSchema();
```

**Add to CI/CD**:

```yaml
# .github/workflows/deploy.yml
- name: Validate database schema
  run: pnpm ts-node scripts/validate-schema.ts
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Part 3: Environment Management

### 3.1 Environment Variable Architecture

**Problem**: Environment variables scattered across multiple files, hard to track

**Solution**: Centralized environment management

#### 3.1.1 Categorize Environment Variables

```typescript
// packages/shared/src/config/env-categories.ts

export const ENV_CATEGORIES = {
  // Build-time (embedded in bundle, safe to expose to client)
  BUILD_TIME: [
    'NEXT_PUBLIC_CHAIN_ID',
    'NEXT_PUBLIC_RPC_URL',
    'NEXT_PUBLIC_WALLET_CONNECT_ID',
    'NEXT_PUBLIC_API_URL',
  ],

  // Runtime (server-side only, NEVER exposed to client)
  RUNTIME_SECRETS: [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ALCHEMY_API_KEY',
    'HELIUS_API_KEY',
  ],

  // Runtime (non-sensitive)
  RUNTIME_CONFIG: [
    'NODE_ENV',
    'PORT',
    'LOG_LEVEL',
  ],
} as const;
```

#### 3.1.2 Centralized Environment Configuration

**Create Config Service**:

```typescript
// packages/backend/src/config/index.ts
import { z } from 'zod';

const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('4000'),

  // Database
  DATABASE_URL: z.string().url(),

  // Blockchain
  RPC_URL: z.string().url(),
  CHAIN_ID: z.string().transform(Number).pipe(z.number().int()),

  // API Keys (optional in development)
  HELIUS_API_KEY: z.string().min(1).optional(),
  ALCHEMY_API_KEY: z.string().min(1).optional(),

  // Authentication
  JWT_SECRET: z.string().min(32),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

// Validate on module load
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
```

**Use in Application**:

```typescript
// Instead of process.env.PORT (unsafe)
import { config } from './config';

const port = config.PORT; // Type-safe, validated
```

---

### 3.2 Validation Scripts

#### 3.2.1 Environment Variable Validation Script

**Create Validator**:

```bash
#!/bin/bash
# scripts/validate-env.sh
set -e

echo "🔍 Validating environment variables..."

# Check .env file exists
if [ ! -f .env ]; then
  echo "❌ ERROR: .env file not found"
  echo "Copy .env.example to .env and fill in values"
  exit 1
fi

# Check for newline characters (zmartV0.69 issue)
if grep -P '\n$' .env; then
  echo "❌ ERROR: Trailing newlines found in .env"
  echo "Remove invisible newline characters"
  exit 1
fi

# Check for Windows line endings
if file .env | grep -q "CRLF"; then
  echo "⚠️  WARNING: Windows line endings (CRLF) detected"
  echo "Run: dos2unix .env"
fi

# Check all required variables are set
required_vars=(
  "DATABASE_URL"
  "JWT_SECRET"
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
)

missing_vars=()

for var in "${required_vars[@]}"; do
  if ! grep -q "^${var}=" .env; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo "❌ ERROR: Missing required environment variables:"
  for var in "${missing_vars[@]}"; do
    echo "  - $var"
  done
  exit 1
fi

echo "✅ Environment validation passed"
```

**Add to package.json**:

```json
{
  "scripts": {
    "validate:env": "./scripts/validate-env.sh",
    "prebuild": "pnpm validate:env",
    "predev": "pnpm validate:env"
  }
}
```

---

### 3.3 Build-Time vs Runtime

**Critical Distinction**:

| Type | When Available | Example | Safe for Client? |
|------|----------------|---------|------------------|
| Build-Time | During `next build` | `NEXT_PUBLIC_*` | ✅ Yes (embedded in bundle) |
| Runtime | During request handling | `DATABASE_URL` | ❌ No (server-side only) |

**Real-World Issue**: kektechV0.69 Prisma build failures - `DATABASE_URL` not available at build time

#### 3.3.1 Build-Time Variables

```bash
# .env
NEXT_PUBLIC_API_URL=https://api.example.com
```

```typescript
// Usage (works in client components)
const apiUrl = process.env.NEXT_PUBLIC_API_URL; // ✅ Available at build time
```

#### 3.3.2 Runtime Variables (Server-Side Only)

```bash
# .env
DATABASE_URL=postgresql://...
```

```typescript
// Usage (ONLY in API routes or server components)
export async function GET() {
  const dbUrl = process.env.DATABASE_URL; // ✅ Available at runtime
  // ...
}

// ❌ BROKEN: Using in client component
'use client';
export function MyComponent() {
  const dbUrl = process.env.DATABASE_URL; // ❌ undefined in client!
}
```

**Solution for Prisma** (kektechV0.69 pattern):

See [Guide 17, Section 1.3.1](./17-full-stack-deployment.md#131-handle-build-time-database-dependencies)

---

### 3.4 Secret Management

#### 3.4.1 Development (Local)

```bash
# .env.local (NOT committed to git)
DATABASE_URL=postgresql://localhost:5432/dev
JWT_SECRET=local-dev-secret-32-characters-min
```

**.gitignore**:

```
.env
.env.local
.env.production
.env.*.local
```

#### 3.4.2 Production (Vercel)

**Via Vercel Dashboard**:
1. Project → Settings → Environment Variables
2. Add each variable
3. Select environments: Production, Preview, Development

**Via Vercel CLI**:

```bash
vercel env add DATABASE_URL production
# Paste value when prompted
```

#### 3.4.3 Secret Rotation

**Create Rotation Script**:

```bash
#!/bin/bash
# scripts/rotate-secret.sh

SECRET_NAME=$1

if [ -z "$SECRET_NAME" ]; then
  echo "Usage: ./rotate-secret.sh <SECRET_NAME>"
  exit 1
fi

echo "🔄 Rotating $SECRET_NAME..."

# Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# Update in Vercel
vercel env rm "$SECRET_NAME" production
vercel env add "$SECRET_NAME" production <<< "$NEW_SECRET"

echo "✅ $SECRET_NAME rotated"
echo "New value: $NEW_SECRET"
echo "⚠️  Update .env.local with new value for local development"
```

**Schedule Rotation**:

```bash
# Rotate JWT_SECRET every 90 days
0 0 1 */3 * /path/to/rotate-secret.sh JWT_SECRET
```

---

## Part 4: Real-World Patterns

### 4.1 Lazy Initialization (Prisma)

**See Guide 17, Section 1.3.1** for full implementation.

**Summary**:

```typescript
// ❌ BROKEN (eager initialization)
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL, // undefined during build!
});

// ✅ WORKING (lazy initialization)
let prisma: PrismaClient | undefined;

export async function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL, // Available at runtime
    });
  }
  return prisma;
}
```

---

### 4.2 API Client Generation

**Create Type-Safe API Client**:

```typescript
// packages/frontend/src/lib/api-client.ts
import type {
  CreateMarketRequest,
  CreateMarketResponse,
  GetMarketsRequest,
  GetMarketsResponse,
  ErrorResponse,
} from '@my-project/shared/types';

class ApiClient {
  constructor(private baseUrl: string) {}

  async createMarket(data: CreateMarketRequest): Promise<CreateMarketResponse> {
    const response = await fetch(`${this.baseUrl}/markets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error);
    }

    return response.json();
  }

  async getMarkets(params: GetMarketsRequest): Promise<GetMarketsResponse> {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${this.baseUrl}/markets?${query}`);

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(process.env.NEXT_PUBLIC_API_URL!);
```

**Usage**:

```typescript
// Type-safe API calls
const { market } = await apiClient.createMarket({
  title: 'Test Market',
  description: 'Test',
  creatorAddress: '0x...', // ✅ TypeScript enforces correct field name
  outcomeCount: 2,
  resolutionTime: new Date(),
});
```

---

### 4.3 Error Propagation

**Consistent Error Handling**:

```typescript
// packages/shared/src/types/errors.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

**Backend**:

```typescript
// backend/src/middleware/error-handler.ts
import { ApiError, ERROR_CODES } from '@my-project/shared/types';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  } else {
    // Unexpected error
    logger.error('Unexpected error', err);
    res.status(500).json({
      error: 'Internal server error',
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
}

app.use(errorHandler);
```

**Frontend**:

```typescript
// frontend/src/lib/api-client.ts
async createMarket(data: CreateMarketRequest): Promise<CreateMarketResponse> {
  const response = await fetch(`${this.baseUrl}/markets`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new ApiError(error.code, error.error, response.status, error.details);
  }

  return response.json();
}
```

---

### 4.4 Integration Testing

**Test Frontend + Backend Together**:

```typescript
// packages/frontend/tests/integration/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../../src/lib/api-client';

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Start backend server or use test environment
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should create market with correct field names', async () => {
    const request = {
      title: 'Test Market',
      description: 'Integration test',
      creatorAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      outcomeCount: 2,
      resolutionTime: new Date(Date.now() + 86400000),
    };

    const response = await apiClient.createMarket(request);

    expect(response.market.id).toBeDefined();
    expect(response.market.creatorAddress).toBe(request.creatorAddress);
    expect(response.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('should fail with invalid field names (catches parameter mismatches)', async () => {
    const invalidRequest = {
      title: 'Test',
      description: 'Test',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // ❌ Wrong field name
      outcomeCount: 2,
      resolutionTime: new Date(Date.now() + 86400000),
    } as any;

    await expect(apiClient.createMarket(invalidRequest)).rejects.toThrow('Validation failed');
  });
});
```

---

## Part 5: Common Issues & Solutions

### 5.1 Parameter Mismatches

**Issue**: Frontend uses `address`, backend expects `walletAddress`

**Real Example** (kektechV0.69):

```typescript
// Commit 1: Backend
export async function voteOnComment(userId: string, commentId: string, vote: number) {}

// Commit 20: Backend changed to walletAddress
export async function voteOnComment(walletAddress: string, commentId: string, vote: number) {}

// Frontend NOT updated (40+ commits later)
await fetch('/api/comments/vote', {
  body: JSON.stringify({ userId, commentId, vote }), // ❌ Still using userId
});
```

**Prevention**:

1. **Shared types** (Part 1.1)
2. **Zod validation** (Part 1.2)
3. **Contract tests** (Part 1.3)

**Detection**:

```typescript
// Contract test catches this
it('should reject wrong field name', () => {
  const wrongRequest = { userId: '...', commentId: '...', vote: 1 }; // ❌ userId
  expect(() => VoteOnCommentSchema.parse(wrongRequest)).toThrow();
});
```

---

### 5.2 Environment Variable Newlines

**See Guide 17, Section 1.2.4** for full details.

**Quick Fix**:

```bash
# Detect newlines
cat .env | od -c | grep '\\n'

# Remove newlines
sed -i 's/\n$//' .env
```

---

### 5.3 Database Schema Drift

**Issue**: Database schema changes, but application types don't update

**Prevention**:

1. **Generate types from schema** (Part 2.1)
2. **Run migrations before deployment** (Part 2.2)
3. **Schema validation tests** (Part 2.4)

**Detection**:

```bash
# Check if Prisma schema matches database
npx prisma migrate status

# Expected output:
# Database schema is up to date!
```

---

### 5.4 Build-Time Dependencies

**Issue**: Prisma/database client initialized during build (DATABASE_URL unavailable)

**Solution**: See [Part 4.1](#41-lazy-initialization-prisma) and [Guide 17, Section 1.3.1](./17-full-stack-deployment.md#131-handle-build-time-database-dependencies)

---

## Summary & Next Steps

**What We've Covered**:
- ✅ Shared TypeScript types (prevents 40+ parameter mismatch commits)
- ✅ Zod validation (catches errors at runtime)
- ✅ Contract testing (prevents breaking changes)
- ✅ Database schema synchronization
- ✅ Environment variable management
- ✅ Real-world patterns from production

**Time Saved**:
- **Before this guide**: 40+ commits fixing parameter mismatches
- **After this guide**: 0 commits (caught at compile time)

**Checklist**:
- [ ] Shared package created (`packages/shared`)
- [ ] TypeScript types defined for all API endpoints
- [ ] Zod schemas created and used in backend
- [ ] Validation middleware added to all routes
- [ ] Contract tests running in CI/CD
- [ ] Prisma schema matches shared types
- [ ] Environment validation script created
- [ ] Lazy initialization implemented for database clients
- [ ] API client generated for frontend
- [ ] Integration tests cover critical paths

**Next Guides**:
- **Guide 19**: Documentation Standards & Validation
- **Guide 20** (planned): TypeScript Strict Migration

---

**Document Version**: 1.0.0
**Based on**: kektechV0.69 (240 commits) + zmartV0.69 (216 commits) forensic analysis
**Last Updated**: November 14, 2025
**Status**: Ready for Production Use
