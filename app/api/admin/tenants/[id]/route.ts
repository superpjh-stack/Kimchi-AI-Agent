// GET   /api/admin/tenants/:id  — 테넌트 단건 조회 (admin)
// PATCH /api/admin/tenants/:id  — 테넌트 수정 (admin)
// DELETE /api/admin/tenants/:id — 테넌트 삭제 (admin, 'default' 불가)
import { tenantStore } from '@/lib/tenant/tenant-store';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';
import type { TenantConfig } from '@/types/tenant';

export const runtime = 'nodejs';

async function getTenant(req: AuthRequest, ...args: unknown[]): Promise<Response> {
  const { params } = args[0] as { params: { id: string } };
  const { id } = await Promise.resolve(params) as { id: string };

  const tenant = tenantStore.get(id);
  if (!tenant) return Response.json({ error: 'Tenant not found' }, { status: 404 });
  return Response.json(tenant);
}

async function patchTenant(req: AuthRequest, ...args: unknown[]): Promise<Response> {
  const { params } = args[0] as { params: { id: string } };
  const { id } = await Promise.resolve(params) as { id: string };

  let body: Partial<Omit<TenantConfig, 'id' | 'createdAt'>>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const updated = tenantStore.update(id, body);
    return Response.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Not found';
    return Response.json({ error: msg }, { status: 404 });
  }
}

async function deleteTenant(req: AuthRequest, ...args: unknown[]): Promise<Response> {
  const { params } = args[0] as { params: { id: string } };
  const { id } = await Promise.resolve(params) as { id: string };

  try {
    tenantStore.delete(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Not found';
    const status = msg.includes("Cannot delete") ? 409 : 404;
    return Response.json({ error: msg }, { status });
  }
}

export const GET    = withAuth(getTenant,    { permissions: ['admin:tenants'] });
export const PATCH  = withAuth(patchTenant,  { permissions: ['admin:tenants'] });
export const DELETE = withAuth(deleteTenant, { permissions: ['admin:tenants'] });
