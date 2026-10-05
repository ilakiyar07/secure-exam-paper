// ============================================================
// Zod Validation Schemas
// ============================================================
import { z } from 'zod';

// ---------- Auth ----------
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const mfaVerifySchema = z.object({
  code: z.string().length(6, 'MFA code must be 6 digits').regex(/^\d+$/, 'MFA code must be numeric'),
});

export const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number')
  .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'Must contain a special character');

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  password: passwordSchema,
  role: z.enum(['SUPER_ADMIN', 'EXAM_CONTROLLER', 'QUESTION_SETTER', 'REVIEWER', 'SECURITY_AUDITOR']),
});

// ---------- Examination ----------
export const createExaminationSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(200),
  code: z.string().min(2).max(20).regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  description: z.string().max(1000).optional(),
  subject: z.string().min(2).max(100),
  examDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  duration: z.number().int().min(1).max(600),
  totalMarks: z.number().int().min(1).max(10000),
});

// ---------- Question Paper ----------
export const createPaperSchema = z.object({
  examinationId: z.string().min(1, 'Examination is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
});

export const approvalSchema = z.object({
  paperId: z.string().min(1),
  action: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().max(2000).optional(),
});

export const releaseScheduleSchema = z.object({
  paperId: z.string().min(1),
  scheduledDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  releaseTime: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid datetime'),
});

// ---------- File Upload Validation ----------
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = ['application/pdf'];
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

export function validateFileUpload(file: File): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    errors.push('Only PDF files are allowed');
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    errors.push('File must have .pdf extension');
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size must not exceed ${MAX_FILE_SIZE / 1024 / 1024} MB`);
  }

  if (file.size === 0) {
    errors.push('File must not be empty');
  }

  return { valid: errors.length === 0, errors };
}

export function validatePDFSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return PDF_MAGIC_BYTES.every((byte, i) => buffer[i] === byte);
}

// ---------- Assign ----------
export const assignSetterSchema = z.object({
  examinationId: z.string().min(1),
  setterId: z.string().min(1),
});

export const assignReviewerSchema = z.object({
  paperId: z.string().min(1),
  reviewerId: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type MFAVerifyInput = z.infer<typeof mfaVerifySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateExaminationInput = z.infer<typeof createExaminationSchema>;
export type CreatePaperInput = z.infer<typeof createPaperSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
export type ReleaseScheduleInput = z.infer<typeof releaseScheduleSchema>;
