#!/usr/bin/env ts-node
/**
 * Gas Price Monitoring System
 *
 * Adaptive deployment strategy that pauses on gas spikes and auto-retries
 * Addresses Edge Case 3.2: Gas price spike during deployment
 *
 * Features:
 * - Real-time gas price monitoring
 * - Configurable thresholds per chain
 * - Automatic pause/retry on spikes
 * - Historical tracking and alerts
 * - Cost estimation
 */

import * as fs from 'fs';
import * as path from 'path';

interface GasStrategy {
  maxAcceptableGwei: number;
  pauseAboveGwei: number;
  retryIntervalMinutes: number;
  maxWaitHours: number;
  autoResumeBelow: number;
}

interface GasPriceData {
  timestamp: number;
  gasPrice: number; // in gwei
  chain: string;
  source: string;
}

interface GasMonitorState {
  [chain: string]: {
    currentPrice: number;
    lastUpdate: number;
    history: Array<{ timestamp: number; price: number }>;
    isPaused: boolean;
    pausedSince?: number;
    alertThreshold: number;
  };
}

const DEFAULT_STRATEGIES: { [key: string]: GasStrategy } = {
  ethereum: {
    maxAcceptableGwei: 100,
    pauseAboveGwei: 150,
    retryIntervalMinutes: 30,
    maxWaitHours: 24,
    autoResumeBelow: 80,
  },
  sepolia: {
    maxAcceptableGwei: 50,
    pauseAboveGwei: 100,
    retryIntervalMinutes: 15,
    maxWaitHours: 12,
    autoResumeBelow: 40,
  },
  bsc: {
    maxAcceptableGwei: 10,
    pauseAboveGwei: 20,
    retryIntervalMinutes: 15,
    maxWaitHours: 12,
    autoResumeBelow: 8,
  },
  avalanche: {
    maxAcceptableGwei: 50,
    pauseAboveGwei: 100,
    retryIntervalMinutes: 15,
    maxWaitHours: 12,
    autoResumeBelow: 40,
  },
};

const CHAIN_RPC_URLS: { [key: string]: string } = {
  ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
  sepolia: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
  bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
  avalanche: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
};

class GasMonitor {
  private statePath: string;
  private state: GasMonitorState;
  private strategies: { [key: string]: GasStrategy };

  constructor(
    statePath: string = '.claude/state/gas-monitor-state.json',
    customStrategies?: { [key: string]: GasStrategy }
  ) {
    this.statePath = statePath;
    this.strategies = customStrategies || DEFAULT_STRATEGIES;
    this.state = this.loadState();
  }

  private loadState(): GasMonitorState {
    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.statePath)) {
        const data = fs.readFileSync(this.statePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load gas monitor state:', error);
    }

    return {};
  }

  private saveState(): void {
    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const tempPath = `${this.statePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2));
      fs.renameSync(tempPath, this.statePath);
    } catch (error) {
      console.error('Failed to save gas monitor state:', error);
      throw error;
    }
  }

  private initChain(chain: string): void {
    if (!this.state[chain]) {
      this.state[chain] = {
        currentPrice: 0,
        lastUpdate: 0,
        history: [],
        isPaused: false,
        alertThreshold: this.strategies[chain]?.maxAcceptableGwei || 100,
      };
    }
  }

  /**
   * Fetch current gas price from RPC
   */
  async getCurrentGasPrice(chain: string): Promise<number> {
    const rpcUrl = CHAIN_RPC_URLS[chain];
    if (!rpcUrl) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1,
        }),
      });

      const data = await response.json();
      const gasPriceWei = parseInt(data.result, 16);
      const gasPriceGwei = gasPriceWei / 1e9;

      // Update state
      this.initChain(chain);
      this.state[chain].currentPrice = gasPriceGwei;
      this.state[chain].lastUpdate = Date.now();

      // Add to history (keep last 100 samples)
      this.state[chain].history.push({
        timestamp: Date.now(),
        price: gasPriceGwei,
      });

      if (this.state[chain].history.length > 100) {
        this.state[chain].history = this.state[chain].history.slice(-100);
      }

      this.saveState();

      return gasPriceGwei;
    } catch (error) {
      console.error(`[${chain}] Failed to fetch gas price:`, error);
      throw error;
    }
  }

  /**
   * Check if deployment should proceed based on current gas price
   */
  async shouldProceedWithDeployment(
    chain: string,
    customStrategy?: GasStrategy
  ): Promise<{ proceed: boolean; reason: string; gasPrice: number }> {
    const strategy = customStrategy || this.strategies[chain];
    if (!strategy) {
      throw new Error(`No strategy defined for chain: ${chain}`);
    }

    const currentPrice = await this.getCurrentGasPrice(chain);

    // Check if paused and should auto-resume
    if (this.state[chain].isPaused) {
      if (currentPrice <= strategy.autoResumeBelow) {
        this.state[chain].isPaused = false;
        delete this.state[chain].pausedSince;
        this.saveState();
        console.log(
          `[${chain}] Auto-resuming: gas price ${currentPrice} gwei <= threshold ${strategy.autoResumeBelow} gwei`
        );
      } else {
        const pausedDuration = Date.now() - (this.state[chain].pausedSince || 0);
        const pausedHours = pausedDuration / (1000 * 60 * 60);

        if (pausedHours >= strategy.maxWaitHours) {
          return {
            proceed: false,
            reason: `Paused for ${pausedHours.toFixed(1)}h (max: ${strategy.maxWaitHours}h). Manual intervention required.`,
            gasPrice: currentPrice,
          };
        }

        return {
          proceed: false,
          reason: `Paused: gas price ${currentPrice} gwei (waiting for < ${strategy.autoResumeBelow} gwei)`,
          gasPrice: currentPrice,
        };
      }
    }

    // Check if should pause
    if (currentPrice > strategy.pauseAboveGwei) {
      this.state[chain].isPaused = true;
      this.state[chain].pausedSince = Date.now();
      this.saveState();

      return {
        proceed: false,
        reason: `PAUSED: Gas price ${currentPrice} gwei exceeds pause threshold ${strategy.pauseAboveGwei} gwei. Will auto-retry every ${strategy.retryIntervalMinutes} minutes.`,
        gasPrice: currentPrice,
      };
    }

    // Check if acceptable (with user confirmation)
    if (currentPrice > strategy.maxAcceptableGwei) {
      return {
        proceed: false,
        reason: `Gas price ${currentPrice} gwei exceeds max acceptable ${strategy.maxAcceptableGwei} gwei. User confirmation required.`,
        gasPrice: currentPrice,
      };
    }

    // All clear
    return {
      proceed: true,
      reason: `Gas price acceptable: ${currentPrice} gwei (max: ${strategy.maxAcceptableGwei} gwei)`,
      gasPrice: currentPrice,
    };
  }

  /**
   * Estimate deployment cost in USD
   */
  async estimateDeploymentCost(
    chain: string,
    estimatedGasUnits: number,
    ethPriceUSD: number = 2000
  ): Promise<{ costETH: number; costUSD: number; gasPrice: number }> {
    const gasPrice = await this.getCurrentGasPrice(chain);
    const gasPriceWei = gasPrice * 1e9;
    const costWei = estimatedGasUnits * gasPriceWei;
    const costETH = costWei / 1e18;
    const costUSD = costETH * ethPriceUSD;

    return {
      costETH,
      costUSD,
      gasPrice,
    };
  }

  /**
   * Get gas price statistics
   */
  getStatistics(chain: string): {
    current: number;
    average: number;
    min: number;
    max: number;
    samples: number;
  } | null {
    if (!this.state[chain] || this.state[chain].history.length === 0) {
      return null;
    }

    const prices = this.state[chain].history.map((h) => h.price);
    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = sum / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return {
      current: this.state[chain].currentPrice,
      average: avg,
      min,
      max,
      samples: prices.length,
    };
  }

  /**
   * Generate status report
   */
  getStatusReport(): string {
    const lines = ['Gas Price Monitor Status', '='.repeat(70)];

    for (const [chain, data] of Object.entries(this.state)) {
      const strategy = this.strategies[chain];
      if (!strategy) continue;

      lines.push(`\n${chain.toUpperCase()}:`);
      lines.push(`  Current: ${data.currentPrice.toFixed(2)} gwei`);

      const stats = this.getStatistics(chain);
      if (stats) {
        lines.push(`  Average: ${stats.average.toFixed(2)} gwei`);
        lines.push(`  Range: ${stats.min.toFixed(2)} - ${stats.max.toFixed(2)} gwei`);
      }

      lines.push(`  Thresholds:`);
      lines.push(`    Max Acceptable: ${strategy.maxAcceptableGwei} gwei`);
      lines.push(`    Pause Above: ${strategy.pauseAboveGwei} gwei`);
      lines.push(`    Auto-Resume Below: ${strategy.autoResumeBelow} gwei`);

      if (data.isPaused) {
        const pausedDuration = Date.now() - (data.pausedSince || 0);
        const pausedMinutes = Math.floor(pausedDuration / (1000 * 60));
        lines.push(`  Status: ⏸️  PAUSED (${pausedMinutes} minutes)`);
        lines.push(`  Reason: Gas price too high, waiting for drop`);
      } else if (data.currentPrice > strategy.maxAcceptableGwei) {
        lines.push(`  Status: ⚠️  WARNING - Above acceptable threshold`);
      } else {
        lines.push(`  Status: ✅ Ready for deployment`);
      }

      const lastUpdateMin = Math.floor((Date.now() - data.lastUpdate) / 60000);
      lines.push(`  Last Update: ${lastUpdateMin} minutes ago`);
    }

    return lines.join('\n');
  }

  /**
   * Wait for favorable gas price
   */
  async waitForFavorableGas(
    chain: string,
    checkIntervalMinutes: number = 5,
    timeoutHours: number = 24
  ): Promise<{ success: boolean; gasPrice: number; waitedMinutes: number }> {
    const startTime = Date.now();
    const timeoutMs = timeoutHours * 60 * 60 * 1000;
    const intervalMs = checkIntervalMinutes * 60 * 1000;

    console.log(`[${chain}] Waiting for favorable gas prices...`);

    while (Date.now() - startTime < timeoutMs) {
      const decision = await this.shouldProceedWithDeployment(chain);

      if (decision.proceed) {
        const waitedMs = Date.now() - startTime;
        const waitedMin = Math.floor(waitedMs / 60000);

        return {
          success: true,
          gasPrice: decision.gasPrice,
          waitedMinutes: waitedMin,
        };
      }

      console.log(`[${chain}] ${decision.reason}`);
      console.log(`[${chain}] Checking again in ${checkIntervalMinutes} minutes...`);

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    // Timeout
    const waitedHours = (Date.now() - startTime) / (1000 * 60 * 60);
    return {
      success: false,
      gasPrice: this.state[chain].currentPrice,
      waitedMinutes: Math.floor(waitedHours * 60),
    };
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const monitor = new GasMonitor();

  switch (command) {
    case 'check':
      {
        const chain = args[1];
        if (!chain) {
          console.error('Error: Chain required');
          console.log('Usage: ./gas-monitor.ts check <chain>');
          process.exit(1);
        }

        const decision = await monitor.shouldProceedWithDeployment(chain);
        console.log(`[${chain}] Gas Price: ${decision.gasPrice.toFixed(2)} gwei`);
        console.log(`[${chain}] Decision: ${decision.proceed ? '✅ PROCEED' : '⏸️  WAIT'}`);
        console.log(`[${chain}] Reason: ${decision.reason}`);

        process.exit(decision.proceed ? 0 : 1);
      }
      break;

    case 'current':
      {
        const chain = args[1];
        if (!chain) {
          console.error('Error: Chain required');
          process.exit(1);
        }

        const price = await monitor.getCurrentGasPrice(chain);
        console.log(price.toFixed(2));
      }
      break;

    case 'estimate':
      {
        const [chain, gasUnits, ethPrice] = args.slice(1);
        if (!chain || !gasUnits) {
          console.error('Error: Chain and gas units required');
          console.log('Usage: ./gas-monitor.ts estimate <chain> <gas_units> [eth_price_usd]');
          process.exit(1);
        }

        const cost = await monitor.estimateDeploymentCost(
          chain,
          parseInt(gasUnits),
          ethPrice ? parseFloat(ethPrice) : 2000
        );

        console.log(`Gas Price: ${cost.gasPrice.toFixed(2)} gwei`);
        console.log(`Cost: ${cost.costETH.toFixed(6)} ETH`);
        console.log(`Cost: $${cost.costUSD.toFixed(2)} USD`);
      }
      break;

    case 'wait':
      {
        const [chain, intervalMin, timeoutHours] = args.slice(1);
        if (!chain) {
          console.error('Error: Chain required');
          process.exit(1);
        }

        const result = await monitor.waitForFavorableGas(
          chain,
          intervalMin ? parseInt(intervalMin) : 5,
          timeoutHours ? parseInt(timeoutHours) : 24
        );

        if (result.success) {
          console.log(`✅ Favorable gas price achieved: ${result.gasPrice.toFixed(2)} gwei`);
          console.log(`   Waited: ${result.waitedMinutes} minutes`);
          process.exit(0);
        } else {
          console.log(`❌ Timeout reached after ${result.waitedMinutes} minutes`);
          console.log(`   Current price: ${result.gasPrice.toFixed(2)} gwei`);
          process.exit(1);
        }
      }
      break;

    case 'stats':
      {
        const chain = args[1];
        if (!chain) {
          console.error('Error: Chain required');
          process.exit(1);
        }

        const stats = monitor.getStatistics(chain);
        if (!stats) {
          console.log(`No data available for ${chain}`);
          process.exit(1);
        }

        console.log(`${chain.toUpperCase()} Gas Price Statistics`);
        console.log('='.repeat(50));
        console.log(`Current:  ${stats.current.toFixed(2)} gwei`);
        console.log(`Average:  ${stats.average.toFixed(2)} gwei`);
        console.log(`Minimum:  ${stats.min.toFixed(2)} gwei`);
        console.log(`Maximum:  ${stats.max.toFixed(2)} gwei`);
        console.log(`Samples:  ${stats.samples}`);
      }
      break;

    case 'status':
      console.log(monitor.getStatusReport());
      break;

    default:
      console.log(`
Gas Price Monitor - Adaptive Deployment Strategy

Usage:
  ./gas-monitor.ts check <chain>                     Check if should deploy
  ./gas-monitor.ts current <chain>                   Get current gas price
  ./gas-monitor.ts estimate <chain> <gas> [eth_price] Estimate deployment cost
  ./gas-monitor.ts wait <chain> [interval] [timeout]  Wait for favorable gas
  ./gas-monitor.ts stats <chain>                     Show statistics
  ./gas-monitor.ts status                            Show all chains status

Chains: ethereum, sepolia, bsc, avalanche

Examples:
  ./gas-monitor.ts check ethereum
  ./gas-monitor.ts estimate ethereum 3000000 2500
  ./gas-monitor.ts wait ethereum 5 12
  ./gas-monitor.ts status

Exit Codes:
  0 - Ready to deploy / Success
  1 - Should wait / Error
      `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { GasMonitor, GasStrategy, GasPriceData };
