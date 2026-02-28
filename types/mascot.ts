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
  | 'time'    // 시간 기반 이벤트
  | 'alert';  // 공정 알림 연동

/** 계절 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** CustomEvent detail 구조 */
export interface MascotEventDetail {
  state: MascotState;
  context?: MascotContext;
  /** 강제 대사 지정 (선택) */
  forcedPhrase?: string;
  /** 이벤트 시 부여할 경험치 (선택) */
  xpReward?: number;
}

/** 레벨 임계값 (누적 XP 기준) */
export const LEVEL_THRESHOLDS = [0, 10, 30, 60, 100] as const;
/** 레벨별 칭호 */
export const LEVEL_TITLES = [
  '새싹 김치', '절임 김치', '양념 김치', '숙성 김치', '명인 김치',
] as const;

/** 성취 배지 */
export interface Badge {
  id: string;
  name: string;
  icon: string;      // 이모지
  earnedAt: string;  // ISO date
}

/** 마스코트 설정 (LocalStorage) */
export interface MascotSettings {
  enabled: boolean;       // ON/OFF
  speechEnabled: boolean; // 대사 표시 여부
  xp: number;             // 누적 경험치
  level: number;          // 현재 레벨 (1~5)
  dailyXp: number;        // 오늘 획득 XP
  dailyXpDate: string;    // YYYY-MM-DD
  badges: Badge[];        // 획득한 배지 목록
  counters: Record<string, number>; // 'chatCount', 'uploadCount', 'clickCount', 'nightCount'
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
