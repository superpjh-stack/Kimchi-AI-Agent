// OpenAI Chat Completions — SSE 스트리밍 (fetch 기반, 별도 패키지 불필요)
import type { DocumentSource, SSEEvent } from '@/types';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
export const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function createOpenAISSEStream(
  messages: ChatMessage[],
  sources?: DocumentSource[]
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  function sse(event: SSEEvent): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const res = await fetch(OPENAI_CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: OPENAI_CHAT_MODEL,
            messages,
            stream: true,
          }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text();
          throw new Error(`OpenAI 오류: ${res.status} ${errText}`);
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            const payload = trimmed.slice(6);
            if (payload === '[DONE]') {
              // 스트리밍 종료
              if (sources && sources.length > 0) {
                controller.enqueue(
                  sse({
                    type: 'sources',
                    documents: sources.map((s) => s.docName),
                    sources,
                  })
                );
              }
              controller.enqueue(
                sse({ type: 'done', messageId: `msg_${Date.now()}`, conversationId: '' })
              );
              continue;
            }

            try {
              const chunk = JSON.parse(payload);
              const token: string = chunk.choices?.[0]?.delta?.content ?? '';
              if (token) {
                controller.enqueue(sse({ type: 'token', content: token }));
              }
            } catch {
              // 파싱 실패 라인 무시
            }
          }
        }
      } catch (err) {
        controller.enqueue(
          sse({
            type: 'error',
            message: err instanceof Error ? err.message : 'OpenAI 연결 실패',
          })
        );
      } finally {
        controller.close();
      }
    },
  });
}
