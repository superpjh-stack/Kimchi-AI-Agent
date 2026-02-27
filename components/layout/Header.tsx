'use client';

import { Menu, HelpCircle } from 'lucide-react';
import clsx from 'clsx';
import type { TabId } from '@/components/layout/BottomNav';

interface HeaderProps {
  title?: string;
  onMenuToggle: () => void;
  questionPanelOpen?: boolean;
  onQuestionPanelToggle?: () => void;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

const DESKTOP_TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'chat', label: '채팅' },
  { id: 'documents', label: '문서' },
];

export default function Header({
  title = '새 대화',
  onMenuToggle,
  questionPanelOpen = false,
  onQuestionPanelToggle,
  activeTab,
  onTabChange,
}: HeaderProps) {
  return (
    <header
      className="flex items-center gap-3 px-4 border-b border-kimchi-beige-dark bg-white"
      style={{ height: 'var(--header-height, 64px)' }}
    >
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="lg:hidden flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-kimchi-cream transition-colors"
        aria-label="메뉴 열기"
      >
        <Menu size={20} className="text-brand-text-secondary" />
      </button>

      {/* Title (모바일) / 데스크톱 탭 스위처 */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <h2 className="lg:hidden text-sm font-medium text-brand-text-primary truncate">{title}</h2>
        {/* 데스크톱 탭 스위처 */}
        <div className="hidden lg:flex items-center gap-1">
          {DESKTOP_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange?.(id)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                activeTab === id
                  ? 'bg-kimchi-red/10 text-kimchi-red'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Logo badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-kimchi-red/10 rounded-full border border-kimchi-red/20">
        <span className="text-base">🌶️</span>
        <span className="text-xs font-bold text-kimchi-red">김치공장 AI 도우미</span>
      </div>

      {/* Question panel toggle — desktop */}
      {onQuestionPanelToggle && (
        <button
          type="button"
          onClick={onQuestionPanelToggle}
          className={clsx(
            'hidden lg:flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors',
            questionPanelOpen
              ? 'bg-kimchi-green/10 text-kimchi-green'
              : 'hover:bg-kimchi-cream text-brand-text-secondary'
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
