'use server';
// ============================================================
// Authentication Server Actions
// ============================================================
import { prisma } from '@/lib/db/prisma';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  clearSession,
  getSession,
  shouldLockAccount,
  isLockoutExpired,
} from '@/lib/auth/session';
import { hasMFAEnabled, verifyMFACode } from '@/lib/auth/mfa';
import { loginSchema, mfaVerifySchema } from '@/lib/validation/schemas';
import { createAuditLog } from '@/lib/services/auditService';
import { createSecurityEvent, detectBruteForce } from '@/lib/services/securityService';
import { getClientIP, getUserAgent, checkLoginRateLimit } from '@/lib/security/middleware';
import { redirect } from 'next/navigation';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';

const MFA_PENDING_COOKIE = 'mfa_pending';

export interface ActionResult {
  success: boolean;
  error?: string;
  requiresMFA?: boolean;
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const ip = await getClientIP();
  const ua = await getUserAgent();

  // Rate limiting
  const rateKey = ip ?? 'unknown';
  const rateCheck = checkLoginRateLimit(rateKey);
  if (!rateCheck.allowed) {
    return { success: false, error: `Too many login attempts. Try again in ${Math.ceil(rateCheck.retryAfterMs / 1000)} seconds.` };
  }

  // Validate input
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { success: false, error: 'Invalid email or password format' };
  }

  const { email, password } = parsed.data;

  // Find user
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await prisma.loginAttempt.create({
      data: { email, ipAddress: ip, userAgent: ua, success: false, reason: 'User not found' },
    });
    await createAuditLog({
      action: 'FAILED_LOGIN', resource: 'auth', ipAddress: ip, userAgent: ua,
      success: false, details: `Failed login for ${email}: user not found`,
    });
    return { success: false, error: 'Invalid email or password' };
  }

  // Check if account is active
  if (!user.isActive) {
    return { success: false, error: 'Account has been deactivated' };
  }

  // Check lockout
  if (user.isLocked) {
    if (!isLockoutExpired(user.lockedAt)) {
      return { success: false, error: 'Account is locked due to multiple failed login attempts. Try again later.' };
    }
    // Unlock if lockout expired
    await prisma.user.update({
      where: { id: user.id },
      data: { isLocked: false, failedLogins: 0, lockedAt: null },
    });
  }

  // Verify password
  if (!verifyPassword(password, user.passwordHash)) {
    const failedLogins = user.failedLogins + 1;
    const shouldLock = shouldLockAccount(failedLogins);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins,
        isLocked: shouldLock,
        lockedAt: shouldLock ? new Date() : null,
      },
    });

    await prisma.loginAttempt.create({
      data: { userId: user.id, email, ipAddress: ip, userAgent: ua, success: false, reason: 'Invalid password' },
    });

    await createAuditLog({
      userId: user.id, userRole: user.role, action: 'FAILED_LOGIN',
      resource: 'auth', ipAddress: ip, userAgent: ua, success: false,
      details: `Failed login attempt ${failedLogins}`,
    });

    await detectBruteForce(email, ip, failedLogins);

    if (shouldLock) {
      await createAuditLog({
        userId: user.id, userRole: user.role, action: 'ACCOUNT_LOCKOUT',
        resource: 'auth', ipAddress: ip, success: false,
        details: `Account locked after ${failedLogins} failed attempts`,
      });
    }

    return { success: false, error: 'Invalid email or password' };
  }

  // Check MFA
  const mfaEnabled = await hasMFAEnabled(user.id);
  if (mfaEnabled) {
    // Store temporary MFA pending state
    const cookieStore = await cookies();
    const mfaPendingToken = randomUUID();
    cookieStore.set(MFA_PENDING_COOKIE, JSON.stringify({
      userId: user.id,
      token: mfaPendingToken,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    });

    return { success: true, requiresMFA: true };
  }

  // No MFA — create session directly
  await completeLogin(user.id, user.email, user.role, user.name, ip, ua);
  return { success: true };
}

export async function verifyMFAAction(formData: FormData): Promise<ActionResult> {
  const ip = await getClientIP();
  const ua = await getUserAgent();

  const parsed = mfaVerifySchema.safeParse({
    code: formData.get('code'),
  });

  if (!parsed.success) {
    return { success: false, error: 'Invalid MFA code format' };
  }

  // Get MFA pending cookie
  const cookieStore = await cookies();
  const pendingRaw = cookieStore.get(MFA_PENDING_COOKIE)?.value;
  if (!pendingRaw) {
    return { success: false, error: 'MFA session expired. Please login again.' };
  }

  let pending: { userId: string; token: string; expiresAt: number };
  try {
    pending = JSON.parse(pendingRaw);
  } catch {
    return { success: false, error: 'Invalid MFA session' };
  }

  if (Date.now() > pending.expiresAt) {
    cookieStore.delete(MFA_PENDING_COOKIE);
    return { success: false, error: 'MFA session expired. Please login again.' };
  }

  const user = await prisma.user.findUnique({ where: { id: pending.userId } });
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const verified = await verifyMFACode(user.id, parsed.data.code);
  if (!verified) {
    await createAuditLog({
      userId: user.id, userRole: user.role, action: 'MFA_FAILURE',
      resource: 'auth', ipAddress: ip, userAgent: ua, success: false,
      details: 'Invalid MFA code',
    });

    await createSecurityEvent({
      userId: user.id, severity: 'MEDIUM', eventType: 'MFA_FAILURE',
      description: `MFA verification failed for ${user.email}`,
      ipAddress: ip,
    });

    return { success: false, error: 'Invalid MFA code' };
  }

  // Clear MFA pending cookie
  cookieStore.delete(MFA_PENDING_COOKIE);

  // Complete login
  await completeLogin(user.id, user.email, user.role, user.name, ip, ua, true);
  return { success: true };
}

async function completeLogin(
  userId: string, email: string, role: string, name: string,
  ip: string | null, ua: string | null, mfaVerified: boolean = false
) {
  // Reset failed logins
  await prisma.user.update({
    where: { id: userId },
    data: { failedLogins: 0, isLocked: false, lockedAt: null, lastLoginAt: new Date(), lastLoginIp: ip },
  });

  // Create session in DB
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

  const token = await createSessionToken({
    userId, email, role: role as import('@prisma/client').UserRole,
    name, sessionId, mfaVerified,
  });

  await prisma.session.create({
    data: { id: sessionId, userId, token, expiresAt, ipAddress: ip, userAgent: ua },
  });

  await setSessionCookie(token);

  await prisma.loginAttempt.create({
    data: { userId, email, ipAddress: ip, userAgent: ua, success: true },
  });

  await createAuditLog({
    userId, userRole: role as import('@prisma/client').UserRole,
    action: 'LOGIN', resource: 'auth', ipAddress: ip, userAgent: ua,
    success: true, details: `Login successful${mfaVerified ? ' with MFA' : ''}`,
  });
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    const ip = await getClientIP();
    await createAuditLog({
      userId: session.userId, userRole: session.role,
      action: 'LOGOUT', resource: 'auth', ipAddress: ip,
      success: true, details: 'User logged out',
    });
  }
  await clearSession();
  redirect('/login');
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, email: true, name: true, role: true,
      isActive: true, lastLoginAt: true, createdAt: true,
    },
  });

  return user;
}
