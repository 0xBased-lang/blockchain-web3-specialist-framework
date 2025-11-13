# Tenderly Free Tier Capabilities & Integration Research

**Research Date**: November 2025
**Subject**: Tenderly debugging platform for blockchain/Web3 development

---

## Executive Summary

Tenderly is a full-stack Web3 development platform offering transaction simulation, debugging, monitoring, and node infrastructure. The free tier provides **25 million Tenderly Units (TU) per month**, which translates to approximately **62,500 API simulations** or **2,083 simulations per day** - more than double Alchemy's free tier (1,000/day).

**Key Verdict**: Tenderly's free tier is **viable for small to medium development projects** with reasonable simulation needs, but may require paid upgrade for production-scale applications or CI/CD pipelines with heavy usage.

---

## 1. FREE TIER LIMITATIONS

### 1.1 Monthly Quota
| Resource | Free Tier Allocation |
|----------|---------------------|
| **Tenderly Units (TU)** | 25 million/month |
| **Simulations (calculated)** | ~62,500/month (~2,083/day) |
| **Rate Limit** | 60 simulations/min |
| **TU per Simulation** | 400 TU |

### 1.2 Included Features (Free Tier)
✅ **Core Features Available**:
- Transaction simulation (single & bundled)
- Visual Debugger
- Forks (network forking for testing)
- Transaction Overview (state changes, decoded events, token transfers)
- Advanced Trace Search
- Tenderly Web3 Gateway (Free tier)
- All RPC endpoints
- Gas Profiler
- Contract verification

### 1.3 Rate Limits by Tier

| Feature | Free/Starter | Pro | Notes |
|---------|--------------|-----|-------|
| **Simulations/min** | 60 | 100 | Rate limit per minute |
| **Monthly TU** | 25M | 350M | Total monthly quota |
| **TU per second** | Not specified | 300 | Throughput limit |
| **Virtual TestNet (write)** | 2,000 TU/tx | 2,000 TU/tx | Same cost across tiers |

### 1.4 What Requires Paid Subscription

⚠️ **Paid Features/Higher Limits**:
- Higher TU quota (350M+ for Pro)
- Increased simulation rate (100/min for Pro)
- Higher TU/second throughput (300 for Pro)
- Custom limit increases (contact support)
- Advanced team collaboration features
- Priority support

### 1.5 API Rate Limits

**Free Tier Rate Limits**:
- ✅ **Simulations**: 60/min
- ✅ **Each simulation costs**: 400 TU
- ✅ **Virtual TestNet writes**: 2,000 TU per transaction
- ⚠️ **Overall TU/second limit**: Not explicitly documented for free tier
- ✅ **Web3 Actions**: 100 executions per 5 minutes per action (10 actions max per project)

**Important Notes**:
- All requests consume TU based on complexity
- Requests divided into 4 categories with different TU consumption
- Monthly quota resets each billing cycle
- No unauthenticated/public endpoints (all require API access token)

---

## 2. CORE FEATURES FOR DEBUGGING

### 2.1 Transaction Simulation API

**Capabilities**:
- ✅ Single transaction simulation
- ✅ Bundled transaction simulation (multiple consecutive transactions)
- ✅ State overrides (modify timestamps, balances, contract data)
- ✅ Asset and balance change tracking with dollar values
- ✅ 100% accurate gas usage prediction
- ✅ Support for 90+ EVM chains and Layer 2s

**Key Features**:
- All addresses unlocked by default in simulations
- Decoded transaction traces
- Storage modifications tracking
- Error detection before sending transactions

**API Methods**:
- REST: `POST /simulate` - Single transaction
- REST: `POST /simulate-bundle` - Multiple transactions
- RPC: `tenderly_simulateTransaction` - Via Web3 Gateway
- RPC: `tenderly_simulateBundle` - Bundle simulation via RPC

**Simulation Cost**:
- Each API call: **400 TU**
- Identical payloads still cost 400 TU each time

### 2.2 Fork Creation for Testing

**Features**:
- Fork any Tenderly-supported network
- Create forks programmatically via API
- Specify exact block number for fork point
- Receive test accounts pre-loaded in fork
- RPC URL for fork: `https://rpc.tenderly.co/fork/{forkId}`

**API Endpoint**:
```
POST https://api.tenderly.co/api/v1/account/{ACCOUNT_SLUG}/project/{PROJECT_SLUG}/fork
```

**Required Parameters**:
- `network_id`: Network to fork (e.g., '1' for Ethereum mainnet)
- `block_number`: Specific block to fork from

**Response Includes**:
- Fork ID
- RPC URL
- Test accounts with pre-loaded balances

**Important**: Tenderly now recommends **Virtual TestNets** over Forks for new projects. Virtual TestNets offer:
- Continuous synchronization with production data
- Unlimited faucet (native + ERC-20 tokens)
- Publicly shareable block explorer
- Better CI/CD integration

### 2.3 Monitoring and Alerts

**Alert Types** (12 triggers available):
- ✅ Successful/unsuccessful transactions
- ✅ Emitted events
- ✅ Function calls
- ✅ Balance changes
- ✅ State changes
- ✅ Token transfers
- ✅ Custom complex conditions (multiple rules combined)

**Alert Destinations**:
- Email
- Slack
- Discord
- Telegram
- PagerDuty
- Webhooks (custom endpoints)
- Web3 Actions (custom code execution)

**Webhooks Requirements**:
- Must expose GET endpoint (returns HTTP 200 for verification)
- Must expose POST endpoint (5-second timeout)
- Receives JSON payload with alert data

**Webhook Payload Structure**:
```json
{
  "id": "UUID",
  "event_type": "TEST | ALERT",
  "transaction": { /* transaction object */ }
}
```

**Alerts API**:
- Create simple alerts (single rule)
- Create complex alerts (multiple conditions)
- Project-scoped webhooks

### 2.4 Debugging and Tracing

**Visual Debugger Features**:
- ✅ Step-through stack trace execution
- ✅ Opcode-level inspection
- ✅ Function call visualization
- ✅ Gas usage per function/opcode
- ✅ Local and global variable inspection
- ✅ Human-readable complex expression decoding
- ✅ One-click jump to revert locations
- ✅ Storage access visibility
- ✅ Event logs in execution trace

**Decoded Call Trace**:
- JUMP, CALL, DELEGATECALL, STATICCALL
- CREATE, CREATE2
- REVERT, JUMPDEST
- SLOAD, SSTORE (storage operations)

**Advanced Features**:
- Decode unverified contracts using 4-byte directory
- 3x improved visibility with granular execution view
- Storage and event functions in trace

**Transaction Overview Provides**:
- General transaction information
- Decoded call trace
- Tokens transferred
- Contracts involved
- State changes
- Emitted events
- Gas consumption breakdown

### 2.5 Gas Profiling

**Gas Profiler Capabilities**:
- ✅ Interactive flame chart visualization
- ✅ Gas breakdown by function
- ✅ Gas breakdown by opcode
- ✅ Internal transaction gas tracking
- ✅ Storage operation costs
- ✅ Event emission costs
- ✅ Identify optimization opportunities

**Visual Output**:
- Flame chart showing hierarchical gas consumption
- Function-level gas metrics
- Opcode-level gas metrics
- Clear patterns for gas optimization

**Use Cases**:
- Optimize expensive functions
- Identify gas-heavy operations
- Compare implementation alternatives
- Validate gas improvements

---

## 3. API INTEGRATION

### 3.1 Authentication Methods

**Access Token Generation**:

**For Personal Accounts**:
1. Go to Settings → Authorization
2. Click "Create Access Token"
3. Copy token (displayed only once!)
4. Store securely (e.g., environment variable)

**For Organizations**:
1. Select organization
2. Go to Access Tokens tab
3. Click "New Access Token"
4. Add label and generate
5. Copy and store securely

**Using Access Tokens**:
- **REST API**: Send via `X-Access-Key` HTTP header
- **RPC URL**: Automatically appended to URL
- **CLI**: Use `--access-key` flag during login

**CLI Authentication**:
```bash
tenderly login --authentication-method access-key \
  --access-key {your_access_key} --force
```

**Environment Variables**:
```bash
TENDERLY_ACCESS_KEY=your_access_token
TENDERLY_ACCOUNT_NAME=your_account
TENDERLY_PROJECT_NAME=your_project
```

### 3.2 Simulate Transactions Programmatically

**REST API Example**:
```bash
curl https://api.tenderly.co/api/v1/account/{ACCOUNT}/project/{PROJECT}/simulate \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Access-Key: YOUR_ACCESS_TOKEN" \
  -d '{
    "network_id": "1",
    "from": "0x...",
    "to": "0x...",
    "input": "0x...",
    "gas": 21000,
    "gas_price": "0",
    "value": "0",
    "save": true,
    "save_if_fails": true,
    "simulation_type": "full"
  }'
```

**Using Tenderly SDK (TypeScript/JavaScript)**:

**Installation**:
```bash
npm install @tenderly/sdk
```

**Basic Setup**:
```typescript
import { Tenderly, Network } from '@tenderly/sdk';

const tenderly = new Tenderly({
  accessKey: process.env.TENDERLY_ACCESS_KEY,
  accountName: process.env.TENDERLY_ACCOUNT_NAME,
  projectName: process.env.TENDERLY_PROJECT_NAME,
  network: Network.MAINNET,
});

// Simulate transaction
const simulation = await tenderly.simulator.simulateTransaction({
  from: '0x...',
  to: '0x...',
  input: '0x...',
  gas: 21000,
  gasPrice: '0',
  value: '0',
});

console.log('Gas used:', simulation.transaction.gas_used);
console.log('Success:', simulation.transaction.status);
```

**Bundle Simulation**:
```typescript
const bundleSimulation = await tenderly.simulator.simulateBundle({
  transactions: [
    { from: '0x...', to: '0x...', input: '0x...', ... },
    { from: '0x...', to: '0x...', input: '0x...', ... },
  ],
  blockNumber: 12345678, // Optional: specific block
});
```

**RPC Method (via Web3 Gateway)**:
```javascript
const Web3 = require('web3');
const web3 = new Web3('https://rpc.tenderly.co/fork/{FORK_ID}');

const result = await web3.currentProvider.send({
  jsonrpc: '2.0',
  method: 'tenderly_simulateTransaction',
  params: [{
    from: '0x...',
    to: '0x...',
    data: '0x...',
  }],
  id: 1,
});
```

### 3.3 Create Forks for Testing

**API Method**:
```bash
curl https://api.tenderly.co/api/v1/account/{ACCOUNT}/project/{PROJECT}/fork \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Access-Key: YOUR_ACCESS_TOKEN" \
  -d '{
    "network_id": "1",
    "block_number": 12345678
  }'
```

**SDK Example**:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.tenderly.co/api/v1',
  headers: {
    'X-Access-Key': process.env.TENDERLY_ACCESS_KEY,
    'Content-Type': 'application/json',
  },
});

const forkResponse = await api.post(
  `account/${accountSlug}/project/${projectSlug}/fork`,
  {
    network_id: '1',
    block_number: 12345678,
  }
);

const forkId = forkResponse.data.root_transaction.fork_id;
const rpcUrl = `https://rpc.tenderly.co/fork/${forkId}`;
const testAccounts = forkResponse.data.simulation_fork.accounts;

console.log('Fork RPC:', rpcUrl);
console.log('Test accounts:', testAccounts);
```

**Using Virtual TestNets (Recommended)**:
Virtual TestNets are the newer, recommended approach:
- More features than forks
- Better CI/CD integration
- Publicly shareable
- Continuous sync with mainnet

### 3.4 Monitor Smart Contract Events

**Creating Alerts via API**:

**Simple Alert (single condition)**:
```bash
curl https://api.tenderly.co/api/v1/account/{ACCOUNT}/project/{PROJECT}/alerts \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Access-Key: YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Transfer Event Monitor",
    "network": "1",
    "alert_type": "event",
    "event_signature": "Transfer(address,address,uint256)",
    "contract_address": "0x...",
    "enabled": true,
    "destinations": ["email", "webhook"]
  }'
```

**Complex Alert (multiple conditions)**:
```json
{
  "name": "Complex Alert",
  "network": "1",
  "rules": [
    {
      "type": "method_call",
      "method_signature": "transfer(address,uint256)"
    },
    {
      "type": "state_change",
      "storage_slot": "0x0"
    }
  ],
  "enabled": true
}
```

**Webhook Integration**:
```javascript
// Express.js webhook receiver
app.get('/tenderly-webhook', (req, res) => {
  // Verification endpoint
  res.status(200).send('OK');
});

app.post('/tenderly-webhook', (req, res) => {
  const { id, event_type, transaction } = req.body;

  if (event_type === 'ALERT') {
    console.log('Alert triggered:', transaction);
    // Process alert
  }

  res.status(200).send('OK');
});
```

**Web3 Actions for Custom Logic**:
Web3 Actions allow you to run custom JavaScript/TypeScript code when events occur:
```typescript
// Example Web3 Action
import { ActionFn, Context, Event } from '@tenderly/actions';

export const onTransfer: ActionFn = async (context: Context, event: Event) => {
  const { from, to, value } = event.params;

  console.log(`Transfer: ${from} -> ${to}: ${value}`);

  // Custom logic: send to Discord, update database, etc.
  if (value > threshold) {
    await notifyLargeTransfer(from, to, value);
  }
};
```

### 3.5 Retrieve Transaction Traces

**Via Dashboard**:
1. Search transaction hash
2. View decoded trace in UI
3. Access debugger, gas profiler, state changes

**Via API**:
```bash
curl https://api.tenderly.co/api/v1/account/{ACCOUNT}/project/{PROJECT}/transactions/{TRANSACTION_ID} \
  -H "X-Access-Key: YOUR_ACCESS_TOKEN"
```

**Response includes**:
- Full execution trace
- Decoded function calls
- Gas usage breakdown
- State changes
- Event logs
- Error details (if reverted)

**SDK Example**:
```typescript
const transaction = await tenderly.getTransaction({
  network: Network.MAINNET,
  hash: '0x...',
});

console.log('Trace:', transaction.trace);
console.log('Gas used:', transaction.gas_used);
console.log('State changes:', transaction.state_changes);
```

---

## 4. CLI TOOLS

### 4.1 Tenderly CLI Installation

**Linux/macOS**:
```bash
curl https://raw.githubusercontent.com/Tenderly/tenderly-cli/master/scripts/install-linux.sh | sudo sh
```

**Alternative: Manual Installation**:
1. Download from [tenderly-cli releases](https://github.com/Tenderly/tenderly-cli/releases)
2. Add to `$PATH`

**Verify Installation**:
```bash
tenderly version
```

### 4.2 CLI Authentication

```bash
# Using access key (recommended)
tenderly login --authentication-method access-key \
  --access-key YOUR_ACCESS_KEY --force

# Using email/password
tenderly login --authentication-method email \
  --email your@email.com --password yourpassword
```

### 4.3 CLI Commands Cheatsheet

**Project Management**:
```bash
# Initialize project
tenderly init

# Export contract (verify)
tenderly export {contract_address} --network {network_id}

# Push contracts
tenderly push
```

**Web3 Actions**:
```bash
# Initialize Web3 Actions
tenderly actions init

# Deploy Web3 Action
tenderly actions deploy

# List actions
tenderly actions list

# View logs
tenderly actions logs {action_id}
```

**Contract Verification**:
```bash
# Verify contract
tenderly verify {contract_address} \
  --network {network_id} \
  --compiler-version {version}
```

### 4.4 Development Workflow Integration

**Typical Workflow**:
1. **Setup**: `tenderly init` in project directory
2. **Deploy contracts**: Using Hardhat/Foundry
3. **Verify**: Automatic verification via plugin or CLI
4. **Monitor**: Set up alerts for critical events
5. **Debug**: Use dashboard/API for failed transactions
6. **Test**: Use forks/Virtual TestNets for testing

**Configuration Files**:

**tenderly.yaml** (project configuration):
```yaml
account_id: your-account
project_slug: your-project
contracts:
  - address: "0x..."
    name: "MyContract"
    network_id: "1"
```

**For Web3 Actions (.tenderly/actions.yaml)**:
```yaml
account_id: your-account
actions:
  my-action:
    runtime: v2
    sources: actions
    specs:
      my-action:
        description: "Monitor transfers"
        function: actions/index:onTransfer
        trigger:
          type: event
          event:
            signature: "Transfer(address,address,uint256)"
            contract:
              address: "0x..."
              network_id: "1"
```

---

## 5. INTEGRATION WITH TESTING FRAMEWORKS

### 5.1 Hardhat Integration

**Installation**:
```bash
npm install --save-dev @tenderly/hardhat-tenderly
```

**Configuration (hardhat.config.js)**:
```javascript
require("@tenderly/hardhat-tenderly");

module.exports = {
  solidity: "0.8.19",
  networks: {
    // ... your networks
  },
  tenderly: {
    project: process.env.TENDERLY_PROJECT_NAME,
    username: process.env.TENDERLY_ACCOUNT_NAME,
    privateVerification: false, // public verification
  },
};
```

**Environment Variables (.env)**:
```bash
TENDERLY_ACCESS_KEY=your_access_token
TENDERLY_ACCOUNT_NAME=your_account
TENDERLY_PROJECT_NAME=your_project
```

**Automatic Verification**:
```javascript
// In deployment script
const Contract = await ethers.getContractFactory("MyContract");
const contract = await Contract.deploy();
await contract.deployed();

// Automatically verified if plugin configured
await hre.tenderly.verify({
  name: "MyContract",
  address: contract.address,
});
```

**Using Forks in Tests**:
```javascript
const { ethers, tenderly } = require("hardhat");

describe("MyContract", function () {
  it("should work on fork", async function () {
    // Create fork
    const fork = await tenderly.fork({
      network: "mainnet",
      blockNumber: 12345678,
    });

    // Use fork RPC
    const provider = new ethers.providers.JsonRpcProvider(fork.rpcUrl);
    // ... run tests
  });
});
```

**Virtual TestNets with Hardhat**:
```javascript
// hardhat.config.js
networks: {
  tenderly: {
    url: process.env.TENDERLY_VIRTUAL_TESTNET_RPC,
    chainId: 1, // or your chain ID
  },
}
```

**GitHub Actions with Hardhat**:
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      # Setup Tenderly Virtual TestNet
      - uses: Tenderly/vnet-github-action@v1
        with:
          access_key: ${{ secrets.TENDERLY_ACCESS_KEY }}
          account_name: ${{ secrets.TENDERLY_ACCOUNT_NAME }}
          project_name: ${{ secrets.TENDERLY_PROJECT_NAME }}
          mode: CI # or CD for continuous deployment

      - run: npm install
      - run: npx hardhat test --network tenderly
```

### 5.2 Foundry Integration

**Contract Verification with Foundry**:

**Setup (foundry.toml)**:
```toml
[profile.default]
cbor_metadata = true  # REQUIRED for Tenderly verification
```

**Environment Variables**:
```bash
TENDERLY_ACCESS_KEY=your_access_token
TENDERLY_VIRTUAL_TESTNET_RPC=https://virtual.mainnet.rpc.tenderly.co/YOUR_ID
TENDERLY_VERIFIER_URL=${TENDERLY_VIRTUAL_TESTNET_RPC}/verify/etherscan
```

**Verification Methods**:

**1. Using forge create with verification**:
```bash
forge create src/MyContract.sol:MyContract \
  --rpc-url $TENDERLY_VIRTUAL_TESTNET_RPC \
  --private-key $PRIVATE_KEY \
  --verify \
  --verifier-url $TENDERLY_VERIFIER_URL \
  --etherscan-api-key $TENDERLY_ACCESS_KEY
```

**2. Using forge verify-contract**:
```bash
forge verify-contract {CONTRACT_ADDRESS} \
  src/MyContract.sol:MyContract \
  --verifier-url $TENDERLY_VERIFIER_URL \
  --etherscan-api-key $TENDERLY_ACCESS_KEY
```

**3. Using forge script**:
```bash
# Use --slow flag to prevent batching (important!)
forge script script/Deploy.s.sol \
  --rpc-url $TENDERLY_VIRTUAL_TESTNET_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier-url $TENDERLY_VERIFIER_URL \
  --etherscan-api-key $TENDERLY_ACCESS_KEY \
  --slow  # Prevents transaction batching
```

**Public Network Verification**:
For public networks, append `/public` to verifier URL:
```bash
TENDERLY_VERIFIER_URL=https://virtual.mainnet.rpc.tenderly.co/YOUR_ID/verify/etherscan/public
```

**Known Issues**:
- Remapping issues reported (Dec 2024)
- Rate limiting with large contract sets
- Use `--slow` flag with forge script to avoid batching issues

**Testing with Virtual TestNets**:
```bash
# In foundry.toml
[rpc_endpoints]
tenderly = "${TENDERLY_VIRTUAL_TESTNET_RPC}"

# Run tests
forge test --fork-url tenderly
```

**Foundry + GitHub Actions**:
```yaml
# .github/workflows/foundry.yml
name: Foundry Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: foundry-rs/foundry-toolchain@v1

      - uses: Tenderly/vnet-github-action@v1
        with:
          access_key: ${{ secrets.TENDERLY_ACCESS_KEY }}
          account_name: ${{ secrets.TENDERLY_ACCOUNT_NAME }}
          project_name: ${{ secrets.TENDERLY_PROJECT_NAME }}
          mode: CI

      - name: Run tests
        run: forge test --fork-url $TENDERLY_VIRTUAL_TESTNET_RPC
```

### 5.3 CI/CD Integration

**Virtual TestNet CI/CD Modes**:

**CI Mode** (Continuous Integration):
- Virtual TestNet paused after job completes
- Can inspect transactions via dashboard
- Cannot send further RPC requests
- Ideal for test runs

**CD Mode** (Continuous Deployment):
- Virtual TestNet remains active
- Can continue interacting with deployed contracts
- Ideal for staging environments

**GitHub Action Parameters**:
```yaml
- uses: Tenderly/vnet-github-action@v1
  with:
    access_key: ${{ secrets.TENDERLY_ACCESS_KEY }}
    account_name: ${{ secrets.TENDERLY_ACCOUNT_NAME }}
    project_name: ${{ secrets.TENDERLY_PROJECT_NAME }}
    mode: CI  # or CD
    network_id: 1  # optional: network to fork
```

**Benefits**:
- Fresh TestNet per PR
- Isolated testing environments
- Production data fork
- Unlimited test tokens
- Shareable results via block explorer

**Complete CI/CD Example**:
```yaml
name: Smart Contract CI/CD
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Setup Tenderly TestNet
        uses: Tenderly/vnet-github-action@v1
        with:
          access_key: ${{ secrets.TENDERLY_ACCESS_KEY }}
          account_name: ${{ secrets.TENDERLY_ACCOUNT_NAME }}
          project_name: ${{ secrets.TENDERLY_PROJECT_NAME }}
          mode: ${{ github.event_name == 'pull_request' && 'CI' || 'CD' }}

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

      - name: Deploy
        if: github.ref == 'refs/heads/main'
        run: npm run deploy
        env:
          PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
```

---

## 6. ALTERNATIVES IF FREE TIER IS TOO LIMITED

### 6.1 What Can Be Done Locally Instead

**Foundry Anvil** (Best self-hosted option):
```bash
# Fork mainnet locally
anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Fork at specific block
anvil --fork-url $RPC_URL --fork-block-number 12345678

# With trace support
anvil --fork-url $RPC_URL --trace
```

**Capabilities**:
- ✅ Local blockchain node for testing
- ✅ Mainnet forking with on-the-fly RPC
- ✅ Transaction simulation
- ✅ Debug trace support (debug_traceTransaction)
- ✅ No external dependencies
- ✅ Fast execution
- ✅ Free and unlimited

**Limitations**:
- ❌ No visual debugger
- ❌ No web UI
- ❌ Limited gas profiling
- ❌ No cloud-based sharing
- ❌ Manual trace analysis

**Hardhat Network Fork**:
```javascript
// hardhat.config.js
networks: {
  hardhat: {
    forking: {
      url: process.env.ALCHEMY_URL,
      blockNumber: 12345678,
    },
  },
}
```

**Capabilities**:
- ✅ Built-in Hardhat integration
- ✅ Fork mainnet state
- ✅ Console.log debugging
- ✅ Stack traces in tests
- ✅ Free and unlimited

**Limitations**:
- ❌ Slower than Anvil
- ❌ Limited trace support
- ❌ No visual tools
- ❌ Basic debugging only

### 6.2 Alternative Transaction Simulation Tools

**1. Alchemy Simulation API**:
- ✅ Free tier: 1,000 simulations/day
- ✅ Growth tier: 50,000 simulations/day
- ❌ Less generous than Tenderly free tier (2,083/day)
- ✅ Well-documented API
- ✅ Multi-chain support

**2. Temper (by EnsoBuild)**:
- ✅ Open-source, self-hosted
- ✅ Simple HTTP API
- ✅ Single transactions & bundles
- ✅ Stateful simulations
- ✅ No external dependencies
- ✅ Unlimited free usage
- ❌ No visual interface
- GitHub: https://github.com/EnsoBuild/temper

**3. RPC Fast Transaction Simulator**:
- ✅ Self-hosted option available
- ✅ Claimed fastest performance
- ✅ 100% secure (self-hosted)
- ⚠️ Limited documentation available

**4. evm-simulator (by idanya)**:
- ✅ Open-source
- ✅ Uses Ganache for local fork
- ✅ Simulates without network send
- ✅ debug_traceTransaction support
- ❌ Requires Ganache setup
- GitHub: https://github.com/idanya/evm-simulator

**5. evm_simulator_rs (Rust CLI)**:
- ✅ Rust-based, fast
- ✅ CLI tool
- ✅ Any EVM chain support
- ✅ Lightweight
- GitHub: https://github.com/AmadiMichael/evm_simulator_rs

**6. Sentio Debug and Simulation API**:
- ✅ Available via QuickNode marketplace
- ✅ Advanced transaction API
- ✅ Decoded internal calls
- ✅ Highly accurate simulations
- ⚠️ Pricing not clear (via QuickNode)

**7. QuickNode Integration**:
- Note: QuickNode offers Tenderly's simulator as add-on
- Also offers other simulation tools (Sentio, Noves Foresight)
- Acts as infrastructure provider rather than competitor

### 6.3 Self-Hosted Options

**Best Self-Hosted Setup**:

**Anvil + Custom Tooling**:
```bash
# Terminal 1: Run Anvil
anvil --fork-url $MAINNET_RPC --fork-block-number $BLOCK

# Terminal 2: Your development environment
# Connect via http://localhost:8545
```

**Advantages**:
- ✅ Complete control
- ✅ No rate limits
- ✅ No costs
- ✅ Privacy
- ✅ Fast local execution

**Recommended Stack**:
1. **Anvil**: Local node/forking
2. **Foundry forge**: Testing framework
3. **Temper**: Transaction simulation API
4. **Custom scripts**: For analysis/monitoring

**When to Use Self-Hosted**:
- Heavy simulation load (>62,500/month)
- Privacy requirements
- Offline development
- Cost optimization
- No dependency on external services

**When to Use Tenderly Free Tier**:
- Visual debugging needed
- Team collaboration
- Quick setup required
- Production monitoring
- Gas profiling visualization
- Within 25M TU/month budget

**Hybrid Approach** (Best of both):
- Development: Anvil + Foundry (local)
- Testing: Tenderly Virtual TestNets (CI/CD)
- Debugging: Tenderly dashboard (failed txs)
- Monitoring: Tenderly alerts (production)
- Heavy simulation: Local Anvil/Temper

---

## 7. TENDERLY CAPABILITIES MATRIX

### 7.1 Feature Comparison by Tier

| Feature | Free | Starter | Pro | Self-Hosted (Anvil) |
|---------|------|---------|-----|---------------------|
| **Monthly TU** | 25M | 100M | 350M | Unlimited |
| **Simulations/min** | 60 | 60 | 100 | Unlimited |
| **Simulations/month** | ~62.5K | ~250K | ~875K | Unlimited |
| **Visual Debugger** | ✅ | ✅ | ✅ | ❌ |
| **Gas Profiler** | ✅ | ✅ | ✅ | Limited |
| **Forks** | ✅ | ✅ | ✅ | ✅ (local) |
| **Virtual TestNets** | ✅ | ✅ | ✅ | ❌ |
| **Monitoring/Alerts** | ✅ | ✅ | ✅ | ❌ |
| **Web3 Actions** | ✅ (10/project) | ✅ | ✅ | ❌ |
| **Contract Verification** | ✅ | ✅ | ✅ | ❌ |
| **Multi-chain Support** | ✅ 90+ chains | ✅ 90+ chains | ✅ 90+ chains | ✅ Any EVM |
| **Team Collaboration** | Limited | ✅ | ✅ | ❌ |
| **Support** | Community | Standard | Priority | Self-support |
| **Cost** | $0 | $$ | $$$ | $0 |

### 7.2 Use Case Suitability

| Use Case | Recommended Solution | Reasoning |
|----------|---------------------|-----------|
| **Solo dev, light usage** | Tenderly Free | 62K sims/month sufficient, visual tools valuable |
| **Team development** | Tenderly Starter/Pro | Collaboration features, higher limits |
| **CI/CD pipeline** | Hybrid (Tenderly + Anvil) | Tenderly for deployment, Anvil for bulk tests |
| **Heavy simulation load** | Self-hosted (Anvil + Temper) | Unlimited, cost-effective |
| **Production monitoring** | Tenderly (any tier) | Best-in-class alerts and monitoring |
| **Gas optimization** | Tenderly Free | Excellent gas profiler visualization |
| **Privacy-critical** | Self-hosted | No external data sharing |
| **Quick debugging** | Tenderly Free | Superior visual debugging |
| **Learning/Education** | Tenderly Free or Anvil | Both excellent, Tenderly more visual |

### 7.3 Cost-Benefit Analysis

**Tenderly Free Tier ROI**:
- **Time saved**: Visual debugging saves hours vs manual trace analysis
- **Error prevention**: Simulation prevents costly failed transactions
- **Learning curve**: Gentle, excellent documentation
- **Team onboarding**: Easy for new developers
- **Cost**: $0 for 25M TU/month

**Break-even Point**:
- If you exceed 62.5K simulations/month → Consider paid tier or hybrid
- If you need >60 sims/min → Consider Pro tier or self-hosted
- If visual debugging saves >2 hours/month → Worth using vs pure self-hosted

**Hybrid Strategy Benefits**:
- Use Tenderly free tier for debugging production issues
- Use Anvil for local development and heavy testing
- Use Tenderly Virtual TestNets for CI/CD
- Best of both worlds, maximize free resources

---

## 8. INTEGRATION PATTERNS & BEST PRACTICES

### 8.1 Recommended Development Workflow

**Development Phase**:
```
Local Development (Anvil)
    ↓
Simulation Testing (Tenderly API/SDK)
    ↓
Gas Optimization (Tenderly Gas Profiler)
    ↓
CI/CD Testing (Virtual TestNets)
    ↓
Production Deployment
    ↓
Monitoring (Tenderly Alerts)
```

**Configuration Management**:
```bash
# .env.example
TENDERLY_ACCESS_KEY=
TENDERLY_ACCOUNT_NAME=
TENDERLY_PROJECT_NAME=
TENDERLY_VIRTUAL_TESTNET_RPC=

# For local development
ANVIL_RPC_URL=http://localhost:8545
MAINNET_RPC_URL=
```

### 8.2 Cost Optimization Strategies

**1. Use Local Anvil for Bulk Testing**:
```bash
# Run test suite locally (unlimited)
anvil --fork-url $MAINNET_RPC &
forge test

# Only simulate on Tenderly for integration tests
npm run test:integration # Uses Tenderly
```

**2. Cache Simulation Results**:
```typescript
// Cache identical simulations
const cache = new Map();

async function simulate(params) {
  const key = JSON.stringify(params);
  if (cache.has(key)) return cache.get(key);

  const result = await tenderly.simulator.simulateTransaction(params);
  cache.set(key, result);
  return result;
}
```

**3. Bundle Simulations**:
```typescript
// Instead of 10 separate simulations (4000 TU)
// Use 1 bundle simulation (400 TU)
const bundle = await tenderly.simulator.simulateBundle({
  transactions: [tx1, tx2, tx3, ...],
});
```

**4. Use Selective Monitoring**:
```javascript
// Only alert on critical events, not every transaction
// Reduces alert execution costs
alert.rules = [
  { type: 'value_threshold', threshold: '1000000000000000000' }, // >1 ETH
  { type: 'function', signature: 'emergencyWithdraw()' },
];
```

**5. Leverage Web3 Actions Efficiently**:
```typescript
// Use storage to reduce executions
import { Storage } from '@tenderly/actions';

export const onEvent: ActionFn = async (context, event) => {
  const storage = new Storage();
  const lastProcessed = await storage.get('lastBlock');

  // Skip if already processed
  if (event.blockNumber <= lastProcessed) return;

  // Process and update
  await processEvent(event);
  await storage.put('lastBlock', event.blockNumber);
};
```

### 8.3 Security Best Practices

**API Key Management**:
```bash
# Never commit API keys
echo "TENDERLY_ACCESS_KEY=*" >> .gitignore

# Use environment variables
export TENDERLY_ACCESS_KEY=$(cat ~/.tenderly/key)

# Rotate keys periodically
# Generate new token in dashboard, update .env
```

**Webhook Security**:
```javascript
// Verify webhook authenticity
app.post('/webhook', (req, res) => {
  // Add HMAC verification if possible
  const signature = req.headers['x-tenderly-signature'];
  if (!verifySignature(req.body, signature)) {
    return res.status(401).send('Unauthorized');
  }

  // Process webhook
  processAlert(req.body);
  res.status(200).send('OK');
});
```

**Simulation State Management**:
```typescript
// Don't expose sensitive data in simulations
const simulation = await tenderly.simulator.simulateTransaction({
  ...params,
  save: false, // Don't save to dashboard if sensitive
});
```

---

## 9. QUICK REFERENCE

### 9.1 Essential Links

- **Official Website**: https://tenderly.co
- **Documentation**: https://docs.tenderly.co
- **GitHub CLI**: https://github.com/Tenderly/tenderly-cli
- **GitHub SDK**: https://github.com/Tenderly/tenderly-sdk
- **Pricing**: https://tenderly.co/pricing
- **Dashboard**: https://dashboard.tenderly.co

### 9.2 Key npm Packages

```bash
# Core SDK
npm install @tenderly/sdk

# Hardhat plugin
npm install --save-dev @tenderly/hardhat-tenderly

# Web3 Actions runtime
npm install @tenderly/actions

# Web3 Actions testing
npm install --save-dev @tenderly/actions-test
```

### 9.3 Common API Endpoints

```
# Base URL
https://api.tenderly.co/api/v1

# Simulations
POST /account/{account}/project/{project}/simulate
POST /account/{account}/project/{project}/simulate-bundle

# Forks
POST /account/{account}/project/{project}/fork

# Alerts
POST /account/{account}/project/{project}/alerts
GET /account/{account}/project/{project}/alerts

# Transactions
GET /account/{account}/project/{project}/transactions/{tx_id}
```

### 9.4 Environment Variables Template

```bash
# Tenderly Configuration
TENDERLY_ACCESS_KEY=your_access_token_here
TENDERLY_ACCOUNT_NAME=your_account_name
TENDERLY_PROJECT_NAME=your_project_name

# Virtual TestNets
TENDERLY_VIRTUAL_TESTNET_RPC=https://virtual.mainnet.rpc.tenderly.co/your_id

# Verifier
TENDERLY_VERIFIER_URL=${TENDERLY_VIRTUAL_TESTNET_RPC}/verify/etherscan

# For production monitoring
TENDERLY_WEBHOOK_URL=https://yourapp.com/tenderly-webhook

# Fallback RPC
MAINNET_RPC_URL=your_alchemy_or_infura_url
```

---

## 10. CONCLUSION & RECOMMENDATIONS

### 10.1 Is Tenderly Free Tier Sufficient?

**YES, if you**:
- Develop small to medium projects
- Need <62,500 simulations/month (<2,083/day)
- Want visual debugging tools
- Need production monitoring
- Simulate at <60/min rate
- Work in a small team

**NO (need paid tier), if you**:
- Run heavy CI/CD pipelines
- Need >62,500 simulations/month
- Require >60 simulations/min
- Need priority support
- Have large team collaboration needs

**Consider self-hosted, if you**:
- Need unlimited simulations
- Have privacy requirements
- Want full control
- Comfortable with CLI tools
- Don't need visual debugging

### 10.2 Recommended Setup for Framework

**For Blockchain/Web3 Specialist Framework**:

```
Development Stack:
├── Local Testing: Foundry Anvil (unlimited, fast)
├── Simulation: Tenderly SDK (free tier, 62.5K/month)
├── Debugging: Tenderly Dashboard (visual, gas profiler)
├── CI/CD: Tenderly Virtual TestNets (GitHub Actions)
├── Monitoring: Tenderly Alerts (production)
└── Backup: Self-hosted Temper (if free tier exceeded)
```

**Justification**:
1. **Anvil**: Free, unlimited local testing
2. **Tenderly Free**: Visual tools, monitoring, 62.5K sims sufficient for most
3. **Hybrid approach**: Maximize free resources
4. **Scalable**: Easy upgrade path to paid tier if needed
5. **Fallback**: Self-hosted options if limits hit

### 10.3 Action Items for Integration

1. ✅ Sign up for Tenderly free account
2. ✅ Generate API access token
3. ✅ Install Tenderly CLI
4. ✅ Install @tenderly/sdk npm package
5. ✅ Configure environment variables
6. ✅ Set up Hardhat/Foundry plugin
7. ✅ Create example simulation script
8. ✅ Configure GitHub Actions with Virtual TestNets
9. ✅ Set up monitoring alerts for critical events
10. ✅ Document usage patterns and TU consumption

### 10.4 Cost Monitoring

**Track your usage**:
- Check dashboard for TU consumption
- Monitor simulation count
- Set up alerts when approaching limits
- Review monthly usage reports

**If approaching limits**:
1. Audit simulation usage
2. Implement caching strategy
3. Move bulk tests to Anvil
4. Consider paid tier ($)
5. Implement hybrid approach

---

## APPENDIX: Code Examples

### A. Complete Simulation Example (TypeScript)

```typescript
import { Tenderly, Network } from '@tenderly/sdk';
import dotenv from 'dotenv';

dotenv.config();

const tenderly = new Tenderly({
  accessKey: process.env.TENDERLY_ACCESS_KEY!,
  accountName: process.env.TENDERLY_ACCOUNT_NAME!,
  projectName: process.env.TENDERLY_PROJECT_NAME!,
  network: Network.MAINNET,
});

async function simulateSwap() {
  try {
    const simulation = await tenderly.simulator.simulateTransaction({
      from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap Router
      input: '0x...', // Encoded swap function call
      gas: 200000,
      gasPrice: '30000000000',
      value: '0',
      save: true,
    });

    console.log('Simulation Results:');
    console.log('- Status:', simulation.transaction.status ? 'Success' : 'Failed');
    console.log('- Gas used:', simulation.transaction.gas_used);
    console.log('- Effective gas price:', simulation.transaction.effective_gas_price);

    if (simulation.transaction.error_message) {
      console.error('Error:', simulation.transaction.error_message);
    }

    // Analyze state changes
    for (const change of simulation.transaction.state_changes || []) {
      console.log(`State change in ${change.address}:`, change);
    }

    return simulation;
  } catch (error) {
    console.error('Simulation failed:', error);
    throw error;
  }
}

simulateSwap();
```

### B. Web3 Action Example

```typescript
// actions/monitor-transfers.ts
import { ActionFn, Context, Event, TransactionEvent } from '@tenderly/actions';
import { ethers } from 'ethers';

// Monitor large transfers and alert
export const monitorLargeTransfers: ActionFn = async (
  context: Context,
  event: Event
) => {
  const txEvent = event as TransactionEvent;

  // Decode Transfer event
  const iface = new ethers.utils.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ]);

  for (const log of txEvent.logs) {
    try {
      const parsed = iface.parseLog(log);
      const value = ethers.BigNumber.from(parsed.args.value);

      // Alert if transfer > 1000 tokens (assuming 18 decimals)
      const threshold = ethers.utils.parseEther('1000');

      if (value.gt(threshold)) {
        console.log('ALERT: Large transfer detected!');
        console.log('From:', parsed.args.from);
        console.log('To:', parsed.args.to);
        console.log('Value:', ethers.utils.formatEther(value));

        // Send alert (Discord, Slack, email, etc.)
        await sendAlert({
          type: 'large_transfer',
          from: parsed.args.from,
          to: parsed.args.to,
          value: value.toString(),
          txHash: txEvent.hash,
        });
      }
    } catch (e) {
      // Not a Transfer event, skip
      continue;
    }
  }
};

async function sendAlert(data: any) {
  // Implement your alert logic
  // Discord webhook, Slack API, email, etc.
  console.log('Alert sent:', data);
}
```

### C. Fork Testing Example (Hardhat)

```typescript
// test/fork-test.ts
import { ethers, tenderly } from 'hardhat';
import { expect } from 'chai';

describe('Flash Loan Attack Simulation', function () {
  let fork: any;
  let forkProvider: any;

  before(async function () {
    // Create fork at specific block
    fork = await tenderly.fork({
      network: 'mainnet',
      blockNumber: 15000000,
    });

    forkProvider = new ethers.providers.JsonRpcProvider(fork.rpcUrl);
  });

  it('should simulate flash loan attack', async function () {
    // Deploy attacker contract
    const Attacker = await ethers.getContractFactory('FlashLoanAttacker');
    const attacker = await Attacker.deploy({ /* ... */ });

    // Execute attack
    const tx = await attacker.attack();
    const receipt = await tx.wait();

    console.log('Attack gas used:', receipt.gasUsed.toString());

    // Verify results
    expect(receipt.status).to.equal(1);
  });

  after(async function () {
    // Fork auto-deleted or can be manually deleted
    // await tenderly.deleteFork(fork.id);
  });
});
```

---

**Document Version**: 1.0
**Last Updated**: November 2025
**Author**: AI Research Assistant
**Status**: Comprehensive research complete
