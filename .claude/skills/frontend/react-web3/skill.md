# React Web3 Development Skill

```yaml
---
name: react-web3
description: Expert knowledge in building dApp frontends with React, Next.js, wagmi, viem, and modern Web3 integration patterns
triggers:
  files:
    - "*.tsx"
    - "*.jsx"
    - "src/components/**/*"
    - "app/**/*"
  keywords:
    - react
    - nextjs
    - dapp frontend
    - web3 react
    - wagmi
    - viem
    - ethers
dependencies: ["wallet-integration"]
version: 1.0.0
priority: medium
token_budget: 600
last_updated: 2025-11-12
---
```

## Core Stack (2025 Best Practices)

**Modern Web3 Frontend Stack**:
- **Framework**: Next.js 14+ (App Router)
- **React Hooks**: wagmi v2 (Ethereum interaction)
- **Ethereum Library**: viem (TypeScript-first)
- **Wallet Connection**: RainbowKit or ConnectKit
- **State Management**: Zustand or React Context
- **Styling**: TailwindCSS
- **Type Safety**: TypeScript strict mode

---

## Project Structure

```
web3-dapp/
├── app/                      # Next.js 14 App Router
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Home page
│   └── stake/
│       └── page.tsx         # Staking page
├── components/
│   ├── web3/
│   │   ├── ConnectWallet.tsx
│   │   ├── NetworkSwitcher.tsx
│   │   └── TransactionButton.tsx
│   └── staking/
│       ├── StakeForm.tsx
│       └── StakeStats.tsx
├── hooks/
│   ├── useStaking.ts        # Custom contract hooks
│   └── useRewards.ts
├── lib/
│   ├── wagmi-config.ts      # wagmi configuration
│   └── contracts.ts         # Contract ABIs and addresses
└── types/
    └── contracts.ts         # Generated types from ABIs
```

---

## wagmi Configuration

```typescript
// lib/wagmi-config.ts
import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, bsc, avalanche } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, sepolia, bsc, avalanche],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [bsc.id]: http(),
    [avalanche.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
```

---

## Root Layout with Providers

```typescript
// app/layout.tsx
'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { config } from '@/lib/wagmi-config'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              {children}
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  )
}
```

---

## Reading Contract Data

```typescript
// hooks/useStaking.ts
import { useReadContract, useAccount } from 'wagmi'
import { stakingABI } from '@/lib/contracts'

const STAKING_ADDRESS = '0x...' as `0x${string}`

export function useStakingBalance() {
  const { address } = useAccount()

  const { data: balance, isLoading, error } = useReadContract({
    address: STAKING_ADDRESS,
    abi: stakingABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address, // Only fetch when connected
      refetchInterval: 10000, // Refresh every 10s
    },
  })

  return {
    balance: balance || 0n,
    isLoading,
    error,
  }
}

export function useRewards() {
  const { address } = useAccount()

  const { data: rewards } = useReadContract({
    address: STAKING_ADDRESS,
    abi: stakingABI,
    functionName: 'earned',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  })

  return rewards || 0n
}
```

---

## Writing to Contracts

```typescript
// components/staking/StakeForm.tsx
'use client'

import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { stakingABI, tokenABI } from '@/lib/contracts'

const STAKING_ADDRESS = '0x...' as `0x${string}`
const TOKEN_ADDRESS = '0x...' as `0x${string}`

export function StakeForm() {
  const [amount, setAmount] = useState('')

  // Step 1: Approve tokens
  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApproving,
  } = useWriteContract()

  // Step 2: Stake tokens
  const {
    writeContract: stake,
    data: stakeHash,
    isPending: isStaking,
  } = useWriteContract()

  // Wait for approval confirmation
  const { isLoading: isConfirmingApproval } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  // Wait for stake confirmation
  const { isLoading: isConfirmingStake, isSuccess } = useWaitForTransactionReceipt({
    hash: stakeHash,
  })

  const handleApprove = async () => {
    try {
      approve({
        address: TOKEN_ADDRESS,
        abi: tokenABI,
        functionName: 'approve',
        args: [STAKING_ADDRESS, parseEther(amount)],
      })
    } catch (error) {
      console.error('Approval failed:', error)
    }
  }

  const handleStake = async () => {
    try {
      stake({
        address: STAKING_ADDRESS,
        abi: stakingABI,
        functionName: 'stake',
        args: [parseEther(amount)],
      })
    } catch (error) {
      console.error('Staking failed:', error)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount to stake"
        className="w-full px-4 py-2 border rounded"
      />

      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isApproving || isConfirmingApproval || !amount}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {isConfirmingApproval ? 'Approving...' : 'Approve'}
        </button>

        <button
          onClick={handleStake}
          disabled={isStaking || isConfirmingStake || !approveHash}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          {isConfirmingStake ? 'Staking...' : 'Stake'}
        </button>
      </div>

      {isSuccess && (
        <p className="text-green-600">Staking successful!</p>
      )}
    </div>
  )
}
```

---

## Event Listening

```typescript
// hooks/useStakingEvents.ts
import { useWatchContractEvent } from 'wagmi'
import { stakingABI } from '@/lib/contracts'

const STAKING_ADDRESS = '0x...' as `0x${string}`

export function useStakingEvents(userAddress?: `0x${string}`) {
  // Listen for Staked events
  useWatchContractEvent({
    address: STAKING_ADDRESS,
    abi: stakingABI,
    eventName: 'Staked',
    args: userAddress ? { user: userAddress } : undefined,
    onLogs(logs) {
      logs.forEach((log) => {
        console.log('User staked:', log.args.amount)
        // Update UI, show notification, etc.
      })
    },
  })

  // Listen for Withdrawn events
  useWatchContractEvent({
    address: STAKING_ADDRESS,
    abi: stakingABI,
    eventName: 'Withdrawn',
    args: userAddress ? { user: userAddress } : undefined,
    onLogs(logs) {
      logs.forEach((log) => {
        console.log('User withdrew:', log.args.amount)
      })
    },
  })
}
```

---

## Multi-Chain Support

```typescript
// components/web3/NetworkSwitcher.tsx
'use client'

import { useSwitchChain, useChainId } from 'wagmi'
import { mainnet, sepolia, bsc, avalanche } from 'wagmi/chains'

const SUPPORTED_CHAINS = [mainnet, sepolia, bsc, avalanche]

export function NetworkSwitcher() {
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  return (
    <select
      value={chainId}
      onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
      disabled={isPending}
      className="px-4 py-2 border rounded"
    >
      {SUPPORTED_CHAINS.map((chain) => (
        <option key={chain.id} value={chain.id}>
          {chain.name}
        </option>
      ))}
    </select>
  )
}
```

---

## Error Handling

```typescript
// components/web3/TransactionButton.tsx
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { BaseError, ContractFunctionRevertedError } from 'viem'

export function TransactionButton() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // Parse error messages
  const errorMessage = error && (
    error instanceof BaseError
      ? error.shortMessage
      : error instanceof ContractFunctionRevertedError
      ? error.data?.message || 'Transaction reverted'
      : 'Unknown error occurred'
  )

  return (
    <div>
      <button
        onClick={() => writeContract({
          // contract call...
        })}
        disabled={isPending || isConfirming}
      >
        {isPending ? 'Confirming...' :
         isConfirming ? 'Processing...' :
         'Execute Transaction'}
      </button>

      {errorMessage && (
        <p className="text-red-600 mt-2">{errorMessage}</p>
      )}

      {isSuccess && (
        <p className="text-green-600 mt-2">Transaction successful!</p>
      )}
    </div>
  )
}
```

---

## Formatting Values

```typescript
import { formatEther, formatUnits, parseEther } from 'viem'

// Format wei to ether (18 decimals)
const ethValue = formatEther(1000000000000000000n) // "1.0"

// Format custom decimals
const usdcValue = formatUnits(1000000n, 6) // "1.0" (USDC has 6 decimals)

// Parse to wei
const weiValue = parseEther('1.5') // 1500000000000000000n

// Display in components
export function BalanceDisplay({ balance }: { balance: bigint }) {
  return (
    <div>
      Balance: {Number(formatEther(balance)).toFixed(4)} ETH
    </div>
  )
}
```

---

## Best Practices

### 1. **Always Handle Loading States**

```typescript
export function DataDisplay() {
  const { data, isLoading, error } = useReadContract({...})

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!data) return <div>No data</div>

  return <div>Data: {data.toString()}</div>
}
```

### 2. **Use BigInt for Token Amounts**

```typescript
// ❌ BAD: Floating point loses precision
const amount = 1.5 * 10**18

// ✅ GOOD: Use BigInt
const amount = parseEther('1.5')
```

### 3. **Enable Refetch Intervals for Dynamic Data**

```typescript
const { data } = useReadContract({
  // ...
  query: {
    refetchInterval: 10000, // Refresh every 10s
  },
})
```

### 4. **Validate User Input**

```typescript
function StakeInput() {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const handleChange = (value: string) => {
    setAmount(value)

    if (Number(value) <= 0) {
      setError('Amount must be positive')
    } else if (Number(value) > maxStake) {
      setError(`Maximum stake is ${maxStake}`)
    } else {
      setError('')
    }
  }

  return (
    <>
      <input value={amount} onChange={(e) => handleChange(e.target.value)} />
      {error && <p className="text-red-600">{error}</p>}
    </>
  )
}
```

---

## Testing Frontend

```typescript
// __tests__/StakeForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { WagmiProvider } from 'wagmi'
import { StakeForm } from '@/components/staking/StakeForm'
import { config } from '@/lib/wagmi-config'

describe('StakeForm', () => {
  it('disables stake button until approved', () => {
    render(
      <WagmiProvider config={config}>
        <StakeForm />
      </WagmiProvider>
    )

    const stakeButton = screen.getByText('Stake')
    expect(stakeButton).toBeDisabled()
  })

  it('validates amount input', () => {
    render(<StakeForm />)

    const input = screen.getByPlaceholderText('Amount to stake')
    fireEvent.change(input, { target: { value: '-1' } })

    expect(screen.getByText(/must be positive/i)).toBeInTheDocument()
  })
})
```

---

## Activation

This skill activates when:
- Editing `.tsx`, `.jsx` files
- Working in React/Next.js projects
- Keywords: react, nextjs, dapp frontend, web3 react, wagmi

**Token Budget**: ~600 tokens when fully loaded

---

**Skill Version**: 1.0.0
**Stack**: Next.js 14, wagmi v2, viem, RainbowKit
**Last Updated**: 2025-11-12
