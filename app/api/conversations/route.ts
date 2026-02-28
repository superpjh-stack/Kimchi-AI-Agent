// GET/POST /api/conversations
// bkend.ai 설정 시 → bkend.ai 영구 저장
// 미설정 시 → 인메모리 폴백 (개발/테스트용)
import { ok, created } from '@/lib/utils/api-response';
import { isBkendConfigured, conversationsDb } from '@/lib/db/bkend';
import { conversationStore, createConversationEntry, setConversationEntry } from '@/lib/db/conversations-store';
import { generateTitle, truncate } from '@/lib/utils/markdown';
// TODO(Sprint2): 로그인 UI 완성 후 withAuth 재활성화
// import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

export const runtime = 'nodejs';

// GET /api/conversations?limit=20&page=1
async function listConversations(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);
  const page = Math.max(parseInt(url.searchParams.get('page') ?? '1', 10), 1);
  // offset 방식 하위 호환
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const resolvedPage = url.searchParams.has('page') ? page : Math.floor(offset / limit) + 1;

  if (isBkendConfigured()) {
    const result = await conversationsDb.list({ page: resolvedPage, limit });
    return ok(
      { conversations: result.items },
      { total: result.pagination.total, limit, page: result.pagination.page }
    );
  }

  // 인메모리 폴백
  const all = Array.from(conversationStore.values())
    .map((e) => e.conversation)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const start = (resolvedPage - 1) * limit;
  const paginated = all.slice(start, start + limit);

  return ok({ conversations: paginated }, { total: all.length, limit, page: resolvedPage });
}

// POST /api/conversations — 새 대화 생성
async function createConversation(req: Request): Promise<Response> {
  let body: { firstMessage?: string } = {};
  try {
    body = (await req.json()) as { firstMessage?: string };
  } catch {
    // body is optional
  }

  const firstMessage = body.firstMessage ?? '새 대화';

  if (isBkendConfigured()) {
    const conversation = await conversationsDb.create({
      title: generateTitle(firstMessage),
      lastMessage: truncate(firstMessage, 50),
      messageCount: 0,
    });
    return created(conversation);
  }

  // 인메모리 폴백
  const conversation = createConversationEntry(firstMessage);
  setConversationEntry(conversation.id, { conversation, messages: [] });
  return created(conversation);
}

// TODO(Sprint2): 로그인 UI 완성 후 withAuth 재활성화
// export const GET  = withAuth(listConversations,   { permissions: ['conversations:read'] });
// export const POST = withAuth(createConversation,  { permissions: ['conversations:write'] });
export const GET  = listConversations;
export const POST = createConversation;
