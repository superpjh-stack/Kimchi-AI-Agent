'use client';

import { useState, useEffect, useRef } from 'react';
import type { MascotSettings, Badge } from '@/types/mascot';
import { LEVEL_THRESHOLDS } from '@/types/mascot';

interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  check: (s: MascotSettings) => boolean;
}

const BADGE_DEFINITIONS: BadgeDef[] = [
  {
    id: 'first-chat',
    name: '첫 대화',
    icon: '💬',
    check: (s) => (s.counters.chatCount ?? 0) >= 1,
  },
  {
    id: 'first-upload',
    name: '첫 업로드',
    icon: '📄',
    check: (s) => (s.counters.uploadCount ?? 0) >= 1,
  },
  {
    id: 'chatter-10',
    name: '수다쟁이',
    icon: '🗣️',
    check: (s) => (s.counters.chatCount ?? 0) >= 10,
  },
  {
    id: 'clicker-5',
    name: '김치군 팬',
    icon: '🥬',
    check: (s) => (s.counters.clickCount ?? 0) >= 5,
  },
  {
    id: 'level-3',
    name: '양념 장인',
    icon: '⭐',
    check: (s) => s.xp >= LEVEL_THRESHOLDS[2],
  },
  {
    id: 'level-5',
    name: '김치 명인',
    icon: '👑',
    check: (s) => s.xp >= LEVEL_THRESHOLDS[4],
  },
];

export interface PendingBadge {
  id: string;
  name: string;
  icon: string;
}

export function useMascotAchievements(
  settings: MascotSettings,
  updateSettings: (updater: (prev: MascotSettings) => MascotSettings) => void
) {
  const [pendingBadge, setPendingBadge] = useState<PendingBadge | null>(null);
  const checkedRef = useRef<Set<string>>(new Set(settings.badges.map((b) => b.id)));

  useEffect(() => {
    for (const def of BADGE_DEFINITIONS) {
      if (checkedRef.current.has(def.id)) continue;
      if (def.check(settings)) {
        checkedRef.current.add(def.id);
        const newBadge: Badge = {
          id: def.id,
          name: def.name,
          icon: def.icon,
          earnedAt: new Date().toISOString(),
        };
        updateSettings((prev) => ({
          ...prev,
          badges: [...prev.badges, newBadge],
        }));
        setPendingBadge({ id: def.id, name: def.name, icon: def.icon });
        break; // 한 번에 하나씩 표시
      }
    }
  }, [settings, updateSettings]);

  const dismissBadge = () => setPendingBadge(null);

  return { pendingBadge, dismissBadge };
}
