// ============================================================
// Security Middleware & Helpers
// ============================================================
import { headers } from 'next/headers';

/**
 * Extract client IP address from request headers.
 */
export async function getClientIP(): Promise<string | null> {
  const hdrs = await headers();
  return (
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip') ??
    null
  );
}

/**
 * Extract user agent from request headers.
 */
export async function getUserAgent(): Promise<string | null> {
  const hdrs = await headers();
  return hdrs.get('user-agent') ?? null;
}

/**
 * Simple in-memory rate limiter for serverless.
 * Uses a sliding window approach.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
}

/**
 * Login-specific rate limiter (stricter).
 */
export function checkLoginRateLimit(identifier: string): { allowed: boolean; retryAfterMs: number } {
  const result = checkRateLimit(`login:${identifier}`, 5, 5 * 60 * 1000);
  return { allowed: result.allowed, retryAfterMs: result.retryAfterMs };
}

/**
 * Sanitize user input to prevent XSS.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Security headers for API responses.
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}
