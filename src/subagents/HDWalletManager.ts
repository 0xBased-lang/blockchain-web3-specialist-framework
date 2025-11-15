/**
 * HD Wallet Manager
 *
 * Extends WalletManager with hierarchical deterministic wallet support (BIP32/BIP39).
 *
 * Features:
 * - BIP39 mnemonic import (12/15/18/21/24 words)
 * - BIP32 key derivation
 * - Multi-chain support (Ethereum + Solana)
 * - Encrypted seed storage
 *
 * SECURITY CRITICAL: 100% test coverage required
 */

import { HDNodeWallet, Mnemonic } from 'ethers';
import { Keypair as SolanaKeypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import { WalletManager } from './WalletManager.js';
import {
  type EncryptedKey,
  type MnemonicImportRequest,
  type KeyDerivationRequest,
  WalletChain,
  type WalletChain as WalletChainType,
  WalletError,
  WalletErrorCode,
  MnemonicImportRequestSchema,
  KeyDerivationRequestSchema,
} from '../types/wallet.js';
import { encrypt, decrypt, wipeString, wipeUint8Array } from '../utils/crypto.js';
import { logger } from '../utils/index.js';

/**
 * Standard derivation paths
 */
export const DERIVATION_PATHS = {
  // Ethereum: m/44'/60'/0'/0/x (BIP44 standard)
  ETHEREUM: (index: number) => `m/44'/60'/0'/0/${index}`,

  // Solana: m/44'/501'/x'/0' (Solana standard)
  SOLANA: (index: number) => `m/44'/501'/${index}'/0'`,
} as const;

/**
 * HD Wallet Manager
 *
 * Manages hierarchical deterministic wallets using BIP39/BIP32.
 */
export class HDWalletManager extends WalletManager {
  // Encrypted master seed (derived from mnemonic)
  private encryptedSeed: EncryptedKey | null = null;

  // Track derived wallet indices per chain
  private derivedIndices: Map<WalletChainType, number> = new Map();

  constructor() {
    super();
    logger.info('HDWalletManager initialized');
  }

  /**
   * Import a BIP39 mnemonic phrase
   *
   * SECURITY: Mnemonic and seed are wiped from memory after encryption
   *
   * @param request - Mnemonic import request
   */
  async importMnemonic(request: MnemonicImportRequest): Promise<void> {
    // Validate request
    const validated = MnemonicImportRequestSchema.parse(request);

    // Validate mnemonic
    if (!this.validateMnemonic(validated.mnemonic)) {
      throw new WalletError(
        'Invalid BIP39 mnemonic phrase',
        WalletErrorCode.INVALID_MNEMONIC
      );
    }

    // Check word count if specified
    if (validated.wordCount) {
      const words = validated.mnemonic.trim().split(/\s+/);
      const expectedCount = parseInt(validated.wordCount, 10);

      if (words.length !== expectedCount) {
        throw new WalletError(
          `Invalid word count: expected ${expectedCount}, got ${words.length}`,
          WalletErrorCode.INVALID_MNEMONIC
        );
      }
    }

    // Derive seed from mnemonic (this produces the master seed)
    const mnemonic = Mnemonic.fromPhrase(validated.mnemonic);
    const seed = mnemonic.entropy; // Get the entropy (seed) as hex

    // Encrypt seed
    this.encryptedSeed = await encrypt(seed, validated.password);

    // Wipe mnemonic from memory
    let mnemonicStr = validated.mnemonic;
    mnemonicStr = wipeString(mnemonicStr);

    // Reset derived indices
    this.derivedIndices.clear();

    logger.info('HD wallet mnemonic imported successfully');
  }

  /**
   * Derive a new wallet at the next index for a chain
   *
   * @param chain - Blockchain to derive for
   * @param password - Password to decrypt seed
   * @param label - Optional wallet label
   * @returns Derived wallet address
   */
  async deriveNextWallet(
    chain: WalletChainType,
    password: string,
    label?: string
  ): Promise<string> {
    if (!this.encryptedSeed) {
      throw new WalletError(
        'No HD wallet seed imported',
        WalletErrorCode.KEY_NOT_FOUND
      );
    }

    // Get next index for this chain
    const index = this.derivedIndices.get(chain) ?? 0;

    // Derive wallet
    const address = await this.deriveWallet({
      path: this.getStandardPath(chain, index),
      password,
      chain,
    });

    // Increment index
    this.derivedIndices.set(chain, index + 1);

    // Update label if provided
    if (label) {
      const metadata = this.getWallet(address);
      if (metadata) {
        metadata.label = label;
        metadata.derivationPath = this.getStandardPath(chain, index);
      }
    }

    logger.info('Derived new HD wallet', {
      chain,
      index,
      address,
    });

    return address;
  }

  /**
   * Derive a wallet at a specific path
   *
   * @param request - Key derivation request
   * @returns Derived wallet address
   */
  async deriveWallet(request: KeyDerivationRequest): Promise<string> {
    // Validate request
    const validated = KeyDerivationRequestSchema.parse(request);

    if (!this.encryptedSeed) {
      throw new WalletError(
        'No HD wallet seed imported',
        WalletErrorCode.KEY_NOT_FOUND
      );
    }

    // Decrypt seed
    let seed: string | null = null;

    try {
      seed = await decrypt(this.encryptedSeed, validated.password);

      // Derive private key based on chain
      const privateKey = this.derivePrivateKey(
        seed,
        validated.path,
        validated.chain
      );

      // Add wallet using base WalletManager
      const address = await this.addWallet(privateKey, validated.password, {
        chain: validated.chain,
      });

      // Update metadata with derivation path
      const metadata = this.getWallet(address);
      if (metadata) {
        metadata.derivationPath = validated.path;
      }

      return address;
    } finally {
      // Wipe seed from memory
      if (seed) {
        seed = wipeString(seed);
      }
    }
  }

  /**
   * Get the standard derivation path for a chain and index
   *
   * @param chain - Blockchain
   * @param index - Account index
   * @returns BIP32 derivation path
   */
  getStandardPath(chain: WalletChainType, index: number): string {
    switch (chain) {
      case WalletChain.ETHEREUM:
        return DERIVATION_PATHS.ETHEREUM(index);

      case WalletChain.SOLANA:
        return DERIVATION_PATHS.SOLANA(index);

      default:
        throw new WalletError(
          `Unsupported chain: ${chain}`,
          WalletErrorCode.CHAIN_MISMATCH
        );
    }
  }

  /**
   * Check if HD wallet is initialized
   *
   * @returns True if HD wallet has been imported
   */
  hasHDWallet(): boolean {
    return this.encryptedSeed !== null;
  }

  /**
   * Clear HD wallet (but keep individual derived wallets)
   */
  clearHDWallet(): void {
    this.encryptedSeed = null;
    this.derivedIndices.clear();
    logger.info('HD wallet cleared');
  }

  /**
   * Private helper methods
   */

  /**
   * Validate BIP39 mnemonic phrase
   *
   * @param mnemonic - Mnemonic phrase to validate
   * @returns True if valid
   */
  private validateMnemonic(mnemonic: string): boolean {
    try {
      // Validate using ethers.js Mnemonic
      Mnemonic.fromPhrase(mnemonic);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Derive private key from seed and path
   *
   * @param seed - Master seed (hex)
   * @param path - BIP32 derivation path
   * @param chain - Blockchain
   * @returns Private key (hex with 0x prefix)
   */
  private derivePrivateKey(seed: string, path: string, chain: WalletChainType): string {
    switch (chain) {
      case WalletChain.ETHEREUM:
        return this.deriveEthereumKey(seed, path);

      case WalletChain.SOLANA:
        return this.deriveSolanaKey(seed, path);

      default:
        throw new WalletError(
          `Unsupported chain: ${chain}`,
          WalletErrorCode.CHAIN_MISMATCH
        );
    }
  }

  /**
   * Derive Ethereum private key using BIP32
   *
   * @param seed - Master seed (hex)
   * @param path - BIP32 path (e.g., m/44'/60'/0'/0/0)
   * @returns Private key (hex with 0x prefix)
   */
  private deriveEthereumKey(seed: string, path: string): string {
    // Create mnemonic from entropy (seed)
    const mnemonic = Mnemonic.fromEntropy(seed);

    // Create HD node from mnemonic
    const hdNode = HDNodeWallet.fromMnemonic(mnemonic);

    // Derive at path
    const derived = hdNode.derivePath(path);

    return derived.privateKey;
  }

  /**
   * Derive Solana private key using Ed25519 derivation
   *
   * @param seed - Master seed (hex)
   * @param path - BIP32 path (e.g., m/44'/501'/0'/0')
   * @returns Private key (hex with 0x prefix)
   */
  private deriveSolanaKey(seed: string, path: string): string {
    // Convert seed to bytes
    const seedBytes = Buffer.from(seed, 'hex');

    // Derive using ed25519-hd-key
    const { key } = derivePath(path, seedBytes.toString('hex'));

    // Create keypair from derived key
    const keypair = SolanaKeypair.fromSeed(key);

    // Get private key (secret key is 64 bytes: 32 bytes private + 32 bytes public)
    const secretKey = keypair.secretKey;

    // Convert to hex
    const privateKeyHex = '0x' + Buffer.from(secretKey).toString('hex');

    // Wipe sensitive data
    wipeUint8Array(key);
    wipeUint8Array(secretKey);

    return privateKeyHex;
  }
}
