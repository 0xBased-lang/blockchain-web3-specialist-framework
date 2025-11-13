# Transaction Handling Templates

## EVM Transaction Pattern (Complete)

```typescript
import { useContractWrite, useWaitForTransaction } from 'wagmi';
import { redis } from '@/lib/redis';
import { useQueryClient } from '@tanstack/react-query';

export function useTransfer() {
  const queryClient = useQueryClient();

  const { write, data: txData } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'transfer',
    onError: (error) => {
      console.error('Transaction failed:', error);
      // Report to error tracking
      Sentry.captureException(error);
    }
  });

  const { isLoading: isConfirming } = useWaitForTransaction({
    hash: txData?.hash,
    onSuccess: async (receipt) => {
      console.log('Transaction confirmed:', receipt.transactionHash);

      // 1. Invalidate cache
      await redis.del(`balance:${address}`);

      // 2. Invalidate queries
      queryClient.invalidateQueries(['balance', address]);
      queryClient.invalidateQueries(['transactions', address]);

      // 3. Optional: Update backend
      await fetch('/api/transactions/record', {
        method: 'POST',
        body: JSON.stringify({
          hash: receipt.transactionHash,
          status: 'confirmed'
        })
      });
    }
  });

  return { write, isConfirming };
}
```

## Solana Transaction Pattern (Complete)

```typescript
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, SystemProgram } from '@solana/web3.js';
import { redis } from '@/lib/redis';
import { useQueryClient } from '@tanstack/react-query';

export function useSolanaTransfer() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  const transfer = async (to: string, amount: number) => {
    if (!publicKey) throw new Error('Wallet not connected');

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(to),
          lamports: amount
        })
      );

      // Send transaction
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation (IMPORTANT!)
      const confirmation = await connection.confirmTransaction(
        signature,
        'confirmed' // or 'finalized'
      );

      if (confirmation.value.err) {
        throw new Error('Transaction failed');
      }

      console.log('Transaction confirmed:', signature);

      // 1. Invalidate cache
      await redis.del(`balance:${publicKey.toString()}`);

      // 2. Invalidate queries
      queryClient.invalidateQueries(['balance', publicKey.toString()]);

      return { signature, confirmation };
    } catch (error) {
      console.error('Solana transaction error:', error);
      Sentry.captureException(error);
      throw error;
    }
  };

  return { transfer };
}
```

## Cache Invalidation Pattern

```typescript
// After successful blockchain transaction
const invalidateCache = async (address: string, operation: string) => {
  const keysToInvalidate = [
    `balance:${address}`,
    `transactions:${address}`,
    `nonce:${address}`
  ];

  // Invalidate Redis cache
  await Promise.all(keysToInvalidate.map(key => redis.del(key)));

  // Invalidate React Query cache
  queryClient.invalidateQueries(['balance', address]);
  queryClient.invalidateQueries(['transactions', address]);

  console.log(`Cache invalidated for ${operation}`);
};
```

## Network Validation Pattern

```typescript
import { useNetwork, useSwitchNetwork } from 'wagmi';

export function useNetworkGuard() {
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();

  const REQUIRED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID);

  useEffect(() => {
    if (chain && chain.id !== REQUIRED_CHAIN_ID) {
      console.warn(`Wrong network: ${chain.id}, expected: ${REQUIRED_CHAIN_ID}`);

      if (switchNetwork) {
        switchNetwork(REQUIRED_CHAIN_ID);
      }
    }
  }, [chain, switchNetwork]);

  const isCorrectNetwork = chain?.id === REQUIRED_CHAIN_ID;

  return { isCorrectNetwork, switchToCorrectNetwork: () => switchNetwork?.(REQUIRED_CHAIN_ID) };
}

// Usage in component
const { isCorrectNetwork, switchToCorrectNetwork } = useNetworkGuard();

const handleTransaction = async () => {
  if (!isCorrectNetwork) {
    await switchToCorrectNetwork();
    return;
  }

  // Proceed with transaction
};
```

## Error Handling Pattern

```typescript
export const handleTransactionError = (error: any) => {
  let userMessage = 'Transaction failed. Please try again.';
  let severity: 'error' | 'warning' = 'error';

  // EVM errors
  if (error.code === 'INSUFFICIENT_FUNDS') {
    userMessage = 'Insufficient funds for this transaction.';
    severity = 'warning';
  } else if (error.code === 'USER_REJECTED') {
    userMessage = 'Transaction was cancelled.';
    severity = 'warning';
  } else if (error.code === 'NETWORK_ERROR') {
    userMessage = 'Network error. Please check your connection.';
  } else if (error.message?.includes('gas')) {
    userMessage = 'Gas estimation failed. Try increasing gas limit.';
  }

  // Solana errors
  if (error.message?.includes('0x1')) {
    userMessage = 'Insufficient funds for rent.';
    severity = 'warning';
  }

  // Log to error tracking
  Sentry.captureException(error, {
    tags: { type: 'transaction' },
    extra: { userMessage, severity }
  });

  // Show to user
  toast({
    title: severity === 'error' ? 'Error' : 'Warning',
    description: userMessage,
    status: severity,
    duration: 5000
  });

  return { userMessage, severity };
};
```

## Best Practices Checklist

- [ ] Always wait for transaction confirmation (`tx.wait()` or `confirmTransaction`)
- [ ] Invalidate cache after successful transaction
- [ ] Invalidate React Query queries
- [ ] Validate network before transaction
- [ ] Handle all error cases with user-friendly messages
- [ ] Log errors to error tracking (Sentry)
- [ ] Show loading state during confirmation
- [ ] Don't assume transaction success - check receipt/confirmation
- [ ] Use correct commitment level for Solana (`confirmed` or `finalized`)
- [ ] Update backend/database after blockchain confirmation
