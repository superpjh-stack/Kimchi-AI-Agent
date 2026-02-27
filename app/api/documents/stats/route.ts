// Phase 3: GET /api/documents/stats — 문서 통계 엔드포인트

import { ok, err } from '@/lib/utils/api-response';
import { getDocumentStats } from '@/lib/rag/retriever';

export async function GET(): Promise<Response> {
  try {
    const stats = getDocumentStats();
    return ok(stats);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return err('STATS_ERROR', message, 500);
  }
}
