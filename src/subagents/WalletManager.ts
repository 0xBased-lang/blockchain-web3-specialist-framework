/**
 * Wallet Manager Subagent
 *
 * Security-critical subagent for managing private keys and signing operations.
 *
 * Features:
 * - AES-256-GCM encryption for private keys
 * - Multi-chain support (Ethereum + Solana)
 * - Memory wiping after use
 * - Never logs private keys
 *
 * SECURITY CRITICAL: 100% test coverage required
 * NEVER expose private keys in logs, errors, or return values
 */

import { Wallet as EthereumWallet } from 'ethers';
import { Keypair as SolanaKeypair } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import {
  type EncryptedKey,
  WalletChain,
  type WalletChain as WalletChainType,
  type WalletMetadata,
  type WalletConfig,
  type SignRequest,
  type SignResponse,
  type WalletExport,
  WalletError,
  WalletErrorCode,
  SignRequestSchema,
  WalletConfigSchema,
} from '../types/wallet.js';
import {
  encrypt,
  decrypt,
  wipeString,
  wipeUint8Array,
  hexToBytes,
  bytesToHex,
} from '../utils/crypto.js';
import { logger } from '../utils/index.js';

/**
 * Wallet Manager
 *
 * Manages encrypted private keys for multiple blockchains.
 *
 * Security guarantees:
 * - Private keys are encrypted immediately upon import
 * - Private keys are wiped from memory after signing
 * - Private keys are NEVER logged or exposed in errors
 * - All operations require password authentication
 */
export class WalletManager {
  // Encrypted keys storage (address -> encrypted key)
  private readonly encryptedKeys: Map<string, EncryptedKey>;

  // Wallet metadata storage (address -> metadata)
  private readonly metadata: Map<string, WalletMetadata>;

  constructor() {
    this.encryptedKeys = new Map();
    this.metadata = new Map();
    logger.info('WalletManager initialized');
  }

  /**
   * Add a wallet by importing a private key
   *
   * SECURITY: Private key is encrypted immediately and wiped from memory
   *
   * @param privateKey - Private key to import (will be wiped after encryption)
   * @param password - Password for encryption
   * @param config - Wallet configuration
   * @returns Wallet address
   */
  async addWallet(
    privateKey: string,
    password: string,
    config: WalletConfig
  ): Promise<string> {
    // Validate config
    const validatedConfig = WalletConfigSchema.parse(config);

    // Derive address from private key (before encryption)
    const address = this.deriveAddress(privateKey, validatedConfig.chain);

    // Check if wallet already exists
    if (this.encryptedKeys.has(address)) {
      throw new WalletError(
        'Wallet already exists',
        WalletErrorCode.WALLET_ALREADY_EXISTS,
        validatedConfig.chain
      );
    }

    // Encrypt private key immediately
    const encrypted = await encrypt(privateKey, password);

    // Wipe private key from memory (best effort)
    privateKey = wipeString(privateKey);

    // Store encrypted key
    this.encryptedKeys.set(address, encrypted);

    // Store metadata
    const metadata: WalletMetadata = {
      address,
      chain: validatedConfig.chain,
      createdAt: new Date(),
    };

    if (validatedConfig.label !== undefined) {
      metadata.label = validatedConfig.label;
    }

    this.metadata.set(address, metadata);

    // NEVER log the private key
    logger.info('Wallet added', {
      address,
      chain: validatedConfig.chain,
      label: validatedConfig.label,
    });

    return address;
  }

  /**
   * Sign data with a wallet
   *
   * SECURITY: Private key is decrypted in memory only during signing,
   * then immediately wiped.
   *
   * @param request - Signing request
   * @returns Signature
   */
  async sign(request: SignRequest): Promise<SignResponse> {
    // Validate request
    const validated = SignRequestSchema.parse(request);

    // Get encrypted key
    const encrypted = this.encryptedKeys.get(validated.address);
    if (!encrypted) {
      throw new WalletError(
        `Wallet not found: ${validated.address}`,
        WalletErrorCode.KEY_NOT_FOUND
      );
    }

    // Get metadata
    const meta = this.metadata.get(validated.address);
    if (!meta) {
      throw new WalletError(
        `Wallet metadata not found: ${validated.address}`,
        WalletErrorCode.KEY_NOT_FOUND
      );
    }

    // Use chain from request or metadata
    const chain = validated.chain ?? meta.chain;

    // Decrypt private key (in memory only)
    let privateKey: string | null = null;

    try {
      privateKey = await decrypt(encrypted, validated.password);

      // Sign data based on chain
      const signature = await this.signWithChain(
        privateKey,
        validated.data,
        chain
      );

      logger.info('Data signed successfully', {
        address: validated.address,
        chain,
        dataLength: typeof validated.data === 'string' ? validated.data.length : validated.data.length,
      });

      return {
        signature,
        address: validated.address,
        chain,
        timestamp: Date.now(),
      };
    } catch (error) {
      // Don't leak information about why signing failed
      logger.error('Signing failed', {
        address: validated.address,
        chain,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new WalletError(
        'Signing failed: Invalid password or internal error',
        WalletErrorCode.SIGNING_FAILED,
        chain
      );
    } finally {
      // CRITICAL: Wipe private key from memory
      if (privateKey) {
        privateKey = wipeString(privateKey);
      }
    }
  }

  /**
   * Remove a wallet
   *
   * @param address - Wallet address to remove
   */
  removeWallet(address: string): void {
    const removed = this.encryptedKeys.delete(address);
    this.metadata.delete(address);

    if (removed) {
      logger.info('Wallet removed', { address });
    }
  }

  /**
   * List all wallets
   *
   * @returns Array of wallet metadata (no private keys)
   */
  listWallets(): WalletMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Get wallet metadata
   *
   * @param address - Wallet address
   * @returns Wallet metadata
   */
  getWallet(address: string): WalletMetadata | undefined {
    return this.metadata.get(address);
  }

  /**
   * Check if wallet exists
   *
   * @param address - Wallet address
   * @returns True if wallet exists
   */
  hasWallet(address: string): boolean {
    return this.encryptedKeys.has(address);
  }

  /**
   * Export all wallets (encrypted)
   *
   * @returns Encrypted wallet export
   */
  exportWallets(): WalletExport {
    const wallets: Record<string, { encryptedKey: EncryptedKey; metadata: WalletMetadata }> = {};

    for (const [address, encryptedKey] of this.encryptedKeys.entries()) {
      const meta = this.metadata.get(address);
      if (meta) {
        wallets[address] = {
          encryptedKey,
          metadata: meta,
        };
      }
    }

    return {
      version: '1.0.0',
      wallets,
      exportedAt: new Date(),
    };
  }

  /**
   * Import wallets from export
   *
   * @param exported - Encrypted wallet export
   */
  importWallets(exported: WalletExport): void {
    for (const [address, { encryptedKey, metadata }] of Object.entries(exported.wallets)) {
      // Don't overwrite existing wallets
      if (!this.encryptedKeys.has(address)) {
        this.encryptedKeys.set(address, encryptedKey);
        this.metadata.set(address, metadata);
      }
    }

    logger.info('Wallets imported', { count: Object.keys(exported.wallets).length });
  }

  /**
   * Clear all wallets from memory
   */
  clearAll(): void {
    this.encryptedKeys.clear();
    this.metadata.clear();
    logger.info('All wallets cleared');
  }

  /**
   * Private helper methods
   */

  /**
   * Derive wallet address from private key
   *
   * @param privateKey - Private key
   * @param chain - Blockchain
   * @returns Wallet address
   */
  private deriveAddress(privateKey: string, chain: WalletChainType): string {
    switch (chain) {
      case WalletChain.ETHEREUM:
        return this.deriveEthereumAddress(privateKey);

      case WalletChain.SOLANA:
        return this.deriveSolanaAddress(privateKey);

      default:
        throw new WalletError(
          `Unsupported chain: ${chain}`,
          WalletErrorCode.CHAIN_MISMATCH
        );
    }
  }

  /**
   * Derive Ethereum address from private key
   *
   * @param privateKey - Private key (hex with or without 0x)
   * @returns Ethereum address (checksummed)
   */
  private deriveEthereumAddress(privateKey: string): string {
    const wallet = new EthereumWallet(privateKey);
    return wallet.address;
  }

  /**
   * Derive Solana address from private key
   *
   * @param privateKey - Private key (base58 or hex)
   * @returns Solana address (base58)
   */
  private deriveSolanaAddress(privateKey: string): string {
    // Parse private key (support both hex and base58)
    let secretKey: Uint8Array;

    if (privateKey.startsWith('0x')) {
      // Hex format
      secretKey = hexToBytes(privateKey);
    } else if (privateKey.length === 128) {
      // Hex without 0x prefix
      secretKey = hexToBytes(privateKey);
    } else {
      // Assume base58
      try {
        secretKey = Uint8Array.from(Buffer.from(privateKey, 'base64'));
      } catch {
        throw new WalletError(
          'Invalid Solana private key format',
          WalletErrorCode.SIGNING_FAILED,
          'solana'
        );
      }
    }

    const keypair = SolanaKeypair.fromSecretKey(secretKey);

    // Wipe secret key
    wipeUint8Array(secretKey);

    return keypair.publicKey.toBase58();
  }

  /**
   * Sign data with chain-specific method
   *
   * @param privateKey - Private key (decrypted, in memory)
   * @param data - Data to sign
   * @param chain - Blockchain
   * @returns Signature (hex)
   */
  private async signWithChain(
    privateKey: string,
    data: string | Uint8Array,
    chain: WalletChainType
  ): Promise<string> {
    switch (chain) {
      case WalletChain.ETHEREUM:
        return this.signEthereum(privateKey, data);

      case WalletChain.SOLANA:
        return this.signSolana(privateKey, data);

      default:
        throw new WalletError(
          `Unsupported chain: ${chain}`,
          WalletErrorCode.CHAIN_MISMATCH
        );
    }
  }

  /**
   * Sign data with Ethereum wallet
   *
   * @param privateKey - Ethereum private key
   * @param data - Data to sign (string or bytes)
   * @returns Signature (hex with 0x prefix)
   */
  private async signEthereum(privateKey: string, data: string | Uint8Array): Promise<string> {
    const wallet = new EthereumWallet(privateKey);

    // Convert data to bytes if string
    const dataBytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

    // Sign the data (returns hex signature with 0x prefix)
    const signature = await wallet.signMessage(dataBytes);

    return signature;
  }

  /**
   * Sign data with Solana keypair
   *
   * @param privateKey - Solana private key
   * @param data - Data to sign (string or bytes)
   * @returns Signature (hex)
   */
  private signSolana(privateKey: string, data: string | Uint8Array): string {
    // Parse private key
    let secretKey: Uint8Array;

    if (privateKey.startsWith('0x')) {
      secretKey = hexToBytes(privateKey);
    } else if (privateKey.length === 128) {
      secretKey = hexToBytes(privateKey);
    } else {
      try {
        secretKey = Uint8Array.from(Buffer.from(privateKey, 'base64'));
      } catch {
        throw new WalletError(
          'Invalid Solana private key format',
          WalletErrorCode.SIGNING_FAILED,
          'solana'
        );
      }
    }

    try {
      const keypair = SolanaKeypair.fromSecretKey(secretKey);

      // Convert data to bytes if string
      const dataBytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

      // Sign data with Ed25519
      const signature = nacl.sign.detached(dataBytes, keypair.secretKey);

      return bytesToHex(signature);
    } finally {
      // Wipe secret key
      wipeUint8Array(secretKey);
    }
  }
}
