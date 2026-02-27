// B5 + B12: POST /api/chat — Claude 스트리밍 + RAG 통합 (Ollama 폴백 지원)
import { anthropic, MODEL, MAX_TOKENS } from '@/lib/ai/claude';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { createSSEStream, SSE_HEADERS } from '@/lib/ai/streaming';
import { createOllamaSSEStream, OLLAMA_MODEL } from '@/lib/ai/ollama';
import { createOpenAISSEStream, OPENAI_CHAT_MODEL } from '@/lib/ai/openai-chat';
import { retrieveContext } from '@/lib/rag/pipeline';
import { createSensorClient } from '@/lib/process/sensor-client';
import { isBkendConfigured, conversationsDb, messagesDb } from '@/lib/db/bkend';
import { addMessageToConversation } from '@/lib/db/conversations-store';
import { generateTitle, truncate } from '@/lib/utils/markdown';
import type { ChatRequest, Message } from '@/types';

const USE_OLLAMA = !!process.env.OLLAMA_BASE_URL;
const USE_OPENAI = !USE_OLLAMA && !!process.env.OPENAI_CHAT_MODEL;

export const runtime = 'nodejs';

const MAX_MESSAGE_LENGTH = 10_000;

export async function POST(req: Request): Promise<Response> {
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
          messagesDb.create({ conversationId, role: 'user', content: message }).catch(console.error),
          messagesDb.create({ conversationId, role: 'assistant', content: fullText, sources: ragResult.sources }).catch(console.error),
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
          }).catch(console.error)
        );
      } else {
        // 인메모리 폴백
        addMessageToConversation(conversationId, 'assistant', fullText, ragResult.sources);
      }
    };

    if (USE_OLLAMA) {
      console.log(`[/api/chat] Using Ollama model: ${OLLAMA_MODEL}`);
      sseStream = createOllamaSSEStream(chatMessages, ragResult.sources);
    } else if (USE_OPENAI) {
      console.log(`[/api/chat] Using OpenAI model: ${OPENAI_CHAT_MODEL}`);
      sseStream = createOpenAISSEStream(chatMessages, ragResult.sources);
    } else {
      console.log(`[/api/chat] Using Claude model: ${MODEL}`);
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
    console.error('[/api/chat] Error:', err);
    const errorEvent = `data: ${JSON.stringify({ type: 'error', message: 'Internal server error' })}\n\n`;

    return new Response(errorEvent, {
      status: 500,
      headers: SSE_HEADERS,
    });
  }
}
