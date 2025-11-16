---
name: wallet-manager
description: Securely manage blockchain wallets including key generation, signing, and transaction management across multiple chains
allowed-tools: ["Bash", "Read", "Write", "Edit"]
argument-hint: "wallet operation (create, import, sign, export)"
model: sonnet
---

# Wallet Manager Skill

## Activation Triggers

Activate when the user:
- Wants to create a new wallet
- Needs to import an existing wallet
- Asks about wallet management
- Mentions "private key", "mnemonic", "seed phrase"
- Wants to sign transactions or messages
- Needs HD wallet derivation

## Security-First Approach

⚠️ **CRITICAL SECURITY RULES**:

1. **NEVER display private keys or mnemonics in plain text**
2. **ALWAYS encrypt before storing** (AES-256-GCM)
3. **ALWAYS wipe from memory after use**
4. **NEVER log sensitive data**
5. **WARN about mainnet operations**
6. **REQUIRE confirmation for risky operations**

## Capabilities

- Create new wallets (Ethereum & Solana)
- Import from mnemonic/private key
- HD wallet derivation (BIP-32/44/49/84)
- Sign transactions offline
- Sign messages (EIP-191, EIP-712)
- Multi-signature wallet support
- Hardware wallet integration ready
- Secure key storage with encryption

## Wallet Operations

### 1. Create New Wallet

**User**: "Create a new Ethereum wallet"

**Actions**:
```typescript
import { WalletManager } from './src/subagents/WalletManager';

const walletManager = new WalletManager({
  chain: 'ethereum',
  network: 'sepolia', // Always testnet for demos
});

const wallet = await walletManager.createWallet();
// Returns { address, encryptedKey, mnemonic }
```

**Output**:
```
╔═══════════════════════════════════════════════════╗
║  New Ethereum Wallet Created                      ║
╚═══════════════════════════════════════════════════╝

Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Network: Sepolia Testnet

⚠️  IMPORTANT: Save your seed phrase securely

Seed Phrase (write this down):
witch collapse practice feed shame open despair creek road again ice least

⚠️  This will only be shown ONCE
⚠️  Anyone with this phrase can access your funds
⚠️  Never share it with anyone

Derivation Path: m/44'/60'/0'/0/0
Encrypted: ✓ (stored in ~/.web3-wallet/ethereum.enc)

Next Steps:
→ Save seed phrase in secure location
→ Get testnet ETH from faucet
→ Test with small amounts first
```

### 2. Import Existing Wallet

**User**: "Import wallet from mnemonic"

**Actions**:
```typescript
const mnemonic = await promptSecurely('Enter mnemonic:');

const wallet = await walletManager.importFromMnemonic(mnemonic, {
  derivationPath: "m/44'/60'/0'/0/0"
});
```

**Security checks**:
- Validate mnemonic (BIP-39 wordlist)
- Verify checksum
- Warn if non-standard derivation path
- Encrypt immediately after import

### 3. HD Wallet Derivation

**User**: "Derive 5 addresses from my HD wallet"

**Actions**:
```typescript
import { HDWalletManager } from './src/subagents/HDWalletManager';

const hdWallet = new HDWalletManager(encryptedMnemonic);

for (let i = 0; i < 5; i++) {
  const address = await hdWallet.deriveAddress(i);
  console.log(`Address ${i}: ${address}`);
}
```

**Output**:
```
HD Wallet Addresses (m/44'/60'/0'/0/x):

0: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
1: 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063
2: 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984
3: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
4: 0xdAC17F958D2ee523a2206206994597C13D831ec7

Derivation Path Template: m/44'/60'/0'/0/{index}
```

### 4. Sign Transaction

**User**: "Sign this transaction"

**Actions**:
```typescript
import { TransactionBuilder } from './src/subagents/TransactionBuilder';

// Build transaction
const txBuilder = new TransactionBuilder();
const unsignedTx = await txBuilder.buildTransaction({
  from: wallet.address,
  to: '0xRecipient...',
  value: ethers.parseEther('0.1'),
  chain: 'ethereum',
});

// Sign with wallet
const signedTx = await walletManager.signTransaction(unsignedTx);
```

**Security prompts**:
```
╔═══════════════════════════════════════════════════╗
║  Transaction Signature Request                    ║
╚═══════════════════════════════════════════════════╝

From:     0x742d...f0bEb
To:       0x8f3C...6A063
Value:    0.1 ETH
Network:  Ethereum Sepolia
Gas:      21,000
Fee:      0.000525 ETH

⚠️  Review carefully before signing

Sign this transaction? [y/N]:
```

### 5. Sign Message

**User**: "Sign message: 'Hello Web3'"

**Actions**:
```typescript
// EIP-191 personal message
const signature = await walletManager.signMessage('Hello Web3');

// Or EIP-712 typed data
const typedData = { /* EIP-712 structure */ };
const typedSignature = await walletManager.signTypedData(typedData);
```

## Implementation

### Required Files

- `src/subagents/WalletManager.ts` - Core wallet operations
- `src/subagents/HDWalletManager.ts` - HD wallet derivation
- `src/utils/crypto.ts` - Encryption utilities
- `src/types/wallet.ts` - Type definitions

### Key Management

```typescript
import { encryptPrivateKey, decryptPrivateKey } from './src/utils/crypto';

// Encrypt before storage
const password = await promptSecurely('Enter encryption password:');
const encrypted = await encryptPrivateKey(privateKey, password);

// Store safely
await writeFile('~/.web3-wallet/eth.enc', encrypted);

// Wipe from memory
privateKey = '0'.repeat(64); // Overwrite
```

### Multi-Chain Support

```typescript
// Ethereum
const ethWallet = new WalletManager({ chain: 'ethereum' });

// Solana
const solWallet = new WalletManager({ chain: 'solana' });
// Solana uses ed25519 (different from Ethereum's secp256k1)
```

## Safety Checks

Before ANY sensitive operation:

1. ✓ Verify user understands risks
2. ✓ Confirm network (testnet vs mainnet)
3. ✓ Display transaction details clearly
4. ✓ Require explicit confirmation
5. ✓ Log operation (without sensitive data)
6. ✓ Verify signature before broadcasting

## Error Handling

- **Invalid mnemonic**: "Invalid seed phrase. Please check and try again."
- **Wrong password**: "Incorrect password. X attempts remaining."
- **Insufficient funds**: "Insufficient balance for transaction + gas"
- **Network mismatch**: "Wallet is for Ethereum but transaction is for Polygon"

## Related Skills

- Use `blockchain-query` to check wallet balances
- Use `contract-deploy` when signing deployment transactions
- Use `defi-swap` for token swap signatures
- Use `security-audit` to verify transaction safety
