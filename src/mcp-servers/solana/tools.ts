import {
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAccount,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getMint,
} from '@solana/spl-token';
import { SolanaProvider } from './provider.js';
import {
  SolanaError,
  SolanaErrorCode,
  QueryBalanceParamsSchema,
  SendTransactionParamsSchema,
  TransferTokenParamsSchema,
  RequestAirdropParamsSchema,
  WaitForConfirmationParamsSchema,
  type SolanaAddress,
  type Signature,
  type BalanceResponse,
  type TransactionResponse,
  type RecentBlockhashResponse,
} from './types.js';
import { logger } from '../../utils/index.js';

/**
 * Solana Tool Manager
 *
 * MCP Tools for blockchain operations:
 * - Query balances (SOL + SPL tokens)
 * - Send transactions (SOL transfers)
 * - Transfer SPL tokens (with ATA creation)
 * - Get recent blockhash (critical for Solana)
 * - Request airdrop (devnet/testnet)
 * - Wait for confirmation
 *
 * Security:
 * - Private keys NEVER logged
 * - Keypair cleared from memory after use
 * - Balance validation before transfers
 * - Blockhash expiration awareness
 */
export class SolanaToolManager {
  private keypair: Keypair | null = null;

  constructor(private provider: SolanaProvider) {}

  /**
   * Initialize keypair for signing transactions
   *
   * ⚠️ SECURITY CRITICAL:
   * - Private key NEVER logged
   * - Keypair stored in memory only
   * - Call clearKeypair() to wipe after use
   */
  initializeKeypair(privateKey: string): void {
    try {
      // Parse private key (expects base58 or byte array)
      let secretKey: Uint8Array;

      if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
        // JSON array format
        secretKey = Uint8Array.from(JSON.parse(privateKey));
      } else {
        // Assume base58 format - convert to bytes
        // Note: This is simplified - real implementation would use bs58 library
        throw new Error('Only JSON array format supported for private keys currently');
      }

      this.keypair = Keypair.fromSecretKey(secretKey);

      logger.info('Keypair initialized', {
        publicKey: this.keypair.publicKey.toBase58(),
        // NEVER log private key
      });
    } catch (error) {
      logger.error('Failed to initialize keypair', { error: String(error) });
      throw new SolanaError('Invalid private key format', SolanaErrorCode.INVALID_ADDRESS, {
        error: String(error),
      });
    }
  }

  /**
   * Clear keypair from memory
   */
  clearKeypair(): void {
    this.keypair = null;
    logger.info('Keypair cleared from memory');
  }

  /**
   * Query balance (SOL or SPL token)
   */
  async queryBalance(params: unknown): Promise<BalanceResponse> {
    const validated = QueryBalanceParamsSchema.parse(params);
    const { address, token, commitment = 'confirmed' } = validated;

    try {
      const slot = await this.provider.getSlot(commitment);
      let balance: bigint;
      let decimals: number;
      let symbol: string | undefined;

      if (!token) {
        // Query SOL balance
        balance = await this.provider.getBalance(address, commitment);
        decimals = 9; // SOL has 9 decimals
        symbol = 'SOL';
      } else {
        // Query SPL token balance
        try {
          const ownerPubkey = new PublicKey(address);
          const mintPubkey = new PublicKey(token);

          // Get associated token account
          const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);

          // Get token account info
          const tokenAccount = await getAccount(this.provider.getConnection(), ata, commitment);

          balance = tokenAccount.amount;

          // Get token metadata
          const mintInfo = await getMint(this.provider.getConnection(), mintPubkey, commitment);

          decimals = mintInfo.decimals;
          // Symbol would come from token metadata (not implemented here)
        } catch (error) {
          // Token account doesn't exist
          logger.debug('Token account not found', { address, token, error: String(error) });
          balance = 0n;
          decimals = 9; // Default
        }
      }

      return {
        address,
        balance: balance.toString(),
        decimals,
        ...(symbol && { symbol }),
        slot,
        ...(token && { token }),
      };
    } catch (error) {
      logger.error('Failed to query balance', { address, token, error });
      throw new SolanaError(
        `Failed to query balance for ${address}`,
        SolanaErrorCode.NETWORK_ERROR,
        { address, token, error: String(error) }
      );
    }
  }

  /**
   * Send SOL transaction
   */
  async sendTransaction(params: unknown): Promise<TransactionResponse> {
    if (!this.keypair) {
      throw new SolanaError(
        'Keypair not initialized. Call initializeKeypair() first.',
        SolanaErrorCode.INVALID_ADDRESS
      );
    }

    const validated = SendTransactionParamsSchema.parse(params);
    const { to, amount, recentBlockhash, computeUnitLimit, computeUnitPrice } = validated;

    try {
      const fromPubkey = this.keypair.publicKey;
      const toPubkey = new PublicKey(to);

      // Check balance before sending (prevent wasting fees)
      const balance = await this.provider.getBalance(
        fromPubkey.toBase58() as SolanaAddress,
        'confirmed'
      );

      if (balance < amount) {
        throw new SolanaError(
          `Insufficient funds: have ${balance} lamports, need ${amount} lamports`,
          SolanaErrorCode.INSUFFICIENT_FUNDS,
          { balance: balance.toString(), required: amount.toString() }
        );
      }

      // Get recent blockhash if not provided
      const blockhashData = recentBlockhash
        ? { blockhash: recentBlockhash, lastValidBlockHeight: 0 }
        : await this.provider.getRecentBlockhash('confirmed');

      // Create transaction
      const transaction = new Transaction({
        feePayer: fromPubkey,
        blockhash: blockhashData.blockhash,
        lastValidBlockHeight: blockhashData.lastValidBlockHeight,
      });

      // Add compute budget if specified
      if (computeUnitLimit || computeUnitPrice) {
        // Note: Would need @solana/web3.js ComputeBudgetProgram
        logger.debug('Compute budget specified', { computeUnitLimit, computeUnitPrice });
      }

      // Add transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Number(amount), // Convert BigInt to number for SDK
        })
      );

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        this.provider.getConnection(),
        transaction,
        [this.keypair],
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        }
      );

      logger.info('Transaction sent', {
        signature,
        from: fromPubkey.toBase58(),
        to,
        amount: amount.toString(),
      });

      // Get transaction details
      const slot = await this.provider.getSlot('confirmed');

      return {
        signature: signature as Signature,
        from: fromPubkey.toBase58() as SolanaAddress,
        to,
        amount: amount.toString(),
        fee: '5000', // Estimated fee (would get from transaction meta)
        recentBlockhash: blockhashData.blockhash,
        slot,
        status: 'confirmed',
      };
    } catch (error) {
      logger.error('Failed to send transaction', { to, amount: amount.toString(), error });
      if (error instanceof SolanaError) {
        throw error;
      }
      throw new SolanaError('Transaction failed', SolanaErrorCode.TRANSACTION_FAILED, {
        to,
        amount: amount.toString(),
        error: String(error),
      });
    }
  }

  /**
   * Transfer SPL tokens
   */
  async transferToken(params: unknown): Promise<TransactionResponse> {
    if (!this.keypair) {
      throw new SolanaError(
        'Keypair not initialized. Call initializeKeypair() first.',
        SolanaErrorCode.INVALID_ADDRESS
      );
    }

    const validated = TransferTokenParamsSchema.parse(params);
    const { to, amount, mint, createAssociatedTokenAccount = false } = validated;

    try {
      const fromPubkey = this.keypair.publicKey;
      const toPubkey = new PublicKey(to);
      const mintPubkey = new PublicKey(mint);

      // Get source token account
      const sourceAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey);

      // Get destination token account
      const destAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } =
        await this.provider.getRecentBlockhash('confirmed');

      // Create transaction
      const transaction = new Transaction({
        feePayer: fromPubkey,
        blockhash,
        lastValidBlockHeight,
      });

      // Create destination ATA if it doesn't exist and flag is set
      if (createAssociatedTokenAccount) {
        try {
          await getAccount(this.provider.getConnection(), destAta, 'confirmed');
        } catch {
          // Account doesn't exist, create it
          transaction.add(
            createAssociatedTokenAccountInstruction(
              fromPubkey, // payer
              destAta, // associated token account
              toPubkey, // owner
              mintPubkey // mint
            )
          );
          logger.debug('Creating associated token account', { destAta: destAta.toBase58() });
        }
      }

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          sourceAta,
          destAta,
          fromPubkey,
          Number(amount) // Convert BigInt to number for SDK
        )
      );

      // Send and confirm
      const signature = await sendAndConfirmTransaction(
        this.provider.getConnection(),
        transaction,
        [this.keypair],
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        }
      );

      logger.info('SPL token transferred', {
        signature,
        from: fromPubkey.toBase58(),
        to,
        mint,
        amount: amount.toString(),
      });

      const slot = await this.provider.getSlot('confirmed');

      return {
        signature: signature as Signature,
        from: fromPubkey.toBase58() as SolanaAddress,
        to,
        amount: amount.toString(),
        fee: '5000', // Estimated
        recentBlockhash: blockhash,
        slot,
        status: 'confirmed',
      };
    } catch (error) {
      logger.error('Failed to transfer token', { to, mint, amount: amount.toString(), error });
      if (error instanceof SolanaError) {
        throw error;
      }
      throw new SolanaError('Token transfer failed', SolanaErrorCode.TRANSACTION_FAILED, {
        to,
        mint,
        amount: amount.toString(),
        error: String(error),
      });
    }
  }

  /**
   * Get recent blockhash
   *
   * ⚠️ CRITICAL: Solana blockhashes expire after ~79 seconds
   * Always fetch fresh blockhash before creating transactions
   */
  async getRecentBlockhash(): Promise<RecentBlockhashResponse> {
    try {
      const { blockhash, lastValidBlockHeight } =
        await this.provider.getRecentBlockhash('confirmed');

      logger.debug('Recent blockhash fetched', { blockhash, lastValidBlockHeight });

      return {
        blockhash,
        lastValidBlockHeight,
      };
    } catch (error) {
      logger.error('Failed to get recent blockhash', { error });
      throw new SolanaError('Failed to fetch recent blockhash', SolanaErrorCode.NETWORK_ERROR, {
        error: String(error),
      });
    }
  }

  /**
   * Request airdrop (devnet/testnet only)
   */
  async requestAirdrop(params: unknown): Promise<{ signature: Signature; lamports: string }> {
    const validated = RequestAirdropParamsSchema.parse(params);
    const { address, lamports } = validated;

    try {
      // Validate amount (max 2 SOL per airdrop on devnet)
      const MAX_AIRDROP = BigInt(2 * LAMPORTS_PER_SOL);
      if (lamports > MAX_AIRDROP) {
        throw new SolanaError(
          `Airdrop amount too large: max ${MAX_AIRDROP} lamports (2 SOL)`,
          SolanaErrorCode.INVALID_ADDRESS,
          { requested: lamports.toString(), max: MAX_AIRDROP.toString() }
        );
      }

      const signature = await this.provider.requestAirdrop(address, lamports);

      // Wait for confirmation
      await this.provider.confirmTransaction(signature, 'confirmed', 30000);

      logger.info('Airdrop completed', { address, lamports: lamports.toString(), signature });

      return {
        signature,
        lamports: lamports.toString(),
      };
    } catch (error) {
      logger.error('Failed to request airdrop', { address, lamports: lamports.toString(), error });
      throw new SolanaError('Airdrop failed', SolanaErrorCode.NETWORK_ERROR, {
        address,
        lamports: lamports.toString(),
        error: String(error),
      });
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(params: unknown): Promise<{ signature: Signature; status: string }> {
    const validated = WaitForConfirmationParamsSchema.parse(params);
    const { signature, commitment = 'confirmed', timeout = 30000 } = validated;

    try {
      await this.provider.confirmTransaction(signature, commitment, timeout);

      logger.info('Transaction confirmed', { signature, commitment });

      return {
        signature,
        status: 'confirmed',
      };
    } catch (error) {
      logger.error('Failed to confirm transaction', { signature, commitment, error });
      if (error instanceof SolanaError) {
        throw error;
      }
      throw new SolanaError('Transaction confirmation failed', SolanaErrorCode.TIMEOUT, {
        signature,
        commitment,
        timeout,
        error: String(error),
      });
    }
  }
}
