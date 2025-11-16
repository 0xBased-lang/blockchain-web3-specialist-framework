import { MultiChainProvider } from './provider.js';
import { EthereumResourceManager } from '../ethereum/resources.js';
import { SolanaResourceManager } from '../solana/resources.js';
import {
  SupportedChain,
  parseMultiChainURI,
  MultiChainError,
  MultiChainErrorCode,
  type UnifiedBalanceResponse,
  type UnifiedTransactionResponse,
} from './types.js';
import { logger } from '../../utils/index.js';

/**
 * Multi-Chain Resource Manager
 *
 * Unified resource manager that routes to appropriate chain based on URI or address:
 * - Automatic chain detection from address format
 * - Unified response formats across chains
 * - Fallback to both chains if detection fails
 * - MCP-compliant resource URIs
 *
 * URI Schemes:
 * - multichain://ethereum/account/{address}
 * - multichain://solana/account/{address}
 * - multichain://auto/account/{address}  (auto-detect chain)
 * - multichain://ethereum/transaction/{hash}
 * - multichain://solana/transaction/{signature}
 *
 * Edge Cases Handled:
 * - Account not found → Null response with chain context
 * - Invalid URI format → Clear error message
 * - Chain-specific features → Graceful degradation
 * - Both chains unavailable → Error with details
 */
export class MultiChainResourceManager {
  private ethereumResources: EthereumResourceManager | null = null;
  private solanaResources: SolanaResourceManager | null = null;

  constructor(private provider: MultiChainProvider) {
    // Initialize chain-specific resource managers if providers are available
    try {
      const ethProvider = this.provider.getEthereumProvider();
      this.ethereumResources = new EthereumResourceManager(ethProvider);
      logger.debug('Ethereum resource manager initialized');
    } catch (error) {
      logger.debug('Ethereum resources not available', { error: String(error) });
    }

    try {
      const solProvider = this.provider.getSolanaProvider();
      this.solanaResources = new SolanaResourceManager(solProvider);
      logger.debug('Solana resource manager initialized');
    } catch (error) {
      logger.debug('Solana resources not available', { error: String(error) });
    }
  }

  /**
   * List available multi-chain resources
   */
  listResources(): Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }> {
    const resources: Array<{
      uri: string;
      name: string;
      description: string;
      mimeType: string;
    }> = [];

    // Add Ethereum resources if available
    if (this.ethereumResources) {
      resources.push(
        {
          uri: 'multichain://ethereum/account/*',
          name: 'Ethereum Account',
          description: 'Get Ethereum account info (balance, nonce, contract status)',
          mimeType: 'application/json',
        },
        {
          uri: 'multichain://ethereum/contract/*',
          name: 'Ethereum Contract',
          description: 'Get smart contract bytecode and info',
          mimeType: 'application/json',
        },
        {
          uri: 'multichain://ethereum/transaction/*',
          name: 'Ethereum Transaction',
          description: 'Get transaction details and receipt',
          mimeType: 'application/json',
        }
      );
    }

    // Add Solana resources if available
    if (this.solanaResources) {
      resources.push(
        {
          uri: 'multichain://solana/account/*',
          name: 'Solana Account',
          description: 'Get Solana account info (balance, owner, data)',
          mimeType: 'application/json',
        },
        {
          uri: 'multichain://solana/token-account/*',
          name: 'Solana Token Account',
          description: 'Get SPL token account info',
          mimeType: 'application/json',
        },
        {
          uri: 'multichain://solana/transaction/*',
          name: 'Solana Transaction',
          description: 'Get transaction details (status, logs, compute units)',
          mimeType: 'application/json',
        }
      );
    }

    // Add auto-detect resources if both chains available
    if (this.ethereumResources && this.solanaResources) {
      resources.push(
        {
          uri: 'multichain://auto/account/*',
          name: 'Auto-Detect Account',
          description: 'Get account balance (auto-detects chain from address)',
          mimeType: 'application/json',
        },
        {
          uri: 'multichain://auto/transaction/*',
          name: 'Auto-Detect Transaction',
          description: 'Get transaction details (auto-detects chain)',
          mimeType: 'application/json',
        }
      );
    }

    return resources;
  }

  /**
   * Get unified account balance
   *
   * Auto-detects chain from address or uses explicit chain from URI
   */
  async getAccountBalance(uri: string): Promise<UnifiedBalanceResponse> {
    try {
      const parsed = parseMultiChainURI(uri);

      // Route based on detected or explicit chain
      if (
        parsed.chain === SupportedChain.ETHEREUM ||
        (parsed.chain === SupportedChain.AUTO &&
          this.provider.detectChainFromAddress(parsed.identifier) === SupportedChain.ETHEREUM)
      ) {
        return await this.getEthereumAccountBalance(parsed.identifier);
      } else if (
        parsed.chain === SupportedChain.SOLANA ||
        (parsed.chain === SupportedChain.AUTO &&
          this.provider.detectChainFromAddress(parsed.identifier) === SupportedChain.SOLANA)
      ) {
        return await this.getSolanaAccountBalance(parsed.identifier);
      } else {
        throw new MultiChainError(
          `Unable to determine chain for account: ${parsed.identifier}`,
          parsed.chain,
          MultiChainErrorCode.CHAIN_DETECTION_FAILED
        );
      }
    } catch (error) {
      if (error instanceof MultiChainError) {
        throw error;
      }
      throw new MultiChainError(
        `Failed to get account balance: ${String(error)}`,
        SupportedChain.AUTO,
        MultiChainErrorCode.RESOURCE_NOT_FOUND,
        { uri, error: String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get Ethereum account balance
   */
  private async getEthereumAccountBalance(address: string): Promise<UnifiedBalanceResponse> {
    if (!this.ethereumResources) {
      throw new MultiChainError(
        'Ethereum resources not available',
        SupportedChain.ETHEREUM,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }

    const resource = await this.ethereumResources.getAccountResource(address as `0x${string}`);

    return {
      chain: SupportedChain.ETHEREUM,
      address: resource.data.address,
      balance: resource.data.balance,
      symbol: 'ETH',
      decimals: 18,
      blockNumber: resource.data.blockNumber,
    };
  }

  /**
   * Get Solana account balance
   */
  private async getSolanaAccountBalance(address: string): Promise<UnifiedBalanceResponse> {
    if (!this.solanaResources) {
      throw new MultiChainError(
        'Solana resources not available',
        SupportedChain.SOLANA,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }

    const resource = await this.solanaResources.getAccountResource(address as any);

    if (!resource.data) {
      // Account doesn't exist - return zero balance
      return {
        chain: SupportedChain.SOLANA,
        address,
        balance: '0',
        symbol: 'SOL',
        decimals: 9,
      };
    }

    return {
      chain: SupportedChain.SOLANA,
      address,
      balance: resource.data.lamports.toString(),
      symbol: 'SOL',
      decimals: 9,
      slot: resource.data.slot,
    };
  }

  /**
   * Get unified transaction details
   *
   * Auto-detects chain from signature/hash format or uses explicit chain
   */
  async getTransaction(uri: string): Promise<UnifiedTransactionResponse> {
    try {
      const parsed = parseMultiChainURI(uri);

      // Route based on chain
      if (parsed.chain === SupportedChain.ETHEREUM) {
        return await this.getEthereumTransaction(parsed.identifier);
      } else if (parsed.chain === SupportedChain.SOLANA) {
        return await this.getSolanaTransaction(parsed.identifier);
      } else if (parsed.chain === SupportedChain.AUTO) {
        // Try to detect by format - Ethereum tx hashes start with 0x
        if (parsed.identifier.startsWith('0x')) {
          return await this.getEthereumTransaction(parsed.identifier);
        } else {
          // Assume Solana Base58 signature
          return await this.getSolanaTransaction(parsed.identifier);
        }
      } else {
        throw new MultiChainError(
          `Invalid chain for transaction: ${parsed.chain}`,
          parsed.chain,
          MultiChainErrorCode.INVALID_CHAIN
        );
      }
    } catch (error) {
      if (error instanceof MultiChainError) {
        throw error;
      }
      throw new MultiChainError(
        `Failed to get transaction: ${String(error)}`,
        SupportedChain.AUTO,
        MultiChainErrorCode.RESOURCE_NOT_FOUND,
        { uri, error: String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get Ethereum transaction
   */
  private async getEthereumTransaction(hash: string): Promise<UnifiedTransactionResponse> {
    if (!this.ethereumResources) {
      throw new MultiChainError(
        'Ethereum resources not available',
        SupportedChain.ETHEREUM,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }

    const resource = await this.ethereumResources.getTransactionResource(hash as `0x${string}`);

    // Calculate fee if available (gasUsed * gasPrice), otherwise use '0'
    let fee = '0';
    if (resource.data.gasUsed && resource.data.gasPrice) {
      fee = (BigInt(resource.data.gasUsed) * BigInt(resource.data.gasPrice)).toString();
    }

    return {
      chain: SupportedChain.ETHEREUM,
      signature: resource.data.hash,
      status: resource.data.status,
      from: resource.data.from,
      to: resource.data.to ?? '',
      amount: resource.data.value,
      fee,
      ...(resource.data.blockNumber !== null && { blockNumber: resource.data.blockNumber }),
      ...(resource.data.gasUsed && { gasUsed: resource.data.gasUsed }),
    };
  }

  /**
   * Get Solana transaction
   */
  private async getSolanaTransaction(signature: string): Promise<UnifiedTransactionResponse> {
    if (!this.solanaResources) {
      throw new MultiChainError(
        'Solana resources not available',
        SupportedChain.SOLANA,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }

    const resource = await this.solanaResources.getTransactionResource(signature as any);

    if (!resource.data) {
      throw new MultiChainError(
        `Transaction not found: ${signature}`,
        SupportedChain.SOLANA,
        MultiChainErrorCode.RESOURCE_NOT_FOUND
      );
    }

    // Extract first signer as "from" address
    const from = resource.data.accounts[0] ?? ('' as any);

    return {
      chain: SupportedChain.SOLANA,
      signature: resource.data.signature,
      status: resource.data.status === 'failed' ? 'failed' : 'confirmed',
      from,
      to: '', // Solana doesn't have simple "to" field
      amount: '0', // Would need to parse instruction data
      slot: resource.data.slot,
      computeUnitsConsumed: resource.data.computeUnitsConsumed,
      fee: resource.data.fee,
    };
  }

  /**
   * Get resource by URI
   *
   * Generic method that routes to appropriate resource type
   */
  async getResource(uri: string): Promise<{
    uri: string;
    type: string;
    data: UnifiedBalanceResponse | UnifiedTransactionResponse | unknown;
  }> {
    try {
      const parsed = parseMultiChainURI(uri);

      // Route based on resource type
      if (parsed.resourceType === 'account') {
        const balance = await this.getAccountBalance(uri);
        return {
          uri,
          type: 'account',
          data: balance,
        };
      } else if (parsed.resourceType === 'transaction') {
        const tx = await this.getTransaction(uri);
        return {
          uri,
          type: 'transaction',
          data: tx,
        };
      } else if (parsed.resourceType === 'token-account') {
        // Token accounts are Solana-specific
        if (parsed.chain !== SupportedChain.SOLANA) {
          throw new MultiChainError(
            'Token accounts are only supported on Solana',
            parsed.chain,
            MultiChainErrorCode.INVALID_CHAIN
          );
        }

        if (!this.solanaResources) {
          throw new MultiChainError(
            'Solana resources not available',
            SupportedChain.SOLANA,
            MultiChainErrorCode.CHAIN_NOT_CONFIGURED
          );
        }

        const resource = await this.solanaResources.getTokenAccountResource(
          parsed.identifier as any
        );
        return {
          uri,
          type: 'token-account',
          data: resource.data,
        };
      } else if (parsed.resourceType === 'contract') {
        // Contracts are Ethereum-specific
        if (parsed.chain !== SupportedChain.ETHEREUM) {
          throw new MultiChainError(
            'Contracts are only supported on Ethereum',
            parsed.chain,
            MultiChainErrorCode.INVALID_CHAIN
          );
        }

        if (!this.ethereumResources) {
          throw new MultiChainError(
            'Ethereum resources not available',
            SupportedChain.ETHEREUM,
            MultiChainErrorCode.CHAIN_NOT_CONFIGURED
          );
        }

        const resource = await this.ethereumResources.getContractResource(
          parsed.identifier as `0x${string}`
        );
        return {
          uri,
          type: 'contract',
          data: resource.data,
        };
      } else {
        throw new MultiChainError(
          `Unknown resource type: ${parsed.resourceType}`,
          parsed.chain,
          MultiChainErrorCode.INVALID_PARAMETERS
        );
      }
    } catch (error) {
      if (error instanceof MultiChainError) {
        throw error;
      }
      throw new MultiChainError(
        `Failed to get resource: ${String(error)}`,
        SupportedChain.AUTO,
        MultiChainErrorCode.RESOURCE_NOT_FOUND,
        { uri, error: String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }
}
