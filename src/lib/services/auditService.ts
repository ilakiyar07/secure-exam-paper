// ============================================================
// Audit Logging Service
// ============================================================
import { prisma } from '@/lib/db/prisma';
import type { AuditAction, UserRole } from '@prisma/client';

interface AuditLogInput {
  userId?: string | null;
  userRole?: UserRole | null;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  details?: string;
}

/**
 * Create an audit log entry. This is append-only from the application perspective.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        userRole: input.userRole ?? null,
        action: input.action,
        resource: input.resource ?? null,
        resourceId: input.resourceId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        success: input.success,
        details: input.details ?? null,
      },
    });
  } catch (error) {
    // Audit logging should never crash the main request
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Query audit logs with filters.
 */
export async function queryAuditLogs(filters: {
  userId?: string;
  action?: AuditAction;
  resource?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 50, 100);
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.resource) where.resource = filters.resource;
  if (filters.success !== undefined) where.success = filters.success;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
