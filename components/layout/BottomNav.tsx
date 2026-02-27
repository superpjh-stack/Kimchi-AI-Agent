'use client';

import { LayoutDashboard, MessageSquare, List, FileText, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

export type TabId = 'dashboard' | 'chat' | 'conversations' | 'documents' | 'questions';

interface BottomNavProps {
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  onConversationsOpen?: () => void;
  onQuestionsOpen?: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard' as const, label: '대시보드', Icon: LayoutDashboard },
  { id: 'chat' as const, label: '채팅', Icon: MessageSquare },
  { id: 'conversations' as const, label: '대화목록', Icon: List },
  { id: 'documents' as const, label: '문서', Icon: FileText },
  { id: 'questions' as const, label: '질문', Icon: HelpCircle },
];

export default function BottomNav({
  activeTab = 'chat',
  onTabChange,
  onConversationsOpen,
  onQuestionsOpen,
}: BottomNavProps) {
  const handleClick = (id: TabId) => {
    onTabChange?.(id);
    if (id === 'conversations') onConversationsOpen?.();
    if (id === 'questions') onQuestionsOpen?.();
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-kimchi-beige-dark safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleClick(id)}
            className={clsx(
              'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
              'min-h-[44px] min-w-[44px]',
              'transition-colors duration-150',
              activeTab === id
                ? id === 'questions' ? 'text-kimchi-green' : 'text-kimchi-red'
                : 'text-brand-text-muted hover:text-brand-text-secondary'
            )}
            aria-label={label}
          >
            <Icon size={20} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
