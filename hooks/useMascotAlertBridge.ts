'use client';

import { useEffect, useRef } from 'react';
import { dispatchMascotEvent } from '@/lib/utils/mascot-event';

/**
 * SSE 공정 알림 수치 → 마스코트 이벤트 브릿지
 * - 500ms debounce: 알림 폭풍 방지
 * - critical > 0  → error 상태 (XP 0, 알림 컨텍스트)
 * - warning > 0   → thinking 상태 (주의 표시)
 * - 둘 다 0       → 이전에 알림이 있었으면 success (정상화 축하)
 */
export function useMascotAlertBridge(
  criticalCount: number,
  warningCount: number,
) {
  const prevCritical = useRef(criticalCount);
  const prevWarning  = useRef(warningCount);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const crit = criticalCount;
    const warn = warningCount;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (crit > 0) {
        dispatchMascotEvent('error', 'alert');
      } else if (warn > 0) {
        dispatchMascotEvent('thinking', 'alert');
      } else if (prevCritical.current > 0 || prevWarning.current > 0) {
        // 경보 해제 → 정상화 축하 (XP +2)
        dispatchMascotEvent(
          'success',
          'alert',
          '공정이 정상화됐어요! 김치가 잘 익고 있어요 🥬',
          2,
        );
      }

      prevCritical.current = crit;
      prevWarning.current  = warn;
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [criticalCount, warningCount]);
}
