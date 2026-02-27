// C2: DELETE /api/documents/[id] — 문서 삭제 (DB + 벡터 스토어)
import { ok, err } from '@/lib/utils/api-response';
import { isBkendConfigured, documentsDb } from '@/lib/db/bkend';
import { removeDocumentFull } from '@/lib/rag/pipeline';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const { id } = params;

  // 벡터 스토어 + BM25 인덱스에서 동시 제거
  await removeDocumentFull(id);

  if (isBkendConfigured()) {
    try {
      await documentsDb.delete(id);
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
        return err('NOT_FOUND', 'Document not found', 404);
      }
      throw e;
    }
  }

  return ok({ deleted: true, id });
}
