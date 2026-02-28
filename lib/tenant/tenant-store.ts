// lib/tenant/tenant-store.ts — Tenant 설정 저장소 (싱글턴)
import { createLogger } from '@/lib/logger';
import type { TenantId, TenantConfig } from '@/types/tenant';

const log = createLogger('tenant.store');

export class TenantStore {
  private tenants = new Map<TenantId, TenantConfig>();

  constructor() {
    // 기본 tenant 초기화 — 항상 존재
    this.tenants.set('default', {
      id: 'default',
      name: '기본 공장',
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }

  get(id: TenantId): TenantConfig | undefined {
    return this.tenants.get(id);
  }

  exists(id: TenantId): boolean {
    return this.tenants.has(id);
  }

  list(): TenantConfig[] {
    return Array.from(this.tenants.values());
  }

  create(config: Omit<TenantConfig, 'createdAt'>): TenantConfig {
    if (this.tenants.has(config.id)) {
      throw new Error(`Tenant '${config.id}' already exists`);
    }
    const full: TenantConfig = { ...config, createdAt: new Date().toISOString() };
    this.tenants.set(config.id, full);
    log.info({ id: config.id, name: config.name }, 'Tenant created');
    return full;
  }

  update(id: TenantId, patch: Partial<Omit<TenantConfig, 'id' | 'createdAt'>>): TenantConfig {
    const existing = this.tenants.get(id);
    if (!existing) throw new Error(`Tenant '${id}' not found`);
    const updated: TenantConfig = { ...existing, ...patch };
    this.tenants.set(id, updated);
    log.info({ id, patch }, 'Tenant updated');
    return updated;
  }

  delete(id: TenantId): void {
    if (id === 'default') throw new Error("Cannot delete the 'default' tenant");
    if (!this.tenants.has(id)) throw new Error(`Tenant '${id}' not found`);
    this.tenants.delete(id);
    log.info({ id }, 'Tenant deleted');
  }
}

export const tenantStore = new TenantStore();
