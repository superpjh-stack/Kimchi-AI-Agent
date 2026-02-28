/** 마스코트 감정 상태 */
export type MascotState =
  | 'idle'        // 기본 대기 — 숨쉬기 애니메이션
  | 'thinking'    // AI 처리 중 — 좌우 흔들림
  | 'success'     // 응답 완료 — 폴짝 점프
  | 'error'       // 오류 발생 — 당황 표현
  | 'celebrating' // 문서 업로드 완료 — 환호
  | 'searching'   // RAG 검색 중 — 두리번
  | 'sleeping';   // 야간 모드 — 졸음

/** 마스코트 이벤트 컨텍스트 */
export type MascotContext =
  | 'chat'    // 채팅 관련
  | 'upload'  // 문서 업로드
  | 'system'  // 시스템 이벤트
  | 'time';   // 시간 기반 이벤트

/** CustomEvent detail 구조 */
export interface MascotEventDetail {
  state: MascotState;
  context?: MascotContext;
  /** 강제 대사 지정 (선택) */
  forcedPhrase?: string;
}

/** 마스코트 설정 (LocalStorage) */
export interface MascotSettings {
  enabled: boolean;       // ON/OFF
  speechEnabled: boolean; // 대사 표시 여부
}

/** 대사 항목 */
export interface MascotPhrase {
  text: string;
  /** 선택적 이모지 (대사 끝에 추가) */
  emoji?: string;
}

// TypeScript global 타입 확장
declare global {
  interface WindowEventMap {
    'kimchi-mascot': CustomEvent<MascotEventDetail>;
  }
}
