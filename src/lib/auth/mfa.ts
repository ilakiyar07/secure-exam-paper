// ============================================================
// MFA Service — TOTP Configuration and Verification
// ============================================================
import { createHmac, randomBytes } from 'crypto';
import { prisma } from '@/lib/db/prisma';

const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'sha1';
const APP_NAME = 'SecureExamPaper';

/**
 * Generate a random base32-encoded secret for TOTP.
 */
export function generateTOTPSecret(): string {
  const buffer = randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Base32 encode a buffer.
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Base32 decode a string to a buffer.
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = encoded.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const idx = alphabet.indexOf(cleanInput[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Generate a TOTP code for a given secret and time.
 */
export function generateTOTP(secret: string, time?: number): string {
  const counter = Math.floor((time ?? Date.now() / 1000) / TOTP_PERIOD);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(0, 0);
  counterBuffer.writeUInt32BE(counter, 4);

  const key = base32Decode(secret);
  const hmac = createHmac(TOTP_ALGORITHM, key).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % Math.pow(10, TOTP_DIGITS)).toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a TOTP code (with ±1 window tolerance).
 */
export function verifyTOTP(secret: string, code: string): boolean {
  const now = Date.now() / 1000;
  for (let i = -1; i <= 1; i++) {
    const expected = generateTOTP(secret, now + i * TOTP_PERIOD);
    if (expected === code) return true;
  }
  return false;
}

/**
 * Generate a TOTP URI for QR code generation.
 */
export function generateTOTPUri(secret: string, email: string): string {
  return `otpauth://totp/${encodeURIComponent(APP_NAME)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(APP_NAME)}&algorithm=${TOTP_ALGORITHM.toUpperCase()}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * Setup MFA for a user.
 */
export async function setupMFA(userId: string): Promise<{ secret: string; uri: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const secret = generateTOTPSecret();
  const uri = generateTOTPUri(secret, user.email);

  await prisma.mFAConfiguration.upsert({
    where: { userId },
    create: {
      userId,
      secret, // In production, encrypt this with MFA_ENCRYPTION_KEY
      isEnabled: false,
      backupCodes: [],
    },
    update: {
      secret,
      isEnabled: false,
    },
  });

  return { secret, uri };
}

/**
 * Enable MFA after successful verification.
 */
export async function enableMFA(userId: string, code: string): Promise<boolean> {
  const config = await prisma.mFAConfiguration.findUnique({ where: { userId } });
  if (!config) return false;

  if (!verifyTOTP(config.secret, code)) return false;

  await prisma.mFAConfiguration.update({
    where: { userId },
    data: { isEnabled: true },
  });

  return true;
}

/**
 * Verify MFA code for login.
 */
export async function verifyMFACode(userId: string, code: string): Promise<boolean> {
  const config = await prisma.mFAConfiguration.findUnique({ where: { userId } });
  if (!config || !config.isEnabled) return false;
  return verifyTOTP(config.secret, code);
}

/**
 * Check if user has MFA enabled.
 */
export async function hasMFAEnabled(userId: string): Promise<boolean> {
  const config = await prisma.mFAConfiguration.findUnique({
    where: { userId },
    select: { isEnabled: true },
  });
  return config?.isEnabled ?? false;
}
