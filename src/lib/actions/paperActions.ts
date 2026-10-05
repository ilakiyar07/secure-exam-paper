'use server';
// ============================================================
// Examination & Question Paper Server Actions
// ============================================================
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import { encryptFile, calculateSHA256 } from '@/lib/crypto/encryption';
import { signDocument } from '@/lib/crypto/signature';
import { createAuditLog } from '@/lib/services/auditService';
import { createSecurityEvent } from '@/lib/services/securityService';
import { getClientIP } from '@/lib/security/middleware';
import {
  createExaminationSchema,
  createPaperSchema,
  approvalSchema,
  releaseScheduleSchema,
  validatePDFSignature,
} from '@/lib/validation/schemas';
import { randomUUID } from 'crypto';

// ---------- Examinations ----------

export async function createExamination(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'examinations:create')) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = createExaminationSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code'),
    description: formData.get('description') || undefined,
    subject: formData.get('subject'),
    examDate: formData.get('examDate'),
    duration: Number(formData.get('duration')),
    totalMarks: Number(formData.get('totalMarks')),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  try {
    const exam = await prisma.examination.create({
      data: {
        ...parsed.data,
        examDate: new Date(parsed.data.examDate),
        createdById: session.userId,
      },
    });

    await createAuditLog({
      userId: session.userId, userRole: session.role,
      action: 'PAPER_CREATE', resource: 'examination', resourceId: exam.id,
      ipAddress: await getClientIP(), success: true,
      details: `Created examination: ${exam.name}`,
    });

    return { success: true, examId: exam.id };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('Unique constraint')) {
      return { success: false, error: 'Examination code already exists' };
    }
    return { success: false, error: 'Failed to create examination' };
  }
}

export async function getExaminations() {
  const session = await getSession();
  if (!session) return [];

  if (hasPermission(session.role, 'examinations:read')) {
    return prisma.examination.findMany({
      include: { _count: { select: { papers: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  return [];
}

// ---------- Question Papers ----------

export async function createQuestionPaper(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'papers:create')) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = createPaperSchema.safeParse({
    examinationId: formData.get('examinationId'),
    title: formData.get('title'),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const paper = await prisma.questionPaper.create({
    data: {
      examinationId: parsed.data.examinationId,
      title: parsed.data.title,
      createdById: session.userId,
      status: 'DRAFT',
    },
  });

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'PAPER_CREATE', resource: 'question_paper', resourceId: paper.id,
    ipAddress: await getClientIP(), success: true,
    details: `Created paper: ${paper.title}`,
  });

  return { success: true, paperId: paper.id };
}

export async function uploadQuestionPaper(formData: FormData): Promise<{ success: boolean; error?: string; version?: number; sha256?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'papers:upload')) {
    return { success: false, error: 'Unauthorized' };
  }
  const ip = await getClientIP();

  const paperId = formData.get('paperId') as string;
  const file = formData.get('file') as File;

  if (!paperId || !file) {
    return { success: false, error: 'Paper ID and file are required' };
  }

  // Verify the paper belongs to this user
  const paper = await prisma.questionPaper.findUnique({
    where: { id: paperId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });

  if (!paper) return { success: false, error: 'Paper not found' };

  if (paper.createdById !== session.userId) {
    await createSecurityEvent({
      userId: session.userId, severity: 'HIGH',
      eventType: 'UNAUTHORIZED_PAPER_ACCESS',
      description: `User ${session.userId} tried to upload to paper ${paperId} owned by ${paper.createdById}`,
      ipAddress: ip,
    });
    await createAuditLog({
      userId: session.userId, userRole: session.role,
      action: 'UNAUTHORIZED_ACCESS', resource: 'question_paper', resourceId: paperId,
      ipAddress: ip, success: false,
      details: 'Attempted to upload to another user\'s paper',
    });
    return { success: false, error: 'Unauthorized: this is not your paper' };
  }

  if (!['DRAFT', 'REJECTED'].includes(paper.status)) {
    return { success: false, error: 'Paper can only be uploaded in DRAFT or REJECTED status' };
  }

  // Validate file
  if (file.type !== 'application/pdf') {
    return { success: false, error: 'Only PDF files are allowed' };
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { success: false, error: 'File must have .pdf extension' };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { success: false, error: 'File size must not exceed 50 MB' };
  }
  if (file.size === 0) {
    return { success: false, error: 'File must not be empty' };
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const plaintext = Buffer.from(arrayBuffer);

  // Validate PDF magic bytes
  if (!validatePDFSignature(plaintext)) {
    return { success: false, error: 'File does not appear to be a valid PDF' };
  }

  // Encrypt the file
  const encrypted = encryptFile(plaintext);

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'PAPER_ENCRYPT', resource: 'question_paper', resourceId: paperId,
    ipAddress: ip, success: true,
    details: `Encrypted paper. SHA-256: ${encrypted.sha256Hash}`,
  });

  // Store encrypted version
  const newVersion = (paper.versions[0]?.version ?? 0) + 1;

  await prisma.questionPaperVersion.create({
    data: {
      paperId,
      version: newVersion,
      encryptedData: encrypted.encryptedData,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      sha256Hash: encrypted.sha256Hash,
      encryptionVersion: encrypted.encryptionVersion,
      originalFilename: `${randomUUID()}.pdf`, // Never store the original name
      mimeType: 'application/pdf',
      fileSize: file.size,
    },
  });

  await prisma.questionPaper.update({
    where: { id: paperId },
    data: { currentVersion: newVersion },
  });

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'PAPER_UPLOAD', resource: 'question_paper', resourceId: paperId,
    ipAddress: ip, success: true,
    details: `Uploaded version ${newVersion}. Size: ${file.size} bytes`,
  });

  return { success: true, version: newVersion, sha256: encrypted.sha256Hash };
}

export async function submitPaper(paperId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'papers:submit')) {
    return { success: false, error: 'Unauthorized' };
  }

  const paper = await prisma.questionPaper.findUnique({
    where: { id: paperId },
    include: { versions: true },
  });

  if (!paper) return { success: false, error: 'Paper not found' };
  if (paper.createdById !== session.userId) {
    return { success: false, error: 'You can only submit your own papers' };
  }
  if (paper.status !== 'DRAFT' && paper.status !== 'REJECTED') {
    return { success: false, error: 'Paper can only be submitted from DRAFT or REJECTED status' };
  }
  if (paper.versions.length === 0) {
    return { success: false, error: 'Upload a file before submitting' };
  }

  await prisma.questionPaper.update({
    where: { id: paperId },
    data: { status: 'SUBMITTED' },
  });

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'PAPER_SUBMIT', resource: 'question_paper', resourceId: paperId,
    ipAddress: await getClientIP(), success: true,
    details: 'Paper submitted for review',
  });

  return { success: true };
}

// ---------- Review & Approval ----------

export async function assignReviewer(paperId: string, reviewerId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'examinations:assign')) {
    return { success: false, error: 'Unauthorized' };
  }

  const paper = await prisma.questionPaper.findUnique({ where: { id: paperId } });
  if (!paper) return { success: false, error: 'Paper not found' };

  // Ensure reviewer exists and has REVIEWER role
  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
  if (!reviewer || reviewer.role !== 'REVIEWER') {
    return { success: false, error: 'Invalid reviewer' };
  }

  await prisma.reviewAssignment.upsert({
    where: { paperId_reviewerId: { paperId, reviewerId } },
    create: { paperId, reviewerId },
    update: {},
  });

  // Move paper to UNDER_REVIEW if it was SUBMITTED
  if (paper.status === 'SUBMITTED') {
    await prisma.questionPaper.update({
      where: { id: paperId },
      data: { status: 'UNDER_REVIEW' },
    });
  }

  return { success: true };
}

export async function reviewPaper(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'papers:approve') && !hasPermission(session.role, 'papers:reject')) {
    return { success: false, error: 'Unauthorized' };
  }
  const ip = await getClientIP();

  const parsed = approvalSchema.safeParse({
    paperId: formData.get('paperId'),
    action: formData.get('action'),
    comments: formData.get('comments') || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const { paperId, action, comments } = parsed.data;

  const paper = await prisma.questionPaper.findUnique({
    where: { id: paperId },
    include: { reviewAssignments: true },
  });

  if (!paper) return { success: false, error: 'Paper not found' };

  // CRITICAL: Prevent self-approval — the creator cannot approve their own paper
  if (paper.createdById === session.userId) {
    await createSecurityEvent({
      userId: session.userId, severity: 'HIGH',
      eventType: 'SELF_APPROVAL_ATTEMPT',
      description: `User ${session.userId} attempted to approve their own paper ${paperId}`,
      ipAddress: ip,
    });
    await createAuditLog({
      userId: session.userId, userRole: session.role,
      action: 'PERMISSION_DENIED', resource: 'question_paper', resourceId: paperId,
      ipAddress: ip, success: false,
      details: 'Attempted to approve own paper — BLOCKED',
    });
    return { success: false, error: 'You cannot approve your own paper' };
  }

  // Check reviewer is assigned
  const isAssigned = paper.reviewAssignments.some(a => a.reviewerId === session.userId);
  if (!isAssigned && session.role === 'REVIEWER') {
    return { success: false, error: 'You are not assigned to review this paper' };
  }

  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(paper.status)) {
    return { success: false, error: 'Paper is not in a reviewable status' };
  }

  await prisma.approval.create({
    data: {
      paperId,
      userId: session.userId,
      action: action as 'APPROVED' | 'REJECTED',
      comments,
    },
  });

  const newStatus = action === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  await prisma.questionPaper.update({
    where: { id: paperId },
    data: { status: newStatus },
  });

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: action === 'APPROVED' ? 'PAPER_APPROVE' : 'PAPER_REJECT',
    resource: 'question_paper', resourceId: paperId,
    ipAddress: ip, success: true,
    details: `Paper ${action.toLowerCase()}${comments ? ': ' + comments : ''}`,
  });

  return { success: true };
}

// ---------- Finalize & Schedule ----------

export async function finalizePaper(paperId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'papers:finalize')) {
    return { success: false, error: 'Unauthorized' };
  }
  const ip = await getClientIP();

  const paper = await prisma.questionPaper.findUnique({
    where: { id: paperId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });

  if (!paper) return { success: false, error: 'Paper not found' };

  // CRITICAL: The person who created the paper cannot finalize it
  if (paper.createdById === session.userId) {
    await createSecurityEvent({
      userId: session.userId, severity: 'HIGH',
      eventType: 'SEPARATION_OF_DUTIES_VIOLATION',
      description: `User ${session.userId} attempted to finalize their own paper ${paperId}`,
      ipAddress: ip,
    });
    return { success: false, error: 'You cannot finalize a paper you created' };
  }

  if (paper.status !== 'APPROVED') {
    return { success: false, error: 'Paper must be approved before finalization' };
  }

  const latestVersion = paper.versions[0];
  if (!latestVersion) {
    return { success: false, error: 'No paper version found' };
  }

  // Sign the encrypted content
  const signature = signDocument(Buffer.from(latestVersion.encryptedData));

  await prisma.questionPaperVersion.update({
    where: { id: latestVersion.id },
    data: {
      digitalSignature: signature,
      signedById: session.userId,
      signedAt: new Date(),
    },
  });

  await prisma.questionPaper.update({
    where: { id: paperId },
    data: {
      status: 'FINALIZED',
      finalizedById: session.userId,
      finalizedAt: new Date(),
    },
  });

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'PAPER_FINALIZE', resource: 'question_paper', resourceId: paperId,
    ipAddress: ip, success: true,
    details: 'Paper finalized and digitally signed',
  });

  return { success: true };
}

export async function scheduleRelease(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'papers:schedule')) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = releaseScheduleSchema.safeParse({
    paperId: formData.get('paperId'),
    scheduledDate: formData.get('scheduledDate'),
    releaseTime: formData.get('releaseTime'),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const paper = await prisma.questionPaper.findUnique({ where: { id: parsed.data.paperId } });
  if (!paper) return { success: false, error: 'Paper not found' };
  if (paper.status !== 'FINALIZED') {
    return { success: false, error: 'Paper must be finalized before scheduling' };
  }

  const releaseTime = new Date(parsed.data.releaseTime);
  if (releaseTime <= new Date()) {
    return { success: false, error: 'Release time must be in the future' };
  }

  await prisma.releaseSchedule.upsert({
    where: { paperId: parsed.data.paperId },
    create: {
      paperId: parsed.data.paperId,
      scheduledDate: new Date(parsed.data.scheduledDate),
      releaseTime,
    },
    update: {
      scheduledDate: new Date(parsed.data.scheduledDate),
      releaseTime,
    },
  });

  await prisma.questionPaper.update({
    where: { id: parsed.data.paperId },
    data: { status: 'SCHEDULED' },
  });

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'PAPER_SCHEDULE', resource: 'question_paper', resourceId: parsed.data.paperId,
    ipAddress: await getClientIP(), success: true,
    details: `Scheduled release for ${releaseTime.toISOString()}`,
  });

  return { success: true };
}

export async function releasePaper(paperId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!hasPermission(session.role, 'papers:release')) {
    return { success: false, error: 'Unauthorized' };
  }

  const paper = await prisma.questionPaper.findUnique({
    where: { id: paperId },
    include: { releaseSchedule: true },
  });

  if (!paper) return { success: false, error: 'Paper not found' };
  if (paper.status !== 'SCHEDULED') {
    return { success: false, error: 'Paper must be scheduled before release' };
  }
  if (!paper.releaseSchedule) {
    return { success: false, error: 'No release schedule found' };
  }

  // Server-side time check
  if (new Date() < paper.releaseSchedule.releaseTime) {
    await createSecurityEvent({
      userId: session.userId, severity: 'HIGH',
      eventType: 'EARLY_RELEASE_ATTEMPT',
      description: `User ${session.userId} attempted early release of paper ${paperId}`,
      ipAddress: await getClientIP(),
    });
    return { success: false, error: 'Cannot release before scheduled time' };
  }

  // CRITICAL: The creator cannot release their own paper
  if (paper.createdById === session.userId) {
    return { success: false, error: 'You cannot release a paper you created' };
  }

  await prisma.$transaction([
    prisma.questionPaper.update({
      where: { id: paperId },
      data: { status: 'RELEASED' },
    }),
    prisma.releaseSchedule.update({
      where: { paperId },
      data: { isReleased: true, releasedAt: new Date(), releasedById: session.userId },
    }),
  ]);

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'PAPER_RELEASE', resource: 'question_paper', resourceId: paperId,
    ipAddress: await getClientIP(), success: true,
    details: 'Paper released',
  });

  return { success: true };
}

// ---------- Get Paper Details ----------

export async function getMyPapers() {
  const session = await getSession();
  if (!session) return [];

  if (session.role === 'QUESTION_SETTER') {
    return prisma.questionPaper.findMany({
      where: { createdById: session.userId },
      include: {
        examination: { select: { name: true, code: true } },
        versions: { select: { version: true, sha256Hash: true, fileSize: true, createdAt: true }, orderBy: { version: 'desc' } },
        _count: { select: { approvals: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (session.role === 'REVIEWER') {
    return prisma.questionPaper.findMany({
      where: {
        reviewAssignments: { some: { reviewerId: session.userId } },
      },
      include: {
        examination: { select: { name: true, code: true } },
        createdBy: { select: { name: true } },
        _count: { select: { approvals: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Exam Controller, Admin, Auditor
  if (hasPermission(session.role, 'papers:read_all')) {
    return prisma.questionPaper.findMany({
      include: {
        examination: { select: { name: true, code: true } },
        createdBy: { select: { name: true } },
        versions: { select: { version: true, sha256Hash: true, fileSize: true, createdAt: true }, orderBy: { version: 'desc' } },
        releaseSchedule: true,
        _count: { select: { approvals: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return [];
}

export async function getPaperById(id: string) {
  const session = await getSession();
  if (!session) return null;
  const ip = await getClientIP();

  const paper = await prisma.questionPaper.findUnique({
    where: { id },
    include: {
      examination: true,
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      versions: {
        select: {
          id: true, version: true, sha256Hash: true, fileSize: true, mimeType: true,
          encryptionVersion: true, digitalSignature: true, signedAt: true, createdAt: true,
        },
        orderBy: { version: 'desc' },
      },
      approvals: {
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      },
      releaseSchedule: true,
      reviewAssignments: {
        include: { reviewer: { select: { name: true, email: true } } },
      },
    },
  });

  if (!paper) return null;

  // Authorization check
  if (session.role === 'QUESTION_SETTER' && paper.createdById !== session.userId) {
    await createSecurityEvent({
      userId: session.userId, severity: 'MEDIUM',
      eventType: 'UNAUTHORIZED_PAPER_ACCESS',
      description: `Setter ${session.userId} tried to view paper ${id} belonging to ${paper.createdById}`,
      ipAddress: ip,
    });
    await createAuditLog({
      userId: session.userId, userRole: session.role,
      action: 'UNAUTHORIZED_ACCESS', resource: 'question_paper', resourceId: id,
      ipAddress: ip, success: false, details: 'Attempted to access another setter\'s paper',
    });
    return null;
  }

  if (session.role === 'REVIEWER') {
    const isAssigned = paper.reviewAssignments.some(a => a.reviewer.email === session.email);
    if (!isAssigned) return null;
  }

  await createAuditLog({
    userId: session.userId, userRole: session.role,
    action: 'PAPER_VIEW', resource: 'question_paper', resourceId: id,
    ipAddress: ip, success: true, details: 'Viewed paper details',
  });

  return paper;
}
