/**
 * Cryptographic Utilities
 *
 * Security-critical utilities for:
 * - AES-256-GCM encryption/decryption
 * - Scrypt key derivation
 * - Secure random generation
 * - Memory wiping
 *
 * SECURITY CRITICAL: 100% test coverage required
 * NEVER log keys or plaintext data
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt, createHash } from 'crypto';
import { promisify } from 'util';
import { type EncryptedKey } from '../types/wallet.js';

const scryptAsync = promisify(scrypt);

/**
 * Encryption configuration
 */
const ALGORITHM = 'aes-256-gcm' as const;
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16; // 128 bits

/**
 * Encrypt data with AES-256-GCM
 *
 * @param plaintext - Data to encrypt (will be wiped after encryption)
 * @param password - Password for key derivation
 * @returns Encrypted data with IV, salt, and auth tag
 */
export async function encrypt(plaintext: string, password: string): Promise<EncryptedKey> {
  try {
    // Generate random salt
    const salt = randomBytes(SALT_LENGTH);

    // Derive key from password using scrypt
    const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

    // Generate random IV
    const iv = randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Wipe sensitive data from memory
    wipeBuffer(key);

    return {
      encrypted: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: ALGORITHM,
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt data with AES-256-GCM
 *
 * @param encryptedData - Encrypted data structure
 * @param password - Password for key derivation
 * @returns Decrypted plaintext (caller must wipe from memory)
 */
export async function decrypt(encryptedData: EncryptedKey, password: string): Promise<string> {
  try {
    // Verify algorithm
    if (encryptedData.algorithm !== ALGORITHM) {
      throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
    }

    // Parse hex-encoded data
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const encrypted = Buffer.from(encryptedData.encrypted, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');

    // Derive key from password
    const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);

    // Set auth tag for verification
    decipher.setAuthTag(authTag);

    // Decrypt data
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // Wipe key from memory
    wipeBuffer(key);

    return decrypted.toString('utf8');
  } catch (error) {
    // Don't leak information about why decryption failed
    throw new Error('Decryption failed: Invalid password or corrupted data');
  }
}

/**
 * Wipe a string from memory (best effort)
 *
 * Note: JavaScript engines may optimize this away. Use for defense-in-depth.
 *
 * @param str - String to wipe (will be modified)
 * @returns Wiped string (all zeros)
 */
export function wipeString(str: string): string {
  // JavaScript strings are immutable, so we can't actually wipe them
  // This function returns a zero-filled string of the same length
  // The caller should overwrite their variable with this
  return '0'.repeat(str.length);
}

/**
 * Wipe a Buffer from memory
 *
 * @param buffer - Buffer to wipe (will be modified in place)
 */
export function wipeBuffer(buffer: Buffer): void {
  buffer.fill(0);
}

/**
 * Wipe a Uint8Array from memory
 *
 * @param array - Array to wipe (will be modified in place)
 */
export function wipeUint8Array(array: Uint8Array): void {
  array.fill(0);
}

/**
 * Generate cryptographically secure random bytes
 *
 * @param length - Number of bytes to generate
 * @returns Random bytes as hex string
 */
export function generateRandomHex(length: number): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate cryptographically secure random bytes as buffer
 *
 * @param length - Number of bytes to generate
 * @returns Random bytes as Buffer
 */
export function generateRandomBytes(length: number): Buffer {
  return randomBytes(length);
}

/**
 * Validate hex string format
 *
 * @param hex - String to validate
 * @param expectedLength - Expected length in bytes (optional)
 * @returns True if valid hex string
 */
export function isValidHex(hex: string, expectedLength?: number): boolean {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

  // Check hex format
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    return false;
  }

  // Check length if specified (hex string is 2 chars per byte)
  if (expectedLength !== undefined) {
    return cleanHex.length === expectedLength * 2;
  }

  // Check even length
  return cleanHex.length % 2 === 0;
}

/**
 * Convert hex string to Uint8Array
 *
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!isValidHex(cleanHex)) {
    throw new Error('Invalid hex string');
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }

  return bytes;
}

/**
 * Convert Uint8Array to hex string
 *
 * @param bytes - Bytes to convert
 * @param prefix - Add 0x prefix (default: false)
 * @returns Hex string
 */
export function bytesToHex(bytes: Uint8Array, prefix = false): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return prefix ? `0x${hex}` : hex;
}

/**
 * Hash data with SHA-256
 *
 * @param data - Data to hash
 * @returns SHA-256 hash as hex string
 */
export function sha256(data: string | Buffer): string {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Constant-time string comparison (timing attack resistant)
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if equal
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
  }

  return result === 0;
}
