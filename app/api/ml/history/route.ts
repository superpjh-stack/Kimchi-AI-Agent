// app/api/ml/history/route.ts — 예측 이력 조회

import { predictionHistory } from '@/lib/ml/prediction-history';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'fermentation';
  const hours = parseInt(searchParams.get('hours') ?? '24', 10);
  const records = predictionHistory.getTrend(type, hours);
  return Response.json({ records, count: records.length });
}
