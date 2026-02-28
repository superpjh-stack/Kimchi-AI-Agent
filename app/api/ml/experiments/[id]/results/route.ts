// GET /api/ml/experiments/:id/results — 실험 결과 조회 (operator+)
import { experimentManager } from '@/lib/ml/ab-manager';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

async function getExperimentResults(req: AuthRequest, ...args: unknown[]): Promise<Response> {
  const { params } = args[0] as { params: { id: string } };
  const { id } = await Promise.resolve(params) as { id: string };

  try {
    const results = experimentManager.getResults(id);
    return Response.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Not found';
    return Response.json({ error: msg }, { status: 404 });
  }
}

export const GET = withAuth(getExperimentResults, { permissions: ['ml:read'] });
