'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Plus, FileText, Settings, MessageSquare, X } from 'lucide-react';
import { Conversation } from '@/types';
import AlertBadge from '@/components/process/AlertBadge';

interface SidebarProps {
  conversations: Conversation[];
  activeId?: string;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  criticalAlerts?: number;
  warningAlerts?: number;
}

function groupConversationsByDate(conversations: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; emoji: string; items: Conversation[] }[] = [
    { label: '오늘', emoji: '🌶️', items: [] },
    { label: '어제', emoji: '🥬', items: [] },
    { label: '이번 주', emoji: '🍚', items: [] },
    { label: '이전', emoji: '🏭', items: [] },
  ];

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    if (date >= today) {
      groups[0].items.push(conv);
    } else if (date >= yesterday) {
      groups[1].items.push(conv);
    } else if (date >= weekAgo) {
      groups[2].items.push(conv);
    } else {
      groups[3].items.push(conv);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function Sidebar({
  conversations,
  activeId,
  onNewChat,
  onSelectConversation,
  isOpen = true,
  onClose,
  criticalAlerts = 0,
  warningAlerts = 0,
}: SidebarProps) {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const groups = groupConversationsByDate(conversations);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-kimchi-beige-dark w-64 lg:w-72">
      {/* Header / Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-kimchi-beige bg-kimchi-cream">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-kimchi-red flex items-center justify-center shadow-sm">
            <span className="text-xl">🌶️</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-brand-text-primary text-base leading-tight">김치공장 AI</h1>
              <AlertBadge criticalCount={criticalAlerts} warningCount={warningAlerts} />
            </div>
            <p className="text-xs text-brand-text-muted">김치 제조 전문 도우미 🥬</p>
          </div>
        </div>
        {/* Mobile close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text-secondary hover:bg-kimchi-beige transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <div className="px-3 py-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl
            bg-kimchi-red text-white font-medium text-sm
            hover:bg-kimchi-red-dark transition-colors shadow-sm"
        >
          <Plus size={16} />
          새 대화 시작하기
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3 animate-float">🥬</div>
            <p className="text-sm text-brand-text-secondary font-medium">아직 대화가 없어요</p>
            <p className="text-xs text-brand-text-muted mt-1">김치에 대해 무엇이든 물어보세요!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-brand-text-muted tracking-wider px-3 py-1 flex items-center gap-1.5">
                  <span>{group.emoji}</span>
                  <span>{group.label}</span>
                </p>
                <div className="space-y-0.5">
                  {group.items.map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => onSelectConversation(conv.id)}
                      className={clsx(
                        'w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 group',
                        {
                          'bg-kimchi-red/10 text-kimchi-red border border-kimchi-red/20': activeId === conv.id,
                          'text-brand-text-primary hover:bg-kimchi-cream': activeId !== conv.id,
                        }
                      )}
                    >
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-brand-text-muted truncate mt-0.5">
                        {conv.lastMessage}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Links */}
      <div className="border-t border-kimchi-beige px-2 py-3 space-y-0.5 bg-kimchi-cream/50">
        <Link
          href="/documents"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-brand-text-secondary hover:bg-kimchi-beige hover:text-brand-text-primary transition-colors text-sm"
        >
          <FileText size={16} />
          문서 관리
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-brand-text-secondary hover:bg-kimchi-beige hover:text-brand-text-primary transition-colors text-sm"
        >
          <Settings size={16} />
          설정
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile/Tablet overlay sidebar */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 sidebar-overlay"
            onClick={onClose}
          />
          {/* Sidebar panel */}
          <div className="relative z-10 animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
