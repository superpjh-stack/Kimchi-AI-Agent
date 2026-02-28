import type { MascotState, MascotContext, MascotEventDetail } from '@/types/mascot';

/**
 * 마스코트 상태 변경 이벤트를 발행하는 유틸리티.
 * 서버 사이드에서 호출되어도 안전 (window 체크).
 */
export function dispatchMascotEvent(
  state: MascotState,
  context?: MascotContext,
  forcedPhrase?: string
): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<MascotEventDetail>('kimchi-mascot', {
      detail: { state, context, forcedPhrase },
    })
  );
}
