// lib/tenant/tenant-context.ts — AsyncLocalStorage 기반 Tenant 컨텍스트
// Node.js 전용 (Edge Runtime 불가) — 'nodejs' runtime API 라우트에서만 사용
import { AsyncLocalStorage } from 'async_hooks';
import { tenantStore } from './tenant-store';
import type { TenantContext, TenantId } from '@/types/tenant';

const DEFAULT_TENANT_CONFIG = tenantStore.get('default')!;

const tenantStorage = new AsyncLocalStorage<TenantContext>();

/** 현재 AsyncLocalStorage 컨텍스트의 Tenant를 반환. 없으면 default 반환. */
export function getTenantContext(): TenantContext {
  return tenantStorage.getStore() ?? {
    tenantId: 'default',
    config: tenantStore.get('default') ?? DEFAULT_TENANT_CONFIG,
  };
}

/** 주어진 TenantContext 하에서 fn을 실행 (전파 보장). */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}

/** 요청에서 추출한 tenantId로 TenantContext를 빌드. 유효하지 않으면 default 사용. */
export function buildTenantContext(tenantId: TenantId): TenantContext {
  const config = tenantStore.get(tenantId) ?? tenantStore.get('default')!;
  return { tenantId: config.id, config };
}
