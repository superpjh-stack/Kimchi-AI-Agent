// lib/tenant/tenant-middleware.ts — 요청에서 Tenant ID 추출
import { tenantStore } from './tenant-store';
import type { TenantId } from '@/types/tenant';

/**
 * 요청에서 Tenant ID를 추출합니다.
 *
 * 우선순위:
 * 1. x-tenant-id 헤더 (API 클라이언트 / 테스트용)
 * 2. DEFAULT_TENANT_ID 환경변수
 * 3. 'default'
 *
 * 헤더에 tenantId가 있지만 스토어에 존재하지 않으면 'default' 반환.
 */
export function extractTenantId(req: Request): TenantId {
  const headerTenant = req.headers.get('x-tenant-id');
  if (headerTenant && tenantStore.exists(headerTenant)) {
    return headerTenant;
  }
  const envTenant = process.env.DEFAULT_TENANT_ID;
  if (envTenant && tenantStore.exists(envTenant)) {
    return envTenant;
  }
  return 'default';
}

/** TENANT_MODE=multi 환경에서만 멀티테넌트를 활성화 */
export function isMultiTenantEnabled(): boolean {
  return process.env.TENANT_MODE === 'multi';
}
