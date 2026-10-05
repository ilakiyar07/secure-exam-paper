// ============================================================
// API Route: Download Released Paper
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { attemptRelease } from '@/lib/services/releaseService';
import { getClientIP } from '@/lib/security/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id: paperId } = await params;
  const ip = await getClientIP();

  const result = await attemptRelease(paperId, {
    userId: session.userId,
    userRole: session.role,
    ipAddress: ip,
  });

  if (!result.success) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      NOT_RELEASED: 403,
      TOO_EARLY: 403,
      NO_SCHEDULE: 400,
      NO_VERSION: 400,
      NO_SIGNATURE: 500,
      INTEGRITY_FAILURE: 500,
      SIGNATURE_INVALID: 500,
      DECRYPTION_FAILED: 500,
    };
    const status = statusMap[result.errorCode ?? ''] ?? 500;
    return NextResponse.json({ error: result.error, code: result.errorCode }, { status });
  }

  // Return decrypted file
  return new NextResponse(result.data ? new Uint8Array(result.data) : null, {
    status: 200,
    headers: {
      'Content-Type': result.mimeType ?? 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename ?? 'paper.pdf'}"`,
      'Content-Length': String(result.data?.length ?? 0),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
