'use client';

import { Menu, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

interface HeaderProps {
  title?: string;
  onMenuToggle: () => void;
  questionPanelOpen?: boolean;
  onQuestionPanelToggle?: () => void;
}

export default function Header({
  title = '새 대화',
  onMenuToggle,
  questionPanelOpen = false,
  onQuestionPanelToggle,
}: HeaderProps) {
  return (
    <header
      className="flex items-center gap-3 px-4 border-b border-gray-200 bg-white"
      style={{ height: 'var(--header-height, 60px)' }}
    >
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="lg:hidden flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="메뉴 열기"
      >
        <Menu size={20} className="text-gray-600" />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-medium text-gray-800 truncate">{title}</h2>
      </div>

      {/* Logo badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-kimchi-red bg-opacity-10 rounded-full">
        <span className="text-sm">🥬</span>
        <span className="text-xs font-semibold text-kimchi-red">김치 Agent</span>
      </div>

      {/* Question panel toggle — desktop */}
      {onQuestionPanelToggle && (
        <button
          type="button"
          onClick={onQuestionPanelToggle}
          className={clsx(
            'hidden lg:flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors',
            questionPanelOpen
              ? 'bg-kimchi-green bg-opacity-10 text-kimchi-green'
              : 'hover:bg-gray-100 text-gray-600'
          )}
          aria-label="질문 목록 열기"
          aria-pressed={questionPanelOpen}
        >
          <HelpCircle size={20} />
        </button>
      )}
    </header>
  );
}
