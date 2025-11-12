# Wallet Integration Skill

```yaml
---
name: wallet-integration
description: Expert patterns for wallet connection, authentication, multi-wallet support, and wallet UX best practices using RainbowKit and ConnectKit
triggers:
  keywords:
    - wallet connect
    - metamask
    - wallet integration
    - connect wallet
    - rainbow kit
dependencies: []
version: 1.0.0
priority: medium
token_budget: 400
last_updated: 2025-11-12
---
```

## Wallet Connection Libraries

**RainbowKit** (Recommended for most use cases):
- Beautiful pre-built UI
- Supports 100+ wallets
- Auto-detects installed wallets
- Mobile wallet support via WalletConnect

**ConnectKit** (Alternative, similar features):
- Clean minimal design
- Customizable themes
- Good TypeScript support

---

## RainbowKit Setup

```bash
npm install @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
```

```typescript
// lib/wagmi-config.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, sepolia, bsc, polygon } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'My dApp',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  chains: [mainnet, sepolia, bsc, polygon],
  ssr: true, // For Next.js
})
```

```typescript
// app/layout.tsx
'use client'

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/lib/wagmi-config'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

---

## Connect Button

```typescript
// components/ConnectWallet.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function ConnectWallet() {
  return (
    <ConnectButton
      chainStatus="icon"
      showBalance={true}
      accountStatus="address"
    />
  )
}

// Custom connect button
export function CustomConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && chain

        return (
          <div>
            {!connected ? (
              <button onClick={openConnectModal}>
                Connect Wallet
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={openChainModal}>
                  {chain.name}
                </button>
                <button onClick={openAccountModal}>
                  {account.displayName}
                </button>
              </div>
            )}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
```

---

## Wallet State Management

```typescript
// hooks/useWallet.ts
import { useAccount, useDisconnect, useEnsName, useEnsAvatar } from 'wagmi'

export function useWallet() {
  const { address, isConnected, isConnecting, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: ensName } = useEnsName({ address })
  const { data: ensAvatar } = useEnsAvatar({ name: ensName ?? undefined })

  return {
    address,
    ensName,
    ensAvatar,
    isConnected,
    isConnecting,
    chain,
    disconnect,
  }
}

// Usage in components
export function WalletInfo() {
  const { address, ensName, isConnected } = useWallet()

  if (!isConnected) return <p>Not connected</p>

  return (
    <div>
      <p>Address: {address}</p>
      {ensName && <p>ENS: {ensName}</p>}
    </div>
  )
}
```

---

## Sign Messages (Authentication)

```typescript
// hooks/useAuth.ts
import { useSignMessage, useAccount } from 'wagmi'
import { SiweMessage } from 'siwe'

export function useAuth() {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const login = async () => {
    if (!address) throw new Error('No wallet connected')

    // Create SIWE message
    const message = new SiweMessage({
      domain: window.location.host,
      address,
      statement: 'Sign in to My dApp',
      uri: window.location.origin,
      version: '1',
      chainId: 1,
      nonce: await fetchNonce(), // Get nonce from backend
    })

    // Sign message
    const signature = await signMessageAsync({
      message: message.prepareMessage(),
    })

    // Verify on backend
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature }),
    })

    if (!response.ok) throw new Error('Authentication failed')

    const { token } = await response.json()
    return token
  }

  return { login }
}

async function fetchNonce(): Promise<string> {
  const response = await fetch('/api/auth/nonce')
  const { nonce } = await response.json()
  return nonce
}
```

---

## Mobile Wallet Support

**WalletConnect automatically handles mobile wallets:**

```typescript
// Redirect to wallet app on mobile
import { useConnect } from 'wagmi'

export function MobileWalletConnect() {
  const { connectors, connect } = useConnect()

  return (
    <div>
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
        >
          {connector.name}
        </button>
      ))}
    </div>
  )
}
```

**Deep linking for mobile apps:**

```typescript
// Detect mobile and redirect to wallet
export function openWalletApp(uri: string) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  if (isMobile) {
    // MetaMask deep link
    window.location.href = `metamask://wc?uri=${encodeURIComponent(uri)}`

    // Or use universal link
    window.location.href = `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`
  }
}
```

---

## Multi-Wallet Testing

```typescript
// hooks/useWalletDetection.ts
export function useWalletDetection() {
  const hasMetaMask = typeof window !== 'undefined' && window.ethereum?.isMetaMask
  const hasCoinbase = typeof window !== 'undefined' && window.ethereum?.isCoinbaseWallet
  const hasRabby = typeof window !== 'undefined' && window.ethereum?.isRabby

  return {
    hasMetaMask,
    hasCoinbase,
    hasRabby,
    hasAnyWallet: hasMetaMask || hasCoinbase || hasRabby,
  }
}

// Prompt installation if no wallet
export function WalletPrompt() {
  const { hasAnyWallet } = useWalletDetection()

  if (hasAnyWallet) return null

  return (
    <div className="bg-yellow-100 p-4 rounded">
      <p>No wallet detected. Please install:</p>
      <ul>
        <li><a href="https://metamask.io" target="_blank">MetaMask</a></li>
        <li><a href="https://www.coinbase.com/wallet" target="_blank">Coinbase Wallet</a></li>
      </ul>
    </div>
  )
}
```

---

## Best Practices

### 1. **Always Check Connection Before Transactions**

```typescript
function StakeButton() {
  const { isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()

  if (!isConnected) {
    return <button onClick={openConnectModal}>Connect to Stake</button>
  }

  return <button onClick={handleStake}>Stake Tokens</button>
}
```

### 2. **Handle Network Switching**

```typescript
import { useSwitchChain } from 'wagmi'
import { mainnet } from 'wagmi/chains'

export function EnsureMainnet({ children }: { children: React.ReactNode }) {
  const { chain } = useAccount()
  const { switchChain } = useSwitchChain()

  if (chain?.id !== mainnet.id) {
    return (
      <div>
        <p>Please switch to Ethereum Mainnet</p>
        <button onClick={() => switchChain({ chainId: mainnet.id })}>
          Switch Network
        </button>
      </div>
    )
  }

  return <>{children}</>
}
```

### 3. **Graceful Disconnection**

```typescript
export function DisconnectButton() {
  const { disconnect } = useDisconnect()

  const handleDisconnect = async () => {
    // Clear local state
    localStorage.removeItem('authToken')

    // Disconnect wallet
    disconnect()

    // Redirect
    window.location.href = '/'
  }

  return <button onClick={handleDisconnect}>Disconnect</button>
}
```

### 4. **Wallet Icons/Branding**

```typescript
import Image from 'next/image'

const WALLET_ICONS: Record<string, string> = {
  metamask: '/icons/metamask.svg',
  walletconnect: '/icons/walletconnect.svg',
  coinbase: '/icons/coinbase.svg',
}

export function WalletIcon({ walletId }: { walletId: string }) {
  return (
    <Image
      src={WALLET_ICONS[walletId] || '/icons/default.svg'}
      alt={walletId}
      width={24}
      height={24}
    />
  )
}
```

---

## Security Considerations

### 1. **Never Store Private Keys**

```typescript
// ❌ NEVER do this
const privateKey = '0x...'

// ✅ Let wallet manage keys
const { signMessage } = useSignMessage()
```

### 2. **Validate Signatures Server-Side**

```typescript
// Backend (Next.js API route)
import { verifyMessage } from 'viem'

export async function POST(req: Request) {
  const { message, signature, address } = await req.json()

  const isValid = await verifyMessage({
    address,
    message,
    signature,
  })

  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Generate session token
  const token = generateJWT(address)
  return Response.json({ token })
}
```

### 3. **Use SIWE for Authentication**

```bash
npm install siwe
```

```typescript
// Secure authentication with Sign-In With Ethereum
import { SiweMessage } from 'siwe'

const message = new SiweMessage({
  domain: window.location.host,
  address,
  statement: 'Sign in to My dApp',
  uri: window.location.origin,
  version: '1',
  chainId: 1,
  nonce: await fetchNonce(), // Prevent replay attacks
  issuedAt: new Date().toISOString(),
  expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
})
```

---

## Activation

This skill loads when:
- Keywords: wallet connect, metamask, connect wallet, rainbow kit
- Working on authentication or wallet UI

**Token Budget**: ~400 tokens

---

**Skill Version**: 1.0.0
**Libraries**: RainbowKit, WalletConnect v2, SIWE
**Last Updated**: 2025-11-12
