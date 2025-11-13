# Error Handling Patterns for Web3

## Comprehensive Error Handler

```typescript
import * as Sentry from '@sentry/nextjs';

export class Web3ErrorHandler {
  static handle(error: any, context: string): {
    userMessage: string;
    severity: 'error' | 'warning' | 'info';
    shouldRetry: boolean;
  } {
    console.error(`[${context}]`, error);

    // Default response
    let userMessage = 'An unexpected error occurred';
    let severity: 'error' | 'warning' | 'info' = 'error';
    let shouldRetry = false;

    // EVM Errors
    if (error.code === 'INSUFFICIENT_FUNDS') {
      userMessage = 'Insufficient funds for this transaction';
      severity = 'warning';
      shouldRetry = false;
    } else if (error.code === 'USER_REJECTED' || error.code === 4001) {
      userMessage = 'Transaction cancelled by user';
      severity = 'info';
      shouldRetry = false;
    } else if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR') {
      userMessage = 'Network error. Please check your connection';
      severity = 'warning';
      shouldRetry = true;
    } else if (error.code === 'TIMEOUT') {
      userMessage = 'Request timed out. Please try again';
      severity = 'warning';
      shouldRetry = true;
    } else if (error.code === 'NONCE_EXPIRED') {
      userMessage = 'Transaction nonce expired. Retrying...';
      severity = 'warning';
      shouldRetry = true;
    } else if (error.code === 'REPLACEMENT_UNDERPRICED') {
      userMessage = 'Gas price too low. Increase gas and try again';
      severity = 'warning';
      shouldRetry = false;
    } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      userMessage = 'Cannot estimate gas. Transaction may fail';
      severity = 'error';
      shouldRetry = false;
    } else if (error.code === 'CALL_EXCEPTION') {
      userMessage = 'Smart contract call failed. Check parameters';
      severity = 'error';
      shouldRetry = false;
    }

    // Solana Errors
    else if (error.message?.includes('0x1')) {
      userMessage = 'Insufficient SOL for rent';
      severity = 'warning';
      shouldRetry = false;
    } else if (error.message?.includes('0x0')) {
      userMessage = 'Insufficient funds';
      severity = 'warning';
      shouldRetry = false;
    } else if (error.message?.includes('blockhash not found')) {
      userMessage = 'Transaction expired. Please retry';
      severity = 'warning';
      shouldRetry = true;
    } else if (error.message?.includes('WalletNotConnectedError')) {
      userMessage = 'Wallet not connected';
      severity = 'warning';
      shouldRetry = false;
    }

    // Wallet Errors
    else if (error.message?.includes('User rejected')) {
      userMessage = 'Transaction rejected in wallet';
      severity = 'info';
      shouldRetry = false;
    } else if (error.message?.includes('MetaMask')) {
      userMessage = 'MetaMask error. Please check your wallet';
      severity = 'error';
      shouldRetry = false;
    }

    // RPC Errors
    else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      userMessage = 'Too many requests. Please wait and try again';
      severity = 'warning';
      shouldRetry = true;
    } else if (error.message?.includes('Internal JSON-RPC error')) {
      userMessage = 'RPC error. Transaction may still succeed';
      severity = 'warning';
      shouldRetry = true;
    }

    // Log to Sentry (exclude user-rejected)
    if (severity === 'error' || (severity === 'warning' && shouldRetry)) {
      Sentry.captureException(error, {
        tags: {
          context,
          errorCode: error.code || 'unknown',
          severity
        },
        extra: {
          userMessage,
          shouldRetry
        }
      });
    }

    return { userMessage, severity, shouldRetry };
  }
}
```

## Retry Logic with Exponential Backoff

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => {
      const { shouldRetry } = Web3ErrorHandler.handle(error, 'retry');
      return shouldRetry;
    }
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage
const balance = await retryWithBackoff(
  () => provider.getBalance(address),
  { maxRetries: 3 }
);
```

## Try-Catch Pattern with Context

```typescript
// ❌ BAD: Silent failure
try {
  await contract.transfer(to, amount);
} catch (error) {
  // Nothing - error is swallowed
}

// ❌ BAD: Generic console.log
try {
  await contract.transfer(to, amount);
} catch (error) {
  console.log(error); // No context
}

// ✅ GOOD: Comprehensive error handling
try {
  const tx = await contract.transfer(to, amount);
  const receipt = await tx.wait();

  console.log('Transfer successful:', receipt.transactionHash);
  return { success: true, txHash: receipt.transactionHash };
} catch (error) {
  const { userMessage, severity, shouldRetry } = Web3ErrorHandler.handle(
    error,
    'transfer'
  );

  // Show user-friendly message
  toast({
    title: severity === 'error' ? 'Error' : 'Warning',
    description: userMessage,
    status: severity,
    duration: 5000
  });

  // Optionally retry
  if (shouldRetry) {
    return await retryWithBackoff(() => contract.transfer(to, amount));
  }

  return { success: false, error: userMessage };
}
```

## Error Boundary for React

```typescript
import { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class Web3ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Web3 Error Boundary caught:', error, errorInfo);

    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack
        }
      }
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-boundary">
            <h2>Something went wrong</h2>
            <p>{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false })}>
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Usage
<Web3ErrorBoundary>
  <YourWeb3Component />
</Web3ErrorBoundary>
```

## Transaction Error Recovery

```typescript
export class TransactionRecovery {
  /**
   * Attempt to recover a failed transaction
   */
  static async recover(error: any, originalTx: any): Promise<any> {
    const { shouldRetry } = Web3ErrorHandler.handle(error, 'transaction');

    if (!shouldRetry) {
      throw error;
    }

    // Check if transaction is actually pending
    if (originalTx.hash) {
      const receipt = await provider.getTransactionReceipt(originalTx.hash);

      if (receipt) {
        console.log('Transaction already mined:', receipt.transactionHash);
        return receipt;
      }
    }

    // Retry with higher gas
    if (error.code === 'REPLACEMENT_UNDERPRICED') {
      console.log('Retrying with higher gas price...');

      const gasPrice = await provider.getGasPrice();
      const newGasPrice = gasPrice.mul(120).div(100); // 20% increase

      return await originalTx.sendTransaction({
        ...originalTx.request,
        gasPrice: newGasPrice
      });
    }

    // Retry with fresh nonce
    if (error.code === 'NONCE_EXPIRED') {
      console.log('Retrying with fresh nonce...');

      const nonce = await provider.getTransactionCount(originalTx.from);

      return await originalTx.sendTransaction({
        ...originalTx.request,
        nonce
      });
    }

    throw error;
  }
}
```

## Graceful Degradation

```typescript
export function useBalanceWithFallback(address: string) {
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'rpc' | 'cache' | 'fallback'>('rpc');

  useEffect(() => {
    let mounted = true;

    const fetchBalance = async () => {
      try {
        // Try primary RPC
        const primaryBalance = await provider.getBalance(address);
        if (mounted) {
          setBalance(ethers.utils.formatEther(primaryBalance));
          setSource('rpc');
        }
      } catch (primaryError) {
        console.warn('Primary RPC failed, trying cache...');

        try {
          // Try cache
          const cachedBalance = await BlockchainCache.getBalance(address);
          if (cachedBalance && mounted) {
            setBalance(cachedBalance);
            setSource('cache');
            return;
          }
        } catch (cacheError) {
          console.warn('Cache failed, trying fallback RPC...');
        }

        try {
          // Try fallback RPC
          const fallbackProvider = new ethers.providers.JsonRpcProvider(
            process.env.NEXT_PUBLIC_FALLBACK_RPC_URL
          );
          const fallbackBalance = await fallbackProvider.getBalance(address);
          if (mounted) {
            setBalance(ethers.utils.formatEther(fallbackBalance));
            setSource('fallback');
          }
        } catch (fallbackError) {
          if (mounted) {
            setError('Unable to fetch balance from any source');
            Sentry.captureException(fallbackError);
          }
        }
      }
    };

    fetchBalance();

    return () => {
      mounted = false;
    };
  }, [address]);

  return { balance, error, source };
}
```

## Logging Best Practices

```typescript
export class Web3Logger {
  static logTransaction(tx: any, status: 'pending' | 'confirmed' | 'failed') {
    const log = {
      timestamp: new Date().toISOString(),
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value?.toString(),
      status,
      gasUsed: tx.gasUsed?.toString(),
      effectiveGasPrice: tx.effectiveGasPrice?.toString()
    };

    console.log(`[TX ${status.toUpperCase()}]`, log);

    // Send to analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'transaction', {
        event_category: 'web3',
        event_label: status,
        value: tx.value?.toString()
      });
    }

    return log;
  }

  static logError(context: string, error: any, metadata: any = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      context,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      metadata
    };

    console.error(`[ERROR: ${context}]`, log);

    // Send to error tracking
    Sentry.captureException(error, {
      tags: { context },
      extra: metadata
    });

    return log;
  }
}
```

## Error Handling Checklist

- [ ] Never use empty catch blocks
- [ ] Always log errors with context
- [ ] Provide user-friendly error messages
- [ ] Report critical errors to Sentry/monitoring
- [ ] Implement retry logic for transient failures
- [ ] Use error boundaries in React
- [ ] Handle wallet connection errors specifically
- [ ] Differentiate between user-rejected and actual errors
- [ ] Implement graceful degradation (fallback RPC)
- [ ] Track error metrics for monitoring
- [ ] Test error scenarios (network failures, rejected transactions)
- [ ] Document expected errors and recovery steps
