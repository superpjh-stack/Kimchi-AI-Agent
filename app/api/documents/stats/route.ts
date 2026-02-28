// Phase 3: GET /api/documents/stats — 문서 통계 엔드포인트

import { ok, err } from '@/lib/utils/api-response';
import { getDocumentStats } from '@/lib/rag/retriever';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

async function statsHandler(_req: AuthRequest): Promise<Response> {
  try {
    const stats = getDocumentStats();
    return ok(stats);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return err('STATS_ERROR', message, 500);
  }
}

export const GET = withAuth(statsHandler, { permissions: ['upload:write'] });
