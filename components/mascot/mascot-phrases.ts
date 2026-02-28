import type { MascotState, MascotPhrase } from '@/types/mascot';

/**
 * 상황별 대사 풀 — 공장 현장 감성의 친근한 한국어.
 * 각 상태별 6~8개의 대사로 반복 사용 시에도 다양한 표현 제공.
 */
const PHRASES: Record<MascotState, MascotPhrase[]> = {
  idle: [
    { text: '안녕하세요! 김치군이에요', emoji: '🥬' },
    { text: '뭔가 물어볼 거 있어요?' },
    { text: '오늘 공장 어때요?' },
    { text: '김치 잘 익고 있나요?' },
    { text: '심심하면 말 걸어주세요~' },
    { text: '오늘도 파이팅이에요!' },
    { text: '맛있는 김치 만들어 봐요!' },
  ],

  thinking: [
    { text: '기둘려~ 생각 중이야', emoji: '🥬' },
    { text: '으음... 잠깐만이요~' },
    { text: '김치 숙성 중... 조금만요!' },
    { text: '뚝딱뚝딱 답 만드는 중!' },
    { text: '이게 맞나... 한번 더 볼게요' },
    { text: '머리 풀가동 중이에요~' },
    { text: '어디 보자... 음음...' },
    { text: '열심히 찾고 있어요!' },
  ],

  success: [
    { text: '야호! 찾았다!', emoji: '🎉' },
    { text: '빠빰~ 답 나왔어요!' },
    { text: '헤헤, 식은 죽 먹기죠~' },
    { text: '짜잔~! 어때요?' },
    { text: '우리 김치공장 짱이야!' },
    { text: '이 정도는 김치군한테 맡기세요!' },
    { text: '도움이 됐으면 좋겠어요!', emoji: '😊' },
  ],

  error: [
    { text: '앗! 이건 좀 어렵네요...', emoji: '😅' },
    { text: '으악, 뭔가 잘못됐어요!' },
    { text: '죄송해요~ 다시 해볼게요!' },
    { text: '이거... 김치가 안 익은 것 같은데요?' },
    { text: '에러다! 잠깐만요!' },
    { text: '앗... 실수했어요 ㅠㅠ' },
    { text: '한번 더 시도해 주세요!' },
  ],

  celebrating: [
    { text: '맛있는 데이터 잘 받았어요!', emoji: '🎊' },
    { text: '이제 이것도 다 외웠어요!', emoji: '😄' },
    { text: '데이터 맛있다~ 잘 익혀 놓을게요' },
    { text: '새 문서 냠냠~ 감사해요!' },
    { text: '지식이 또 늘었어요!' },
    { text: '이거 공부하면 더 똑똑해지겠다!' },
  ],

  searching: [
    { text: '어디 보자~ 문서 뒤지는 중!' },
    { text: '잠깐! 여기 있는 거 같은데...' },
    { text: '으음, 열심히 찾고 있어요!' },
    { text: '김치군이 찾아드릴게요~' },
    { text: '어딨지... 분명 있었는데...' },
    { text: '돋보기 가져왔어요!', emoji: '🔍' },
  ],

  sleeping: [
    { text: '이 시간에도 일하세요? 고생 많으세요~', emoji: '😴' },
    { text: '밤에도 열심히시네요!' },
    { text: '야근이에요? 파이팅!' },
    { text: '졸려... 하지만 도와드릴게요', emoji: '😪' },
    { text: '야간 근무 화이팅!' },
    { text: '밤이 깊었네요~ 무리하지 마세요' },
  ],
};

/**
 * 주어진 상태에 대해 랜덤 대사를 반환한다.
 * 이전 대사와 겹치지 않도록 간단한 중복 방지 로직 포함.
 */
const lastPhraseIndex: Record<string, number> = {};

export function getRandomPhrase(state: MascotState): MascotPhrase {
  const pool = PHRASES[state];
  if (!pool || pool.length === 0) {
    return { text: '...' };
  }

  const lastIdx = lastPhraseIndex[state] ?? -1;
  let idx: number;
  let attempts = 0;

  do {
    idx = Math.floor(Math.random() * pool.length);
    attempts++;
  } while (idx === lastIdx && pool.length > 1 && attempts < 3);

  lastPhraseIndex[state] = idx;
  return pool[idx];
}

/** 특정 상태의 전체 대사 풀 반환 (테스트용) */
export function getPhrasesForState(state: MascotState): MascotPhrase[] {
  return PHRASES[state] ?? [];
}
