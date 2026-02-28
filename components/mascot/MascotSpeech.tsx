'use client';

import { useEffect, useState } from 'react';

interface MascotSpeechProps {
  text: string;
  emoji?: string;
  /** 표시 지속 시간 (ms) */
  duration?: number;
  onDismiss: () => void;
}

export default function MascotSpeech({
  text,
  emoji,
  duration = 3500,
  onDismiss,
}: MascotSpeechProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setIsExiting(true), duration - 300);
    const dismissTimer = setTimeout(onDismiss, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);

  return (
    <div
      className={`
        relative max-w-[180px] px-3 py-2 rounded-xl
        bg-white border border-brand-border shadow-lg
        text-sm text-brand-text-primary font-medium leading-snug
        ${isExiting ? 'mascot-speech--exit' : 'mascot-speech--enter'}
      `}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="break-keep">
        {text}
        {emoji && <span className="ml-1">{emoji}</span>}
      </p>
      {/* 말풍선 꼬리 (아래 방향) */}
      <div className="absolute -bottom-1.5 right-4 w-3 h-3
                      bg-white border-r border-b border-brand-border
                      transform rotate-45" />
    </div>
  );
}
