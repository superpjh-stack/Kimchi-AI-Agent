// GET   /api/ml/experiments/:id  — 실험 단건 조회 (operator+)
// PATCH /api/ml/experiments/:id  — 상태 변경 (admin)
import { experimentManager } from '@/lib/ml/ab-manager';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';
import type { ExperimentStatus } from '@/lib/ml/ab-test';

async function getExperiment(req: AuthRequest, ...args: unknown[]): Promise<Response> {
  const { params } = args[0] as { params: { id: string } };
  const { id } = await Promise.resolve(params) as { id: string };

  const experiment = experimentManager.getExperiment(id);
  if (!experiment) {
    return Response.json({ error: 'Experiment not found' }, { status: 404 });
  }
  return Response.json(experiment);
}

async function patchExperiment(req: AuthRequest, ...args: unknown[]): Promise<Response> {
  const { params } = args[0] as { params: { id: string } };
  const { id } = await Promise.resolve(params) as { id: string };

  let body: { status: ExperimentStatus };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ALLOWED_STATUS: ExperimentStatus[] = ['paused', 'completed'];
  if (!ALLOWED_STATUS.includes(body.status)) {
    return Response.json({ error: 'status must be "paused" or "completed"' }, { status: 400 });
  }

  try {
    const updated = experimentManager.updateStatus(id, body.status);
    return Response.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Not found';
    return Response.json({ error: msg }, { status: 404 });
  }
}

export const GET   = withAuth(getExperiment,   { permissions: ['ml:read'] });
export const PATCH = withAuth(patchExperiment, { permissions: ['ml:admin'] });
