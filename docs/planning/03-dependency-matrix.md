# Dependency Matrix - Complete Technology Stack

## Core Dependencies

### Runtime & Language

| Package | Version | Purpose | Critical | License |
|---------|---------|---------|----------|---------|
| Node.js | >= 18.0.0 LTS | Runtime environment | Yes | MIT |
| TypeScript | ^5.3.0 | Type-safe development | Yes | Apache-2.0 |
| pnpm | ^8.0.0 | Package management | Yes | MIT |

### MCP (Model Context Protocol)

| Package | Version | Purpose | Critical | Documentation |
|---------|---------|---------|----------|---------------|
| @modelcontextprotocol/sdk | ^1.0.0 | MCP server/client SDK | Yes | [MCP Docs](https://modelcontextprotocol.io) |
| @anthropic-ai/sdk | ^0.30.0 | Anthropic AI SDK | Yes | [Anthropic Docs](https://docs.anthropic.com) |

### Blockchain - Ethereum

| Package | Version | Purpose | Critical | Documentation |
|---------|---------|---------|----------|---------------|
| ethers | ^6.13.0 | Ethereum interaction library | Yes | [Ethers v6](https://docs.ethers.org/v6/) |
| viem | ^2.21.0 | Type-safe Ethereum library | No | [Viem Docs](https://viem.sh) |
| @chainlink/contracts | ^1.2.0 | Chainlink price feeds | No | [Chainlink](https://docs.chain.link) |

### Blockchain - Solana

| Package | Version | Purpose | Critical | Documentation |
|---------|---------|---------|----------|---------------|
| @solana/web3.js | ^1.95.0 | Solana interaction library | Yes | [Solana Docs](https://solana.com/docs) |
| @solana/spl-token | ^0.4.0 | SPL token standard | No | [SPL Docs](https://spl.solana.com) |
| @metaplex-foundation/js | ^0.20.0 | Metaplex NFTs | No | [Metaplex](https://docs.metaplex.com) |

### Development Tools

| Package | Version | Purpose | Critical | Documentation |
|---------|---------|---------|----------|---------------|
| hardhat | ^2.22.0 | Ethereum development | Yes | [Hardhat Docs](https://hardhat.org/docs) |
| @nomicfoundation/hardhat-toolbox | ^5.0.0 | Hardhat plugin suite | Yes | [Hardhat](https://hardhat.org) |
| @nomiclabs/hardhat-ethers | ^3.0.0 | Ethers.js integration | Yes | [Hardhat](https://hardhat.org) |

### Testing Frameworks

| Package | Version | Purpose | Critical | Documentation |
|---------|---------|---------|----------|---------------|
| vitest | ^2.1.0 | Unit/integration testing | Yes | [Vitest](https://vitest.dev) |
| @vitest/coverage-v8 | ^2.1.0 | Code coverage | Yes | [Vitest](https://vitest.dev/guide/coverage) |
| playwright | ^1.48.0 | E2E testing | No | [Playwright](https://playwright.dev) |
| @testing-library/react | ^16.0.0 | React testing utilities | No | [Testing Library](https://testing-library.com) |

### Code Quality

| Package | Version | Purpose | Critical | Documentation |
|---------|---------|---------|----------|---------------|
| eslint | ^9.0.0 | Code linting | Yes | [ESLint](https://eslint.org) |
| @typescript-eslint/parser | ^8.0.0 | TypeScript ESLint | Yes | [TypeScript ESLint](https://typescript-eslint.io) |
| prettier | ^3.3.0 | Code formatting | Yes | [Prettier](https://prettier.io) |
| eslint-config-prettier | ^9.1.0 | ESLint/Prettier integration | Yes | [GitHub](https://github.com/prettier/eslint-config-prettier) |

### Security Tools

| Package | Version | Purpose | Critical | Documentation |
|---------|---------|---------|----------|---------------|
| slither | latest | Solidity static analysis | Yes | [Slither](https://github.com/crytic/slither) |
| mythril | latest | Symbolic execution | No | [Mythril](https://github.com/ConsenSys/mythril) |
| @openzeppelin/contracts | ^5.0.0 | Secure contract templates | Yes | [OpenZeppelin](https://docs.openzeppelin.com) |

### Utilities

| Package | Version | Purpose | Critical | Documentation |
|---------|---------|---------|----------|---------------|
| zod | ^3.23.0 | Runtime type validation | Yes | [Zod](https://zod.dev) |
| dotenv | ^16.4.0 | Environment management | Yes | [dotenv](https://github.com/motdotla/dotenv) |
| winston | ^3.14.0 | Logging framework | Yes | [Winston](https://github.com/winstonjs/winston) |
| ioredis | ^5.4.0 | Redis client (caching) | No | [ioredis](https://github.com/redis/ioredis) |
| axios | ^1.7.0 | HTTP client | Yes | [Axios](https://axios-http.com) |
| p-limit | ^6.1.0 | Concurrency control | No | [p-limit](https://github.com/sindresorhus/p-limit) |
| p-retry | ^6.2.0 | Retry logic | Yes | [p-retry](https://github.com/sindresorhus/p-retry) |

### Build Tools

| Package | Version | Purpose | Critical | Documentation |
|---------|---------|---------|----------|---------------|
| tsup | ^8.3.0 | TypeScript bundler | Yes | [tsup](https://tsup.egoist.dev) |
| esbuild | ^0.24.0 | Fast bundler | Yes | [esbuild](https://esbuild.github.io) |
| tsx | ^4.19.0 | TypeScript execution | Yes | [tsx](https://github.com/privatenumber/tsx) |

## External Services Dependencies

### RPC Providers (Blockchain Access)

| Service | Purpose | Pricing | Documentation |
|---------|---------|---------|---------------|
| Alchemy | Ethereum/Polygon RPC | Free tier: 300M compute units/month | [Alchemy](https://docs.alchemy.com) |
| Infura | Multi-chain RPC | Free tier: 100K requests/day | [Infura](https://docs.infura.io) |
| QuickNode | Multi-chain RPC | Free tier: Limited | [QuickNode](https://www.quicknode.com/docs) |
| Helius | Solana RPC | Free tier: 100 requests/sec | [Helius](https://docs.helius.dev) |

### Data & Analytics

| Service | Purpose | Pricing | Documentation |
|---------|---------|---------|---------------|
| The Graph | Blockchain data indexing | Free tier available | [The Graph](https://thegraph.com/docs) |
| Etherscan | Ethereum blockchain explorer | Free API | [Etherscan](https://docs.etherscan.io) |
| CoinGecko | Token price data | Free tier | [CoinGecko](https://www.coingecko.com/api/documentation) |

### Security Services

| Service | Purpose | Pricing | Documentation |
|---------|---------|---------|---------------|
| Tenderly | Transaction simulation | Free tier | [Tenderly](https://docs.tenderly.co) |
| Forta | Runtime security monitoring | Free tier | [Forta](https://docs.forta.network) |

## Development Environment Dependencies

### Required System Tools

```bash
# Node.js (LTS version)
node >= 18.0.0

# Package manager
pnpm >= 8.0.0

# Git
git >= 2.30.0

# Python (for Slither)
python >= 3.8.0

# Solidity compiler (for Hardhat)
solc (managed by Hardhat)
```

### Optional Tools

```bash
# Docker (for local blockchain nodes)
docker >= 20.10.0

# Redis (for caching)
redis >= 7.0.0

# PostgreSQL (for analytics)
postgresql >= 14.0
```

## Version Compatibility Matrix

### Node.js Compatibility

| Package | Node 18 | Node 20 | Node 22 |
|---------|---------|---------|---------|
| ethers v6 | ✅ | ✅ | ✅ |
| @solana/web3.js | ✅ | ✅ | ⚠️ (untested) |
| vitest | ✅ | ✅ | ✅ |
| hardhat | ✅ | ✅ | ✅ |

### TypeScript Compatibility

| Package | TS 5.2 | TS 5.3 | TS 5.4+ |
|---------|--------|--------|---------|
| ethers v6 | ✅ | ✅ | ✅ |
| viem | ✅ | ✅ | ✅ |
| @modelcontextprotocol/sdk | ✅ | ✅ | ✅ |

## Package Manager Lock Files

```
# Use pnpm for consistency
pnpm-lock.yaml   ✅ (committed)
package-lock.json ❌ (not used)
yarn.lock         ❌ (not used)
```

## Dependency Update Strategy

### Critical Packages (Review Monthly)

- `ethers` - Security patches
- @solana/web3.js (npm package) - Protocol updates
- `@modelcontextprotocol/sdk` - Breaking changes
- Security tools (slither, mythril)

### Standard Packages (Review Quarterly)

- Testing frameworks
- Build tools
- Code quality tools

### Pinned Versions (No Auto-Update)

- `hardhat` - Breaking changes require code updates
- `@openzeppelin/contracts` - Security-critical

## Vulnerability Monitoring

### Tools

```bash
# npm audit
pnpm audit

# Snyk
snyk test

# GitHub Dependabot
# Configured in .github/dependabot.yml
```

### Update Process

1. Check `pnpm outdated` weekly
2. Review changelogs for breaking changes
3. Update dev dependencies first
4. Test thoroughly before updating production deps
5. Update one major version at a time

## Installation Commands

### Complete Installation

```bash
# Install all dependencies
pnpm install

# Install global tools
pnpm add -g pnpm typescript tsx

# Install Python tools (for security)
pip3 install slither-analyzer mythril
```

### Selective Installation

```bash
# Core only
pnpm install --prod

# With dev dependencies
pnpm install

# With optional dependencies
pnpm install --optional
```

## Dependency Conflicts & Resolutions

### Known Conflicts

```json
{
  "overrides": {
    // Force specific versions if conflicts arise
    "@types/node": "^20.0.0"
  }
}
```

## License Compliance

### License Summary

- **MIT**: 85% of dependencies
- **Apache-2.0**: 10% of dependencies
- **ISC**: 3% of dependencies
- **BSD**: 2% of dependencies

### Commercial Use

✅ All dependencies are compatible with commercial use

### Attribution Required

See `LICENSES.md` (to be generated) for complete attribution list

## Performance Considerations

### Bundle Size Impact

| Category | Estimated Size | Critical |
|----------|---------------|----------|
| Core framework | ~500 KB | - |
| Ethereum deps | ~800 KB | Yes |
| Solana deps | ~600 KB | Yes |
| Testing deps | ~2 MB | Dev only |
| Total (prod) | ~1.9 MB | - |

### Load Time Optimization

```typescript
// Use dynamic imports for optional features
const solana = await import('@solana/web3.js');

// Tree-shake unused code
import { Contract } from 'ethers'; // Not: import * as ethers from 'ethers';
```

## Deprecation Warnings

### Current Deprecations

None identified as of 2025-11-14

### Planned Migrations

- Consider migrating from `axios` to `fetch` (native) in future
- Monitor `ethers` v7 development

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-14
**Next Review**: 2025-12-14
