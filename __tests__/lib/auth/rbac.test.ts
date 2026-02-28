// __tests__/lib/auth/rbac.test.ts — RBAC 권한 검사 단위 테스트
import { hasPermission, requirePermission, ForbiddenError } from '@/lib/auth/rbac';

describe('hasPermission', () => {
  // admin: 전체 권한
  test.each([
    'chat:read', 'chat:write', 'upload:write',
    'conversations:read', 'conversations:write', 'conversations:delete',
    'ml:read', 'ml:admin', 'rag:debug', 'health:read', 'alerts:read', 'admin:tenants',
  ] as const)('admin — %s 허용', (perm) => {
    expect(hasPermission('admin', perm)).toBe(true);
  });

  // operator: 제한된 권한
  test.each([
    ['chat:read', true],
    ['chat:write', true],
    ['upload:write', true],
    ['conversations:read', true],
    ['conversations:write', true],
    ['conversations:delete', true],
    ['ml:read', true],
    ['ml:admin', false],      // 비허용
    ['rag:debug', false],     // 비허용
    ['admin:tenants', false], // 비허용
  ] as [string, boolean][])('operator — %s → %s', (perm, expected) => {
    expect(hasPermission('operator', perm as Parameters<typeof hasPermission>[1])).toBe(expected);
  });

  // viewer: 읽기 전용
  test.each([
    ['chat:read', true],
    ['chat:write', false],
    ['upload:write', false],
    ['conversations:read', true],
    ['conversations:write', false],
    ['conversations:delete', false],
    ['ml:read', true],
    ['ml:admin', false],
    ['rag:debug', false],
  ] as [string, boolean][])('viewer — %s → %s', (perm, expected) => {
    expect(hasPermission('viewer', perm as Parameters<typeof hasPermission>[1])).toBe(expected);
  });
});

describe('requirePermission', () => {
  test('권한 있음 → 예외 없음', () => {
    expect(() => requirePermission('admin', 'admin:tenants')).not.toThrow();
    expect(() => requirePermission('operator', 'chat:write')).not.toThrow();
  });

  test('권한 없음 → ForbiddenError 발생', () => {
    expect(() => requirePermission('viewer', 'chat:write')).toThrow(ForbiddenError);
    expect(() => requirePermission('operator', 'ml:admin')).toThrow(ForbiddenError);
    expect(() => requirePermission('viewer', 'upload:write')).toThrow(ForbiddenError);
  });

  test('ForbiddenError.statusCode === 403', () => {
    try {
      requirePermission('viewer', 'admin:tenants');
      fail('should have thrown');
    } catch (e) {
      expect(e instanceof ForbiddenError).toBe(true);
      expect((e as ForbiddenError).statusCode).toBe(403);
      expect((e as ForbiddenError).name).toBe('ForbiddenError');
    }
  });
});
