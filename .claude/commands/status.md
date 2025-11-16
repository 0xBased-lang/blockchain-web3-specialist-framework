---
description: Show system status, network health, and framework component status
---

# System Status

You are now in status check mode. Provide comprehensive system and network status information.

## Task

Display the current status of:
- Framework components
- Blockchain networks
- MCP servers
- Agents and subagents
- Recent operations
- Health metrics

## Status Categories

### 1. Framework Components

```
╔════════════════════════════════════════════╗
║  Framework Status                          ║
╚════════════════════════════════════════════╝

Core Components:
  ✓ TypeScript Runtime (Node.js 18.20.1)
  ✓ Package Manager (pnpm 8.15.0)
  ✓ Dependencies Installed
  ✓ Tests Passing (Coverage: 85%)

MCP Servers:
  ✓ Ethereum MCP Server (Running)
  ✓ Solana MCP Server (Running)
  ✓ Multi-Chain MCP Server (Running)

Agents:
  ✓ Orchestrator Agent (Ready)
  ✓ Base Agent System (Ready)

Subagents:
  ✓ Wallet Manager (Ready)
  ✓ Transaction Builder (Ready)
  ✓ Gas Optimizer (Ready)
  ✓ Contract Analyzer (Ready)
  ✓ Transaction Simulator (Ready)
  ✓ Price Oracle (Ready, 3 sources)
  ✓ Nonce Manager (Ready)
  ✓ HD Wallet Manager (Ready)

Skills:
  ✓ blockchain-query
  ✓ contract-deploy
  ✓ wallet-manager
  ✓ defi-swap
  ✓ nft-mint
  ✓ security-audit

Slash Commands:
  ✓ /debug
  ✓ /deploy
  ✓ /query
  ✓ /analyze
  ✓ /swap
  ✓ /status

Overall Status: ✓ HEALTHY
```

### 2. Network Status

```
╔════════════════════════════════════════════╗
║  Network Status                            ║
╚════════════════════════════════════════════╝

Ethereum Mainnet:
  Status: ✓ Operational
  Block: #18,234,567
  Gas Price: 30 gwei (Standard)
  TPS: 15.2
  RPC Latency: 145ms
  Provider: Infura

Ethereum Sepolia:
  Status: ✓ Operational
  Block: #4,567,890
  Gas Price: 1 gwei
  RPC Latency: 168ms
  Provider: Alchemy

Polygon:
  Status: ✓ Operational
  Block: #48,234,123
  Gas Price: 50 gwei
  TPS: 45.8
  RPC Latency: 132ms

Solana Mainnet:
  Status: ✓ Operational
  Slot: #234,567,890
  TPS: 2,845
  RPC Latency: 98ms
  Provider: Helius

Solana Devnet:
  Status: ✓ Operational
  Slot: #145,678,901
  TPS: 1,234
  RPC Latency: 112ms

All Networks: ✓ OPERATIONAL
```

### 3. Gas Tracker

```
╔════════════════════════════════════════════╗
║  Gas Tracker (Ethereum)                    ║
╚════════════════════════════════════════════╝

Current Gas Prices:
  Slow:     25 gwei (~20 min)
  Standard: 30 gwei (~3 min)
  Fast:     35 gwei (~1 min)
  Urgent:   45 gwei (~15 sec)

Historical (24h):
  Average: 32 gwei
  Peak: 85 gwei (12:00 UTC)
  Low: 18 gwei (04:30 UTC)

Current Status: ✓ NORMAL
Recommendation: Good time to transact
```

### 4. Recent Operations

```
╔════════════════════════════════════════════╗
║  Recent Operations                         ║
╚════════════════════════════════════════════╝

Last 10 operations:

1. [2 min ago] Balance Query
   Address: 0x742d...f0bEb
   Result: 15.234 ETH
   Status: ✓ Success

2. [15 min ago] Contract Analysis
   Contract: MyToken.sol
   Findings: 3 medium, 5 low
   Status: ✓ Complete

3. [1 hour ago] Token Swap
   Route: ETH → USDC
   Amount: 1.0 ETH → 2,485 USDC
   Status: ✓ Success

4. [3 hours ago] Contract Deployment
   Network: Sepolia
   Contract: 0x1234...5678
   Status: ✓ Verified

[View all operations: /operations --all]
```

### 5. Health Metrics

```
╔════════════════════════════════════════════╗
║  Health Metrics                            ║
╚════════════════════════════════════════════╝

Performance:
  Average Query Time: 1.2s
  RPC Success Rate: 99.8%
  Cache Hit Rate: 87%

Resource Usage:
  Memory: 234 MB / 2 GB
  CPU: 12%
  Disk: 1.2 GB

API Limits:
  Alchemy: 3,450 / 100,000 requests (monthly)
  Infura: 1,234 / 100,000 requests (monthly)
  Helius: 567 / 25,000 requests (monthly)

Security:
  Last Audit: 2025-11-15
  Known Issues: 0 critical, 2 low
  Encryption: ✓ AES-256-GCM

Health Score: 98/100 ✓ EXCELLENT
```

### 6. Warnings & Issues

```
╔════════════════════════════════════════════╗
║  Warnings & Issues                         ║
╚════════════════════════════════════════════╝

⚠️ Warnings:
  - Polygon gas prices elevated (2x normal)
  - Approaching API rate limit on Helius (85%)

✓ No Critical Issues

Recommendations:
  → Monitor Polygon gas prices
  → Consider upgrading Helius plan
  → Update to latest ethers.js (6.15.0 → 6.15.1)
```

## Implementation

### Required Files

Check status from:
- `src/mcp-servers/*/index.ts` - Server health
- `src/agents/*.ts` - Agent status
- `src/subagents/*.ts` - Subagent status
- `package.json` - Version info
- `tests/` - Test results

### Status Checks

```typescript
// Check MCP server
async function checkMCPServer(name: string): Promise<boolean> {
  try {
    const server = await import(`./src/mcp-servers/${name}/index.ts`);
    return server.healthCheck ? await server.healthCheck() : true;
  } catch (error) {
    return false;
  }
}

// Check network
async function checkNetwork(chain: string, rpc: string): Promise<NetworkStatus> {
  const provider = new ethers.JsonRpcProvider(rpc);
  const start = Date.now();
  const blockNumber = await provider.getBlockNumber();
  const latency = Date.now() - start;

  return {
    operational: true,
    blockNumber,
    latency,
  };
}
```

## Quick Status

For quick status check:

```bash
/status --quick

Framework: ✓ Healthy
Networks: ✓ All Operational
Recent Ops: 4 success, 0 failed
Health: 98/100
```

## Detailed Status

For full diagnostic:

```bash
/status --detailed

[Full status output with all sections]
```

## Use This Command

- After system startup
- Before major operations
- When troubleshooting issues
- For health monitoring
- In automated checks

Provide actionable insights, not just raw data.
