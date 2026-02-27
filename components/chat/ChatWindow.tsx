'use client';

import { useEffect, useRef } from 'react';
import { Message, ChatStatus } from '@/types';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import QuickQuestions from './QuickQuestions';
import AiStatusLight from './AiStatusLight';

interface ChatWindowProps {
  messages: Message[];
  isStreaming: boolean;
  chatStatus?: ChatStatus;
  onSend: (message: string) => void;
  conversationId?: string;
}

function WelcomeScreen({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-8 fade-in">
      <div className="text-center mb-8">
        <div className="text-6xl mb-3 animate-float">🌶️</div>
        <h2 className="text-2xl font-bold text-brand-text-primary mb-2">
          김치공장 AI 도우미
        </h2>
        <p className="text-brand-text-secondary text-sm max-w-md leading-relaxed">
          김치공장 운영, 발효 공정, 품질 관리에 대해 무엇이든 물어보세요.
          <br />
          공정 데이터와 레시피를 기반으로 정확한 답변을 드립니다.
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 text-lg">
          <span>🥬</span>
          <span>🧂</span>
          <span>🌡️</span>
          <span>🏭</span>
          <span>🍚</span>
        </div>
      </div>
      <QuickQuestions onSelect={onSelect} />
    </div>
  );
}

export default function ChatWindow({
  messages,
  isStreaming,
  chatStatus = 'idle',
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
    <div className="flex h-full bg-kimchi-cream">
      {/* AI Status Light */}
      <div className="flex-shrink-0 flex flex-col items-center pt-6 px-2 w-20">
        <AiStatusLight status={chatStatus} />
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
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

        {/* Input area */}
        <ChatInput onSend={onSend} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
