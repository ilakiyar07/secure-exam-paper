import { describe, it, expect } from 'vitest';
import { hasPermission } from '@/lib/auth/rbac';
import { UserRole } from '@prisma/client';

describe('Role-Based Access Control (RBAC)', () => {
  it('should allow QUESTION_SETTER to create and upload papers', () => {
    expect(hasPermission('QUESTION_SETTER', 'papers:create')).toBe(true);
    expect(hasPermission('QUESTION_SETTER', 'papers:upload')).toBe(true);
    expect(hasPermission('QUESTION_SETTER', 'papers:submit')).toBe(true);
  });

  it('should NOT allow QUESTION_SETTER to approve, finalize, or release papers', () => {
    expect(hasPermission('QUESTION_SETTER', 'papers:approve')).toBe(false);
    expect(hasPermission('QUESTION_SETTER', 'papers:finalize')).toBe(false);
    expect(hasPermission('QUESTION_SETTER', 'papers:release')).toBe(false);
  });

  it('should allow REVIEWER to approve papers but not create them', () => {
    expect(hasPermission('REVIEWER', 'papers:approve')).toBe(true);
    expect(hasPermission('REVIEWER', 'papers:create')).toBe(false);
    expect(hasPermission('REVIEWER', 'papers:release')).toBe(false);
  });

  it('should allow EXAM_CONTROLLER to finalize and schedule papers', () => {
    expect(hasPermission('EXAM_CONTROLLER', 'papers:finalize')).toBe(true);
    expect(hasPermission('EXAM_CONTROLLER', 'papers:schedule')).toBe(true);
    expect(hasPermission('EXAM_CONTROLLER', 'papers:release')).toBe(true);
  });

  it('should allow SUPER_ADMIN full access to users and exams', () => {
    expect(hasPermission('SUPER_ADMIN', 'users:create')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'examinations:create')).toBe(true);
  });

  it('should strictly limit SECURITY_AUDITOR to read-only security events and audits', () => {
    expect(hasPermission('SECURITY_AUDITOR', 'audit:read')).toBe(true);
    expect(hasPermission('SECURITY_AUDITOR', 'security:read')).toBe(true);
    expect(hasPermission('SECURITY_AUDITOR', 'papers:create')).toBe(false);
    expect(hasPermission('SECURITY_AUDITOR', 'users:update')).toBe(false);
  });
});
