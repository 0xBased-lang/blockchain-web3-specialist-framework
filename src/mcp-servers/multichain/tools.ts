import { MultiChainProvider } from './provider.js';
import { EthereumToolManager } from '../ethereum/tools.js';
import { SolanaToolManager } from '../solana/tools.js';
import {
  SupportedChain,
  QueryBalanceParamsSchema,
  SendTransactionParamsSchema,
  TransferTokenParamsSchema,
  MultiChainError,
  MultiChainErrorCode,
  type UnifiedBalanceResponse,
  type UnifiedTransactionResponse,
  type QueryBalanceParams,
  type SendTransactionParams,
  type TransferTokenParams,
} from './types.js';
import { logger } from '../../utils/index.js';

/**
 * Multi-Chain Tool Manager
 *
 * Unified tool handlers with automatic chain detection:
 * - Query balances (auto-detects ETH/SOL from address)
 * - Send transactions (auto-routes based on sender address)
 * - Transfer tokens (ERC20/SPL with auto-detection)
 * - Unified responses across chains
 *
 * Security:
 * - Private keys NEVER logged
 * - Delegated to chain-specific managers
 * - Wallet/keypair lifecycle managed per chain
 *
 * Edge Cases:
 * - Invalid addresses → Validation errors
 * - Unsupported operations → Clear error messages
 * - Chain-specific features → Graceful handling
 * - Gas/fee estimation → Chain-appropriate methods
 */
export class MultiChainToolManager {
  private ethereumTools: EthereumToolManager | null = null;
  private solanaTools: SolanaToolManager | null = null;

  constructor(private provider: MultiChainProvider) {
    // Initialize chain-specific tool managers if providers are available
    try {
      const ethProvider = this.provider.getEthereumProvider();
      this.ethereumTools = new EthereumToolManager(ethProvider);
      logger.debug('Ethereum tools initialized');
    } catch (error) {
      logger.debug('Ethereum tools not available', { error: String(error) });
    }

    try {
      const solProvider = this.provider.getSolanaProvider();
      this.solanaTools = new SolanaToolManager(solProvider);
      logger.debug('Solana tools initialized');
    } catch (error) {
      logger.debug('Solana tools not available', { error: String(error) });
    }
  }

  /**
   * Initialize wallet/keypair for chain
   *
   * @param chain - Target chain
   * @param privateKey - Private key (format depends on chain)
   */
  initializeWallet(chain: SupportedChain, privateKey: string): void {
    if (chain === SupportedChain.ETHEREUM) {
      if (!this.ethereumTools) {
        throw new MultiChainError(
          'Ethereum tools not available',
          SupportedChain.ETHEREUM,
          MultiChainErrorCode.CHAIN_NOT_CONFIGURED
        );
      }
      this.ethereumTools.initializeWallet(privateKey);
    } else if (chain === SupportedChain.SOLANA) {
      if (!this.solanaTools) {
        throw new MultiChainError(
          'Solana tools not available',
          SupportedChain.SOLANA,
          MultiChainErrorCode.CHAIN_NOT_CONFIGURED
        );
      }
      this.solanaTools.initializeKeypair(privateKey);
    } else {
      throw new MultiChainError(
        `Cannot initialize wallet for AUTO chain - specify ETHEREUM or SOLANA`,
        chain,
        MultiChainErrorCode.INVALID_CHAIN
      );
    }
  }

  /**
   * Clear wallet/keypair from memory
   *
   * @param chain - Target chain (or undefined to clear all)
   */
  clearWallet(chain?: SupportedChain): void {
    if (!chain || chain === SupportedChain.ETHEREUM) {
      this.ethereumTools?.clearWallet();
    }
    if (!chain || chain === SupportedChain.SOLANA) {
      this.solanaTools?.clearKeypair();
    }
  }

  /**
   * List available tools
   */
  listTools(): Array<{
    name: string;
    description: string;
    inputSchema: object;
  }> {
    const tools: Array<{
      name: string;
      description: string;
      inputSchema: object;
    }> = [];

    // Multi-chain tools (available if any chain is configured)
    if (this.ethereumTools || this.solanaTools) {
      tools.push({
        name: 'multichain_query_balance',
        description:
          'Query account balance (auto-detects chain from address format). Supports ETH, SOL, ERC20, and SPL tokens.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Account address (0x... for Ethereum, Base58 for Solana)',
            },
            chain: {
              type: 'string',
              enum: ['ethereum', 'solana', 'auto'],
              description: 'Chain to query (default: auto-detect)',
            },
            token: {
              type: 'string',
              description: 'Token contract address (ERC20) or mint address (SPL)',
            },
            commitment: {
              type: 'string',
              enum: ['processed', 'confirmed', 'finalized', 'latest', 'pending'],
              description: 'Confirmation level (Solana) or block tag (Ethereum)',
            },
          },
          required: ['address'],
        },
      });

      tools.push({
        name: 'multichain_send_transaction',
        description:
          'Send native currency (auto-detects chain from sender address). Sends ETH or SOL.',
        inputSchema: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Recipient address',
            },
            amount: {
              type: 'string',
              description: 'Amount to send (in wei for ETH, lamports for SOL)',
            },
            chain: {
              type: 'string',
              enum: ['ethereum', 'solana', 'auto'],
              description: 'Chain to use (default: auto-detect from sender)',
            },
            gasLimit: {
              type: 'string',
              description: 'Gas limit (Ethereum only)',
            },
            gasPrice: {
              type: 'string',
              description: 'Gas price in wei (Ethereum only)',
            },
            computeUnitLimit: {
              type: 'number',
              description: 'Compute unit limit (Solana only)',
            },
            computeUnitPrice: {
              type: 'string',
              description: 'Priority fee (Solana only)',
            },
          },
          required: ['to', 'amount'],
        },
      });

      tools.push({
        name: 'multichain_transfer_token',
        description:
          'Transfer ERC20 or SPL tokens (auto-detects chain). Handles token approvals and account creation.',
        inputSchema: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Recipient address',
            },
            amount: {
              type: 'string',
              description: 'Amount to transfer (respecting token decimals)',
            },
            token: {
              type: 'string',
              description: 'Token contract address (ERC20) or mint address (SPL)',
            },
            decimals: {
              type: 'number',
              description: 'Token decimals',
            },
            chain: {
              type: 'string',
              enum: ['ethereum', 'solana', 'auto'],
              description: 'Chain to use (default: auto-detect)',
            },
            createAssociatedTokenAccount: {
              type: 'boolean',
              description: 'Auto-create recipient token account (Solana only)',
            },
          },
          required: ['to', 'amount', 'token', 'decimals'],
        },
      });

      tools.push({
        name: 'multichain_initialize_wallet',
        description:
          '⚠️ SECURITY: Initialize wallet/keypair with private key for specific chain. Key stored in memory only. Call multichain_clear_wallet when done.',
        inputSchema: {
          type: 'object',
          properties: {
            chain: {
              type: 'string',
              enum: ['ethereum', 'solana'],
              description: 'Chain to initialize wallet for (cannot be auto)',
            },
            privateKey: {
              type: 'string',
              description: 'Private key (hex for Ethereum, base58 for Solana)',
            },
          },
          required: ['chain', 'privateKey'],
        },
      });

      tools.push({
        name: 'multichain_clear_wallet',
        description:
          'Clear wallet/keypair from memory for all chains. Always call this after transactions.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
    }

    return tools;
  }

  /**
   * Query balance with auto-detection
   */
  async queryBalance(params: unknown): Promise<UnifiedBalanceResponse> {
    const validated = QueryBalanceParamsSchema.parse(params);
    const { address, chain = SupportedChain.AUTO } = validated;

    try {
      // Determine target chain
      let targetChain = chain;
      if (chain === SupportedChain.AUTO) {
        targetChain = this.provider.detectChainFromAddress(address);
      }

      // Route to appropriate chain
      if (targetChain === SupportedChain.ETHEREUM) {
        return await this.queryEthereumBalance(validated);
      } else if (targetChain === SupportedChain.SOLANA) {
        return await this.querySolanaBalance(validated);
      } else {
        throw new MultiChainError(
          `Invalid chain: ${targetChain}`,
          targetChain,
          MultiChainErrorCode.INVALID_CHAIN
        );
      }
    } catch (error) {
      if (error instanceof MultiChainError) {
        throw error;
      }
      throw new MultiChainError(
        `Failed to query balance: ${String(error)}`,
        chain,
        MultiChainErrorCode.CHAIN_UNAVAILABLE,
        { error: String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Query Ethereum balance
   */
  private async queryEthereumBalance(params: QueryBalanceParams): Promise<UnifiedBalanceResponse> {
    if (!this.ethereumTools) {
      throw new MultiChainError(
        'Ethereum tools not available',
        SupportedChain.ETHEREUM,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }

    const result = await this.ethereumTools.queryBalance(params);

    return {
      chain: SupportedChain.ETHEREUM,
      address: result.address,
      balance: result.balance,
      symbol: result.symbol ?? 'ETH',
      decimals: result.decimals ?? 18,
      blockNumber: result.blockNumber,
      ...(result.token && { token: result.token }),
    };
  }

  /**
   * Query Solana balance
   */
  private async querySolanaBalance(params: QueryBalanceParams): Promise<UnifiedBalanceResponse> {
    if (!this.solanaTools) {
      throw new MultiChainError(
        'Solana tools not available',
        SupportedChain.SOLANA,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }

    const result = await this.solanaTools.queryBalance(params);

    return {
      chain: SupportedChain.SOLANA,
      address: result.address,
      balance: result.balance,
      symbol: result.symbol ?? 'SOL',
      decimals: result.decimals,
      slot: result.slot,
      ...(result.token && { token: result.token }),
    };
  }

  /**
   * Send transaction with auto-detection
   *
   * Note: Requires wallet/keypair to be initialized first
   */
  async sendTransaction(params: unknown): Promise<UnifiedTransactionResponse> {
    const validated = SendTransactionParamsSchema.parse(params);
    const { to, chain = SupportedChain.AUTO } = validated;

    try {
      // Determine target chain from recipient address if auto
      let targetChain = chain;
      if (chain === SupportedChain.AUTO) {
        targetChain = this.provider.detectChainFromAddress(to);
      }

      // Route to appropriate chain
      if (targetChain === SupportedChain.ETHEREUM) {
        return await this.sendEthereumTransaction(validated);
      } else if (targetChain === SupportedChain.SOLANA) {
        return await this.sendSolanaTransaction(validated);
      } else {
        throw new MultiChainError(
          `Invalid chain: ${targetChain}`,
          targetChain,
          MultiChainErrorCode.INVALID_CHAIN
        );
      }
    } catch (error) {
      if (error instanceof MultiChainError) {
        throw error;
      }
      throw new MultiChainError(
        `Failed to send transaction: ${String(error)}`,
        chain,
        MultiChainErrorCode.CHAIN_UNAVAILABLE,
        { error: String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Send Ethereum transaction
   */
  private async sendEthereumTransaction(
    params: SendTransactionParams
  ): Promise<UnifiedTransactionResponse> {
    if (!this.ethereumTools) {
      throw new MultiChainError(
        'Ethereum tools not available',
        SupportedChain.ETHEREUM,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }

    const result = await this.ethereumTools.sendTransaction(params);

    // Calculate estimated fee (gasLimit * gasPrice)
    let fee = '0';
    if (result.gasLimit && result.gasPrice) {
      fee = (BigInt(result.gasLimit) * BigInt(result.gasPrice)).toString();
    }

    return {
      chain: SupportedChain.ETHEREUM,
      signature: result.hash,
      status: result.status,
      from: result.from,
      to: result.to ?? '',
      amount: result.value,
      fee,
      ...(result.blockNumber !== null && { blockNumber: result.blockNumber }),
    };
  }

  /**
   * Send Solana transaction
   */
  private async sendSolanaTransaction(
    params: SendTransactionParams
  ): Promise<UnifiedTransactionResponse> {
    if (!this.solanaTools) {
      throw new MultiChainError(
        'Solana tools not available',
        SupportedChain.SOLANA,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }

    const result = await this.solanaTools.sendTransaction(params);

    return {
      chain: SupportedChain.SOLANA,
      signature: result.signature,
      status: result.status,
      from: result.from,
      to: result.to,
      amount: result.amount,
      fee: result.fee,
      ...(result.slot !== null && { slot: result.slot }),
      ...(result.computeUnitsConsumed && {
        computeUnitsConsumed: result.computeUnitsConsumed,
      }),
    };
  }

  /**
   * Transfer token with auto-detection
   */
  async transferToken(params: unknown): Promise<UnifiedTransactionResponse> {
    const validated = TransferTokenParamsSchema.parse(params);
    const { to, token, chain = SupportedChain.AUTO } = validated;

    try {
      // Determine target chain
      let targetChain = chain;
      if (chain === SupportedChain.AUTO) {
        // Try to detect from recipient or token address
        try {
          targetChain = this.provider.detectChainFromAddress(to);
        } catch {
          // If recipient detection fails, try token address
          targetChain = this.provider.detectChainFromAddress(token);
        }
      }

      // Route to appropriate chain
      if (targetChain === SupportedChain.ETHEREUM) {
        return await this.transferERC20Token(validated);
      } else if (targetChain === SupportedChain.SOLANA) {
        return await this.transferSPLToken(validated);
      } else {
        throw new MultiChainError(
          `Invalid chain: ${targetChain}`,
          targetChain,
          MultiChainErrorCode.INVALID_CHAIN
        );
      }
    } catch (error) {
      if (error instanceof MultiChainError) {
        throw error;
      }
      throw new MultiChainError(
        `Failed to transfer token: ${String(error)}`,
        chain,
        MultiChainErrorCode.CHAIN_UNAVAILABLE,
        { error: String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Transfer ERC20 token
   */
  private transferERC20Token(_params: TransferTokenParams): Promise<UnifiedTransactionResponse> {
    if (!this.ethereumTools) {
      return Promise.reject(
        new MultiChainError(
          'Ethereum tools not available',
          SupportedChain.ETHEREUM,
          MultiChainErrorCode.CHAIN_NOT_CONFIGURED
        )
      );
    }

    // Ethereum tools don't have transferToken yet, would need to call contract
    return Promise.reject(
      new MultiChainError(
        'ERC20 token transfers not yet implemented',
        SupportedChain.ETHEREUM,
        MultiChainErrorCode.OPERATION_NOT_SUPPORTED
      )
    );
  }

  /**
   * Transfer SPL token
   */
  private async transferSPLToken(params: TransferTokenParams): Promise<UnifiedTransactionResponse> {
    if (!this.solanaTools) {
      throw new MultiChainError(
        'Solana tools not available',
        SupportedChain.SOLANA,
        MultiChainErrorCode.CHAIN_NOT_CONFIGURED
      );
    }

    const result = await this.solanaTools.transferToken(params);

    return {
      chain: SupportedChain.SOLANA,
      signature: result.signature,
      status: result.status,
      from: result.from,
      to: result.to,
      amount: result.amount,
      fee: result.fee,
      ...(result.slot !== null && { slot: result.slot }),
      ...(result.computeUnitsConsumed && {
        computeUnitsConsumed: result.computeUnitsConsumed,
      }),
    };
  }

  /**
   * Execute tool by name
   *
   * Generic handler for MCP tool invocation
   */
  async executeTool(
    name: string,
    params: unknown
  ): Promise<
    UnifiedBalanceResponse | UnifiedTransactionResponse | { success: boolean; message: string }
  > {
    logger.info('Executing multi-chain tool', { name });

    switch (name) {
      case 'multichain_query_balance':
        return await this.queryBalance(params);

      case 'multichain_send_transaction':
        return await this.sendTransaction(params);

      case 'multichain_transfer_token':
        return await this.transferToken(params);

      case 'multichain_initialize_wallet': {
        // Cast params to access properties
        const toolParams = params as { chain?: string; privateKey?: string };
        const chain = toolParams['chain'] as SupportedChain;
        const privateKey = toolParams['privateKey'] ?? '';

        this.initializeWallet(chain, privateKey);
        return {
          success: true,
          message: `Wallet initialized for ${chain}`,
        };
      }

      case 'multichain_clear_wallet':
        this.clearWallet();
        return {
          success: true,
          message: 'Wallet/keypair cleared from memory',
        };

      default:
        throw new MultiChainError(
          `Unknown tool: ${name}`,
          SupportedChain.AUTO,
          MultiChainErrorCode.INVALID_PARAMETERS
        );
    }
  }
}
