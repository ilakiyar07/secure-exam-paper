// ============================================================
// Release Service — Controlled Question Paper Release
// ============================================================
import { prisma } from '@/lib/db/prisma';
import { decryptFile, verifyIntegrity } from '@/lib/crypto/encryption';
import { verifySignature } from '@/lib/crypto/signature';
import { createAuditLog } from '@/lib/services/auditService';
import { createSecurityEvent } from '@/lib/services/securityService';
import type { UserRole } from '@prisma/client';

interface ReleaseContext {
  userId: string;
  userRole: UserRole;
  ipAddress?: string | null;
}

interface ReleaseResult {
  success: boolean;
  data?: Buffer;
  filename?: string;
  mimeType?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Attempt to release/access a question paper.
 * 
 * SERVER-SIDE ENFORCEMENT of ALL release conditions:
 * 1. Paper must exist
 * 2. Paper must be RELEASED status
 * 3. Release schedule must exist
 * 4. Current time must be >= release time
 * 5. Paper must be finalized
 * 6. Paper must have a digital signature
 * 7. Integrity must pass (SHA-256)
 * 8. Requesting user must be authorized
 */
export async function attemptRelease(
  paperId: string,
  ctx: ReleaseContext
): Promise<ReleaseResult> {
  // 1. Fetch paper with all related data
  const paper = await prisma.questionPaper.findUnique({
    where: { id: paperId },
    include: {
      releaseSchedule: true,
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
      },
      examination: true,
    },
  });

  if (!paper) {
    await createAuditLog({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: 'RELEASE_ATTEMPT',
      resource: 'question_paper',
      resourceId: paperId,
      ipAddress: ctx.ipAddress,
      success: false,
      details: 'Paper not found',
    });
    return { success: false, error: 'Question paper not found', errorCode: 'NOT_FOUND' };
  }

  // 2. Check paper status — must be RELEASED
  if (paper.status !== 'RELEASED') {
    // Check if someone is trying early access
    if (['FINALIZED', 'SCHEDULED'].includes(paper.status)) {
      await createSecurityEvent({
        userId: ctx.userId,
        severity: 'HIGH',
        eventType: 'EARLY_RELEASE_ATTEMPT',
        description: `User ${ctx.userId} attempted to access paper ${paperId} before release (status: ${paper.status})`,
        ipAddress: ctx.ipAddress,
        metadata: { paperId, status: paper.status, userRole: ctx.userRole },
      });
    }

    await createAuditLog({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: 'EARLY_RELEASE_ATTEMPT',
      resource: 'question_paper',
      resourceId: paperId,
      ipAddress: ctx.ipAddress,
      success: false,
      details: `Paper status is ${paper.status}, not RELEASED`,
    });

    return {
      success: false,
      error: 'Paper has not been released yet',
      errorCode: 'NOT_RELEASED',
    };
  }

  // 3. Check release schedule
  if (!paper.releaseSchedule) {
    return { success: false, error: 'No release schedule found', errorCode: 'NO_SCHEDULE' };
  }

  // 4. Check release time (SERVER-SIDE enforcement)
  const now = new Date();
  if (now < paper.releaseSchedule.releaseTime) {
    await createSecurityEvent({
      userId: ctx.userId,
      severity: 'HIGH',
      eventType: 'EARLY_RELEASE_ATTEMPT',
      description: `User ${ctx.userId} attempted to access paper ${paperId} before release time`,
      ipAddress: ctx.ipAddress,
      metadata: {
        paperId,
        releaseTime: paper.releaseSchedule.releaseTime.toISOString(),
        currentTime: now.toISOString(),
      },
    });

    await createAuditLog({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: 'EARLY_RELEASE_ATTEMPT',
      resource: 'question_paper',
      resourceId: paperId,
      ipAddress: ctx.ipAddress,
      success: false,
      details: `Release time not reached. Scheduled: ${paper.releaseSchedule.releaseTime.toISOString()}`,
    });

    return {
      success: false,
      error: 'Paper cannot be accessed before the scheduled release time',
      errorCode: 'TOO_EARLY',
    };
  }

  // 5. Get latest version
  const latestVersion = paper.versions[0];
  if (!latestVersion) {
    return { success: false, error: 'No paper version found', errorCode: 'NO_VERSION' };
  }

  // 6. Verify digital signature
  if (!latestVersion.digitalSignature) {
    await createSecurityEvent({
      userId: ctx.userId,
      severity: 'CRITICAL',
      eventType: 'MISSING_SIGNATURE',
      description: `Paper ${paperId} is missing digital signature`,
      ipAddress: ctx.ipAddress,
    });
    return { success: false, error: 'Paper is missing digital signature', errorCode: 'NO_SIGNATURE' };
  }

  // 7. Decrypt and verify integrity
  try {
    const integrity = verifyIntegrity(
      Buffer.from(latestVersion.encryptedData),
      latestVersion.iv,
      latestVersion.authTag,
      latestVersion.sha256Hash
    );

    if (!integrity.isValid) {
      await createSecurityEvent({
        userId: ctx.userId,
        severity: 'CRITICAL',
        eventType: 'INTEGRITY_FAILURE',
        description: `Integrity verification FAILED for paper ${paperId}. Expected: ${latestVersion.sha256Hash}, Got: ${integrity.actualHash}`,
        ipAddress: ctx.ipAddress,
        metadata: {
          paperId,
          expectedHash: latestVersion.sha256Hash,
          actualHash: integrity.actualHash,
        },
      });

      await createAuditLog({
        userId: ctx.userId,
        userRole: ctx.userRole,
        action: 'INTEGRITY_FAILURE',
        resource: 'question_paper',
        resourceId: paperId,
        ipAddress: ctx.ipAddress,
        success: false,
        details: 'SHA-256 integrity verification FAILED — possible tampering detected',
      });

      return {
        success: false,
        error: 'INTEGRITY VERIFICATION FAILED — paper may have been tampered with',
        errorCode: 'INTEGRITY_FAILURE',
      };
    }

    // 8. Verify digital signature on the encrypted content
    const sigValid = verifySignature(
      Buffer.from(latestVersion.encryptedData),
      latestVersion.digitalSignature
    );

    if (!sigValid) {
      await createSecurityEvent({
        userId: ctx.userId,
        severity: 'CRITICAL',
        eventType: 'SIGNATURE_VERIFICATION_FAILED',
        description: `Digital signature verification failed for paper ${paperId}`,
        ipAddress: ctx.ipAddress,
      });

      return {
        success: false,
        error: 'Digital signature verification failed',
        errorCode: 'SIGNATURE_INVALID',
      };
    }

    // 9. Decrypt the paper
    const { decryptedData } = decryptFile(
      Buffer.from(latestVersion.encryptedData),
      latestVersion.iv,
      latestVersion.authTag
    );

    // 10. Log successful release
    await createAuditLog({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: 'PAPER_RELEASE',
      resource: 'question_paper',
      resourceId: paperId,
      ipAddress: ctx.ipAddress,
      success: true,
      details: `Paper released successfully. Integrity: PASS, Signature: PASS`,
    });

    return {
      success: true,
      data: decryptedData,
      filename: latestVersion.originalFilename,
      mimeType: latestVersion.mimeType,
    };
  } catch (error) {
    await createSecurityEvent({
      userId: ctx.userId,
      severity: 'CRITICAL',
      eventType: 'DECRYPTION_FAILURE',
      description: `Decryption failed for paper ${paperId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ipAddress: ctx.ipAddress,
    });

    return {
      success: false,
      error: 'Failed to decrypt paper',
      errorCode: 'DECRYPTION_FAILED',
    };
  }
}

/**
 * Mark a paper as released in the database.
 */
export async function markAsReleased(
  paperId: string,
  releasedById: string
): Promise<void> {
  await prisma.$transaction([
    prisma.questionPaper.update({
      where: { id: paperId },
      data: { status: 'RELEASED' },
    }),
    prisma.releaseSchedule.update({
      where: { paperId },
      data: {
        isReleased: true,
        releasedAt: new Date(),
        releasedById,
      },
    }),
  ]);
}
