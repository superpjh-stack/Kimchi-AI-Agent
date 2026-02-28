// POST /api/ml/experiments  — 실험 생성 (admin)
// GET  /api/ml/experiments  — 실험 목록 (operator+)
import { experimentManager } from '@/lib/ml/ab-manager';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';
import type { Variant } from '@/lib/ml/ab-test';

async function listExperiments(_req: AuthRequest): Promise<Response> {
  const experiments = experimentManager.listExperiments();
  return Response.json({ experiments });
}

async function createExperiment(req: AuthRequest): Promise<Response> {
  let body: { name: string; description?: string; variants: Variant[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, description, variants } = body;
  if (!name || typeof name !== 'string') {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  if (!Array.isArray(variants) || variants.length < 2) {
    return Response.json({ error: 'At least 2 variants required' }, { status: 400 });
  }
  // trafficPercent 합계 검증
  const total = variants.reduce((s: number, v: Variant) => s + (v.trafficPercent ?? 0), 0);
  if (total !== 100) {
    return Response.json({ error: `Variant trafficPercent must sum to 100, got ${total}` }, { status: 400 });
  }

  try {
    const experiment = experimentManager.createExperiment({
      name,
      description,
      status: 'active',
      variants,
      createdBy: req.user.sub,
    });
    return Response.json(experiment, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create experiment';
    return Response.json({ error: msg }, { status: 400 });
  }
}

export const GET  = withAuth(listExperiments,    { permissions: ['ml:read'] });
export const POST = withAuth(createExperiment,   { permissions: ['ml:admin'] });
