# Guide 17: Full-Stack Web3 Deployment

**Prerequisites**: Completed guides 00-16, project built and tested locally, production infrastructure ready

**Time Estimate**: 8-10 hours (first deployment), 2-3 hours (subsequent deployments)

**Prevents**: 20+ hours of deployment debugging per project (based on real production data)

---

## Table of Contents

- [Part 1: Vercel Frontend Deployment](#part-1-vercel-frontend-deployment)
  - [1.1 Monorepo Configuration](#11-monorepo-configuration)
  - [1.2 Environment Variable Setup](#12-environment-variable-setup)
  - [1.3 Build Configuration](#13-build-configuration)
  - [1.4 Domain & SSL Setup](#14-domain--ssl-setup)
  - [1.5 Deployment Automation](#15-deployment-automation)
  - [1.6 Troubleshooting Guide](#16-troubleshooting-guide)
- [Part 2: VPS Backend Deployment](#part-2-vps-backend-deployment)
  - [2.1 Server Setup & Security](#21-server-setup--security)
  - [2.2 PM2 Process Management](#22-pm2-process-management)
  - [2.3 Multi-Service Architecture](#23-multi-service-architecture)
  - [2.4 HTTPS with Cloudflare Tunnel](#24-https-with-cloudflare-tunnel)
  - [2.5 Monitoring & Health Checks](#25-monitoring--health-checks)
  - [2.6 Zero-Downtime Deployment](#26-zero-downtime-deployment)
- [Part 3: Integration & Testing](#part-3-integration--testing)
  - [3.1 HTTPS/WSS Configuration](#31-httpswss-configuration)
  - [3.2 CORS & Security Headers](#32-cors--security-headers)
  - [3.3 Production Testing Checklist](#33-production-testing-checklist)
  - [3.4 Rollback Procedures](#34-rollback-procedures)
- [Part 4: Real-World Issues Reference](#part-4-real-world-issues-reference)

---

## Overview

This guide is based on production deployments of two Web3 projects:
- **zmartV0.69**: Solana prediction market (216 commits analyzed)
- **kektechV0.69**: EVM prediction market (240 commits analyzed)

**Critical Discovery**: Both projects spent **40-50% of development time** on deployment and integration issues. This guide helps you avoid that.

**Top Time Sinks We'll Prevent**:
1. ⏱️ Vercel monorepo configuration (18 hours across both projects)
2. ⏱️ PM2 crash loop debugging (INCIDENT-001: production down for hours)
3. ⏱️ HTTPS/WSS mixed content errors (6 commits, multiple hours)
4. ⏱️ Environment variable issues (15 incidents combined)
5. ⏱️ Database schema synchronization (multiple production failures)

---

## Part 1: Vercel Frontend Deployment

### 1.1 Monorepo Configuration

**Problem**: Vercel defaults to deploying from repository root. In monorepos, your frontend is typically in a subdirectory (e.g., `frontend/`, `packages/frontend/`). Without proper configuration, Vercel cannot find your `package.json` or dependencies.

**Real-World Cost**: 18 hours debugging across zmartV0.69 and kektechV0.69

#### 1.1.1 Identify Your Project Structure

**Standalone Project** (frontend at root):
```
my-project/
├── package.json          # Root package.json
├── next.config.js
├── app/
└── components/
```
→ **No special configuration needed**

**Monorepo with Frontend Subdirectory** (zmartV0.69 pattern):
```
my-project/
├── package.json          # Workspace root
├── frontend/
│   ├── package.json      # Frontend package.json
│   ├── next.config.js
│   └── app/
└── backend/
```
→ **Needs `vercel.json` configuration**

**Monorepo with Packages** (kektechV0.69 pattern):
```
my-project/
├── package.json          # Workspace root
├── packages/
│   └── frontend/
│       ├── package.json  # Frontend package.json
│       └── app/
```
→ **Needs `vercel.json` configuration**

#### 1.1.2 Create vercel.json (Monorepo Only)

**For Frontend Subdirectory Pattern** (zmartV0.69):

Create `vercel.json` in **repository root**:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "cd ../.. && pnpm install",
  "rootDirectory": "frontend",
  "framework": "nextjs"
}
```

**For Packages Pattern** (kektechV0.69):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "cd ../.. && pnpm install",
  "rootDirectory": "packages/frontend",
  "framework": "nextjs"
}
```

**Critical Fields Explained**:

| Field | Purpose | Common Mistake |
|-------|---------|----------------|
| `rootDirectory` | **MOST CRITICAL** - Where Vercel runs build | Forgetting this = 18 hours debugging |
| `installCommand` | Install from workspace root | Using default `npm install` = missing dependencies |
| `buildCommand` | Build command relative to rootDirectory | Not accounting for pnpm workspaces |
| `outputDirectory` | Build output relative to rootDirectory | Wrong path = deployment fails |

#### 1.1.3 Configure Package Manager

**Add `.npmrc` to Repository Root**:

```ini
# .npmrc
shamefully-hoist=true
strict-peer-dependencies=false
auto-install-peers=true
node-linker=hoisted
```

**Why This Matters**:
- Vercel needs to resolve workspace dependencies
- Without hoisting, dependencies in subdirectories won't be found
- **Real Issue**: kektechV0.69 commit `24e1836` - "fix: Add .npmrc for Vercel deployment"

**For pnpm Workspaces**:

Create/verify `pnpm-workspace.yaml` in repository root:

```yaml
packages:
  - 'frontend'
  - 'backend'
  # Or for packages pattern:
  - 'packages/*'
```

#### 1.1.4 Test Locally

**CRITICAL: Test Vercel build locally BEFORE pushing**

```bash
# Install Vercel CLI globally (one-time)
npm install -g vercel

# Login (one-time)
vercel login

# Pull Vercel configuration (creates .vercel/)
vercel pull

# Test build locally
vercel build

# Expected output:
# ✓ Building project in /path/to/my-project/frontend
# ✓ Compiled successfully
# ✓ Build completed in 45s
```

**If Build Fails**:
1. Check `rootDirectory` in `vercel.json`
2. Verify `installCommand` runs from correct location
3. Check `pnpm-lock.yaml` exists and is committed
4. Verify all dependencies are in `package.json`

**Common Error Messages**:

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find package.json` | Wrong `rootDirectory` | Set `rootDirectory` to frontend location |
| `Cannot find module 'next'` | Dependencies not installed | Fix `installCommand` to run from workspace root |
| `pnpm not found` | Vercel doesn't detect pnpm | Add `"packageManager": "pnpm@8.x"` to root `package.json` |

---

### 1.2 Environment Variable Setup

**Problem**: Environment variables are the #1 source of production bugs. Issues include: missing variables, newline characters, build-time vs runtime confusion.

**Real-World Impact**: 15 incidents across both projects (zmartV0.69 INCIDENT-001, multiple kektechV0.69 commits)

#### 1.2.1 Categorize Your Variables

**Build-Time Variables** (available during `next build`):
```bash
# Public variables (embedded in client bundle)
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
NEXT_PUBLIC_WALLET_CONNECT_ID=abc123

# Private build-time variables (NOT in client bundle)
ANALYZE=true
SENTRY_AUTH_TOKEN=xyz789
```

**Runtime Variables** (available during request handling):
```bash
# Database (NEVER available at build time on Vercel)
DATABASE_URL=postgresql://user:pass@host:5432/db

# API Keys (server-side only)
HELIUS_API_KEY=your-key-here
SUPABASE_SERVICE_ROLE_KEY=your-key-here
ALCHEMY_API_KEY=your-key-here

# Authentication
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://yourdomain.com
```

#### 1.2.2 Create .env.example

**CRITICAL**: Keep this file up-to-date with every variable your app uses.

```bash
# .env.example - COMMIT THIS FILE
# Copy to .env.local and fill in real values

#==============================================================================
# Build-Time Variables (Next.js embeds these in client bundle)
#==============================================================================

# Public: Blockchain Configuration
NEXT_PUBLIC_CHAIN_ID=8453                      # Base mainnet
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_WALLET_CONNECT_ID=               # Required: Get from walletconnect.com

# Public: Application URLs
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://ws.yourdomain.com

#==============================================================================
# Runtime Variables (Server-side only, NOT in client bundle)
#==============================================================================

# Database (PostgreSQL via Supabase/Railway/etc.)
DATABASE_URL=                                  # Required: postgresql://...

# Authentication
NEXTAUTH_SECRET=                               # Required: Generate with `openssl rand -base64 32`
NEXTAUTH_URL=https://yourdomain.com

# API Keys
HELIUS_API_KEY=                               # Optional: Solana RPC (if using Solana)
ALCHEMY_API_KEY=                              # Optional: Ethereum RPC alternative
SUPABASE_URL=                                 # Required if using Supabase
SUPABASE_SERVICE_ROLE_KEY=                    # Required if using Supabase (NEVER expose to client)

#==============================================================================
# Development Only (Not used in production)
#==============================================================================

# Vercel Analytics
ANALYZE=false                                  # Set to 'true' to analyze bundle size
```

**Documentation Format**:
- ✅ Group by purpose (Build-Time, Runtime, Dev)
- ✅ Mark required vs optional
- ✅ Include example values (non-sensitive)
- ✅ Add generation instructions (e.g., `openssl rand -base64 32`)
- ✅ Explain what each variable does

#### 1.2.3 Validation Script

**Real-World Issue**: zmartV0.69 INCIDENT-001 - Missing `BACKEND_AUTHORITY_PRIVATE_KEY` caused PM2 crash loop (47 restarts in 4 minutes)

**Prevention**: Validate environment variables on startup

Create `src/config/env.ts`:

```typescript
import { z } from 'zod';

// Define schema for ALL environment variables
const envSchema = z.object({
  // Build-Time (Public)
  NEXT_PUBLIC_CHAIN_ID: z.string().transform(Number).pipe(z.number().int().positive()),
  NEXT_PUBLIC_RPC_URL: z.string().url(),
  NEXT_PUBLIC_WALLET_CONNECT_ID: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),

  // Runtime (Private)
  DATABASE_URL: z.string().url().optional(), // Optional: might use lazy init
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Validate and export typed environment
export const env = envSchema.parse({
  // Build-Time
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_WALLET_CONNECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,

  // Runtime
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Node
  NODE_ENV: process.env.NODE_ENV,
});

// Type-safe environment access throughout your app
export type Env = z.infer<typeof envSchema>;
```

**Usage in Your App**:

```typescript
// Instead of process.env (unsafe)
import { env } from '@/config/env';

const chainId = env.NEXT_PUBLIC_CHAIN_ID; // Type-safe, validated
```

**Benefits**:
- ✅ Fails fast on startup if variables missing
- ✅ TypeScript autocomplete for all env vars
- ✅ Catches typos at compile time
- ✅ Documents expected types
- ✅ Prevents runtime errors in production

#### 1.2.4 Handle Newline Characters (CRITICAL)

**Real-World Issue**: zmartV0.69 commit `e62a3f8` - "fix: Remove newline character from API URL environment variables"

**Symptom**: API calls fail silently because URLs have invisible `\n` characters

```bash
# .env (BROKEN - has invisible newline)
API_URL=http://localhost:4000\n

# fetch() calls: "http://localhost:4000\n/markets"
# Result: DNS lookup fails, CORS error, or timeout
```

**Detection Script**:

Create `scripts/validate-env.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Validating environment files..."

# Check for newline characters in .env files
for env_file in .env .env.local .env.production; do
  if [ -f "$env_file" ]; then
    echo "Checking $env_file..."

    # Find lines with trailing newline
    if grep -P '\n$' "$env_file"; then
      echo "❌ ERROR: Found trailing newline in $env_file"
      echo "Fix: Remove invisible newline characters"
      exit 1
    fi

    # Check for Windows line endings (CRLF)
    if file "$env_file" | grep -q "CRLF"; then
      echo "⚠️  WARNING: $env_file has Windows line endings (CRLF)"
      echo "Fix: Run 'dos2unix $env_file' or configure git to use LF"
    fi

    echo "✅ $env_file looks good"
  fi
done

echo "✅ All environment files validated"
```

**Make executable and run**:

```bash
chmod +x scripts/validate-env.sh
./scripts/validate-env.sh
```

**Add to package.json**:

```json
{
  "scripts": {
    "validate:env": "./scripts/validate-env.sh",
    "prebuild": "pnpm validate:env"
  }
}
```

**Prevention**:
1. Configure git to use LF line endings
2. Add validation to pre-commit hooks
3. Trim values in env loading code

#### 1.2.5 Add Variables to Vercel

**Via Vercel Dashboard**:

1. Go to https://vercel.com/[team]/[project]/settings/environment-variables
2. Add each variable from `.env.example`
3. Select environments: Production, Preview, Development
4. **IMPORTANT**: Use "Sensitive" checkbox for secrets

**Via Vercel CLI** (Automated):

Create `scripts/sync-env-to-vercel.sh`:

```bash
#!/bin/bash
set -e

# Load .env.production (or .env)
if [ ! -f .env.production ]; then
  echo "❌ ERROR: .env.production not found"
  exit 1
fi

echo "🚀 Syncing environment variables to Vercel..."

# Read each line from .env.production
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue

  # Remove quotes from value
  value=$(echo "$value" | sed 's/^"//;s/"$//')

  # Add to Vercel (production environment)
  echo "Adding $key..."
  vercel env add "$key" production <<< "$value"
done < .env.production

echo "✅ Environment variables synced to Vercel"
```

**Security Notes**:
- ⚠️ NEVER commit `.env` or `.env.production` to git
- ⚠️ Use Vercel's "Sensitive" flag for secrets
- ⚠️ Rotate secrets regularly (see Guide 03: Security)
- ⚠️ Use different values for preview/production environments

---

### 1.3 Build Configuration

#### 1.3.1 Handle Build-Time Database Dependencies

**Real-World Issue**: kektechV0.69 commits `c7e6a10`, `a3d9fa1`, `10dffa3` - "Lazy initialize Prisma to prevent build-time errors"

**Problem**: `DATABASE_URL` is not available during Vercel build. If you initialize Prisma/database clients at module level, the build fails.

**BROKEN Code** (causes Vercel build failure):

```typescript
// lib/db.ts (BROKEN)
import { PrismaClient } from '@prisma/client';

// ❌ This runs at import time, BEFORE DATABASE_URL is available
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL, // undefined during build!
});

export default prisma;
```

**WORKING Code** (lazy initialization):

```typescript
// lib/db.ts (WORKING)
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

export async function getPrisma(): Promise<PrismaClient> {
  if (!prisma) {
    // Only initialize when actually needed (runtime)
    prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL, // Available at runtime
    });
  }
  return prisma;
}

// For development, handle hot reload
if (process.env.NODE_ENV !== 'production') {
  if (!(global as any).prisma) {
    (global as any).prisma = new PrismaClient();
  }
  prisma = (global as any).prisma;
}
```

**Usage in API Routes**:

```typescript
// app/api/markets/route.ts
import { getPrisma } from '@/lib/db';

export async function GET() {
  const prisma = await getPrisma(); // Lazy init
  const markets = await prisma.market.findMany();
  return Response.json(markets);
}
```

#### 1.3.2 Prisma Client Generation

**Add to `package.json`**:

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

**Why This Matters**:
- Vercel runs `pnpm install`
- `postinstall` hook runs automatically
- Generates Prisma client from schema
- **Without this**: Build fails with "Cannot find module '@prisma/client'"

**Real Issue**: kektechV0.69 commit `c7e6a10` - "fix: Add postinstall script to generate Prisma client"

#### 1.3.3 Optimize Build Performance

**Next.js 15 Configuration**:

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Optimize build
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production', // Remove console.logs in prod
  },

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['@solana/web3.js', 'ethers'], // Reduce bundle size
  },

  // Environment variables (runtime only, NOT build-time)
  serverRuntimeConfig: {
    // Only available server-side
    databaseUrl: process.env.DATABASE_URL,
  },
  publicRuntimeConfig: {
    // Available both server and client (prefer NEXT_PUBLIC_ prefix)
  },

  // Webpack customization
  webpack: (config, { isServer }) => {
    // Fix for "Can't resolve 'fs'" errors in client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
```

**Common Build Issues**:

| Error | Cause | Fix |
|-------|-------|-----|
| `Can't resolve 'fs'` | Server-only module imported in client | Add to `webpack.resolve.fallback` |
| `Module not found: Can't resolve 'crypto'` | Node.js built-in in browser | Use `crypto-browserify` or fallback to `false` |
| Build timeout (>15 min) | Too much computation | Split builds, optimize imports |

---

### 1.4 Domain & SSL Setup

**Skip to 1.5 if using Vercel's default domain (e.g., `my-app.vercel.app`)**

#### 1.4.1 Add Custom Domain

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add domain: `yourdomain.com`
3. Vercel provides DNS records

**For Cloudflare DNS**:

```
Type: CNAME
Name: @
Target: cname.vercel-dns.com
Proxy: Disabled (grey cloud)
```

**For Subdomain** (e.g., `app.yourdomain.com`):

```
Type: CNAME
Name: app
Target: cname.vercel-dns.com
```

#### 1.4.2 SSL Certificate

Vercel automatically provisions SSL certificates via Let's Encrypt.

**Verification**:
- ✅ HTTPS works within 30 seconds
- ✅ Automatic renewal every 90 days
- ✅ HTTP → HTTPS redirect automatic

**If SSL Doesn't Work**:
1. Check DNS propagation: `dig yourdomain.com`
2. Verify CNAME points to `cname.vercel-dns.com`
3. Check Vercel dashboard for SSL status
4. Wait up to 24 hours for DNS propagation

---

### 1.5 Deployment Automation

#### 1.5.1 GitHub Integration

**Connect Repository**:

1. Vercel Dashboard → New Project
2. Import Git Repository
3. Select your repository
4. Configure project (uses `vercel.json` if present)

**Automatic Deployments**:
- ✅ Push to `main` → Production deployment
- ✅ Push to other branches → Preview deployment
- ✅ Pull request → Preview deployment with unique URL

#### 1.5.2 GitHub Actions (Optional Advanced)

For more control, use GitHub Actions:

`.github/workflows/deploy-vercel.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install Vercel CLI
        run: npm install -g vercel@latest

      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

**Get Vercel Secrets**:

```bash
# Get Vercel token
vercel login
vercel whoami

# Get org and project IDs
cat .vercel/project.json
```

Add to GitHub Secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

---

### 1.6 Troubleshooting Guide

#### Build Failures

**"Cannot find package.json"**

```bash
# Check vercel.json
cat vercel.json | jq '.rootDirectory'

# Should match your frontend location
# Fix: Update rootDirectory
```

**"Cannot find module 'next'"**

```bash
# Check if pnpm is detected
cat package.json | jq '.packageManager'

# Should be: "pnpm@8.x" or similar
# Fix: Add to root package.json
echo '"packageManager": "pnpm@8.15.0"' >> package.json
```

**"Prisma Client not generated"**

```bash
# Check postinstall hook
cat package.json | jq '.scripts.postinstall'

# Should be: "prisma generate"
# Fix: Add postinstall script
npm pkg set scripts.postinstall="prisma generate"
```

#### Runtime Errors

**"Mixed Content" (HTTPS → HTTP blocked)**

See [Part 3.1: HTTPS/WSS Configuration](#31-httpswss-configuration)

**"Environment variable undefined"**

```bash
# Check Vercel dashboard
vercel env ls

# Add missing variables
vercel env add VARIABLE_NAME production
```

**Database connection fails**

```typescript
// Verify DATABASE_URL format
console.log(process.env.DATABASE_URL?.substring(0, 20)); // Check prefix

// Should be: postgresql://... or mysql://...
```

---

## Part 2: VPS Backend Deployment

**When to Use VPS**:
- ✅ Long-running processes (blockchain indexers, event listeners)
- ✅ WebSocket servers
- ✅ Microservices architecture
- ✅ Custom infrastructure needs

**When to Use Vercel**:
- ✅ Serverless API routes
- ✅ Static frontend
- ✅ Edge functions

**Many projects use BOTH**: Vercel for frontend, VPS for backend (like zmartV0.69)

---

### 2.1 Server Setup & Security

#### 2.1.1 Initial Server Configuration

**Providers**: DigitalOcean, Hetzner, Vultr, AWS EC2, etc.

**Recommended Specs** (for blockchain indexer + API):
- CPU: 2+ cores
- RAM: 4GB minimum (8GB recommended)
- Disk: 80GB+ SSD
- OS: Ubuntu 22.04 LTS

**Initial Setup**:

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser deployer
usermod -aG sudo deployer

# Setup SSH key authentication
su - deployer
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Add your public key to ~/.ssh/authorized_keys
# chmod 600 ~/.ssh/authorized_keys
```

#### 2.1.2 Security Hardening

**Disable root login**:

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Change these lines:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

**Setup firewall**:

```bash
# Install UFW
sudo apt install ufw

# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 4000/tcp  # Backend API port (example)

# Enable firewall
sudo ufw enable
```

**Install fail2ban** (prevent brute force):

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

### 2.2 PM2 Process Management

**Real-World Issue**: zmartV0.69 INCIDENT-001 - PM2 crash loop (47 restarts in 4 minutes)

**Prevention**: Proper PM2 configuration + pre-deployment checks

#### 2.2.1 Install PM2

```bash
# Install Node.js 20 (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Install PM2 globally
npm install -g pm2

# Setup PM2 startup script (starts on server reboot)
pm2 startup
# Run the command it outputs (starts with 'sudo')
```

#### 2.2.2 Create ecosystem.config.js

**Real-World Working Configuration** (from zmartV0.69):

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'backend-api',
      script: './dist/index.js',
      instances: 2, // Cluster mode (2 instances)
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // CRITICAL: Pre-deploy checks (prevents INCIDENT-001)
      pre_deploy_local: 'npm run build && npm run test',

      // Restart strategy
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',

      // Wait for app to be ready
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
    {
      name: 'vote-aggregator',
      script: './dist/vote-aggregator/src/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/vote-aggregator-error.log',
      out_file: './logs/vote-aggregator-out.log',
      merge_logs: true,

      // CRITICAL: Verify compiled files exist
      pre_deploy_local: 'test -f ./dist/vote-aggregator/src/index.js || npm run build',

      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'event-indexer',
      script: './dist/event-indexer/src/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/event-indexer-error.log',
      out_file: './logs/event-indexer-out.log',
      merge_logs: true,

      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'market-monitor',
      script: './dist/market-monitor/src/index.js',
      instances: 1,
      cron_restart: '0 * * * *', // Restart every hour (for memory cleanup)
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/market-monitor-error.log',
      out_file: './logs/market-monitor-out.log',
      merge_logs: true,

      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
```

**Critical PM2 Configuration Explained**:

| Setting | Purpose | Prevents |
|---------|---------|----------|
| `pre_deploy_local` | Build/test before starting | INCIDENT-001 (missing compiled files) |
| `max_restarts: 10` | Limit restarts to prevent infinite loops | Crash loops |
| `min_uptime: '10s'` | Only count as success if runs >10s | Immediate crashes |
| `wait_ready: true` | Wait for app to signal ready | Premature traffic routing |
| `max_memory_restart` | Auto-restart if memory exceeds limit | Memory leaks |
| `cron_restart` | Periodic restarts | Long-running memory leaks |

#### 2.2.3 Deployment Commands

**Initial deployment**:

```bash
# Build TypeScript (CRITICAL: Do this FIRST)
npm run build

# Verify compiled files exist (prevents INCIDENT-001)
test -f dist/index.js || { echo "Build failed!"; exit 1; }

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Check status
pm2 status

# Expected output:
# ┌─────┬──────────────────┬─────────┬─────────┬──────────┬─────────┐
# │ id  │ name             │ mode    │ status  │ restart  │ uptime  │
# ├─────┼──────────────────┼─────────┼─────────┼──────────┼─────────┤
# │ 0   │ backend-api      │ cluster │ online  │ 0        │ 2m      │
# │ 1   │ vote-aggregator  │ fork    │ online  │ 0        │ 2m      │
# │ 2   │ event-indexer    │ fork    │ online  │ 0        │ 2m      │
# │ 3   │ market-monitor   │ fork    │ online  │ 0        │ 2m      │
# └─────┴──────────────────┴─────────┴─────────┴──────────┴─────────┘
```

**Update deployment** (zero-downtime):

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify build succeeded
test -f dist/index.js || { echo "Build failed!"; exit 1; }

# Reload PM2 processes (zero-downtime)
pm2 reload ecosystem.config.js

# Check logs for errors
pm2 logs --lines 50
```

#### 2.2.4 Monitoring PM2 Processes

**Real-Time Monitoring**:

```bash
# Dashboard with CPU/memory
pm2 monit

# Logs (all processes)
pm2 logs

# Logs (specific process)
pm2 logs backend-api

# Status overview
pm2 status
```

**Detect Crash Loops** (INCIDENT-001):

```bash
# Check restart count
pm2 status

# If restart count is HIGH (>10) and uptime is LOW (<1m):
# ↓ CRASH LOOP DETECTED

# Check logs immediately
pm2 logs --lines 100 --err

# Common causes:
# 1. Missing environment variables
# 2. TypeScript compilation failed (no dist/ files)
# 3. Port already in use
# 4. Database connection failed
```

**Automated Alerts**:

```bash
# Install PM2-logrotate (prevent log files from filling disk)
pm2 install pm2-logrotate

# Install PM2 monitoring (optional, paid service)
pm2 link YOUR_SECRET YOUR_PUBLIC
```

---

### 2.3 Multi-Service Architecture

**zmartV0.69 Architecture** (from forensics):

```
VPS (185.202.236.71)
├── backend-api:4000           # Main API (Express)
│   ├── /api/markets
│   ├── /api/activity
│   └── /health
├── vote-aggregator:4001       # Solana vote aggregation
│   ├── Listens to blockchain events
│   ├── Aggregates votes
│   └── Updates database
├── event-indexer:4002         # Blockchain event indexing
│   ├── Indexes market creation
│   ├── Indexes trades
│   └── Indexes resolutions
└── market-monitor:4003        # Market monitoring
    ├── Checks market expiry
    ├── Triggers resolutions
    └── Health checks
```

#### 2.3.1 Service Communication

**Option 1: HTTP** (Simple, works across servers):

```typescript
// backend-api calls vote-aggregator
const response = await fetch('http://localhost:4001/aggregate-votes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ marketId }),
});
```

**Option 2: Redis Pub/Sub** (Event-driven, scalable):

```typescript
// vote-aggregator publishes event
import Redis from 'ioredis';
const redis = new Redis();

await redis.publish('votes:aggregated', JSON.stringify({ marketId, result }));

// backend-api subscribes to events
redis.subscribe('votes:aggregated');
redis.on('message', (channel, message) => {
  const { marketId, result } = JSON.parse(message);
  // Update frontend via WebSocket
});
```

**Option 3: Shared Database** (Simplest for read-heavy):

```typescript
// vote-aggregator writes to database
await prisma.voteResult.create({ data: { marketId, result } });

// backend-api reads from database
const result = await prisma.voteResult.findUnique({ where: { marketId } });
```

#### 2.3.2 Health Checks for Each Service

**Add to each service** (prevents silent failures):

```typescript
// src/health.ts
import express from 'express';

export function createHealthRouter() {
  const router = express.Router();

  router.get('/health', (req, res) => {
    // Check dependencies
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),

      // Service-specific checks
      database: 'ok', // TODO: Actual DB ping
      blockchain: 'ok', // TODO: Actual RPC ping
    };

    res.json(checks);
  });

  router.get('/ready', async (req, res) => {
    // More thorough readiness check
    try {
      // Check database
      await prisma.$queryRaw`SELECT 1`;

      // Check blockchain RPC
      await connection.getSlot();

      res.json({ ready: true });
    } catch (error) {
      res.status(503).json({ ready: false, error: error.message });
    }
  });

  return router;
}

// Use in each service
app.use(createHealthRouter());
```

**Monitor from external service**:

```bash
# Check all services
curl http://YOUR_SERVER_IP:4000/health  # backend-api
curl http://YOUR_SERVER_IP:4001/health  # vote-aggregator
curl http://YOUR_SERVER_IP:4002/health  # event-indexer
curl http://YOUR_SERVER_IP:4003/health  # market-monitor

# All should return 200 OK with { status: 'ok' }
```

---

### 2.4 HTTPS with Cloudflare Tunnel

**Problem**: Frontend on Vercel (HTTPS) → Backend on VPS (HTTP) = Mixed Content Error (blocked by browser)

**Real-World Issue**: zmartV0.69 commit `6899150` - "fix: Add Vercel proxy to solve HTTPS mixed content issue"

**Solution**: Use Cloudflare Tunnel to expose VPS backend via HTTPS

#### 2.4.1 Install Cloudflared

On your VPS:

```bash
# Download cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Verify installation
cloudflared --version
```

#### 2.4.2 Authenticate with Cloudflare

```bash
# Login (opens browser)
cloudflared tunnel login

# Verify authentication
cloudflared tunnel list
```

#### 2.4.3 Create Tunnel

```bash
# Create tunnel
cloudflared tunnel create backend-api

# Output:
# Tunnel credentials written to /home/deployer/.cloudflared/TUNNEL_ID.json
# TUNNEL_ID: abc123-def456-ghi789

# Save tunnel ID
export TUNNEL_ID=abc123-def456-ghi789
```

#### 2.4.4 Configure Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: abc123-def456-ghi789
credentials-file: /home/deployer/.cloudflared/abc123-def456-ghi789.json

ingress:
  # Route api.yourdomain.com to backend-api (port 4000)
  - hostname: api.yourdomain.com
    service: http://localhost:4000

  # Route ws.yourdomain.com to WebSocket server (port 4000)
  - hostname: ws.yourdomain.com
    service: http://localhost:4000

  # Catch-all (required)
  - service: http_status:404
```

#### 2.4.5 Add DNS Records

```bash
# Route DNS to tunnel
cloudflared tunnel route dns backend-api api.yourdomain.com
cloudflared tunnel route dns backend-api ws.yourdomain.com

# Verify DNS
dig api.yourdomain.com  # Should show CNAME to tunnel
```

#### 2.4.6 Run Tunnel as Service

```bash
# Install as systemd service
sudo cloudflared service install

# Start service
sudo systemctl start cloudflared

# Enable on boot
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared

# Expected output:
# ● cloudflared.service - Cloudflare Tunnel
#    Loaded: loaded
#    Active: active (running)
```

#### 2.4.7 Verify HTTPS Access

```bash
# Test from anywhere
curl https://api.yourdomain.com/health

# Should return 200 OK with health check data
# ✅ HTTPS working!
```

**Update Frontend Environment Variables**:

```bash
# .env.production (Vercel)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://ws.yourdomain.com
```

**Benefits**:
- ✅ Automatic HTTPS via Cloudflare
- ✅ No need to manage SSL certificates
- ✅ DDoS protection
- ✅ Global CDN
- ✅ Works behind NAT/firewall (no port forwarding needed)

---

### 2.5 Monitoring & Health Checks

#### 2.5.1 PM2 Monitoring Commands

```bash
# Real-time dashboard
pm2 monit

# Logs
pm2 logs --lines 100

# Memory usage
pm2 ls | grep -E '(memory|restart)'

# CPU usage
top -u deployer
```

#### 2.5.2 Automated Health Checks

**Create monitoring script**:

```bash
#!/bin/bash
# scripts/health-check.sh

SERVICES=(
  "http://localhost:4000/health:backend-api"
  "http://localhost:4001/health:vote-aggregator"
  "http://localhost:4002/health:event-indexer"
  "http://localhost:4003/health:market-monitor"
)

echo "🔍 Checking service health..."

for service in "${SERVICES[@]}"; do
  IFS=':' read -r url name <<< "$service"

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")

  if [ "$response" -eq 200 ]; then
    echo "✅ $name: OK"
  else
    echo "❌ $name: FAILED (HTTP $response)"
    # Alert (send to Slack/Discord/email)
    # pm2 restart "$name"  # Auto-restart
  fi
done
```

**Run every 5 minutes**:

```bash
# Add to crontab
crontab -e

# Add line:
*/5 * * * * /home/deployer/backend/scripts/health-check.sh >> /home/deployer/logs/health-check.log 2>&1
```

#### 2.5.3 Disk Space Monitoring

```bash
# Check disk usage
df -h

# Clean PM2 logs (if too large)
pm2 flush

# Setup log rotation (already done with pm2-logrotate)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

---

### 2.6 Zero-Downtime Deployment

**Real-World Pattern**: zmartV0.69 production deployments

#### 2.6.1 Deployment Script

Create `scripts/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting zero-downtime deployment..."

# 1. Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# 2. Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# 3. Run tests
echo "🧪 Running tests..."
pnpm test --run

# 4. Build TypeScript
echo "🔨 Building TypeScript..."
pnpm build

# 5. Verify build artifacts exist (CRITICAL)
echo "✅ Verifying build artifacts..."
required_files=(
  "dist/index.js"
  "dist/vote-aggregator/src/index.js"
  "dist/event-indexer/src/index.js"
  "dist/market-monitor/src/index.js"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ ERROR: Missing build artifact: $file"
    exit 1
  fi
done

echo "✅ All build artifacts present"

# 6. Database migrations (if any)
echo "🗄️  Running database migrations..."
pnpm prisma migrate deploy

# 7. Reload PM2 (zero-downtime)
echo "♻️  Reloading PM2 processes..."
pm2 reload ecosystem.config.js --update-env

# 8. Wait for processes to stabilize
echo "⏳ Waiting for processes to stabilize..."
sleep 10

# 9. Verify all processes are online
echo "🔍 Verifying processes..."
if pm2 status | grep -q 'errored'; then
  echo "❌ ERROR: Some processes failed to start"
  pm2 logs --lines 50 --err
  exit 1
fi

# 10. Health checks
echo "🏥 Running health checks..."
./scripts/health-check.sh

echo "✅ Deployment complete!"
echo "📊 PM2 Status:"
pm2 status
```

**Make executable**:

```bash
chmod +x scripts/deploy.sh
```

#### 2.6.2 Rollback Procedure

Create `scripts/rollback.sh`:

```bash
#!/bin/bash
set -e

# Get previous commit
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)

echo "⚠️  Rolling back to $PREVIOUS_COMMIT..."

# 1. Reset to previous commit
git reset --hard "$PREVIOUS_COMMIT"

# 2. Rebuild
pnpm install
pnpm build

# 3. Reload PM2
pm2 reload ecosystem.config.js

# 4. Verify
./scripts/health-check.sh

echo "✅ Rollback complete"
```

---

## Part 3: Integration & Testing

### 3.1 HTTPS/WSS Configuration

**Real-World Issue**: zmartV0.69 - 6 commits fixing mixed content errors

**Problem**: Browser blocks HTTP requests from HTTPS pages (called "Mixed Content")

#### 3.1.1 Ensure All Services Use HTTPS

```bash
# Frontend (Vercel)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com       # ✅ HTTPS
NEXT_PUBLIC_WS_URL=wss://ws.yourdomain.com            # ✅ WSS (secure WebSocket)

# NOT:
NEXT_PUBLIC_API_URL=http://185.202.236.71:4000       # ❌ HTTP (blocked!)
NEXT_PUBLIC_WS_URL=ws://185.202.236.71:4000          # ❌ WS (blocked!)
```

#### 3.1.2 WebSocket Connection

**Client-side** (Next.js):

```typescript
// lib/websocket.ts
import { useEffect, useState } from 'react';

export function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Use environment variable (MUST be HTTPS for WSS)
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;

    if (!wsUrl) {
      console.error('NEXT_PUBLIC_WS_URL not configured');
      return;
    }

    // Create WebSocket connection
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);

      // Reconnect after 5 seconds
      setTimeout(() => {
        console.log('Reconnecting...');
        // Re-run effect
      }, 5000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(socket);

    // Cleanup on unmount
    return () => {
      socket.close();
    };
  }, []);

  return { ws, isConnected };
}
```

**Server-side** (Backend):

```typescript
// src/websocket.ts
import { WebSocketServer } from 'ws';
import http from 'http';

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    console.log('Client connected:', req.socket.remoteAddress);

    ws.on('message', (data) => {
      console.log('Received:', data);
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });

    // Send initial message
    ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
  });

  return wss;
}

// Usage in server setup
const server = http.createServer(app);
setupWebSocket(server);
server.listen(4000);
```

#### 3.1.3 Testing WebSocket

```bash
# Test WSS connection (requires wscat)
npm install -g wscat

# Connect to your WSS endpoint
wscat -c wss://ws.yourdomain.com

# Should see:
# Connected (press CTRL+C to quit)
# < {"type":"connected","timestamp":1234567890}
```

---

### 3.2 CORS & Security Headers

#### 3.2.1 CORS Configuration

**Backend** (`src/index.ts`):

```typescript
import express from 'express';
import cors from 'cors';

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com', 'https://www.yourdomain.com']
    : ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
```

#### 3.2.2 Security Headers

**Add helmet middleware**:

```bash
pnpm add helmet
```

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        'https://api.yourdomain.com',
        'wss://ws.yourdomain.com',
      ],
    },
  },
}));
```

---

### 3.3 Production Testing Checklist

**Before declaring "deployment complete"**, verify:

#### Frontend Checklist

- [ ] HTTPS works (no browser warnings)
- [ ] No console errors
- [ ] All pages load correctly
- [ ] Wallet connection works
- [ ] API calls succeed (check Network tab)
- [ ] WebSocket connects (check Network → WS)
- [ ] No "Mixed Content" errors

#### Backend Checklist

- [ ] All PM2 processes show "online"
- [ ] No crash loops (restart count < 5)
- [ ] Health checks return 200 OK
- [ ] Logs show no errors
- [ ] Database connection works
- [ ] Blockchain RPC connection works
- [ ] Environment variables loaded correctly

#### Integration Checklist

- [ ] Frontend can call backend API
- [ ] WebSocket real-time updates work
- [ ] Database writes from backend appear in frontend
- [ ] Blockchain events trigger backend updates
- [ ] CORS allows frontend requests

---

### 3.4 Rollback Procedures

**If deployment fails**:

1. **Frontend (Vercel)**:
   - Vercel Dashboard → Deployments → Previous deployment → "Promote to Production"
   - Or: `git revert HEAD && git push`

2. **Backend (VPS)**:
   - Run `./scripts/rollback.sh`
   - Or manually:
     ```bash
     git reset --hard HEAD~1
     pnpm install && pnpm build
     pm2 reload all
     ```

3. **Database**:
   - If migrations ran: `pnpm prisma migrate resolve --rolled-back MIGRATION_NAME`
   - Restore from backup if necessary

---

## Part 4: Real-World Issues Reference

This section documents actual production issues from zmartV0.69 and kektechV0.69.

### 4.1 Vercel Build Failures

**Issue**: "Cannot find package.json"
- **Commits**: zmartV0.69: `3237d05`, `2c6aa53`
- **Cause**: Wrong `rootDirectory` in `vercel.json`
- **Solution**: Set `rootDirectory: "frontend"` in `vercel.json`
- **Prevention**: Test with `vercel build` locally

**Issue**: "Prisma Client not generated"
- **Commits**: kektechV0.69: `c7e6a10`, `a3d9fa1`
- **Cause**: Missing `postinstall` script
- **Solution**: Add `"postinstall": "prisma generate"` to `package.json`
- **Prevention**: See [Section 1.3.2](#132-prisma-client-generation)

**Issue**: "DATABASE_URL required during build"
- **Commits**: kektechV0.69: `10dffa3`, `aede878`, `c6d74e9`
- **Cause**: Eager initialization of Prisma client at module level
- **Solution**: Lazy initialization (see [Section 1.3.1](#131-handle-build-time-database-dependencies))

---

### 4.2 PM2 Crash Loops

**Issue**: Services restart 47 times in 4 minutes
- **Incident**: zmartV0.69 INCIDENT-001
- **Causes**:
  1. Missing environment variable (`BACKEND_AUTHORITY_PRIVATE_KEY`)
  2. TypeScript compilation failed (no `dist/` files)
- **Symptoms**:
  - PM2 shows "online" but uptime < 10s
  - High restart count (>10)
  - Empty logs (because code never ran)
- **Solution**: See [Part 2.2: PM2 Process Management](#22-pm2-process-management)
- **Prevention**:
  - Add `pre_deploy_local: 'npm run build'` to `ecosystem.config.js`
  - Add environment validation script
  - Check `test -f dist/index.js` before `pm2 start`

---

### 4.3 Mixed Content Errors

**Issue**: Browser blocks HTTP requests from HTTPS page
- **Commits**: zmartV0.69: `6899150`, `bdabbad`, `c9377f4`
- **Symptoms**:
  - Frontend loads successfully
  - All API calls fail with CORS error
  - Console: "Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure XMLHttpRequest endpoint 'http://...'. This request has been blocked; the content must be served over HTTPS."
- **Root Cause**: Frontend on Vercel (HTTPS), backend on VPS (HTTP)
- **Solution**: Cloudflare Tunnel (see [Section 2.4](#24-https-with-cloudflare-tunnel))
- **Alternative**: Vercel API proxy (see zmartV0.69 commit `6899150`)

---

### 4.4 Environment Variable Problems

**Issue**: Newline character in environment variable
- **Commits**: zmartV0.69: `e62a3f8`, `4f890d3`
- **Symptoms**:
  - API URL looks correct in code
  - All fetch() calls fail with DNS error
  - Error: "getaddrinfo ENOTFOUND localhost\n"
- **Detection**:
  ```bash
  cat .env | od -c | grep '\\n'
  ```
- **Solution**: Manually remove newlines, use validation script (see [Section 1.2.4](#124-handle-newline-characters-critical))

**Issue**: Missing environment variable
- **Commits**: zmartV0.69: INCIDENT-001
- **Symptoms**: Immediate crash on startup
- **Solution**: Add environment validation (see [Section 1.2.3](#123-validation-script))

---

## Summary & Next Steps

**What We've Covered**:
- ✅ Vercel frontend deployment (monorepo configuration, environment variables, builds)
- ✅ VPS backend deployment (PM2, multi-service architecture, HTTPS)
- ✅ Production integration (HTTPS/WSS, CORS, testing)
- ✅ Real-world issue reference (from 456 commits analyzed)

**Time Saved**:
- **Before this guide**: 20+ hours on deployment issues
- **After this guide**: 2-3 hours for first deployment, <1 hour for updates

**Next Guides**:
- **Guide 18**: Backend/Frontend Integration Patterns
- **Guide 19**: Documentation Standards & Validation
- **Guide 20**: TypeScript Strict Migration

**Final Checklist**:
- [ ] Vercel deployment works
- [ ] VPS backend deployed with PM2
- [ ] HTTPS/WSS configured
- [ ] All health checks passing
- [ ] No console errors
- [ ] Production testing complete
- [ ] Rollback procedure documented
- [ ] Team trained on deployment process

---

**Document Version**: 1.0.0
**Based on**: zmartV0.69 (216 commits) + kektechV0.69 (240 commits) forensic analysis
**Last Updated**: November 14, 2025
**Status**: Ready for Production Use
