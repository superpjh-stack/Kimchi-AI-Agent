'use client';

import { useEffect, useState } from 'react';
import { Menu, HelpCircle, Wifi, WifiOff, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import type { TabId } from '@/components/layout/BottomNav';
import LocaleSwitcher from '@/components/layout/LocaleSwitcher';
import TenantSelector from '@/components/tenant/TenantSelector';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  title?: string;
  onMenuToggle: () => void;
  questionPanelOpen?: boolean;
  onQuestionPanelToggle?: () => void;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default function Header({
  title = '새 대화',
  onMenuToggle,
  questionPanelOpen = false,
  onQuestionPanelToggle,
  activeTab,
  onTabChange,
}: HeaderProps) {
  const isOnline = useOnlineStatus();
  const t = useTranslations('header');
  const tAuth = useTranslations('auth');
  const tAccessibility = useTranslations('accessibility');
  const { user, isLoading: authLoading, logout } = useAuth();

  const DESKTOP_TABS: { id: TabId; label: string }[] = [
    { id: 'dashboard', label: t('dashboard') },
    { id: 'chat', label: t('chat') },
    { id: 'documents', label: t('documents') },
  ];

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
        aria-label={tAccessibility('menuOpen')}
      >
        <Menu size={20} className="text-brand-text-secondary" />
      </button>

      {/* Title (모바일) / 데스크톱 탭 스위처 */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <h2 className="lg:hidden text-sm font-medium text-brand-text-primary truncate">{title}</h2>
        {/* 데스크톱 탭 스위처 */}
        <div className="hidden lg:flex items-center gap-1" role="tablist" aria-label="메인 탭">
          {DESKTOP_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
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

      {/* Connection status indicator */}
      <div
        className={clsx(
          'hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors',
          isOnline
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        )}
        aria-live="polite"
        aria-label={isOnline ? '인터넷 연결됨' : '인터넷 연결 안 됨'}
      >
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full shrink-0',
            isOnline ? 'bg-green-500' : 'bg-red-500'
          )}
        />
        {isOnline ? (
          <>
            <Wifi size={11} />
            <span>온라인</span>
          </>
        ) : (
          <>
            <WifiOff size={11} />
            <span>오프라인</span>
          </>
        )}
      </div>

      {/* Tenant Selector (FR-45: multi-tenant 시 표시) */}
      <TenantSelector />

      {/* Locale Switcher */}
      <LocaleSwitcher />

      {/* User info + Logout */}
      {!authLoading && user && (
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs text-brand-text-secondary truncate max-w-[120px]">
            {user.name ?? user.email}
          </span>
          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg hover:bg-kimchi-cream text-brand-text-secondary hover:text-kimchi-red transition-colors"
            aria-label={tAuth('logout')}
            title={tAuth('logout')}
          >
            <LogOut size={16} />
          </button>
        </div>
      )}

      {/* Logo badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-kimchi-red/10 rounded-full border border-kimchi-red/20">
        <span className="text-base">🌶️</span>
        <span className="text-xs font-bold text-kimchi-red hidden sm:inline">{t('title')}</span>
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
          aria-label={questionPanelOpen ? tAccessibility('questionListClose') : tAccessibility('questionListOpen')}
          aria-pressed={questionPanelOpen}
        >
          <HelpCircle size={20} />
        </button>
      )}
    </header>
  );
}
