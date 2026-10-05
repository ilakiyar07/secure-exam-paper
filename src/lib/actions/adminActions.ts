'use server';
// ============================================================
// Admin Server Actions
// ============================================================
import { prisma } from '@/lib/db/prisma';
import { getSession, hashPassword } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import { createAuditLog } from '@/lib/services/auditService';
import { getClientIP } from '@/lib/security/middleware';
import { createUserSchema } from '@/lib/validation/schemas';
import type { UserRole } from '@prisma/client';

export async function createUser(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'users:create')) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    password: formData.get('password'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { success: false, error: 'Email already in use' };
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: hashPassword(parsed.data.password),
      role: parsed.data.role as UserRole,
    },
  });

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'USER_CREATE', resource: 'user', resourceId: user.id,
    ipAddress: await getClientIP(), success: true,
    details: `Created user ${user.email} with role ${user.role}`,
  });

  return { success: true, userId: user.id };
}

export async function getUsers() {
  const session = await getSession();
  if (!session) return [];
  if (!hasPermission(session.role, 'users:read')) return [];

  return prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true,
      isActive: true, isLocked: true, lastLoginAt: true, createdAt: true,
      _count: { select: { createdPapers: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function toggleUserActive(userId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'users:update')) {
    return { success: false, error: 'Unauthorized' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'User not found' };

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'USER_UPDATE', resource: 'user', resourceId: userId,
    ipAddress: await getClientIP(), success: true,
    details: `${user.isActive ? 'Deactivated' : 'Activated'} user ${user.email}`,
  });

  return { success: true };
}

export async function unlockUser(userId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'users:update')) {
    return { success: false, error: 'Unauthorized' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isLocked: false, failedLogins: 0, lockedAt: null },
  });

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'ACCOUNT_UNLOCK', resource: 'user', resourceId: userId,
    ipAddress: await getClientIP(), success: true,
    details: 'Account unlocked by admin',
  });

  return { success: true };
}

// ---------- Dashboard Stats ----------

export async function getDashboardStats() {
  const session = await getSession();
  if (!session) return null;

  const [
    totalUsers, activeUsers, totalExams, totalPapers,
    pendingApprovals, draftPapers, submittedPapers,
    approvedPapers, finalizedPapers, scheduledPapers, releasedPapers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.examination.count(),
    prisma.questionPaper.count(),
    prisma.questionPaper.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.questionPaper.count({ where: { status: 'DRAFT' } }),
    prisma.questionPaper.count({ where: { status: 'SUBMITTED' } }),
    prisma.questionPaper.count({ where: { status: 'APPROVED' } }),
    prisma.questionPaper.count({ where: { status: 'FINALIZED' } }),
    prisma.questionPaper.count({ where: { status: 'SCHEDULED' } }),
    prisma.questionPaper.count({ where: { status: 'RELEASED' } }),
  ]);

  const recentAuditLogs = await prisma.auditLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  });

  const recentSecurityEvents = await prisma.securityEvent.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  });

  return {
    totalUsers, activeUsers, totalExams, totalPapers,
    pendingApprovals, draftPapers, submittedPapers,
    approvedPapers, finalizedPapers, scheduledPapers, releasedPapers,
    recentAuditLogs, recentSecurityEvents,
  };
}

export async function getAuditLogs(page: number = 1) {
  const session = await getSession();
  if (!session) return null;
  if (!hasPermission(session.role, 'audit:read')) return null;

  const pageSize = 25;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true, role: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  return { logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getSecurityEvents(page: number = 1) {
  const session = await getSession();
  if (!session) return null;
  if (!hasPermission(session.role, 'security:read')) return null;

  const pageSize = 25;
  const [events, total] = await Promise.all([
    prisma.securityEvent.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true, role: true } } },
    }),
    prisma.securityEvent.count(),
  ]);

  return { events, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getReviewers() {
  return prisma.user.findMany({
    where: { role: 'REVIEWER', isActive: true },
    select: { id: true, name: true, email: true },
  });
}

export async function getSetters() {
  return prisma.user.findMany({
    where: { role: 'QUESTION_SETTER', isActive: true },
    select: { id: true, name: true, email: true },
  });
}
