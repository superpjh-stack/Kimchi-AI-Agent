// C1: GET /api/documents — 문서 목록 + 통계
// bkend.ai 설정 시 → DB 조회, 미설정 시 → 인메모리 벡터 스토어 기반
import { ok } from '@/lib/utils/api-response';
import { isBkendConfigured, documentsDb } from '@/lib/db/bkend';
import { getStoreSize } from '@/lib/rag/retriever';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

export const runtime = 'nodejs';

async function listDocuments(req: AuthRequest): Promise<Response> {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);
  const page = Math.max(parseInt(url.searchParams.get('page') ?? '1', 10), 1);

  if (isBkendConfigured()) {
    const result = await documentsDb.list({ page, limit });
    return ok(
      { documents: result.items },
      { total: result.pagination.total, limit, page: result.pagination.page }
    );
  }

  // 인메모리 폴백: 벡터 스토어 통계만 반환 (문서 목록 없음)
  const vectorStoreSize = getStoreSize();
  return ok(
    { documents: [], vectorStoreSize },
    { total: 0, limit, page }
  );
}

export const GET = withAuth(listDocuments, { permissions: ['upload:write'] });
