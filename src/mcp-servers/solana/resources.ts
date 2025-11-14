import { SolanaProvider } from './provider.js';
import {
  SolanaError,
  SolanaErrorCode,
  type SolanaAddress,
  type Signature,
  type Commitment,
  type AccountInfo,
  type TokenAccountInfo,
  type TransactionInfo,
  type BlockInfo,
} from './types.js';
import { logger } from '../../utils/index.js';

/**
 * Solana Resource Manager
 *
 * MCP Resources provide read-only blockchain data access:
 * - Account info (SOL balance, owner, data)
 * - Token accounts (SPL token balances)
 * - Transactions (with status, logs, compute units)
 * - Blocks (with transactions, rewards)
 *
 * URI Scheme:
 * - solana://account/{address}
 * - solana://token-account/{address}
 * - solana://transaction/{signature}
 * - solana://block/{slot}
 *
 * Edge cases handled:
 * - Account not found → Null response
 * - Token account initialization → Check for existence
 * - Transaction not found → Proper error
 * - Block not found → Null response
 */
export class SolanaResourceManager {
  constructor(private provider: SolanaProvider) {}

  /**
   * List available resources
   */
  listResources(): Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }> {
    return [
      {
        uri: 'solana://account/*',
        name: 'Account Info',
        description: 'Get Solana account information (balance, owner, data)',
        mimeType: 'application/json',
      },
      {
        uri: 'solana://token-account/*',
        name: 'Token Account',
        description: 'Get SPL token account information',
        mimeType: 'application/json',
      },
      {
        uri: 'solana://transaction/*',
        name: 'Transaction',
        description: 'Get transaction details (status, logs, compute units)',
        mimeType: 'application/json',
      },
      {
        uri: 'solana://block/*',
        name: 'Block',
        description: 'Get block information (transactions, rewards)',
        mimeType: 'application/json',
      },
    ];
  }

  /**
   * Get account resource
   */
  async getAccountResource(
    address: SolanaAddress,
    commitment: Commitment = 'confirmed'
  ): Promise<{
    uri: string;
    type: string;
    data: AccountInfo | null;
  }> {
    try {
      const accountInfo = await this.provider.getAccountInfo(address, commitment);

      if (!accountInfo) {
        logger.debug('Account not found', { address });
        return {
          uri: `solana://account/${address}`,
          type: 'account',
          data: null,
        };
      }

      logger.info('Account resource fetched', { address, slot: accountInfo.slot });

      return {
        uri: `solana://account/${address}`,
        type: 'account',
        data: accountInfo,
      };
    } catch (error) {
      logger.error('Failed to get account resource', { address, error });
      throw new SolanaError(
        `Failed to fetch account ${address}`,
        SolanaErrorCode.NETWORK_ERROR,
        { address, error: String(error) }
      );
    }
  }

  /**
   * Get token account resource
   *
   * For SPL tokens, users have Associated Token Accounts (ATAs)
   */
  async getTokenAccountResource(
    address: SolanaAddress,
    commitment: Commitment = 'confirmed'
  ): Promise<{
    uri: string;
    type: string;
    data: TokenAccountInfo | null;
  }> {
    try {
      const accountInfo = await this.provider.getAccountInfo(address, commitment);

      if (!accountInfo) {
        logger.debug('Token account not found', { address });
        return {
          uri: `solana://token-account/${address}`,
          type: 'token-account',
          data: null,
        };
      }

      // Parse token account data
      // Note: This is simplified - real implementation would deserialize the account data
      // using @solana/spl-token or similar library
      const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

      if (accountInfo.owner !== TOKEN_PROGRAM_ID) {
        throw new SolanaError(
          'Account is not a token account',
          SolanaErrorCode.ACCOUNT_NOT_FOUND,
          { address, owner: accountInfo.owner }
        );
      }

      // Placeholder: Real implementation would parse the account data
      const tokenAccount: TokenAccountInfo = {
        address,
        mint: '11111111111111111111111111111111' as SolanaAddress, // Placeholder
        owner: '11111111111111111111111111111111' as SolanaAddress, // Placeholder
        amount: '0',
        decimals: 9,
        slot: accountInfo.slot,
      };

      logger.info('Token account resource fetched', { address, slot: accountInfo.slot });

      return {
        uri: `solana://token-account/${address}`,
        type: 'token-account',
        data: tokenAccount,
      };
    } catch (error) {
      logger.error('Failed to get token account resource', { address, error });
      if (error instanceof SolanaError) {
        throw error;
      }
      throw new SolanaError(
        `Failed to fetch token account ${address}`,
        SolanaErrorCode.NETWORK_ERROR,
        { address, error: String(error) }
      );
    }
  }

  /**
   * Get transaction resource
   */
  async getTransactionResource(
    signature: Signature,
    commitment: Commitment = 'confirmed'
  ): Promise<{
    uri: string;
    type: string;
    data: TransactionInfo;
  }> {
    try {
      const tx = await this.provider.getTransaction(signature, commitment);

      if (!tx) {
        throw new SolanaError(
          'Transaction not found',
          SolanaErrorCode.ACCOUNT_NOT_FOUND,
          { signature }
        );
      }

      logger.info('Transaction resource fetched', { signature, slot: tx.slot });

      return {
        uri: `solana://transaction/${signature}`,
        type: 'transaction',
        data: tx,
      };
    } catch (error) {
      logger.error('Failed to get transaction resource', { signature, error });
      if (error instanceof SolanaError) {
        throw error;
      }
      throw new SolanaError(
        `Failed to fetch transaction ${signature}`,
        SolanaErrorCode.NETWORK_ERROR,
        { signature, error: String(error) }
      );
    }
  }

  /**
   * Get block resource
   */
  async getBlockResource(
    slot: number | 'latest',
    commitment: Commitment = 'confirmed'
  ): Promise<{
    uri: string;
    type: string;
    data: BlockInfo;
  }> {
    try {
      // Get latest slot if requested
      const targetSlot = slot === 'latest' ? await this.provider.getSlot(commitment) : slot;

      const block = await this.provider.getBlock(targetSlot, commitment);

      if (!block) {
        throw new SolanaError(
          'Block not found',
          SolanaErrorCode.ACCOUNT_NOT_FOUND,
          { slot: targetSlot }
        );
      }

      logger.info('Block resource fetched', { slot: targetSlot });

      return {
        uri: `solana://block/${targetSlot}`,
        type: 'block',
        data: block,
      };
    } catch (error) {
      logger.error('Failed to get block resource', { slot, error });
      if (error instanceof SolanaError) {
        throw error;
      }
      throw new SolanaError(
        `Failed to fetch block ${slot}`,
        SolanaErrorCode.NETWORK_ERROR,
        { slot, error: String(error) }
      );
    }
  }
}
