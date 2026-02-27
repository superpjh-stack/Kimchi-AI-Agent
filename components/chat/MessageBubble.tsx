'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import clsx from 'clsx';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === 'user';
  const hasSources = message.sources && message.sources.length > 0;

  return (
    <div
      className={clsx(
        'flex w-full mb-4',
        isUser ? 'justify-end message-user' : 'justify-start message-assistant'
      )}
    >
      {/* Avatar — assistant only */}
      {!isUser && (
        <div className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-full bg-kimchi-red flex items-center justify-center text-white text-xs md:text-sm font-bold mr-2 mt-0.5 shadow-sm">
          🌶️
        </div>
      )}

      <div className={clsx('max-w-[90%] md:max-w-[80%] lg:max-w-[70%]', isUser ? 'items-end' : 'items-start', 'flex flex-col')}>
        {/* Bubble */}
        <div
          className={clsx(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-kimchi-red text-white rounded-br-sm shadow-sm'
              : 'bg-white border border-kimchi-beige-dark text-brand-text-primary rounded-bl-sm shadow-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className={clsx('markdown-content', isStreaming && 'streaming-cursor')}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || ''}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {hasSources && (
          <div className="mt-1 w-full">
            <button
              onClick={() => setSourcesOpen((o) => !o)}
              className="flex items-center gap-1 text-xs text-brand-text-muted hover:text-brand-text-secondary transition-colors"
            >
              <FileText size={12} />
              <span>출처 {message.sources!.length}개</span>
              {sourcesOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {sourcesOpen && (
              <div className="mt-1 space-y-1 animate-fade-in">
                {message.sources!.map((src, i) => (
                  <div
                    key={`${src.docId}-${i}`}
                    className="text-xs bg-kimchi-cream border border-kimchi-beige-dark rounded-lg px-2 py-1.5 md:px-3 md:py-2"
                  >
                    <p className="font-medium text-brand-text-secondary mb-0.5 truncate">📄 {src.docName}</p>
                    <p className="text-brand-text-muted line-clamp-1 md:line-clamp-2">{src.chunkText}</p>
                    <p className="text-brand-text-muted/60 mt-0.5">{(src.score * 100).toFixed(0)}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-brand-text-muted mt-1 px-1">
          {new Date(message.createdAt).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
