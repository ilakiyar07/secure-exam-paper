# Security Implementation Details

This document outlines how specific security requirements are met in the Secure Question Paper Management System.

## Threat Models Addressed
1. **Unauthorized Access:** Blocked via HTTP-only session cookies, strictly validated in Middleware (`src/middleware.ts`) and RBAC checks (`src/lib/auth/rbac.ts`).
2. **IDOR (Insecure Direct Object Reference):** Every Server Action validates that the `session.userId` and `session.role` have explicit ownership or administrative rights over the requested object (e.g., `paperActions.ts`).
3. **Data Leaks at Rest:** `AES-256-GCM` encrypts the files in memory before saving to DB. The initialization vector (IV) and Authentication Tag are saved alongside the cipher.
4. **Insider Threats & Tampering:** `SHA-256` hashing on upload. If the database `encrypted_data` is directly altered by a DB admin, the AES-256-GCM Auth Tag and SHA-256 will fail on decryption.
5. **Self-Approval:** The `approveQuestionPaper` action explicitly verifies `if (paper.createdById === session.userId) throw Error`.
6. **Early Release Prevention:** `releaseService.ts` explicitly compares `new Date()` to `releaseSchedule.releaseTime`. Even if the UI is tricked, the API route will throw an error and refuse to decrypt.
7. **Privilege Escalation:** Only `SUPER_ADMIN` can change roles or create users.
8. **Compromised Passwords:** Mitigated via mandatory TOTP (Time-Based One-Time Password) using `otpauth`.

## Incident Response
Security Events (High/Critical severities) are immediately saved to `security_events` table for investigation by the `SECURITY_AUDITOR`.
