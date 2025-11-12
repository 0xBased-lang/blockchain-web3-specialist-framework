# Solana Smart Contract Expert Skill

```yaml
---
name: solana-expert
description: Expert knowledge in Solana program development using Rust and Anchor framework, including security patterns, account model best practices, and Solana-specific optimizations
triggers:
  files:
    - "*.rs"
    - "programs/**/*.rs"
    - "Anchor.toml"
  keywords:
    - solana
    - anchor
    - rust program
    - solana program
    - program derived address
    - PDA
    - solana account
dependencies: []
version: 1.0.0
priority: high
token_budget: 800
last_updated: 2025-11-12
---
```

## Core Competencies

This skill provides expert-level knowledge in:

1. **Solana Program Development** (Rust + Anchor)
   - Anchor framework patterns and best practices
   - Account model and ownership
   - Program Derived Addresses (PDAs)

2. **Security for Solana Programs**
   - Common vulnerabilities and mitigations
   - Account validation patterns
   - Signer and owner checks

3. **Performance Optimization**
   - Compute unit optimization
   - Account size optimization
   - Cross-Program Invocation (CPI) patterns

4. **Solana-Specific Concepts**
   - Account model vs EVM storage
   - Rent exemption
   - Transaction size limits

---

## Anchor Framework Best Practices

### Project Structure

```
solana-project/
├── Anchor.toml              # Anchor configuration
├── Cargo.toml               # Rust workspace
├── programs/
│   └── my-program/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs       # Program entrypoint
├── tests/
│   └── my-program.ts        # TypeScript tests
└── migrations/
    └── deploy.ts
```

### Program Structure Pattern

```rust
use anchor_lang::prelude::*;

declare_id!("YourProgramIDHere111111111111111111111111111");

#[program]
pub mod my_program {
    use super::*;

    /// Initialize the program state
    pub fn initialize(ctx: Context<Initialize>, data: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.data = data;
        state.bump = *ctx.bumps.get("state").unwrap();

        msg!("Initialized with data: {}", data);
        Ok(())
    }

    /// Update state (with authorization)
    pub fn update(ctx: Context<Update>, new_data: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;

        // Authorization check
        require!(
            ctx.accounts.authority.key() == state.authority,
            ErrorCode::Unauthorized
        );

        state.data = new_data;
        msg!("Updated data to: {}", new_data);
        Ok(())
    }
}

// Account validation structs
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + State::INIT_SPACE,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, State>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump
    )]
    pub state: Account<'info, State>,

    pub authority: Signer<'info>,
}

// State account structure
#[account]
#[derive(InitSpace)]
pub struct State {
    pub authority: Pubkey,  // 32 bytes
    pub data: u64,          // 8 bytes
    pub bump: u8,           // 1 byte
}

// Custom errors
#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized: caller is not the authority")]
    Unauthorized,

    #[msg("Invalid data: value must be positive")]
    InvalidData,

    #[msg("Account not initialized")]
    NotInitialized,
}
```

---

## Security Patterns & Vulnerability Prevention

### 1. Signer Checks (CRITICAL)

**Vulnerability**: Missing signer verification allows unauthorized access.

**BAD** ❌:
```rust
pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
    // ❌ No check that authority actually signed!
    let from = &mut ctx.accounts.from_account;
    from.balance -= amount;
    // ...
}
```

**GOOD** ✅:
```rust
#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(mut)]
    pub from_account: Account<'info, UserAccount>,

    /// ✅ Signer<'info> ensures this account signed the transaction
    pub authority: Signer<'info>,
}

pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
    let from = &mut ctx.accounts.from_account;

    // ✅ Additional authorization check
    require!(
        ctx.accounts.authority.key() == from.authority,
        ErrorCode::Unauthorized
    );

    from.balance -= amount;
    Ok(())
}
```

---

### 2. Owner Checks

**Vulnerability**: Not verifying account ownership allows wrong program to modify data.

**GOOD** ✅:
```rust
#[derive(Accounts)]
pub struct UpdateData<'info> {
    #[account(
        mut,
        // ✅ Ensures this account is owned by our program
        constraint = data_account.to_account_info().owner == program_id
    )]
    pub data_account: Account<'info, DataAccount>,
}
```

**Even Better** ✅:
```rust
// Anchor's Account<'info, T> automatically checks owner!
#[derive(Accounts)]
pub struct UpdateData<'info> {
    #[account(mut)]
    pub data_account: Account<'info, DataAccount>,  // ✅ Owner checked automatically
}
```

---

### 3. Account Initialization Checks

**Vulnerability**: Reinitialization attacks overwrite existing data.

**BAD** ❌:
```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let state = &mut ctx.accounts.state;
    // ❌ Doesn't check if already initialized
    state.authority = ctx.accounts.authority.key();
    Ok(())
}
```

**GOOD** ✅:
```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,  // ✅ Fails if account already exists
        payer = authority,
        space = 8 + State::INIT_SPACE,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, State>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

---

### 4. PDA Validation

**Program Derived Addresses (PDAs)** are deterministic addresses owned by programs.

**Best Practices**:
```rust
#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault", user.key().as_ref()],  // ✅ Deterministic seed
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// When accessing existing PDA:
#[derive(Accounts)]
pub struct AccessVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump = vault.bump  // ✅ Use stored bump
    )]
    pub vault: Account<'info, Vault>,
    pub user: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub balance: u64,
    pub bump: u8,  // ✅ Store bump for efficient re-derivation
}
```

---

### 5. Arithmetic Overflow Protection

**Rust has overflow checks in debug mode**, but not in release!

**Safe Arithmetic**:
```rust
use anchor_lang::prelude::*;

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    // ✅ Use checked_add (returns Option)
    vault.balance = vault.balance
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    Ok(())
}

// Alternative: Use saturating arithmetic
pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    // ✅ Saturates at u64::MAX instead of wrapping
    vault.balance = vault.balance.saturating_sub(amount);

    Ok(())
}
```

---

### 6. Account Data Validation

**Always validate account data constraints**:

```rust
#[derive(Accounts)]
#[instruction(amount: u64)]  // Access instruction args
pub struct Withdraw<'info> {
    #[account(
        mut,
        constraint = vault.balance >= amount @ ErrorCode::InsufficientFunds,
        constraint = vault.owner == user.key() @ ErrorCode::Unauthorized
    )]
    pub vault: Account<'info, Vault>,

    pub user: Signer<'info>,
}

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let vault = &mut ctx.accounts.vault;
    vault.balance -= amount;  // Safe because constraint checked

    Ok(())
}
```

---

## Solana Account Model Best Practices

### Account Size Calculation

**Always calculate exact space needed**:

```rust
#[account]
#[derive(InitSpace)]  // ✅ Automatically calculates space with InitSpace derive
pub struct UserProfile {
    pub authority: Pubkey,     // 32 bytes
    pub username: String,      // 4 + len (max 32)
    pub avatar_url: String,    // 4 + len (max 200)
    pub created_at: i64,       // 8 bytes
    pub bump: u8,              // 1 byte
}

// Manual calculation (if not using InitSpace):
// space = 8 (discriminator) + 32 + (4 + 32) + (4 + 200) + 8 + 1 = 289 bytes

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + UserProfile::INIT_SPACE,  // ✅ Uses derived space
        seeds = [b"profile", authority.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

---

### Rent Exemption

**All accounts must be rent-exempt** (Solana requirement):

```rust
// Anchor handles rent exemption automatically when using init!
#[account(
    init,
    payer = payer,
    space = 8 + MyAccount::INIT_SPACE  // ✅ Anchor ensures rent exemption
)]
pub my_account: Account<'info, MyAccount>,

// Manual check (rarely needed with Anchor):
pub fn manual_init(ctx: Context<ManualInit>) -> Result<()> {
    let rent = Rent::get()?;
    let space = 8 + MyAccount::INIT_SPACE;

    require!(
        **ctx.accounts.account.lamports.borrow() >= rent.minimum_balance(space),
        ErrorCode::NotRentExempt
    );

    Ok(())
}
```

---

## Cross-Program Invocation (CPI)

**Calling other Solana programs**:

```rust
use anchor_spl::token::{self, Transfer, TokenAccount, Token};

pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
    let cpi_accounts = Transfer {
        from: ctx.accounts.from.to_account_info(),
        to: ctx.accounts.to.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    // ✅ Execute CPI
    token::transfer(cpi_ctx, amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
```

**CPI with PDA Signer** (program signs with its PDA):

```rust
pub fn transfer_with_pda(ctx: Context<TransferWithPDA>, amount: u64) -> Result<()> {
    let bump = ctx.accounts.vault.bump;
    let seeds = &[
        b"vault",
        ctx.accounts.vault.owner.as_ref(),
        &[bump]
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token.to_account_info(),
        to: ctx.accounts.recipient.to_account_info(),
        authority: ctx.accounts.vault.to_account_info(),  // PDA authority
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(
        cpi_program,
        cpi_accounts,
        signer_seeds  // ✅ PDA signs the CPI
    );

    token::transfer(cpi_ctx, amount)?;
    Ok(())
}
```

---

## Performance Optimization

### 1. Compute Unit Optimization

**Solana has compute unit limits** (~200k-1.4M CU per transaction):

```rust
// ✅ Use efficient data structures
#[account]
#[derive(InitSpace)]
pub struct EfficientData {
    pub id: u32,           // Use smallest type needed (u32 vs u64)
    pub flags: u8,         // Bit flags instead of multiple bools
    pub amount: u64,
}

// ❌ Avoid expensive operations in loops
pub fn inefficient(ctx: Context<Process>) -> Result<()> {
    for i in 0..1000 {
        let key = ctx.accounts.data.key();  // ❌ Repeated expensive call
        // process...
    }
    Ok(())
}

// ✅ Cache values outside loops
pub fn efficient(ctx: Context<Process>) -> Result<()> {
    let key = ctx.accounts.data.key();  // ✅ Cache once
    for i in 0..1000 {
        // use key...
    }
    Ok(())
}
```

---

### 2. Account Size Optimization

**Minimize account size** to reduce rent costs:

```rust
// ✅ Use bit flags for booleans
#[account]
pub struct Flags {
    pub flags: u8,  // 8 boolean flags in 1 byte
}

impl Flags {
    const FLAG_ACTIVE: u8 = 1 << 0;
    const FLAG_VERIFIED: u8 = 1 << 1;
    const FLAG_PREMIUM: u8 = 1 << 2;

    pub fn is_active(&self) -> bool {
        self.flags & Self::FLAG_ACTIVE != 0
    }

    pub fn set_active(&mut self, value: bool) {
        if value {
            self.flags |= Self::FLAG_ACTIVE;
        } else {
            self.flags &= !Self::FLAG_ACTIVE;
        }
    }
}
```

---

## Testing Best Practices

**Use Anchor's testing framework**:

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MyProgram } from "../target/types/my_program";
import { assert } from "chai";

describe("my-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MyProgram as Program<MyProgram>;

  it("Initializes state", async () => {
    const [statePDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    await program.methods
      .initialize(new anchor.BN(42))
      .accounts({
        state: statePDA,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const state = await program.account.state.fetch(statePDA);
    assert.equal(state.data.toNumber(), 42);
  });

  it("Fails without authorization", async () => {
    const [statePDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    const unauthorizedUser = anchor.web3.Keypair.generate();

    try {
      await program.methods
        .update(new anchor.BN(100))
        .accounts({
          state: statePDA,
          authority: unauthorizedUser.publicKey,
        })
        .signers([unauthorizedUser])
        .rpc();

      assert.fail("Should have failed with unauthorized error");
    } catch (err) {
      assert.include(err.toString(), "Unauthorized");
    }
  });
});
```

---

## Common Anchor Macros & Attributes

### Account Constraints

```rust
#[account(
    init,                              // Initialize new account
    init_if_needed,                    // Init if doesn't exist
    mut,                               // Account data will be modified
    close = destination,               // Close account, send lamports to destination

    // Size and payer
    payer = payer,
    space = 8 + MyAccount::INIT_SPACE,

    // PDA derivation
    seeds = [b"seed", user.key().as_ref()],
    bump,

    // Constraints
    constraint = account.owner == authority.key() @ ErrorCode::Unauthorized,
    has_one = authority,               // Checks account.authority == authority.key()

    // Account relationships
    realloc = new_size,
    realloc::payer = payer,
    realloc::zero = true,
)]
```

---

## Solana vs EVM: Key Differences

| Aspect | Solana | EVM (Ethereum) |
|--------|--------|----------------|
| **Account Model** | Explicit accounts, programs are stateless | Contract storage, programs are stateful |
| **State** | Stored in accounts (external to program) | Stored in contract's storage slots |
| **Concurrency** | High parallelization | Sequential (mostly) |
| **Transaction Cost** | Fixed fee + compute units | Gas price × gas used |
| **Speed** | ~400ms finality | ~12s block time |
| **Language** | Rust (primarily) | Solidity, Vyper |
| **Deployment** | Programs deployed to specific addresses | Contracts create new addresses |

---

## Security Checklist

Before deploying ANY Solana program:

- [ ] All instructions have signer checks
- [ ] All accounts have owner checks (use `Account<'info, T>`)
- [ ] PDAs use consistent seeds and store bumps
- [ ] Account initialization uses `init` (prevents reinitialization)
- [ ] Arithmetic uses `checked_*` methods
- [ ] Account size calculated correctly for rent exemption
- [ ] Custom errors defined for all failure cases
- [ ] All constraints validated in `#[derive(Accounts)]`
- [ ] CPIs use correct signer seeds
- [ ] Tests cover success and failure paths
- [ ] Compute unit usage within limits

---

## Quick Reference: Common Imports

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use anchor_spl::associated_token::AssociatedToken;

// For timestamp
use anchor_lang::solana_program::clock::Clock;

// For rent calculations
use anchor_lang::solana_program::rent::Rent;
use anchor_lang::system_program::{self, Transfer as SystemTransfer};
```

---

## Activation

This skill activates automatically when:
- Editing `.rs` files in `programs/` directory
- Editing `Anchor.toml` configuration
- Keywords detected: solana, anchor, rust program, PDA, solana account

**Load time**: ~100 tokens (metadata only), ~800 tokens (full content when activated)

---

**Skill Version**: 1.0.0
**Last Updated**: 2025-11-12
**Framework**: Anchor 0.29+
**Maintained By**: BlockchainOrchestra Framework
