'use client';

import { useEffect } from 'react';
import type { MascotState, MascotEventDetail } from '@/types/mascot';

/**
 * 글로벌 CustomEvent('kimchi-mascot')를 수신하여 마스코트 상태를 변경하는 훅.
 * 기존 비즈니스 로직 코드에서는 아래처럼 이벤트만 발행하면 된다:
 *
 * window.dispatchEvent(new CustomEvent('kimchi-mascot', {
 *   detail: { state: 'thinking', context: 'chat' }
 * }));
 */
export function useMascotTrigger(
  onStateChange: (state: MascotState, forcedPhrase?: string) => void,
  onXpGain?: (amount: number, context: string) => void
) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<MascotEventDetail>).detail;
      if (detail?.state) {
        onStateChange(detail.state, detail.forcedPhrase);
      }
      if (detail?.xpReward && onXpGain) {
        onXpGain(detail.xpReward, detail.context ?? 'system');
      }
    };

    window.addEventListener('kimchi-mascot', handler);
    return () => window.removeEventListener('kimchi-mascot', handler);
  }, [onStateChange, onXpGain]);
}
