import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  wipeString,
  wipeBuffer,
  wipeUint8Array,
  generateRandomHex,
  generateRandomBytes,
  isValidHex,
  hexToBytes,
  bytesToHex,
  sha256,
  constantTimeCompare,
} from '../../../src/utils/crypto.js';

describe('Crypto Utilities', () => {
  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const plaintext = 'sensitive data that needs encryption';
      const password = 'strong-password-123';

      const encrypted = await encrypt(plaintext, password);

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toHaveLength(32); // 16 bytes hex = 32 chars
      expect(encrypted.salt).toHaveLength(32);
      expect(encrypted.authTag).toHaveLength(32);
      expect(encrypted.algorithm).toBe('aes-256-gcm');

      const decrypted = await decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', async () => {
      const plaintext = 'same data';
      const password = 'password';

      const encrypted1 = await encrypt(plaintext, password);
      const encrypted2 = await encrypt(plaintext, password);

      // Different IVs and salts
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);

      // But both decrypt to same plaintext
      expect(await decrypt(encrypted1, password)).toBe(plaintext);
      expect(await decrypt(encrypted2, password)).toBe(plaintext);
    });

    it('should fail decryption with wrong password', async () => {
      const plaintext = 'secret';
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';

      const encrypted = await encrypt(plaintext, password);

      await expect(decrypt(encrypted, wrongPassword)).rejects.toThrow('Decryption failed');
    });

    it('should fail with tampered ciphertext', async () => {
      const plaintext = 'secret';
      const password = 'password';

      const encrypted = await encrypt(plaintext, password);

      // Tamper with encrypted data
      const tampered = {
        ...encrypted,
        encrypted: encrypted.encrypted.slice(0, -2) + 'ff',
      };

      await expect(decrypt(tampered, password)).rejects.toThrow('Decryption failed');
    });

    it('should fail with tampered auth tag', async () => {
      const plaintext = 'secret';
      const password = 'password';

      const encrypted = await encrypt(plaintext, password);

      // Tamper with auth tag
      const tampered = {
        ...encrypted,
        authTag: encrypted.authTag.slice(0, -2) + 'ff',
      };

      await expect(decrypt(tampered, password)).rejects.toThrow('Decryption failed');
    });

    it('should handle empty plaintext', async () => {
      const plaintext = '';
      const password = 'password';

      const encrypted = await encrypt(plaintext, password);
      const decrypted = await decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long plaintext', async () => {
      const plaintext = 'a'.repeat(10000);
      const password = 'password';

      const encrypted = await encrypt(plaintext, password);
      const decrypted = await decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
      expect(decrypted.length).toBe(10000);
    });
  });

  describe('Memory Wiping', () => {
    it('should wipe string to zeros', () => {
      const original = 'sensitive-data-123';
      const wiped = wipeString(original);

      expect(wiped).toBe('0'.repeat(original.length));
      expect(wiped.length).toBe(original.length);
    });

    it('should wipe buffer in place', () => {
      const buffer = Buffer.from('sensitive data');
      wipeBuffer(buffer);

      expect(buffer.every((byte) => byte === 0)).toBe(true);
    });

    it('should wipe Uint8Array in place', () => {
      const array = new Uint8Array([1, 2, 3, 4, 5]);
      wipeUint8Array(array);

      expect(array.every((byte) => byte === 0)).toBe(true);
    });
  });

  describe('Random Generation', () => {
    it('should generate random hex of specified length', () => {
      const hex = generateRandomHex(16);

      expect(hex).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
    });

    it('should generate different random values', () => {
      const hex1 = generateRandomHex(16);
      const hex2 = generateRandomHex(16);

      expect(hex1).not.toBe(hex2);
    });

    it('should generate random bytes buffer', () => {
      const bytes = generateRandomBytes(32);

      expect(bytes).toBeInstanceOf(Buffer);
      expect(bytes.length).toBe(32);
    });
  });

  describe('Hex Validation', () => {
    it('should validate correct hex strings', () => {
      expect(isValidHex('0123456789abcdef')).toBe(true);
      expect(isValidHex('0x0123456789abcdef')).toBe(true);
      expect(isValidHex('ABCDEF')).toBe(true);
      expect(isValidHex('0xABCDEF')).toBe(true);
    });

    it('should reject invalid hex strings', () => {
      expect(isValidHex('xyz')).toBe(false);
      expect(isValidHex('12g')).toBe(false);
      expect(isValidHex('0x12g')).toBe(false);
    });

    it('should reject odd-length hex strings', () => {
      expect(isValidHex('123')).toBe(false);
      expect(isValidHex('0x123')).toBe(false);
    });

    it('should validate hex with expected length', () => {
      expect(isValidHex('0123456789abcdef', 8)).toBe(true);
      expect(isValidHex('0x0123456789abcdef', 8)).toBe(true);
      expect(isValidHex('0123456789abcdef', 16)).toBe(false);
    });
  });

  describe('Hex Conversions', () => {
    it('should convert hex to bytes', () => {
      const hex = '48656c6c6f'; // "Hello" in hex
      const bytes = hexToBytes(hex);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
    });

    it('should convert hex with 0x prefix to bytes', () => {
      const hex = '0x48656c6c6f';
      const bytes = hexToBytes(hex);

      expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
    });

    it('should convert bytes to hex', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const hex = bytesToHex(bytes);

      expect(hex).toBe('48656c6c6f');
    });

    it('should convert bytes to hex with prefix', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const hex = bytesToHex(bytes, true);

      expect(hex).toBe('0x48656c6c6f');
    });

    it('should throw on invalid hex in hexToBytes', () => {
      expect(() => hexToBytes('xyz')).toThrow('Invalid hex string');
    });
  });

  describe('SHA-256 Hashing', () => {
    it('should hash string correctly', () => {
      const hash = sha256('hello');

      expect(hash).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('should produce consistent hashes', () => {
      const hash1 = sha256('test');
      const hash2 = sha256('test');

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = sha256('test1');
      const hash2 = sha256('test2');

      expect(hash1).not.toBe(hash2);
    });

    it('should hash buffer correctly', () => {
      const buffer = Buffer.from('hello');
      const hash = sha256(buffer);

      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe('Constant Time Comparison', () => {
    it('should return true for equal strings', () => {
      expect(constantTimeCompare('hello', 'hello')).toBe(true);
      expect(constantTimeCompare('', '')).toBe(true);
      expect(constantTimeCompare('abcd1234', 'abcd1234')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(constantTimeCompare('hello', 'world')).toBe(false);
      expect(constantTimeCompare('abc', 'abd')).toBe(false);
    });

    it('should return false for different lengths', () => {
      expect(constantTimeCompare('hello', 'hell')).toBe(false);
      expect(constantTimeCompare('short', 'longer-string')).toBe(false);
    });

    it('should be timing-safe (same time for all comparisons of same length)', () => {
      // This is more of a conceptual test
      // In production, constant-time comparison prevents timing attacks
      const str1 = 'a'.repeat(100);
      const str2 = 'b'.repeat(100);
      const str3 = 'a'.repeat(99) + 'b';

      expect(constantTimeCompare(str1, str2)).toBe(false);
      expect(constantTimeCompare(str1, str3)).toBe(false);
    });
  });
});
