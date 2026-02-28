// M2: ChatService — chat/route.ts에서 분리한 비즈니스 로직
// LLM 프로바이더 선택, RAG 검색, 스트리밍, 메시지 영구화 담당

import { anthropic, MODEL, MAX_TOKENS } from '@/lib/ai/claude';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { createSSEStream, SSE_HEADERS } from '@/lib/ai/streaming';
import { createOllamaSSEStream, OLLAMA_MODEL } from '@/lib/ai/ollama';
import { createOpenAISSEStream, OPENAI_CHAT_MODEL } from '@/lib/ai/openai-chat';
import { retrieveContext } from '@/lib/rag/pipeline';
import { createSensorClient } from '@/lib/process/sensor-client';
import { isBkendConfigured, conversationsDb, messagesDb } from '@/lib/db/bkend';
import {
  addMessageToConversation,
  setConversationEntry,
  createConversationEntry,
  conversationStore,
} from '@/lib/db/conversations-store';
import { generateTitle, truncate } from '@/lib/utils/markdown';
import { getTenantContext } from '@/lib/tenant/tenant-context';
import { createLogger } from '@/lib/logger';
import type { Message } from '@/types';

const log = createLogger('services.chat');

const USE_OLLAMA = !!process.env.OLLAMA_BASE_URL;
const USE_OPENAI = !USE_OLLAMA && !!process.env.OPENAI_CHAT_MODEL;

export interface ChatServiceParams {
  message: string;
  conversationId: string;
  history: Message[];
  tenantId?: string;
}

/**
 * RAG 검색 → 시스템 프롬프트 → LLM 스트리밍 → SSE Response 반환.
 * 스트리밍 완료 후 대화 영구화(onComplete)를 자동 처리.
 */
export async function streamChat(params: ChatServiceParams): Promise<Response> {
  const { message, conversationId, history, tenantId } = params;

  // 1. RAG 컨텍스트 + 센서 데이터 병렬 조회
  const [ragResult, sensorData] = await Promise.all([
    retrieveContext(message).catch(() => ({ context: '', sources: [] })),
    createSensorClient().getCurrentData().catch(() => undefined),
  ]);

  // 2. 시스템 프롬프트 구성 (FR-44: tenant별 시스템 프롬프트 지원)
  const tenantCtx = getTenantContext();
  const systemPrompt = buildSystemPrompt(
    ragResult.context,
    sensorData,
    undefined,
    tenantCtx.config.systemPrompt,
  );

  // 3. 메시지 히스토리 (최근 20개 제한)
  const recentHistory = history.slice(-20);
  const anthropicMessages = [
    ...recentHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ];

  const chatMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...anthropicMessages,
  ];

  // 4. 스트리밍 완료 후 메시지 영구화
  const onComplete = async (fullText: string) => {
    try {
      if (isBkendConfigured()) {
        await Promise.all([
          messagesDb
            .create({ conversationId, role: 'user', content: message })
            .catch((e: unknown) => log.error({ err: e }, 'messagesDb.create user 실패')),
          messagesDb
            .create({ conversationId, role: 'assistant', content: fullText, sources: ragResult.sources })
            .catch((e: unknown) => log.error({ err: e }, 'messagesDb.create assistant 실패')),
        ]);
        conversationsDb
          .update(conversationId, {
            lastMessage: truncate(fullText, 50),
            messageCount: history.length + 2,
          })
          .catch(() =>
            conversationsDb
              .create({
                title: generateTitle(message),
                lastMessage: truncate(fullText, 50),
                messageCount: history.length + 2,
              })
              .catch((e: unknown) => log.error({ err: e }, 'conversationsDb.create 실패'))
          );
      } else {
        if (!conversationStore.has(conversationId)) {
          const conv = createConversationEntry(message);
          (conv as { id: string }).id = conversationId;
          setConversationEntry(conversationId, { conversation: conv, messages: [] });
        }
        addMessageToConversation(conversationId, 'user', message);
        addMessageToConversation(conversationId, 'assistant', fullText, ragResult.sources);
      }
    } catch (e) {
      log.error({ err: e }, 'onComplete 영구화 실패');
    }
  };

  // 5. LLM 프로바이더 선택 후 스트림 반환
  let sseStream: ReadableStream<Uint8Array>;

  if (USE_OLLAMA) {
    log.info({ model: OLLAMA_MODEL }, 'Using Ollama');
    sseStream = createOllamaSSEStream(chatMessages, ragResult.sources);
  } else if (USE_OPENAI) {
    log.info({ model: OPENAI_CHAT_MODEL }, 'Using OpenAI');
    sseStream = createOpenAISSEStream(chatMessages, ragResult.sources, onComplete, conversationId);
  } else {
    log.info({ model: MODEL }, 'Using Claude');
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: anthropicMessages,
    });
    sseStream = createSSEStream(stream, ragResult.sources, onComplete, conversationId);
  }

  return new Response(sseStream, { headers: SSE_HEADERS });
}
