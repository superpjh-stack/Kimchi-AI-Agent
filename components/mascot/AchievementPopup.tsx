'use client';

import { useEffect } from 'react';
import type { PendingBadge } from '@/hooks/useMascotAchievements';

interface AchievementPopupProps {
  badge: PendingBadge;
  onDismiss: () => void;
}

export default function AchievementPopup({ badge, onDismiss }: AchievementPopupProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="achievement-popup fixed top-4 left-1/2 -translate-x-1/2 z-[60]
                 flex items-center gap-3 px-4 py-3
                 bg-white border border-amber-300 rounded-xl shadow-lg
                 text-sm font-medium text-amber-800
                 cursor-pointer select-none"
      onClick={onDismiss}
      role="alert"
      aria-live="polite"
      aria-label={`배지 획득: ${badge.name}`}
    >
      <span className="text-2xl">{badge.icon}</span>
      <div>
        <p className="text-xs text-amber-500 font-normal">배지 획득!</p>
        <p>{badge.name}</p>
      </div>
    </div>
  );
}
