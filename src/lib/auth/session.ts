// ============================================================
// Authentication Library - JWT + Password Hashing
// ============================================================
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { hashSync, compareSync } from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import type { UserRole } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
const COOKIE_NAME = 'session_token';
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  sessionId: string;
  mfaVerified: boolean;
}

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET environment variable is not set');
  return new TextEncoder().encode(secret);
}

/**
 * Hash a password using bcryptjs (Argon2id requires native bindings;
 * bcrypt with high rounds is the pragmatic serverless choice).
 */
export function hashPassword(password: string): string {
  return hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash.
 */
export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

/**
 * Validate password strength.
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 12) errors.push('Password must be at least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain a special character');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Create a JWT session token.
 */
export async function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION / 1000}s`)
    .sign(getAuthSecret());
}

/**
 * Verify and decode a JWT session token.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
}

/**
 * Get the current session from cookies.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Verify session exists in database
  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
  });
  
  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return payload;
}

/**
 * Clear the session cookie and delete from database.
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (token) {
    const payload = await verifySessionToken(token);
    if (payload?.sessionId) {
      await prisma.session.delete({
        where: { id: payload.sessionId },
      }).catch(() => {}); // Ignore if already deleted
    }
  }
  
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Check if an account should be locked.
 */
export function shouldLockAccount(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_LOGINS;
}

/**
 * Check if an account lockout has expired.
 */
export function isLockoutExpired(lockedAt: Date | null): boolean {
  if (!lockedAt) return true;
  return Date.now() - lockedAt.getTime() > LOCKOUT_DURATION;
}

export { COOKIE_NAME, MAX_FAILED_LOGINS, LOCKOUT_DURATION, SESSION_DURATION };
