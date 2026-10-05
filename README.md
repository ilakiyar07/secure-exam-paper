# Secure Cloud-Based Competitive Examination Question Paper Management System

A highly secure, cloud-based platform for managing the entire lifecycle of competitive examination question papers. Designed to prevent unauthorized access, unauthorized modifications, insider leakage, compromised accounts, and premature access.

## Features

- **Strict Role-Based Access Control (RBAC):** Roles include Super Admin, Exam Controller, Question Setter, Reviewer, and Security Auditor. Segregation of duties is strictly enforced.
- **End-to-End Encryption:** Question papers are encrypted using AES-256-GCM. Plaintext papers are never permanently stored in the database.
- **Digital Signatures:** Finalized question papers are signed with ECDSA (P-256) to ensure non-repudiation and prevent tampering.
- **Integrity Validation:** SHA-256 hashes detect any unauthorized modification of stored data.
- **Multi-Factor Authentication (MFA):** Mandatory TOTP-based 2FA for all users.
- **Immutable Audit Logging:** Every system action, authentication attempt, and data access is securely logged.
- **Time-Gated Release Mechanism:** Server-side enforcement prevents downloading question papers even a millisecond before the scheduled release time.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Actions)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Glassmorphism & Cyber-security theme)
- **Database:** Neon PostgreSQL (Serverless)
- **ORM:** Prisma
- **Cryptography:** Node.js Crypto, `jose`
- **Authentication:** Custom Session-based auth with `bcryptjs` and `otpauth`
- **Validation:** Zod
- **Testing:** Vitest, React Testing Library

## Quick Start

1. Install dependencies: `npm install`
2. Set up environment variables in `.env`
3. Generate Prisma client: `npx prisma generate`
4. Run migrations: `npx prisma db push`
5. Start development server: `npm run dev`

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting instructions on Vercel and Neon.
