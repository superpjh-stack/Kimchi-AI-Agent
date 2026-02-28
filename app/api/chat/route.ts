// B5 + B12: POST /api/chat — Claude 스트리밍 + RAG 통합 (Ollama 폴백 지원)
import { anthropic, MODEL, MAX_TOKENS } from '@/lib/ai/claude';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { createSSEStream, SSE_HEADERS } from '@/lib/ai/streaming';
import { createOllamaSSEStream, OLLAMA_MODEL } from '@/lib/ai/ollama';
import { createOpenAISSEStream, OPENAI_CHAT_MODEL } from '@/lib/ai/openai-chat';
import { retrieveContext } from '@/lib/rag/pipeline';
import { createSensorClient } from '@/lib/process/sensor-client';
import { isBkendConfigured, conversationsDb, messagesDb } from '@/lib/db/bkend';
import { addMessageToConversation, setConversationEntry, createConversationEntry, conversationStore } from '@/lib/db/conversations-store';
import { generateTitle, truncate } from '@/lib/utils/markdown';
import { createLogger } from '@/lib/logger';
import { chatLimiter } from '@/lib/middleware/rate-limit';
import type { ChatRequest, Message } from '@/types';

const log = createLogger('api.chat');

const USE_OLLAMA = !!process.env.OLLAMA_BASE_URL;
const USE_OPENAI = !USE_OLLAMA && !!process.env.OPENAI_CHAT_MODEL;

export const runtime = 'nodejs';

const MAX_MESSAGE_LENGTH = 10_000;

export async function POST(req: Request): Promise<Response> {
  // S4-4: Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed, remaining: rlRemaining, resetAt } = chatLimiter.check(ip);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        'X-RateLimit-Remaining': String(rlRemaining),
      },
    });
  }

  let body: ChatRequest;

  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { message, history = [] } = body;
  // A3: conversationId가 없으면 새 UUID 생성 (SSE done 이벤트에서 항상 유효한 ID 반환)
  const conversationId = body.conversationId ?? crypto.randomUUID();

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return new Response(
      JSON.stringify({ error: 'message is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. RAG 컨텍스트 + 센서 데이터 병렬 조회
    const [ragResult, sensorData] = await Promise.all([
      retrieveContext(message).catch(() => ({ context: '', sources: [] })),
      createSensorClient().getCurrentData().catch(() => undefined),
    ]);

    // 2. 시스템 프롬프트 구성 (RAG + 실시간 센서 데이터 주입)
    const systemPrompt = buildSystemPrompt(ragResult.context, sensorData);

    // 3. 메시지 히스토리 변환 (최근 20개 제한)
    const recentHistory: Message[] = history.slice(-20);
    const anthropicMessages = [
      ...recentHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // 4. LLM 스트리밍 호출 (Ollama 또는 Claude)
    let sseStream: ReadableStream<Uint8Array>;

    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...anthropicMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // 5. 메시지 저장 콜백 (스트리밍 완료 후 실행)
    const onComplete = async (fullText: string) => {
      if (isBkendConfigured()) {
        // bkend.ai에 사용자 메시지 + AI 응답 저장
        await Promise.all([
          messagesDb.create({ conversationId, role: 'user', content: message }).catch((e: unknown) => log.error({ err: e }, 'messagesDb.create user failed')),
          messagesDb.create({ conversationId, role: 'assistant', content: fullText, sources: ragResult.sources }).catch((e: unknown) => log.error({ err: e }, 'messagesDb.create assistant failed')),
        ]);
        // 대화 메타데이터 갱신 (없으면 새로 생성)
        conversationsDb.update(conversationId, {
          lastMessage: truncate(fullText, 50),
          messageCount: (history.length + 2),
        }).catch(() =>
          // 대화가 없으면 새로 생성
          conversationsDb.create({
            title: generateTitle(message),
            lastMessage: truncate(fullText, 50),
            messageCount: history.length + 2,
          }).catch((e: unknown) => log.error({ err: e }, 'conversationsDb.create failed'))
        );
      } else {
        // 파일 저장소 폴백 — 대화가 없으면 새로 생성 후 저장
        if (!conversationStore.has(conversationId)) {
          const conv = createConversationEntry(message);
          // 전달받은 conversationId 사용
          (conv as { id: string }).id = conversationId;
          setConversationEntry(conversationId, { conversation: conv, messages: [] });
        }
        addMessageToConversation(conversationId, 'user', message);
        addMessageToConversation(conversationId, 'assistant', fullText, ragResult.sources);
      }
    };

    if (USE_OLLAMA) {
      log.info({ model: OLLAMA_MODEL }, 'Using Ollama model');
      sseStream = createOllamaSSEStream(chatMessages, ragResult.sources);
    } else if (USE_OPENAI) {
      log.info({ model: OPENAI_CHAT_MODEL }, 'Using OpenAI model');
      sseStream = createOpenAISSEStream(chatMessages, ragResult.sources, onComplete, conversationId);
    } else {
      log.info({ model: MODEL }, 'Using Claude model');
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: anthropicMessages,
      });
      sseStream = createSSEStream(stream, ragResult.sources, onComplete, conversationId);
    }

    return new Response(sseStream, { headers: SSE_HEADERS });
  } catch (err) {
    log.error({ err }, 'Unhandled error in POST /api/chat');
    const errorEvent = `data: ${JSON.stringify({ type: 'error', message: 'Internal server error' })}\n\n`;

    return new Response(errorEvent, {
      status: 500,
      headers: SSE_HEADERS,
    });
  }
}
