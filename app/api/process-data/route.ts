// D4: GET /api/process-data — 현재 센서 수치
import { ok } from '@/lib/utils/api-response';
import { createSensorClient } from '@/lib/process/sensor-client';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

export const runtime = 'nodejs';
// Next.js 캐시 비활성화 — 항상 최신 센서 데이터
export const dynamic = 'force-dynamic';

async function processDataHandler(_req: AuthRequest): Promise<Response> {
  const client = createSensorClient();
  const data = await client.getCurrentData();
  return ok(data);
}

export const GET = withAuth(processDataHandler, { permissions: ['ml:read'] });
