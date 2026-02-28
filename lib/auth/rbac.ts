// lib/auth/rbac.ts — Role-Based Access Control
import type { UserRole } from './jwt';

type Permission =
  | 'chat:read' | 'chat:write'
  | 'upload:write'
  | 'conversations:read' | 'conversations:write' | 'conversations:delete'
  | 'ml:read' | 'ml:admin'
  | 'rag:debug'
  | 'health:read'
  | 'alerts:read'
  | 'admin:tenants';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'chat:read', 'chat:write',
    'upload:write',
    'conversations:read', 'conversations:write', 'conversations:delete',
    'ml:read', 'ml:admin',
    'rag:debug',
    'health:read',
    'alerts:read',
    'admin:tenants',
  ],
  operator: [
    'chat:read', 'chat:write',
    'upload:write',
    'conversations:read', 'conversations:write', 'conversations:delete',
    'ml:read',
    'health:read',
    'alerts:read',
  ],
  viewer: [
    'chat:read',
    'conversations:read',
    'ml:read',
    'health:read',
    'alerts:read',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(`Role '${role}' lacks permission '${permission}'`);
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
