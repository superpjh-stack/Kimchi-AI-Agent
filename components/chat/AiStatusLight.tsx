'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { ChatStatus } from '@/types';

interface AiStatusLightProps {
  status: ChatStatus;
}

const STAGES = [
  { key: 'rag-searching', label: 'RAG 검색', emoji: '🥬', color: 'bg-kimchi-orange', glow: 'shadow-kimchi-orange/50' },
  { key: 'llm-generating', label: 'LLM 생성', emoji: '🌶️', color: 'bg-kimchi-green', glow: 'shadow-kimchi-green/50' },
  { key: 'done', label: '완료', emoji: '🫙', color: 'bg-kimchi-green-dark', glow: 'shadow-kimchi-green/50' },
] as const;

type StageKey = (typeof STAGES)[number]['key'];

function getActiveStageIndex(status: ChatStatus): number {
  if (status === 'rag-searching') return 0;
  if (status === 'llm-generating') return 1;
  if (status === 'done') return 2;
  return -1;
}

export default function AiStatusLight({ status }: AiStatusLightProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== 'idle') {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 600);
      return () => clearTimeout(t);
    }
  }, [status]);

  const activeIdx = getActiveStageIndex(status);
  const isError = status === 'error';

  if (!visible && status === 'idle') return null;

  return (
    <div
      className={clsx(
        'transition-opacity duration-500',
        status === 'idle' ? 'opacity-0' : 'opacity-100'
      )}
    >
      {/* Traffic light panel — warm dark brown */}
      <div className="flex flex-col items-center gap-1 bg-[#2D1810] rounded-2xl px-3 py-4 shadow-xl border border-[#4A3228] w-16">
        {/* Top label */}
        <span className="text-[9px] text-kimchi-beige/60 font-medium tracking-wide mb-1">AI</span>

        {/* 3 light dots */}
        {STAGES.map((stage, idx) => {
          const isActive = !isError && idx === activeIdx;
          const isPast = !isError && idx < activeIdx;

          return (
            <div key={stage.key} className="relative flex flex-col items-center">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                  isError && 'bg-kimchi-red shadow-lg shadow-kimchi-red/40',
                  isActive && `${stage.color} shadow-lg ${stage.glow} scale-110`,
                  isPast && 'bg-[#4A3228] opacity-60',
                  !isActive && !isPast && !isError && 'bg-[#3A2418] opacity-40'
                )}
              >
                {isActive && (
                  <span className="text-base leading-none animate-pulse">
                    {stage.emoji}
                  </span>
                )}
                {isPast && (
                  <span className="text-xs text-kimchi-beige/60">✓</span>
                )}
                {isError && idx === 0 && (
                  <span className="text-base leading-none">❌</span>
                )}
              </div>

              {/* Connector line (except last) */}
              {idx < STAGES.length - 1 && (
                <div
                  className={clsx(
                    'w-0.5 h-2 mt-0.5 rounded-full transition-colors duration-300',
                    isPast ? 'bg-[#6B4F3A]' : 'bg-[#3A2418]'
                  )}
                />
              )}
            </div>
          );
        })}

        {/* Status text */}
        <div className="mt-2 text-center">
          {isError ? (
            <span className="text-[9px] text-kimchi-red font-medium">오류</span>
          ) : activeIdx >= 0 ? (
            <span className="text-[9px] text-kimchi-beige/70 font-medium leading-tight block">
              {STAGES[activeIdx].label}
            </span>
          ) : null}
        </div>
      </div>

      {/* Current stage tooltip */}
      {!isError && activeIdx >= 0 && (
        <div className="mt-2 bg-[#2D1810] rounded-lg px-2 py-1.5 text-center w-16 border border-[#4A3228]">
          <p className="text-[9px] text-kimchi-beige/60 leading-tight">
            {activeIdx === 0 && '문서\n검색 중'}
            {activeIdx === 1 && 'AI\n답변 중'}
            {activeIdx === 2 && '생성\n완료'}
          </p>
        </div>
      )}
    </div>
  );
}
