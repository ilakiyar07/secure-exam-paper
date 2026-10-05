// ============================================================
// Digital Signature Module (ECDSA with P-256)
// ============================================================
import { createSign, createVerify, generateKeyPairSync } from 'crypto';

const ALGORITHM = 'SHA256';
const CURVE = 'prime256v1'; // P-256

/**
 * Generate a new ECDSA key pair for signing.
 * Returns PEM-encoded private and public keys.
 */
export function generateSigningKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: CURVE,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
}

/**
 * Get the signing private key from environment variables.
 */
function getSigningPrivateKey(): string {
  const key = process.env.SIGNING_PRIVATE_KEY;
  if (!key) {
    throw new Error('SIGNING_PRIVATE_KEY environment variable is not set');
  }
  // Handle escaped newlines in env vars
  return key.replace(/\\n/g, '\n');
}

/**
 * Get the signing public key from environment variables.
 */
function getSigningPublicKey(): string {
  const key = process.env.SIGNING_PUBLIC_KEY;
  if (!key) {
    throw new Error('SIGNING_PUBLIC_KEY environment variable is not set');
  }
  return key.replace(/\\n/g, '\n');
}

/**
 * Sign document data using ECDSA.
 * Returns a base64-encoded signature.
 */
export function signDocument(data: Buffer): string {
  const privateKey = getSigningPrivateKey();
  const signer = createSign(ALGORITHM);
  signer.update(data);
  signer.end();
  return signer.sign(privateKey, 'base64');
}

/**
 * Verify a document signature using ECDSA.
 */
export function verifySignature(data: Buffer, signatureBase64: string): boolean {
  try {
    const publicKey = getSigningPublicKey();
    const verifier = createVerify(ALGORITHM);
    verifier.update(data);
    verifier.end();
    return verifier.verify(publicKey, signatureBase64, 'base64');
  } catch {
    return false;
  }
}

/**
 * Sign with additional metadata (user ID, timestamp, hash).
 * Creates a canonical signing payload.
 */
export function signWithMetadata(
  documentHash: string,
  userId: string,
  action: string
): string {
  const payload = JSON.stringify({
    hash: documentHash,
    userId,
    action,
    timestamp: new Date().toISOString(),
  });
  const data = Buffer.from(payload, 'utf-8');
  return signDocument(data);
}
