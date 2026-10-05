import { describe, it, expect } from 'vitest';
import { encryptFile, decryptFile, calculateSHA256 } from '@/lib/crypto/encryption';
import { generateSigningKeyPair, signDocument, verifySignature } from '@/lib/crypto/signature';

describe('Cryptography & Integrity', () => {
  it('should securely encrypt and decrypt data with AES-256-GCM', () => {
    // Generate a secure random key to use for encryption during test
    process.env.ENCRYPTION_KEY = Buffer.from(Array(32).fill(0).map(() => Math.floor(Math.random() * 256))).toString('hex');
    
    const plaintext = Buffer.from('Secret Exam Paper Content');
    const encrypted = encryptFile(plaintext);
    
    expect(encrypted.encryptedData).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.sha256Hash).toBeDefined();
    
    const decrypted = decryptFile(encrypted.encryptedData, encrypted.iv, encrypted.authTag);
    expect(decrypted.decryptedData.toString()).toBe('Secret Exam Paper Content');
  });

  it('should detect tampering (Integrity Failure) and throw an error', () => {
    process.env.ENCRYPTION_KEY = Buffer.from(Array(32).fill(0).map(() => Math.floor(Math.random() * 256))).toString('hex');
    const plaintext = Buffer.from('Secret Content');
    const encrypted = encryptFile(plaintext);
    
    // Tamper with the encrypted data
    const tamperedData = Buffer.from(encrypted.encryptedData);
    tamperedData[0] ^= 1; // Flip a bit
    
    expect(() => {
      decryptFile(tamperedData, encrypted.iv, encrypted.authTag);
    }).toThrow();
  });

  it('should correctly calculate SHA-256 hashes', () => {
    const data = Buffer.from('Test Data');
    const hash = calculateSHA256(data);
    expect(hash.length).toBe(64); // Hex length of SHA-256
  });

  it('should sign and verify documents (Digital Signature)', () => {
    const { publicKey, privateKey } = generateSigningKeyPair();
    process.env.SIGNING_PRIVATE_KEY = privateKey;
    process.env.SIGNING_PUBLIC_KEY = publicKey;

    const data = Buffer.from('Finalized Exam Data');
    const signature = signDocument(data);
    
    expect(signature).toBeDefined();
    const isValid = verifySignature(data, signature);
    expect(isValid).toBe(true);
  });

  it('should reject invalid digital signatures', () => {
    const { publicKey, privateKey } = generateSigningKeyPair();
    process.env.SIGNING_PRIVATE_KEY = privateKey;
    process.env.SIGNING_PUBLIC_KEY = publicKey;

    const data = Buffer.from('Finalized Exam Data');
    const signature = signDocument(data);
    
    // Tamper with data before verification
    const tamperedData = Buffer.from('Tampered Exam Data');
    const isValid = verifySignature(tamperedData, signature);
    expect(isValid).toBe(false);
  });
});

