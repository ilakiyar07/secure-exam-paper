# System Architecture

## Core Technologies
- **Frontend/Backend:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **Database:** Neon Serverless PostgreSQL
- **ORM:** Prisma

## Separation of Concerns
The system uses Next.js Server Actions exclusively for state-mutating operations and API routes purely for restricted downloads. The boundary between client and server is strictly enforced. No database or cryptographic secrets leak to the client.

## Data Models
1. **User / MFAConfiguration / Session / LoginAttempt:** Identity and access control layer.
2. **Examination / ExamAssignment:** Groups papers logically.
3. **QuestionPaper / QuestionPaperVersion / Approval / ReviewAssignment:** Core paper lifecycle tracking. Each file update creates a new immutable version.
4. **ReleaseSchedule:** Manages the time-gated access system.
5. **AuditLog / SecurityEvent:** Immutable tracking for observability.

## Authentication Flow
1. User provides credentials.
2. Verified against `bcryptjs` hash.
3. TOTP challenge verified using `otpauth`.
4. Cryptographically secure session token generated, stored in DB and set as HTTP-Only, Secure cookie.
5. Proxy middleware checks validity of token and role permissions.

## Cryptography
- Papers are encrypted in `encryption.ts` using Node.js native `crypto` module (AES-256-GCM).
- Signatures in `signature.ts` use ECDSA on `prime256v1`.
