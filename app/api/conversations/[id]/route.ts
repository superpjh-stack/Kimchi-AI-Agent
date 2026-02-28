// GET/DELETE /api/conversations/[id]
import { conversationStore, deleteConversationEntry } from '@/lib/db/conversations-store';
import { isBkendConfigured, conversationsDb, messagesDb } from '@/lib/db/bkend';
import { ok, err } from '@/lib/utils/api-response';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';
import { logAudit } from '@/lib/auth/audit-logger';
import type { Message } from '@/types';

export const runtime = 'nodejs';

async function getConversation(
  req: Request,
  ...args: unknown[]
): Promise<Response> {
  const { params } = args[0] as { params: { id: string } };
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

async function deleteConversation(
  req: AuthRequest,
  ...args: unknown[]
): Promise<Response> {
  const { params } = args[0] as { params: { id: string } };
  if (isBkendConfigured()) {
    try {
      await conversationsDb.delete(params.id);
      logAudit({
        action: 'conversation.delete',
        actorEmail: req.user.sub,
        actorRole: req.user.role,
        resourceType: 'conversation',
        resourceId: params.id,
        ip: req.headers.get('x-forwarded-for') ?? undefined,
      });
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
  logAudit({
    action: 'conversation.delete',
    actorEmail: req.user.sub,
    actorRole: req.user.role,
    resourceType: 'conversation',
    resourceId: params.id,
  });
  return ok({ deleted: true });
}

// TODO(Sprint2): GET도 로그인 UI 완성 후 withAuth 재활성화
// export const GET = withAuth(getConversation, { permissions: ['conversations:read'] });
export const GET    = getConversation;
export const DELETE = withAuth(deleteConversation, { permissions: ['conversations:delete'] });
