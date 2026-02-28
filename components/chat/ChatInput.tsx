'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import VoiceInput from './VoiceInput';

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  isStreaming = false,
  placeholder,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslations('chat');

  const resolvedPlaceholder = placeholder ?? t('placeholder');

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    const maxHeight = 160;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
    textareaRef.current?.focus();
  }, []);

  const canSend = input.trim().length > 0 && !isStreaming;

  return (
    <div className="border-t border-kimchi-beige-dark bg-white px-4 py-3 chat-bottom-padding lg:pb-3">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        {/* Voice Input */}
        <VoiceInput onTranscript={handleVoiceTranscript} disabled={isStreaming} />

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={isStreaming ? 'AI가 응답 중입니다...' : resolvedPlaceholder}
            rows={1}
            aria-label="메시지 입력"
            aria-disabled={isStreaming}
            className={clsx(
              'w-full resize-none rounded-2xl border px-4 py-3 pr-12',
              'text-sm leading-relaxed text-brand-text-primary placeholder-brand-text-muted',
              'focus:outline-none focus:ring-2 focus:ring-kimchi-orange focus:border-transparent',
              'transition-all duration-200',
              'max-h-40 overflow-y-auto',
              {
                'border-kimchi-beige-dark bg-white': !isStreaming,
                'border-kimchi-beige bg-kimchi-cream cursor-not-allowed opacity-70': isStreaming,
              }
            )}
            style={{ height: 'auto', minHeight: '48px' }}
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label={isStreaming ? 'AI 응답 중' : '전송'}
          aria-busy={isStreaming}
          title="전송 (Enter)"
          className={clsx(
            'flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200',
            'min-h-[48px] min-w-[48px]',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-kimchi-orange',
            {
              'bg-kimchi-red text-white hover:bg-kimchi-red-dark shadow-sm': canSend,
              'bg-kimchi-beige text-brand-text-muted cursor-not-allowed': !canSend,
              'opacity-60': isStreaming,
            }
          )}
        >
          {isStreaming ? (
            <span className="flex gap-0.5 items-center" aria-hidden="true">
              <span className="loading-dot w-1.5 h-1.5 bg-brand-text-muted rounded-full" />
              <span className="loading-dot w-1.5 h-1.5 bg-brand-text-muted rounded-full" />
              <span className="loading-dot w-1.5 h-1.5 bg-brand-text-muted rounded-full" />
            </span>
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      <p className="text-center text-xs text-brand-text-muted mt-2">
        {isStreaming ? 'AI가 응답을 생성하고 있습니다...' : 'Enter로 전송 · Shift+Enter로 줄바꿈'}
      </p>
    </div>
  );
}
