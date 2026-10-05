// ============================================================
// AES-256-GCM Encryption Module
// ============================================================
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

export interface EncryptionResult {
  encryptedData: Buffer;
  iv: string;       // Base64
  authTag: string;  // Base64
  sha256Hash: string;
  encryptionVersion: string;
}

export interface DecryptionResult {
  decryptedData: Buffer;
  sha256Hash: string;
}

/**
 * Get the encryption key from environment variables.
 * Key must be a 64-character hex string (32 bytes).
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (256 bits)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Generate a new random AES-256 encryption key.
 * Returns a hex-encoded string.
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Calculate SHA-256 hash of data.
 */
export function calculateSHA256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Encrypt a file/buffer using AES-256-GCM.
 * 
 * 1. Reads the plaintext buffer
 * 2. Generates a random 96-bit IV
 * 3. Encrypts using AES-256-GCM
 * 4. Calculates SHA-256 of the original plaintext
 * 5. Returns encrypted data + metadata
 */
export function encryptFile(plaintext: Buffer): EncryptionResult {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  // Calculate SHA-256 of plaintext BEFORE encryption
  const sha256Hash = calculateSHA256(plaintext);
  
  // Encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    sha256Hash,
    encryptionVersion: 'aes-256-gcm-v1',
  };
}

/**
 * Decrypt a file/buffer using AES-256-GCM.
 * 
 * 1. Reads the encrypted data
 * 2. Decrypts using AES-256-GCM with the stored IV and auth tag
 * 3. Calculates SHA-256 of the decrypted data
 * 4. Returns decrypted data + hash for integrity verification
 */
export function decryptFile(
  encryptedData: Buffer,
  ivBase64: string,
  authTagBase64: string
): DecryptionResult {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);
  
  const sha256Hash = calculateSHA256(decrypted);
  
  return {
    decryptedData: decrypted,
    sha256Hash,
  };
}

/**
 * Verify the integrity of encrypted data by decrypting and comparing SHA-256 hashes.
 */
export function verifyIntegrity(
  encryptedData: Buffer,
  ivBase64: string,
  authTagBase64: string,
  expectedHash: string
): { isValid: boolean; actualHash: string } {
  try {
    const { sha256Hash } = decryptFile(encryptedData, ivBase64, authTagBase64);
    return {
      isValid: sha256Hash === expectedHash,
      actualHash: sha256Hash,
    };
  } catch {
    return {
      isValid: false,
      actualHash: 'DECRYPTION_FAILED',
    };
  }
}
