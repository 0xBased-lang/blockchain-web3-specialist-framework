# Cache Strategies for Web3 Applications

## Redis Cache Pattern with Blockchain Data

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.UPSTASH_REDIS_REST_URL);

export class BlockchainCache {
  // Cache duration by data type
  static TTL = {
    BALANCE: 30, // 30 seconds (frequently changes)
    TRANSACTION: 300, // 5 minutes (historical data)
    CONTRACT_DATA: 60, // 1 minute (depends on mutation frequency)
    STATIC: 3600 // 1 hour (rarely changes)
  };

  /**
   * Get with auto-refresh pattern
   */
  static async getBalance(address: string): Promise<string | null> {
    const key = `balance:${address}`;

    // Try cache first
    const cached = await redis.get(key);
    if (cached) {
      console.log(`Cache HIT: ${key}`);
      return cached;
    }

    console.log(`Cache MISS: ${key}`);
    return null;
  }

  /**
   * Set with TTL
   */
  static async setBalance(address: string, balance: string): Promise<void> {
    const key = `balance:${address}`;
    await redis.set(key, balance, 'EX', this.TTL.BALANCE);
    console.log(`Cache SET: ${key} (TTL: ${this.TTL.BALANCE}s)`);
  }

  /**
   * Invalidate after mutation
   */
  static async invalidateBalance(address: string): Promise<void> {
    const key = `balance:${address}`;
    await redis.del(key);
    console.log(`Cache INVALIDATED: ${key}`);
  }

  /**
   * Invalidate pattern (all related keys)
   */
  static async invalidateUserData(address: string): Promise<void> {
    const pattern = `*:${address}`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`Cache INVALIDATED: ${keys.length} keys for ${address}`);
    }
  }

  /**
   * Cache-aside pattern with automatic fallback
   */
  static async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.TTL.CONTRACT_DATA
  ): Promise<T> {
    // Try cache
    const cached = await redis.get(key);
    if (cached) {
      console.log(`Cache HIT: ${key}`);
      return JSON.parse(cached) as T;
    }

    // Fetch from source
    console.log(`Cache MISS: ${key}, fetching...`);
    const data = await fetcher();

    // Store in cache
    await redis.set(key, JSON.stringify(data), 'EX', ttl);

    return data;
  }
}
```

## React Query + Redis Integration

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BlockchainCache } from './cache';
import { ethers } from 'ethers';

export function useBalance(address: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['balance', address],
    queryFn: async () => {
      // Check Redis cache first
      const cached = await BlockchainCache.getBalance(address);
      if (cached) return cached;

      // Fetch from blockchain
      const provider = new ethers.providers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_RPC_URL
      );

      const balance = await provider.getBalance(address);
      const balanceStr = ethers.utils.formatEther(balance);

      // Update cache
      await BlockchainCache.setBalance(address, balanceStr);

      return balanceStr;
    },
    staleTime: 30000, // Consider data stale after 30s
    cacheTime: 300000, // Keep in memory for 5 minutes
    refetchOnWindowFocus: true
  });
}

// Invalidate both caches after transaction
export function useInvalidateBalance() {
  const queryClient = useQueryClient();

  return async (address: string) => {
    // Invalidate Redis
    await BlockchainCache.invalidateBalance(address);

    // Invalidate React Query
    queryClient.invalidateQueries(['balance', address]);

    console.log(`Both caches invalidated for ${address}`);
  };
}
```

## Multi-Layer Cache Strategy

```
┌─────────────────────────────────────┐
│  React Query (Client-Side Cache)    │  ← 0-30s TTL
│  - In-memory cache                  │
│  - Per-session                      │
└──────────────┬──────────────────────┘
               │ Cache MISS
               ▼
┌─────────────────────────────────────┐
│  Redis (Server-Side Cache)          │  ← 30s-5min TTL
│  - Shared across users              │
│  - Persistent                       │
└──────────────┬──────────────────────┘
               │ Cache MISS
               ▼
┌─────────────────────────────────────┐
│  Blockchain (Source of Truth)       │  ← Always accurate
│  - RPC call                         │
│  - ~500ms latency                   │
└─────────────────────────────────────┘
```

## Invalidation Strategies

### 1. Time-Based (TTL)
```typescript
// Automatically expires after TTL
await redis.set(key, value, 'EX', 60); // 60 seconds
```

### 2. Event-Based (After Mutations)
```typescript
const { write } = useContractWrite({
  onSuccess: async (data) => {
    const receipt = await data.wait();

    // Invalidate all affected caches
    await BlockchainCache.invalidateBalance(address);
    await BlockchainCache.invalidateUserData(address);

    queryClient.invalidateQueries(['balance']);
    queryClient.invalidateQueries(['transactions']);
  }
});
```

### 3. Tag-Based (Group Invalidation)
```typescript
// Tag cache entries
await redis.set(`balance:${address}`, value);
await redis.sadd(`user:${userId}:keys`, `balance:${address}`);

// Invalidate all user-related keys
const invalidateUser = async (userId: string) => {
  const keys = await redis.smembers(`user:${userId}:keys`);
  if (keys.length) await redis.del(...keys);
  await redis.del(`user:${userId}:keys`);
};
```

### 4. Write-Through (Update on Mutation)
```typescript
const updateBalance = async (address: string, newBalance: string) => {
  // 1. Update blockchain (source of truth)
  const tx = await contract.updateBalance(newBalance);
  await tx.wait();

  // 2. Update cache immediately
  await BlockchainCache.setBalance(address, newBalance);

  // 3. Update React Query
  queryClient.setQueryData(['balance', address], newBalance);
};
```

## Cache Debugging

```typescript
export class CacheDebugger {
  static async diagnose(key: string) {
    const value = await redis.get(key);
    const ttl = await redis.ttl(key);

    console.log('Cache Diagnosis:');
    console.log('  Key:', key);
    console.log('  Exists:', value !== null);
    console.log('  Value:', value);
    console.log('  TTL:', ttl === -1 ? 'no expiry' : `${ttl}s`);

    if (ttl === -2) {
      console.log('  Status: Key does not exist');
    } else if (ttl === -1) {
      console.log('  ⚠️  Warning: Key exists but has no expiry');
    } else if (ttl < 10) {
      console.log('  ⚠️  Warning: About to expire');
    }
  }

  static async listUserKeys(address: string) {
    const pattern = `*:${address}*`;
    const keys = await redis.keys(pattern);

    console.log(`Keys for ${address}:`, keys);

    for (const key of keys) {
      const ttl = await redis.ttl(key);
      console.log(`  ${key}: TTL ${ttl}s`);
    }
  }
}
```

## Best Practices

### DO ✅

- Cache read-heavy data (balances, token info)
- Set appropriate TTLs based on data volatility
- Invalidate cache after mutations
- Use multi-layer caching (React Query + Redis)
- Log cache hits/misses for monitoring
- Handle cache failures gracefully (fallback to source)

### DON'T ❌

- Cache user-specific sensitive data without encryption
- Set very long TTLs for frequently changing data
- Forget to invalidate after blockchain mutations
- Cache without TTL (risk of stale data)
- Ignore cache invalidation failures
- Cache data that's cheaper to fetch than to cache

## Common Pitfalls

### Pitfall 1: Stale Data After Transaction
```typescript
// ❌ BAD: Transaction succeeds but UI shows old data
const tx = await contract.transfer(to, amount);
// Missing: await tx.wait()
// Missing: cache invalidation

// ✅ GOOD:
const tx = await contract.transfer(to, amount);
const receipt = await tx.wait();
await BlockchainCache.invalidateBalance(from);
await BlockchainCache.invalidateBalance(to);
queryClient.invalidateQueries(['balance']);
```

### Pitfall 2: Race Conditions
```typescript
// ❌ BAD: Parallel requests create race condition
Promise.all([
  updateBalance(address, '100'),
  updateBalance(address, '200')
]);

// ✅ GOOD: Sequential or lock-based
await updateBalance(address, '100');
await updateBalance(address, '200');

// Or use Redis lock
const lock = await redis.set(`lock:${address}`, '1', 'NX', 'EX', 10);
if (lock) {
  await updateBalance(address, amount);
  await redis.del(`lock:${address}`);
}
```

### Pitfall 3: Cache Stampede
```typescript
// ❌ BAD: Many requests hit source when cache expires
// (100 users request same data simultaneously)

// ✅ GOOD: Use SWR (stale-while-revalidate)
const { data } = useQuery({
  queryKey: ['balance', address],
  queryFn: fetchBalance,
  staleTime: 30000,
  cacheTime: 60000,
  refetchOnMount: 'always'
});
```

## Monitoring

```typescript
// Track cache performance
export const cacheMetrics = {
  hits: 0,
  misses: 0,
  invalidations: 0,

  recordHit() {
    this.hits++;
    console.log(`Cache hit rate: ${(this.hits / (this.hits + this.misses) * 100).toFixed(2)}%`);
  },

  recordMiss() {
    this.misses++;
  },

  recordInvalidation() {
    this.invalidations++;
  }
};
```
