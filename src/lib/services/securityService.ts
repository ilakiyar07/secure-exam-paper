// ============================================================
// Security Event Service
// ============================================================
import { prisma } from '@/lib/db/prisma';
import type { SecuritySeverity } from '@prisma/client';

interface SecurityEventInput {
  userId?: string | null;
  severity: SecuritySeverity;
  eventType: string;
  description: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Create a security event.
 */
export async function createSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        userId: input.userId ?? null,
        severity: input.severity,
        eventType: input.eventType,
        description: input.description,
        ipAddress: input.ipAddress ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    console.error('Failed to create security event:', error);
  }
}

/**
 * Detect and create events for multiple failed logins.
 */
export async function detectBruteForce(
  email: string,
  ipAddress: string | null,
  failedCount: number
): Promise<void> {
  if (failedCount >= 3 && failedCount < 5) {
    await createSecurityEvent({
      severity: 'MEDIUM',
      eventType: 'MULTIPLE_FAILED_LOGINS',
      description: `Multiple failed login attempts (${failedCount}) for ${email}`,
      ipAddress,
      metadata: { email, failedCount },
    });
  } else if (failedCount >= 5) {
    await createSecurityEvent({
      severity: 'HIGH',
      eventType: 'ACCOUNT_LOCKOUT',
      description: `Account locked after ${failedCount} failed login attempts for ${email}`,
      ipAddress,
      metadata: { email, failedCount },
    });
  }
}

/**
 * Query security events with filters.
 */
export async function querySecurityEvents(filters: {
  severity?: SecuritySeverity;
  eventType?: string;
  isResolved?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 50, 100);
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters.severity) where.severity = filters.severity;
  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.isResolved !== undefined) where.isResolved = filters.isResolved;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }

  const [events, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.securityEvent.count({ where }),
  ]);

  return { events, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Get security dashboard stats.
 */
export async function getSecurityStats() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalEvents,
    criticalEvents,
    highEvents,
    unresolvedEvents,
    last24hEvents,
    last7dEvents,
    failedLogins24h,
    integrityFailures,
  ] = await Promise.all([
    prisma.securityEvent.count(),
    prisma.securityEvent.count({ where: { severity: 'CRITICAL' } }),
    prisma.securityEvent.count({ where: { severity: 'HIGH' } }),
    prisma.securityEvent.count({ where: { isResolved: false } }),
    prisma.securityEvent.count({ where: { createdAt: { gte: last24h } } }),
    prisma.securityEvent.count({ where: { createdAt: { gte: last7d } } }),
    prisma.securityEvent.count({
      where: { eventType: 'MULTIPLE_FAILED_LOGINS', createdAt: { gte: last24h } },
    }),
    prisma.securityEvent.count({ where: { eventType: 'INTEGRITY_FAILURE' } }),
  ]);

  return {
    totalEvents,
    criticalEvents,
    highEvents,
    unresolvedEvents,
    last24hEvents,
    last7dEvents,
    failedLogins24h,
    integrityFailures,
  };
}
