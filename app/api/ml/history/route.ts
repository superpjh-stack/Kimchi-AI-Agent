// app/api/ml/history/route.ts — 예측 이력 조회

import { predictionHistory } from '@/lib/ml/prediction-history';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

export const runtime = 'nodejs';

async function historyHandler(req: AuthRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'fermentation';
  const hours = parseInt(searchParams.get('hours') ?? '24', 10);
  const records = predictionHistory.getTrend(type, hours);
  return Response.json({ records, count: records.length });
}

export const GET = withAuth(historyHandler, { permissions: ['ml:read'] });
