// C3: GET /api/rag/debug?q=검색어 — RAG 검색 결과 디버그
// 개발/관리자 용도: 쿼리에 대한 top-K 결과와 유사도 점수 확인
import { ok, err } from '@/lib/utils/api-response';
import { embed } from '@/lib/rag/embedder';
import { search } from '@/lib/rag/retriever';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

export const runtime = 'nodejs';

async function ragDebugHandler(req: AuthRequest): Promise<Response> {
  const url = new URL(req.url);
  const query = url.searchParams.get('q')?.trim();

  if (!query) {
    return err('MISSING_PARAM', 'q 파라미터가 필요합니다. 예: /api/rag/debug?q=발효온도');
  }

  const topK = Math.min(parseInt(url.searchParams.get('topK') ?? '5', 10), 20);
  // 디버그용으로 threshold를 낮춰 더 많은 결과 확인 가능
  const threshold = parseFloat(url.searchParams.get('threshold') ?? '0.0');

  const queryVector = await embed(query);
  const results = search(queryVector, { topK, threshold });

  const topKResults = results.map((r, i) => ({
    rank: i + 1,
    score: Math.round(r.score * 1000) / 1000,
    docId: r.chunk.metadata.docId,
    docName: r.chunk.metadata.docName,
    chunkIndex: r.chunk.index,
    content: r.chunk.text.slice(0, 300) + (r.chunk.text.length > 300 ? '...' : ''),
  }));

  return ok({
    query,
    topK,
    threshold,
    resultCount: topKResults.length,
    results: topKResults,
  });
}

export const GET = withAuth(ragDebugHandler, { permissions: ['rag:debug'] });
