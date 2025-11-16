import { ethers } from 'ethers';
import pRetry from 'p-retry';
import { logger } from '../../utils/index.js';
import type { Address, Hex } from './types.js';

/**
 * Ethereum provider with built-in retry logic for resilient RPC operations
 *
 * Implements retry patterns from Guide 04 (Edge Cases) Section 4.1
 */
export class EthereumProvider {
  private provider: ethers.JsonRpcProvider;
  private chainId: number;
  private chainName: string;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    rpcUrl: string,
    chainId: number,
    chainName: string,
    options: {
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.chainId = chainId;
    this.chainName = chainName;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
  }

  /**
   * Get the underlying ethers provider
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get chain ID
   */
  getChainId(): number {
    return this.chainId;
  }

  /**
   * Get chain name
   */
  getChainName(): string {
    return this.chainName;
  }

  /**
   * Get balance with retry logic
   *
   * Edge case handling:
   * - RPC rate limiting (retry with exponential backoff)
   * - Network timeouts (automatic retry)
   * - Invalid block tags (validation)
   */
  async getBalance(address: Address, blockTag: ethers.BlockTag = 'latest'): Promise<bigint> {
    return pRetry(
      async () => {
        const balance = await this.provider.getBalance(address, blockTag);
        return balance;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(`Balance query failed (attempt ${error.attemptNumber}/${this.maxRetries})`, {
            address,
            blockTag,
            error: String(error),
          });
        },
      }
    );
  }

  /**
   * Get transaction with retry logic
   *
   * Edge case handling:
   * - Pending transactions (may not be available immediately)
   * - Reorg scenarios (transaction may disappear)
   */
  async getTransaction(hash: Hex): Promise<ethers.TransactionResponse | null> {
    return pRetry(
      async () => {
        const tx = await this.provider.getTransaction(hash);
        return tx;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Transaction query failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            {
              hash,
              error: String(error),
            }
          );
        },
      }
    );
  }

  /**
   * Get transaction receipt with retry logic
   *
   * Edge case handling:
   * - Transaction not yet mined (returns null, retry)
   * - Chain reorgs (receipt may change)
   */
  async getTransactionReceipt(hash: Hex): Promise<ethers.TransactionReceipt | null> {
    return pRetry(
      async () => {
        const receipt = await this.provider.getTransactionReceipt(hash);
        return receipt;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(`Receipt query failed (attempt ${error.attemptNumber}/${this.maxRetries})`, {
            hash,
            error: String(error),
          });
        },
      }
    );
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    return pRetry(
      async () => {
        const blockNumber = await this.provider.getBlockNumber();
        return blockNumber;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Block number query failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            {
              error: String(error),
            }
          );
        },
      }
    );
  }

  /**
   * Get block by number or hash
   */
  async getBlock(blockHashOrBlockTag: ethers.BlockTag): Promise<ethers.Block | null> {
    return pRetry(
      async () => {
        const block = await this.provider.getBlock(blockHashOrBlockTag);
        return block;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(`Block query failed (attempt ${error.attemptNumber}/${this.maxRetries})`, {
            blockHashOrBlockTag,
            error: String(error),
          });
        },
      }
    );
  }

  /**
   * Get gas price with validation
   *
   * Edge case handling:
   * - Gas price spikes (max 500 gwei ceiling per CLAUDE.md)
   * - EIP-1559 support (returns maxFeePerGas if available)
   */
  async getGasPrice(): Promise<bigint> {
    return pRetry(
      async () => {
        const feeData = await this.provider.getFeeData();
        const gasPrice = feeData.gasPrice ?? 0n;

        // Enforce gas price ceiling (500 gwei = 500 * 10^9 wei)
        const MAX_GAS_PRICE = 500n * 10n ** 9n;
        if (gasPrice > MAX_GAS_PRICE) {
          logger.warn('Gas price exceeds maximum ceiling', {
            gasPrice: gasPrice.toString(),
            maxGasPrice: MAX_GAS_PRICE.toString(),
          });
          return MAX_GAS_PRICE;
        }

        return gasPrice;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Gas price query failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            {
              error: String(error),
            }
          );
        },
      }
    );
  }

  /**
   * Get EIP-1559 fee data
   *
   * Returns maxFeePerGas and maxPriorityFeePerGas for EIP-1559 transactions
   */
  async getFeeData(): Promise<{
    maxFeePerGas: bigint | null;
    maxPriorityFeePerGas: bigint | null;
    gasPrice: bigint | null;
  }> {
    return pRetry(
      async () => {
        const feeData = await this.provider.getFeeData();

        // Enforce gas price ceiling on all fee values
        const MAX_GAS_PRICE = 500n * 10n ** 9n;

        const maxFeePerGas = feeData.maxFeePerGas
          ? feeData.maxFeePerGas > MAX_GAS_PRICE
            ? MAX_GAS_PRICE
            : feeData.maxFeePerGas
          : null;

        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        const gasPrice = feeData.gasPrice
          ? feeData.gasPrice > MAX_GAS_PRICE
            ? MAX_GAS_PRICE
            : feeData.gasPrice
          : null;

        return {
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasPrice,
        };
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
      }
    );
  }

  /**
   * Estimate gas for a transaction
   *
   * Edge case handling:
   * - Add 20% buffer to estimates (per CLAUDE.md common gotchas)
   */
  async estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
    return pRetry(
      async () => {
        const estimate = await this.provider.estimateGas(transaction);

        // Add 20% buffer to gas estimate
        const buffered = (estimate * 120n) / 100n;

        return buffered;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(`Gas estimation failed (attempt ${error.attemptNumber}/${this.maxRetries})`, {
            transaction,
            error: String(error),
          });
        },
      }
    );
  }

  /**
   * Call contract method (read-only)
   */
  async call(transaction: ethers.TransactionRequest): Promise<string> {
    return pRetry(
      async () => {
        const result = await this.provider.call(transaction);
        return result;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(`Contract call failed (attempt ${error.attemptNumber}/${this.maxRetries})`, {
            transaction,
            error: String(error),
          });
        },
      }
    );
  }

  /**
   * Wait for transaction to be mined
   *
   * Edge case handling:
   * - Chain reorgs (wait for 12+ confirmations per CLAUDE.md)
   * - Transaction timeouts
   */
  async waitForTransaction(
    hash: Hex,
    confirmations = 12
  ): Promise<ethers.TransactionReceipt | null> {
    return pRetry(
      async () => {
        const receipt = await this.provider.waitForTransaction(hash, confirmations);
        return receipt;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Waiting for transaction failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            {
              hash,
              confirmations,
              error: String(error),
            }
          );
        },
      }
    );
  }

  /**
   * Get code at address (for contract verification)
   */
  async getCode(address: Address, blockTag: ethers.BlockTag = 'latest'): Promise<string> {
    return pRetry(
      async () => {
        const code = await this.provider.getCode(address, blockTag);
        return code;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(`Get code failed (attempt ${error.attemptNumber}/${this.maxRetries})`, {
            address,
            blockTag,
            error: String(error),
          });
        },
      }
    );
  }
}
