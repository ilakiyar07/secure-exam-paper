# Deployment Guide

This project is configured exclusively for **Vercel** and **Neon PostgreSQL**. AWS services are not required and should not be provisioned.

## 1. Database (Neon Serverless Postgres)
1. Create a project in [Neon](https://neon.tech/).
2. Retrieve the standard connection string and the pooled connection string.
3. Configure them in Vercel environment variables:
   - `DATABASE_URL`: Connection string (for Prisma Client)
   - `DIRECT_URL`: Direct connection string (for migrations)

## 2. Vercel Hosting
1. Import the project repository into Vercel.
2. Vercel automatically detects Next.js.
3. Add the following Environment Variables in Vercel settings:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `ENCRYPTION_KEY`: A 64-character hex string (256 bits). **Keep this extremely secure.**
   - `SIGNING_PRIVATE_KEY`: Your ECDSA private key (PEM).
   - `SIGNING_PUBLIC_KEY`: Your ECDSA public key (PEM).
4. Run `npm run build` during deployment.
5. Setup a post-install/build script for Prisma in `package.json` if required by Vercel: `"postinstall": "prisma generate"`.

## 3. Seed First User
After deploying, connect to the Neon SQL editor and insert a `SUPER_ADMIN` user manually, or write a `prisma/seed.ts` script to bootstrap the admin account securely.
