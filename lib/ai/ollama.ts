// Ollama 로컬 LLM 클라이언트
// Ollama API: POST /api/chat (NDJSON streaming)
// → 프론트엔드가 기대하는 SSE 포맷으로 변환
import type { DocumentSource, SSEEvent } from '@/types';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChunk {
  model: string;
  message: { role: string; content: string };
  done: boolean;
}

export function createOllamaSSEStream(
  messages: OllamaMessage[],
  sources?: DocumentSource[]
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  function sse(event: SSEEvent): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages,
            stream: true,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Ollama 오류: ${res.status} ${await res.text()}`);
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
            if (!trimmed) continue;

            const chunk: OllamaChunk = JSON.parse(trimmed);
            const token = chunk.message?.content ?? '';

            if (token) {
              controller.enqueue(sse({ type: 'token', content: token }));
            }

            if (chunk.done) {
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
            }
          }
        }
      } catch (err) {
        controller.enqueue(
          sse({
            type: 'error',
            message: err instanceof Error ? err.message : 'Ollama 연결 실패',
          })
        );
      } finally {
        controller.close();
      }
    },
  });
}
