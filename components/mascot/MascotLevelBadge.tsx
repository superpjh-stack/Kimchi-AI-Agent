'use client';

import { LEVEL_TITLES } from '@/types/mascot';

interface MascotLevelBadgeProps {
  level: number; // 1~5
  xp: number;
}

const LEVEL_COLORS = [
  'bg-green-100 text-green-700 border-green-300',
  'bg-yellow-100 text-yellow-700 border-yellow-300',
  'bg-orange-100 text-orange-700 border-orange-300',
  'bg-red-100 text-red-700 border-red-300',
  'bg-amber-100 text-amber-800 border-amber-400',
];

export default function MascotLevelBadge({ level, xp }: MascotLevelBadgeProps) {
  const idx = Math.min(level - 1, LEVEL_TITLES.length - 1);
  const title = LEVEL_TITLES[idx];
  const colorClass = LEVEL_COLORS[idx];

  return (
    <div
      className={`
        absolute -bottom-1 -right-1
        flex items-center justify-center
        w-5 h-5 rounded-full border text-[9px] font-bold
        ${colorClass}
        cursor-default select-none
      `}
      title={`Lv.${level} ${title} (XP: ${xp})`}
      aria-label={`레벨 ${level} ${title}`}
    >
      {level}
    </div>
  );
}
