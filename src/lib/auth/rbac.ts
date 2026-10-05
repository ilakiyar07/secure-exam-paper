// ============================================================
// RBAC - Role-Based Access Control
// ============================================================
import { type UserRole } from '@prisma/client';

export type Permission =
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'system:config'
  | 'examinations:read'
  | 'examinations:create'
  | 'examinations:update'
  | 'examinations:delete'
  | 'examinations:assign'
  | 'papers:create'
  | 'papers:read_own'
  | 'papers:read_assigned'
  | 'papers:read_all'
  | 'papers:upload'
  | 'papers:submit'
  | 'papers:review'
  | 'papers:approve'
  | 'papers:reject'
  | 'papers:finalize'
  | 'papers:schedule'
  | 'papers:release'
  | 'papers:download'
  | 'audit:read'
  | 'security:read'
  | 'security:investigate'
  | 'dashboard:admin'
  | 'dashboard:setter'
  | 'dashboard:reviewer'
  | 'dashboard:controller'
  | 'dashboard:auditor';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'users:read', 'users:create', 'users:update', 'users:delete',
    'system:config',
    'examinations:read', 'examinations:create', 'examinations:update', 'examinations:delete',
    'papers:read_all',
    'audit:read',
    'security:read', 'security:investigate',
    'dashboard:admin',
  ],

  EXAM_CONTROLLER: [
    'examinations:read', 'examinations:create', 'examinations:update', 'examinations:assign',
    'papers:read_all',
    'papers:finalize', 'papers:schedule', 'papers:release',
    'audit:read',
    'dashboard:controller',
  ],

  QUESTION_SETTER: [
    'examinations:read',
    'papers:create', 'papers:read_own', 'papers:upload', 'papers:submit',
    'dashboard:setter',
  ],

  REVIEWER: [
    'examinations:read',
    'papers:read_assigned', 'papers:review', 'papers:approve', 'papers:reject',
    'dashboard:reviewer',
  ],

  SECURITY_AUDITOR: [
    'audit:read',
    'security:read', 'security:investigate',
    'examinations:read',
    'papers:read_all',
    'dashboard:auditor',
  ],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has ALL of the specified permissions.
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Authorize a user action. Throws if unauthorized.
 */
export function authorize(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Unauthorized: role ${role} does not have permission ${permission}`);
  }
}
