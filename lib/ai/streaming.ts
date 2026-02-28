// B3: SSE 스트리밍 유틸리티
import type { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import type { DocumentSource, SSEEvent } from '@/types';

/**
 * Format a single SSE event as a string.
 * Format: "data: {json}\n\n"
 */
export function sendSSEEvent(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Create a ReadableStream that wraps an Anthropic MessageStream
 * and emits SSE-formatted events for tokens, sources, done, and errors.
 *
 * SSE event types:
 *  - token:   {"type":"token","content":"..."}
 *  - sources: {"type":"sources","documents":[...],"sources":[...]}
 *  - done:    {"type":"done","messageId":"...","conversationId":""}
 *  - error:   {"type":"error","message":"..."}
 */
export function createSSEStream(
  anthropicStream: MessageStream,
  sources?: DocumentSource[],
  onComplete?: (fullText: string) => void,
  conversationId?: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = '';

      // Keep-alive ping every 15 seconds to prevent connection timeouts
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // Stream may already be closed; ignore enqueue errors
        }
      }, 15_000);

      try {
        // MessageStream is an EventEmitter AND AsyncIterable.
        // Iterating yields MessageStreamEvent objects.
        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const token = event.delta.text;
            fullText += token;

            const sseEvent: SSEEvent = { type: 'token', content: token };
            controller.enqueue(encoder.encode(sendSSEEvent(sseEvent)));
          }
        }

        // Send sources after streaming completes
        if (sources && sources.length > 0) {
          const sourcesEvent: SSEEvent = {
            type: 'sources',
            documents: sources.map((s) => s.docName),
            sources,
          };
          controller.enqueue(encoder.encode(sendSSEEvent(sourcesEvent)));
        }

        // Send done event
        const doneEvent: SSEEvent = {
          type: 'done',
          messageId: `msg_${crypto.randomUUID()}`,
          conversationId: conversationId ?? '',
        };
        controller.enqueue(encoder.encode(sendSSEEvent(doneEvent)));

        onComplete?.(fullText);
      } catch (err) {
        const errorEvent: SSEEvent = {
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown streaming error',
        };
        controller.enqueue(encoder.encode(sendSSEEvent(errorEvent)));
      } finally {
        clearInterval(keepAlive);
        controller.close();
      }
    },
  });
}

/**
 * Standard SSE response headers.
 */
export const SSE_HEADERS: HeadersInit = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};
