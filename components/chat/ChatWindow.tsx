'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Message, ChatStatus } from '@/types';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import QuickQuestions from './QuickQuestions';
import AiStatusLight from './AiStatusLight';

interface TtsControls {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  voiceMode: boolean;
  setVoiceMode: (on: boolean) => void;
}

interface ChatWindowProps {
  messages: Message[];
  isStreaming: boolean;
  chatStatus?: ChatStatus;
  onSend: (message: string) => void;
  conversationId?: string;
  tts?: TtsControls;
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
  tts,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | undefined>();
  const prevIsStreamingRef = useRef(isStreaming);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  // Clear speakingMessageId when TTS stops
  useEffect(() => {
    if (tts && !tts.isSpeaking) {
      setSpeakingMessageId(undefined);
    }
  }, [tts?.isSpeaking]);

  // Auto TTS: when streaming completes, read last assistant message if voiceMode is on
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;

    if (wasStreaming && !isStreaming && tts?.voiceMode && tts.isSupported) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
        setSpeakingMessageId(lastMsg.id);
        tts.speak(lastMsg.content);
      }
    }
  }, [isStreaming, messages, tts]);

  // Stop TTS when new streaming starts
  useEffect(() => {
    if (isStreaming && tts?.isSpeaking) {
      tts.stop();
      setSpeakingMessageId(undefined);
    }
  }, [isStreaming]);

  const handleSpeak = useCallback((messageId: string, text: string) => {
    if (!tts) return;
    setSpeakingMessageId(messageId);
    tts.speak(text);
  }, [tts]);

  const handleStopSpeaking = useCallback(() => {
    if (!tts) return;
    tts.stop();
    setSpeakingMessageId(undefined);
  }, [tts]);

  const handleVoiceModeToggle = useCallback(() => {
    if (!tts) return;
    if (tts.voiceMode && tts.isSpeaking) {
      tts.stop();
      setSpeakingMessageId(undefined);
    }
    tts.setVoiceMode(!tts.voiceMode);
  }, [tts]);

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
                    onSpeak={tts?.isSupported ? (text) => handleSpeak(message.id, text) : undefined}
                    onStopSpeaking={handleStopSpeaking}
                    speakingMessageId={speakingMessageId}
                  />
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <ChatInput
          onSend={onSend}
          isStreaming={isStreaming}
          voiceMode={tts?.voiceMode}
          onVoiceModeToggle={tts ? handleVoiceModeToggle : undefined}
          isTtsSupported={tts?.isSupported}
        />
      </div>
    </div>
  );
}
