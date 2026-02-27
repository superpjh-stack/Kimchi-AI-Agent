// GET/DELETE /api/conversations/[id]
import { conversationStore, deleteConversationEntry } from '@/lib/db/conversations-store';
import { isBkendConfigured, conversationsDb, messagesDb } from '@/lib/db/bkend';
import { ok, err } from '@/lib/utils/api-response';
import type { Message } from '@/types';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  if (isBkendConfigured()) {
    try {
      const [conversation, msgResult] = await Promise.all([
        conversationsDb.get(params.id),
        messagesDb.listByConversation(params.id),
      ]);
      // bkend.ai 메시지 → 내부 Message 타입 변환
      const messages: Message[] = msgResult.items.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: Array.isArray(m.sources) ? m.sources : [],
        createdAt: m.createdAt,
      }));
      return ok({ conversation, messages });
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
        return err('NOT_FOUND', 'Conversation not found', 404);
      }
      throw e;
    }
  }

  // 인메모리 폴백
  const entry = conversationStore.get(params.id);
  if (!entry) return err('NOT_FOUND', 'Conversation not found', 404);
  return ok({ conversation: entry.conversation, messages: entry.messages });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  if (isBkendConfigured()) {
    try {
      await conversationsDb.delete(params.id);
      return ok({ deleted: true });
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
        return err('NOT_FOUND', 'Conversation not found', 404);
      }
      throw e;
    }
  }

  // 파일 저장소 폴백
  const existed = deleteConversationEntry(params.id);
  if (!existed) return err('NOT_FOUND', 'Conversation not found', 404);
  return ok({ deleted: true });
}
