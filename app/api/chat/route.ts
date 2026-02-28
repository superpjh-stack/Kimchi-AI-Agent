// POST /api/chat — 요청 검증 + Rate Limit + Tenant Context + ChatService 위임
import { SSE_HEADERS } from '@/lib/ai/streaming';
import { chatLimiter } from '@/lib/middleware/rate-limit';
// TODO(Sprint2): 로그인 UI 완성 후 withAuth 재활성화
// import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';
import { sanitizeChatInput } from '@/lib/security/input-sanitizer';
import { streamChat } from '@/lib/services/chat.service';
import { extractTenantId } from '@/lib/tenant/tenant-middleware';
import { buildTenantContext, runWithTenant } from '@/lib/tenant/tenant-context';
import { createLogger } from '@/lib/logger';
import type { ChatRequest } from '@/types';

const log = createLogger('api.chat');

export const runtime = 'nodejs';

const MAX_MESSAGE_LENGTH = 10_000;

async function chatHandler(req: Request): Promise<Response> {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed, remaining, resetAt } = chatLimiter.check(ip);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        'X-RateLimit-Remaining': String(remaining),
      },
    });
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 입력 정제 (프롬프트 인젝션 방지)
  const sanitized = sanitizeChatInput(body.message ?? '');
  if (!sanitized.safe) {
    return new Response(JSON.stringify({ error: 'Invalid input detected' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const message = sanitized.sanitized;
  if (!message || message.trim() === '') {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const conversationId = body.conversationId ?? crypto.randomUUID();
  const history = body.history ?? [];

  try {
    // Tenant context를 AsyncLocalStorage에 주입하여 하위 호출에서 참조 가능
    const tenantId = extractTenantId(req);
    const tenantCtx = buildTenantContext(tenantId);
    return await runWithTenant(tenantCtx, () =>
      streamChat({ message, conversationId, history, tenantId })
    );
  } catch (err) {
    log.error({ err }, 'Unhandled error in POST /api/chat');
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Internal server error' })}\n\n`,
      { status: 500, headers: SSE_HEADERS }
    );
  }
}

// TODO(Sprint2): 로그인 UI 완성 후 withAuth 재활성화
// export const POST = withAuth(chatHandler, { permissions: ['chat:write'] });
export const POST = chatHandler;
