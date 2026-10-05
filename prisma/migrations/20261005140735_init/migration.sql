-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'EXAM_CONTROLLER', 'QUESTION_SETTER', 'REVIEWER', 'SECURITY_AUDITOR');

-- CreateEnum
CREATE TYPE "PaperStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'FINALIZED', 'SCHEDULED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'FAILED_LOGIN', 'LOGOUT', 'MFA_SETUP', 'MFA_VERIFY', 'MFA_FAILURE', 'PAPER_CREATE', 'PAPER_UPLOAD', 'PAPER_ENCRYPT', 'PAPER_SUBMIT', 'PAPER_VIEW', 'PAPER_APPROVE', 'PAPER_REJECT', 'PAPER_FINALIZE', 'PAPER_SCHEDULE', 'PAPER_RELEASE', 'PAPER_DOWNLOAD', 'PAPER_DECRYPT', 'PAPER_SIGN', 'INTEGRITY_CHECK', 'INTEGRITY_FAILURE', 'UNAUTHORIZED_ACCESS', 'PERMISSION_DENIED', 'EARLY_RELEASE_ATTEMPT', 'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'ROLE_CHANGE', 'ACCOUNT_LOCKOUT', 'ACCOUNT_UNLOCK', 'PASSWORD_CHANGE', 'SESSION_EXPIRE', 'RELEASE_ATTEMPT', 'DOWNLOAD_ATTEMPT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_configurations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "backup_codes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mfa_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examinations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "exam_date" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "total_marks" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "examinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_assignments" (
    "id" TEXT NOT NULL,
    "examination_id" TEXT NOT NULL,
    "setter_id" TEXT,
    "reviewer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_papers" (
    "id" TEXT NOT NULL,
    "examination_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PaperStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" TEXT NOT NULL,
    "finalized_by_id" TEXT,
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_paper_versions" (
    "id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "encrypted_data" BYTEA NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "sha256_hash" TEXT NOT NULL,
    "encryption_version" TEXT NOT NULL DEFAULT 'aes-256-gcm-v1',
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'application/pdf',
    "file_size" INTEGER NOT NULL,
    "digital_signature" TEXT,
    "signed_by_id" TEXT,
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_paper_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_assignments" (
    "id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_schedules" (
    "id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "release_time" TIMESTAMP(3) NOT NULL,
    "is_released" BOOLEAN NOT NULL DEFAULT false,
    "released_at" TIMESTAMP(3),
    "released_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_role" "UserRole",
    "action" "AuditAction" NOT NULL,
    "resource" TEXT,
    "resource_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "severity" "SecuritySeverity" NOT NULL,
    "event_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ip_address" TEXT,
    "metadata" TEXT,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_configurations_user_id_key" ON "mfa_configurations"("user_id");

-- CreateIndex
CREATE INDEX "login_attempts_user_id_idx" ON "login_attempts"("user_id");

-- CreateIndex
CREATE INDEX "login_attempts_email_idx" ON "login_attempts"("email");

-- CreateIndex
CREATE INDEX "login_attempts_ip_address_idx" ON "login_attempts"("ip_address");

-- CreateIndex
CREATE INDEX "login_attempts_created_at_idx" ON "login_attempts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "examinations_code_key" ON "examinations"("code");

-- CreateIndex
CREATE INDEX "examinations_code_idx" ON "examinations"("code");

-- CreateIndex
CREATE INDEX "examinations_exam_date_idx" ON "examinations"("exam_date");

-- CreateIndex
CREATE INDEX "examinations_is_active_idx" ON "examinations"("is_active");

-- CreateIndex
CREATE INDEX "exam_assignments_examination_id_idx" ON "exam_assignments"("examination_id");

-- CreateIndex
CREATE INDEX "exam_assignments_setter_id_idx" ON "exam_assignments"("setter_id");

-- CreateIndex
CREATE INDEX "exam_assignments_reviewer_id_idx" ON "exam_assignments"("reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_assignments_examination_id_setter_id_key" ON "exam_assignments"("examination_id", "setter_id");

-- CreateIndex
CREATE INDEX "question_papers_examination_id_idx" ON "question_papers"("examination_id");

-- CreateIndex
CREATE INDEX "question_papers_created_by_id_idx" ON "question_papers"("created_by_id");

-- CreateIndex
CREATE INDEX "question_papers_status_idx" ON "question_papers"("status");

-- CreateIndex
CREATE INDEX "question_papers_created_at_idx" ON "question_papers"("created_at");

-- CreateIndex
CREATE INDEX "question_paper_versions_paper_id_idx" ON "question_paper_versions"("paper_id");

-- CreateIndex
CREATE INDEX "question_paper_versions_sha256_hash_idx" ON "question_paper_versions"("sha256_hash");

-- CreateIndex
CREATE UNIQUE INDEX "question_paper_versions_paper_id_version_key" ON "question_paper_versions"("paper_id", "version");

-- CreateIndex
CREATE INDEX "review_assignments_paper_id_idx" ON "review_assignments"("paper_id");

-- CreateIndex
CREATE INDEX "review_assignments_reviewer_id_idx" ON "review_assignments"("reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_assignments_paper_id_reviewer_id_key" ON "review_assignments"("paper_id", "reviewer_id");

-- CreateIndex
CREATE INDEX "approvals_paper_id_idx" ON "approvals"("paper_id");

-- CreateIndex
CREATE INDEX "approvals_user_id_idx" ON "approvals"("user_id");

-- CreateIndex
CREATE INDEX "approvals_created_at_idx" ON "approvals"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "release_schedules_paper_id_key" ON "release_schedules"("paper_id");

-- CreateIndex
CREATE INDEX "release_schedules_scheduled_date_idx" ON "release_schedules"("scheduled_date");

-- CreateIndex
CREATE INDEX "release_schedules_release_time_idx" ON "release_schedules"("release_time");

-- CreateIndex
CREATE INDEX "release_schedules_is_released_idx" ON "release_schedules"("is_released");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_success_idx" ON "audit_logs"("success");

-- CreateIndex
CREATE INDEX "security_events_user_id_idx" ON "security_events"("user_id");

-- CreateIndex
CREATE INDEX "security_events_severity_idx" ON "security_events"("severity");

-- CreateIndex
CREATE INDEX "security_events_event_type_idx" ON "security_events"("event_type");

-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");

-- CreateIndex
CREATE INDEX "security_events_is_resolved_idx" ON "security_events"("is_resolved");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_configurations" ADD CONSTRAINT "mfa_configurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_examination_id_fkey" FOREIGN KEY ("examination_id") REFERENCES "examinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_setter_id_fkey" FOREIGN KEY ("setter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_examination_id_fkey" FOREIGN KEY ("examination_id") REFERENCES "examinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_paper_versions" ADD CONSTRAINT "question_paper_versions_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "question_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "question_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "question_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_schedules" ADD CONSTRAINT "release_schedules_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "question_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
