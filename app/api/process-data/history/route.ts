// D5: GET /api/process-data/history?hours=24 — 센서 이력
import { ok, err } from '@/lib/utils/api-response';
import { createSensorClient } from '@/lib/process/sensor-client';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function historyHandler(req: AuthRequest): Promise<Response> {
  const url = new URL(req.url);
  const hours = Math.min(
    parseFloat(url.searchParams.get('hours') ?? '24'),
    168  // 최대 7일
  );

  if (isNaN(hours) || hours <= 0) {
    return err('INVALID_PARAM', 'hours는 0보다 큰 숫자여야 합니다.');
  }

  const client = createSensorClient();
  const readings = await client.getHistory(hours);

  return ok({ hours, count: readings.length, readings });
}

export const GET = withAuth(historyHandler, { permissions: ['ml:read'] });
