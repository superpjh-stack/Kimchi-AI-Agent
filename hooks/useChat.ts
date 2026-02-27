'use client';

import { useState, useCallback, useRef } from 'react';
import type { Message, SSEEvent, ChatStatus } from '@/types';

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat(conversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatStatus, setChatStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      setError(null);

      // Add user message immediately
      const userMsg: Message = {
        id: makeId(),
        role: 'user',
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);

      // Placeholder for streaming assistant message
      const assistantId = makeId();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
          isStreaming: true,
        },
      ]);

      setIsStreaming(true);
      setChatStatus('rag-searching');
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      abortRef.current = new AbortController();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content.trim(),
            conversationId,
            history: messages.slice(-20),
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`서버 오류: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr) as SSEEvent;

              if (event.type === 'token') {
                setChatStatus((prev) => prev === 'rag-searching' ? 'llm-generating' : prev);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                );
              } else if (event.type === 'sources') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, sources: event.sources }
                      : m
                  )
                );
              } else if (event.type === 'done') {
                setChatStatus('done');
                doneTimerRef.current = setTimeout(() => setChatStatus('idle'), 1500);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m
                  )
                );
              } else if (event.type === 'error') {
                throw new Error(event.message);
              }
            } catch (parseErr) {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        setError(msg);
        setChatStatus('error');
        doneTimerRef.current = setTimeout(() => setChatStatus('idle'), 2000);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `오류가 발생했습니다: ${msg}`, isStreaming: false }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming, conversationId]
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    setChatStatus('idle');
  }, []);

  return { messages, isStreaming, chatStatus, error, sendMessage, clearMessages };
}
