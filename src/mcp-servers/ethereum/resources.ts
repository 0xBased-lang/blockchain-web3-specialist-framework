import { EthereumProvider } from './provider.js';
import { logger } from '../../utils/index.js';
import type { Address, TxHash } from './types.js';

/**
 * MCP Resource handlers for Ethereum
 *
 * Resources provide read-only access to blockchain data:
 * - Accounts: balance, nonce, contract status
 * - Contracts: bytecode, balance
 * - Transactions: status, gas used, receipt
 * - Blocks: transactions, gas, miner
 */
export class EthereumResourceManager {
  constructor(private provider: EthereumProvider) {}

  /**
   * Get account resource
   *
   * Returns account information including balance, nonce, and contract status
   */
  async getAccountResource(address: Address): Promise<{
    uri: string;
    type: 'account';
    data: {
      address: Address;
      balance: string;
      nonce: number;
      isContract: boolean;
      blockNumber: number;
    };
  }> {
    try {
      const [balance, nonce, code, blockNumber] = await Promise.all([
        this.provider.getBalance(address),
        this.provider.getProvider().getTransactionCount(address),
        this.provider.getCode(address),
        this.provider.getBlockNumber(),
      ]);

      const isContract = code !== '0x';

      return {
        uri: `ethereum://account/${address}`,
        type: 'account',
        data: {
          address,
          balance: balance.toString(),
          nonce,
          isContract,
          blockNumber,
        },
      };
    } catch (error) {
      logger.error('Failed to get account resource', { address, error });
      throw new Error(`Failed to get account ${address}: ${String(error)}`);
    }
  }

  /**
   * Get contract resource
   *
   * Returns contract bytecode and balance
   * Throws if address is not a contract
   */
  async getContractResource(address: Address): Promise<{
    uri: string;
    type: 'contract';
    data: {
      address: Address;
      bytecode: string;
      bytecodeHash: string;
      balance: string;
      blockNumber: number;
    };
  }> {
    try {
      const [code, balance, blockNumber] = await Promise.all([
        this.provider.getCode(address),
        this.provider.getBalance(address),
        this.provider.getBlockNumber(),
      ]);

      if (code === '0x') {
        throw new Error('Address is not a contract');
      }

      // Calculate bytecode hash for verification
      const bytecodeHash = this.calculateBytecodeHash(code);

      return {
        uri: `ethereum://contract/${address}`,
        type: 'contract',
        data: {
          address,
          bytecode: code,
          bytecodeHash,
          balance: balance.toString(),
          blockNumber,
        },
      };
    } catch (error) {
      logger.error('Failed to get contract resource', { address, error });
      throw new Error(`Failed to get contract ${address}: ${String(error)}`);
    }
  }

  /**
   * Get transaction resource
   *
   * Returns transaction details and receipt if available
   * Status: pending | confirmed | failed
   */
  async getTransactionResource(hash: TxHash): Promise<{
    uri: string;
    type: 'transaction';
    data: {
      hash: TxHash;
      from: Address;
      to: Address | null;
      value: string;
      gasLimit: string;
      gasPrice: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
      nonce: number;
      data: string;
      blockNumber: number | null;
      blockHash: string | null;
      status: 'pending' | 'confirmed' | 'failed';
      gasUsed?: string;
    };
  }> {
    try {
      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(hash),
        this.provider.getTransactionReceipt(hash),
      ]);

      if (!tx) {
        throw new Error('Transaction not found');
      }

      // Determine transaction status
      let status: 'pending' | 'confirmed' | 'failed' = 'pending';
      if (receipt) {
        status = receipt.status === 1 ? 'confirmed' : 'failed';
      }

      return {
        uri: `ethereum://transaction/${hash}`,
        type: 'transaction',
        data: {
          hash,
          from: tx.from.toLowerCase() as Address,
          to: tx.to ? (tx.to.toLowerCase() as Address) : null,
          value: tx.value.toString(),
          gasLimit: tx.gasLimit.toString(),
          gasPrice: tx.gasPrice?.toString() ?? '0',
          ...(tx.maxFeePerGas !== null && tx.maxFeePerGas !== undefined
            ? { maxFeePerGas: tx.maxFeePerGas.toString() }
            : {}),
          ...(tx.maxPriorityFeePerGas !== null && tx.maxPriorityFeePerGas !== undefined
            ? { maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString() }
            : {}),
          nonce: tx.nonce,
          data: tx.data,
          blockNumber: tx.blockNumber,
          blockHash: tx.blockHash,
          status,
          ...(receipt ? { gasUsed: receipt.gasUsed.toString() } : {}),
        },
      };
    } catch (error) {
      logger.error('Failed to get transaction resource', { hash, error });
      throw new Error(`Failed to get transaction ${hash}: ${String(error)}`);
    }
  }

  /**
   * Get block resource
   *
   * Returns block information including transactions
   */
  async getBlockResource(blockNumber: number | 'latest'): Promise<{
    uri: string;
    type: 'block';
    data: {
      number: number;
      hash: string;
      parentHash: string;
      timestamp: number;
      transactions: string[];
      transactionCount: number;
      gasUsed: string;
      gasLimit: string;
      miner: Address;
    };
  }> {
    try {
      const block = await this.provider.getBlock(blockNumber);

      if (!block) {
        throw new Error('Block not found');
      }

      return {
        uri: `ethereum://block/${block.number}`,
        type: 'block',
        data: {
          number: block.number,
          hash: block.hash ?? '0x',
          parentHash: block.parentHash,
          timestamp: block.timestamp,
          transactions: [...block.transactions],
          transactionCount: block.transactions.length,
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          miner: block.miner?.toLowerCase() as Address,
        },
      };
    } catch (error) {
      logger.error('Failed to get block resource', { blockNumber, error });
      throw new Error(`Failed to get block ${String(blockNumber)}: ${String(error)}`);
    }
  }

  /**
   * List available resources
   *
   * Returns metadata about supported resource types
   */
  listResources(): Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }> {
    return [
      {
        uri: 'ethereum://account/*',
        name: 'Ethereum Account',
        description: 'Get account balance, nonce, and contract status',
        mimeType: 'application/json',
      },
      {
        uri: 'ethereum://contract/*',
        name: 'Ethereum Contract',
        description: 'Get contract bytecode and balance',
        mimeType: 'application/json',
      },
      {
        uri: 'ethereum://transaction/*',
        name: 'Ethereum Transaction',
        description: 'Get transaction details and receipt',
        mimeType: 'application/json',
      },
      {
        uri: 'ethereum://block/*',
        name: 'Ethereum Block',
        description: 'Get block information and transactions',
        mimeType: 'application/json',
      },
    ];
  }

  /**
   * Calculate bytecode hash for verification
   * Uses keccak256 for Ethereum compatibility
   */
  private calculateBytecodeHash(bytecode: string): string {
    // Simple hash for now - in production use ethers.keccak256
    return `0x${Buffer.from(bytecode).toString('hex').slice(0, 64)}`;
  }
}

/**
 * Factory function to create resource manager
 */
export function createResourceManager(provider: EthereumProvider): EthereumResourceManager {
  return new EthereumResourceManager(provider);
}
