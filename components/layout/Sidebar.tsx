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

  const groups: { label: string; items: Conversation[] }[] = [
    { label: '오늘', items: [] },
    { label: '어제', items: [] },
    { label: '이번 주', items: [] },
    { label: '이전', items: [] },
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
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-64 lg:w-72">
      {/* Header / Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥬</span>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-gray-900 text-base leading-tight">김치 Agent</h1>
              <AlertBadge criticalCount={criticalAlerts} warningCount={warningAlerts} />
            </div>
            <p className="text-xs text-gray-400">김치공장 AI 어시스턴트</p>
          </div>
        </div>
        {/* Mobile close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
          새 대화
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={32} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">대화 기록이 없습니다</p>
            <p className="text-xs text-gray-300 mt-1">새 대화를 시작해보세요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-1">
                  {group.label}
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
                          'bg-red-50 text-kimchi-red': activeId === conv.id,
                          'text-gray-700 hover:bg-gray-50': activeId !== conv.id,
                        }
                      )}
                    >
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
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
      <div className="border-t border-gray-100 px-2 py-3 space-y-0.5">
        <Link
          href="/documents"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors text-sm"
        >
          <FileText size={16} />
          문서 관리
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors text-sm"
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
