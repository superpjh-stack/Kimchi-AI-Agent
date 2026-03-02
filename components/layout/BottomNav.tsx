'use client';

import { LayoutDashboard, MessageSquare, List, FileText, HelpCircle } from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';

export type TabId = 'dashboard' | 'chat' | 'conversations' | 'documents' | 'questions';

interface BottomNavProps {
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  onConversationsOpen?: () => void;
  onQuestionsOpen?: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard' as const, labelKey: 'dashboard', Icon: LayoutDashboard },
  { id: 'chat' as const, labelKey: 'chat', Icon: MessageSquare },
  { id: 'conversations' as const, labelKey: 'conversations', Icon: List },
  { id: 'documents' as const, labelKey: 'documents', Icon: FileText },
  { id: 'questions' as const, labelKey: 'questions', Icon: HelpCircle },
];

export default function BottomNav({
  activeTab = 'chat',
  onTabChange,
  onConversationsOpen,
  onQuestionsOpen,
}: BottomNavProps) {
  const t = useTranslations('nav');

  const handleClick = (id: TabId) => {
    onTabChange?.(id);
    if (id === 'conversations') onConversationsOpen?.();
    if (id === 'questions') onQuestionsOpen?.();
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-kimchi-beige-dark safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map(({ id, labelKey, Icon }) => {
          const label = t(labelKey);
          return (
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
          );
        })}
      </div>
    </nav>
  );
}
