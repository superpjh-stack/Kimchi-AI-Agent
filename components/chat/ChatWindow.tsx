'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/types';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import QuickQuestions from './QuickQuestions';

interface ChatWindowProps {
  messages: Message[];
  isStreaming: boolean;
  onSend: (message: string) => void;
  conversationId?: string;
}

function WelcomeScreen({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-8 fade-in">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🥬</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">김치 Agent에 오신 것을 환영합니다</h2>
        <p className="text-gray-500 text-sm max-w-md">
          김치공장 운영, 발효 공정, 품질 관리에 대해 무엇이든 물어보세요.
          <br />
          공정 데이터와 레시피를 기반으로 정확한 답변을 드립니다.
        </p>
      </div>
      <QuickQuestions onSelect={onSelect} />
    </div>
  );
}

export default function ChatWindow({
  messages,
  isStreaming,
  onSend,
  conversationId,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto chat-messages-container"
      >
        {isEmpty ? (
          <WelcomeScreen onSelect={onSend} />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-2">
            {messages.map((message, index) => {
              const isLastMessage = index === messages.length - 1;
              const isStreamingThis =
                isStreaming && isLastMessage && message.role === 'assistant';
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={isStreamingThis}
                />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Quick questions when chat is not empty but could still be helpful */}
      {/* Input area */}
      <ChatInput onSend={onSend} isStreaming={isStreaming} />
    </div>
  );
}
