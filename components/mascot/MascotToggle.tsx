'use client';

import { useState, useRef, useEffect } from 'react';

interface MascotToggleProps {
  enabled: boolean;
  speechEnabled?: boolean;
  onToggle: () => void;
  onSpeechToggle?: () => void;
}

export default function MascotToggle({
  enabled,
  speechEnabled = true,
  onToggle,
  onSpeechToggle,
}: MascotToggleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (!enabled) {
    return (
      <button
        onClick={onToggle}
        className="w-8 h-8 rounded-full bg-brand-surface border border-brand-border
                   shadow-md flex items-center justify-center
                   text-xs text-brand-text-muted hover:text-brand-text-primary
                   transition-colors"
        aria-label="김치군 켜기"
        title="김치군 켜기"
      >
        🥬
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="w-5 h-5 rounded-full bg-white/80 border border-brand-border
                   shadow-sm flex items-center justify-center
                   text-[10px] hover:bg-white transition-colors"
        aria-label="김치군 설정"
        aria-expanded={menuOpen}
      >
        ···
      </button>

      {menuOpen && (
        <div className="absolute top-6 right-0 bg-white border border-brand-border
                        rounded-lg shadow-lg py-1 min-w-[120px] z-50 text-xs">
          <button
            onClick={() => { onToggle(); setMenuOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-kimchi-cream
                       transition-colors text-brand-text-primary"
          >
            김치군 끄기
          </button>
          {onSpeechToggle && (
            <button
              onClick={() => { onSpeechToggle(); setMenuOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-kimchi-cream
                         transition-colors text-brand-text-primary"
            >
              {speechEnabled ? '대사 끄기' : '대사 켜기'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
