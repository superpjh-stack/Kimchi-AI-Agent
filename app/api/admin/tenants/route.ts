// GET /api/admin/tenants  — 테넌트 목록 (admin)
// POST /api/admin/tenants — 테넌트 생성 (admin)
import { tenantStore } from '@/lib/tenant/tenant-store';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';
import type { TenantConfig } from '@/types/tenant';

export const runtime = 'nodejs';

async function listTenants(_req: AuthRequest): Promise<Response> {
  const tenants = tenantStore.list();
  return Response.json({ tenants });
}

async function createTenant(req: AuthRequest): Promise<Response> {
  let body: Partial<Pick<TenantConfig, 'id' | 'name' | 'systemPrompt' | 'isActive'>>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name || typeof body.name !== 'string') {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  const id = body.id ?? crypto.randomUUID();

  try {
    const tenant = tenantStore.create({
      id,
      name: body.name,
      systemPrompt: body.systemPrompt,
      isActive: body.isActive ?? true,
    });
    return Response.json(tenant, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create tenant';
    return Response.json({ error: msg }, { status: 409 });
  }
}

export const GET  = withAuth(listTenants,   { permissions: ['admin:tenants'] });
export const POST = withAuth(createTenant,  { permissions: ['admin:tenants'] });
