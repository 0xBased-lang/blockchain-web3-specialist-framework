# Prerequisites - Setup Guide

## System Requirements

### Hardware Requirements

**Minimum**:
- CPU: 4 cores
- RAM: 8 GB
- Disk: 20 GB free space
- Internet: Stable connection

**Recommended**:
- CPU: 8+ cores
- RAM: 16+ GB
- Disk: 50+ GB SSD
- Internet: 100+ Mbps

### Operating System

**Supported**:
- macOS 12+ (Monterey or later)
- Ubuntu 20.04+ / Debian 11+
- Windows 10+ with WSL2

**Not Supported**:
- Windows native (must use WSL2)
- Older Linux distributions

---

## Required Software

### 1. Node.js (v18+ LTS)

**Installation**:

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

nvm install 18
nvm use 18
nvm alias default 18

# Verify
node --version  # Should show v18.x.x or v20.x.x
npm --version   # Should show 9.x.x or higher
```

**Alternative (macOS)**:
```bash
brew install node@18
```

**Alternative (Ubuntu)**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verification**:
```bash
node --version  # Must be >= 18.0.0
npm --version
```

### 2. pnpm (v8+)

**Why pnpm?**
- Faster than npm/yarn
- Saves disk space with content-addressable storage
- Strict dependency resolution

**Installation**:

```bash
# Using npm
npm install -g pnpm@latest

# Or using standalone script
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Verify
pnpm --version  # Should show 8.x.x or higher
```

**Configuration**:
```bash
# Set registry (optional, for faster downloads)
pnpm config set registry https://registry.npmjs.org/

# Enable shamefully-hoist if you encounter issues
pnpm config set shamefully-hoist true
```

### 3. Git (v2.30+)

**Installation**:

```bash
# macOS
brew install git

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install git

# Verify
git --version  # Should be >= 2.30.0
```

**Configuration**:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 4. Python (v3.8+) - For Security Tools

**Installation**:

```bash
# macOS
brew install python@3.11

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3.11 python3-pip

# Verify
python3 --version  # Should be >= 3.8.0
pip3 --version
```

### 5. Solidity Compiler (via Hardhat)

**Note**: Hardhat will manage the Solidity compiler, but you can install it globally if needed.

```bash
# Optional: Install solc globally
npm install -g solc

# Verify
solc --version
```

---

## Optional Software (Recommended)

### 1. Docker (for local blockchain nodes)

**Installation**:

```bash
# macOS
brew install --cask docker

# Ubuntu
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo usermod -aG docker $USER

# Verify
docker --version
docker-compose --version
```

### 2. Redis (for caching)

**Installation**:

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Verify
redis-cli ping  # Should return PONG
```

### 3. PostgreSQL (for analytics, optional)

**Installation**:

```bash
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu
sudo apt-get update
sudo apt-get install postgresql-14
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify
psql --version
```

### 4. VS Code (recommended editor)

**Installation**:
- Download from https://code.visualstudio.com/

**Recommended Extensions**:
```
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- TypeScript Extension Pack (loiane.ts-extension-pack)
- Solidity (JuanBlanco.solidity)
- Hardhat Solidity (NomicFoundation.hardhat-solidity)
- GitHub Copilot (GitHub.copilot) - optional
```

---

## External Service Accounts

### 1. Blockchain RPC Providers

You need at least ONE of these (recommended: all three for redundancy):

#### Alchemy (Recommended)

1. Visit https://www.alchemy.com/
2. Sign up for free account
3. Create new app:
   - Network: Ethereum Mainnet
   - Network: Ethereum Sepolia (testnet)
4. Copy API keys to `.env` file

**Free Tier**: 300M compute units/month

#### Infura

1. Visit https://infura.io/
2. Sign up for free account
3. Create new project
4. Copy API keys

**Free Tier**: 100K requests/day

#### QuickNode

1. Visit https://www.quicknode.com/
2. Sign up for free account
3. Create endpoint
4. Copy URL

**Free Tier**: Limited requests

### 2. Solana RPC Providers

#### Helius (Recommended for Solana)

1. Visit https://www.helius.dev/
2. Sign up for free account
3. Create API key
4. Copy to `.env`

**Free Tier**: 100 requests/sec

### 3. Block Explorers (optional, for debugging)

- Etherscan: https://etherscan.io/apis
- Polygonscan: https://polygonscan.com/apis
- Solscan: https://solscan.io/

---

## Security Tools

### 1. Slither (Solidity static analyzer)

```bash
pip3 install slither-analyzer

# Verify
slither --version
```

### 2. Mythril (Symbolic execution)

```bash
pip3 install mythril

# Verify
myth version
```

---

## Environment Setup

### 1. Create Project Directory

```bash
# Create project directory
mkdir -p ~/projects/blockchain-web3-specialist-framework
cd ~/projects/blockchain-web3-specialist-framework

# Verify you're in the right place
pwd
```

### 2. Set Up Environment Variables

Create `.env.example` file:

```bash
# Ethereum RPC URLs
ETH_MAINNET_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ETH_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Solana RPC URLs
SOL_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
SOL_DEVNET_RPC=https://api.devnet.solana.com

# API Keys
ALCHEMY_API_KEY=your_alchemy_key_here
INFURA_API_KEY=your_infura_key_here
QUICKNODE_URL=your_quicknode_url_here
HELIUS_API_KEY=your_helius_key_here

# Etherscan (for contract verification)
ETHERSCAN_API_KEY=your_etherscan_key_here

# MCP Server Configuration
MCP_ETHEREUM_PORT=3001
MCP_SOLANA_PORT=3002
MCP_MULTICHAIN_PORT=3003

# Agent Configuration
AGENT_LOG_LEVEL=info
AGENT_MAX_RETRIES=3

# Security
WALLET_ENCRYPTION_PASSWORD=changeme_use_strong_password

# Optional: Database
POSTGRES_URL=postgresql://localhost:5432/web3_framework
REDIS_URL=redis://localhost:6379

# Optional: Monitoring
SENTRY_DSN=your_sentry_dsn_here
```

**Create actual `.env` file**:
```bash
cp .env.example .env
# Edit .env with your actual API keys
```

### 3. Git Configuration

```bash
# Initialize git (if not already done)
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Environment
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
*.tsbuildinfo

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Hardhat
cache/
artifacts/
typechain-types/

# Temporary files
tmp/
temp/
*.tmp

# Keys (NEVER commit)
*.key
*.pem
wallets/
EOF
```

---

## Verification Checklist

Run these commands to verify your setup:

```bash
# Node.js and pnpm
node --version   # >= 18.0.0
pnpm --version   # >= 8.0.0

# Git
git --version    # >= 2.30.0

# Python (for security tools)
python3 --version  # >= 3.8.0
pip3 --version

# Security tools
slither --version
myth version

# Optional: Docker
docker --version

# Optional: Redis
redis-cli ping   # Should return PONG

# Environment file
test -f .env && echo "✓ .env file exists" || echo "✗ .env file missing"
```

### Expected Output

```
✓ Node.js: v18.19.0 or higher
✓ pnpm: 8.15.0 or higher
✓ Git: 2.40.0 or higher
✓ Python: 3.11.0 or higher
✓ Slither: 0.10.0 or higher
✓ Mythril: 0.24.0 or higher
✓ .env file exists
```

---

## Common Issues & Solutions

### Issue: Node.js version too old

**Solution**:
```bash
nvm install 18
nvm use 18
nvm alias default 18
```

### Issue: pnpm not found after installation

**Solution**:
```bash
# Reload shell
source ~/.bashrc
# or
source ~/.zshrc

# Or add to PATH manually
export PATH="$HOME/.local/share/pnpm:$PATH"
```

### Issue: Python pip3 not found

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install python3-pip

# macOS
brew install python@3.11
```

### Issue: Slither installation fails

**Solution**:
```bash
# Install dependencies first
sudo apt-get install software-properties-common
sudo apt-get install python3-dev

# Then retry
pip3 install slither-analyzer
```

### Issue: Permission denied for Docker

**Solution**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker
```

---

## Next Steps

Once all prerequisites are installed and verified:

1. ✅ All software installed
2. ✅ All external accounts created
3. ✅ Environment variables configured
4. ✅ Verification checklist passed

**Proceed to**: `docs/implementation/01-project-setup.md`

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-14
**Estimated Setup Time**: 30-60 minutes
