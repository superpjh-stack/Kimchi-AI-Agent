# 김치군 마스코트 Creative 기능 구현 계획서

> **Version**: 1.0
> **Date**: 2026-02-28
> **Author**: Developer (kimchi-mascot-creative team)
> **Scope**: 4 Sprints (Sprint A~D), 독립 기능 단위 구현

---

## 1. 현재 코드베이스 분석

### 1.1 기존 파일 구조

| 파일 | 역할 | LOC |
|------|------|-----|
| `types/mascot.ts` | MascotState, MascotSettings, MascotPhrase 등 타입 | 44 |
| `hooks/useMascot.ts` | 상태 관리, position, 비행 로직, localStorage 설정 | 165 |
| `hooks/useMascotTrigger.ts` | CustomEvent 리스너 | 28 |
| `lib/utils/mascot-event.ts` | dispatchMascotEvent 유틸 | 19 |
| `components/mascot/KimchiMascotContainer.tsx` | motion.div + spring animation 컨테이너 | 79 |
| `components/mascot/KimchiSvg.tsx` | 배추 SVG 7상태 (눈/입/소품) | 144 |
| `components/mascot/MascotSpeech.tsx` | 말풍선 UI + 자동 dismiss | 53 |
| `components/mascot/MascotToggle.tsx` | ON/OFF + 대사 토글 메뉴 | 84 |
| `components/mascot/mascot-phrases.ts` | 47개 한국어 대사 풀 | 105 |
| `app/globals.css` (마스코트 섹션) | 7상태 @keyframes + 접근성 | ~100 |

### 1.2 핵심 패턴

- **Event-Driven**: `dispatchMascotEvent()` -> CustomEvent('kimchi-mascot') -> `useMascotTrigger` -> `useMascot.setState`
- **Position**: framer-motion `motion.div` + spring transition, `getRandomFlyTarget()` 기반
- **State Reset**: `STATE_RESET_DELAY` 맵으로 자동 idle 복귀 (success/error/celebrating: 3000ms)
- **Settings**: localStorage `kimchi-mascot-settings` (enabled, speechEnabled)
- **Animation**: Pure CSS @keyframes, GPU 가속 (will-change: transform)
- **접근성**: `prefers-reduced-motion`, aria-live, aria-label 완비

### 1.3 의존성

- `framer-motion ^12.34.3` (설치 완료)
- `react ^18`, `next 14.2.5`
- CSS: Tailwind + custom globals.css @keyframes

---

## 2. Sprint A: 클릭 인터랙션 + 야간 모드 강화 (1일, 독립적)

### 2.1 클릭 인터랙션 (onClick -> 새 대사 + 리플)

#### 기능 설명
- 김치군 SVG 클릭 시 랜덤 대사 표시 + CSS 리플 이펙트
- 빠른 연타 방지 (throttle 300ms)
- 연속 클릭 시 다른 대사 보장 (기존 중복방지 로직 활용)

#### 수정/신규 파일

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `hooks/useMascot.ts` | **수정** | `handleClick()` 콜백 추가, throttle ref |
| `components/mascot/KimchiMascotContainer.tsx` | **수정** | onClick prop 전달, cursor-pointer |
| `components/mascot/KimchiSvg.tsx` | **수정** | onClick prop 수신, pointer-events |
| `app/globals.css` | **수정** | `.kimchi-mascot__ripple` @keyframes 추가 |

#### 예상 코드 변경

```
hooks/useMascot.ts:
  + handleClick 콜백 (throttle 300ms, getRandomPhrase('idle'), showSpeech)
  + lastClickRef: useRef<number>(0)
  → 약 +18줄

components/mascot/KimchiMascotContainer.tsx:
  + useMascot에서 handleClick 디스트럭처
  + KimchiSvg에 onClick 전달
  → 약 +5줄

components/mascot/KimchiSvg.tsx:
  + onClick?: () => void prop 추가
  + <svg> 에 onClick, cursor: pointer, 리플 원(circle) 조건부 렌더
  → 약 +12줄

app/globals.css:
  + @keyframes mascot-ripple (scale 0->2, opacity 1->0)
  + .kimchi-mascot__ripple 스타일
  → 약 +10줄
```

**예상 총 변경: ~45줄**

#### 기존 코드 영향도
- **Breaking Change**: 없음
- KimchiSvg에 optional onClick prop 추가만 — 기존 호출부 변경 불필요
- useMascot return에 handleClick 추가 — 기존 디스트럭처 영향 없음

#### 타입 변경

```typescript
// types/mascot.ts — 변경 없음
// KimchiSvg interface에 onClick?: () => void 추가 (로컬 인터페이스)
```

#### 구현 순서
1. [ ] `hooks/useMascot.ts`: handleClick 콜백 + throttle 로직 추가
2. [ ] `components/mascot/KimchiSvg.tsx`: onClick prop + pointer-events 추가
3. [ ] `app/globals.css`: `.kimchi-mascot__ripple` keyframes 추가
4. [ ] `components/mascot/KimchiMascotContainer.tsx`: handleClick 전달
5. [ ] 수동 테스트: 클릭 -> 대사 변경, 리플 효과, 300ms throttle 확인

---

### 2.2 야간 모드 강화 (Zzz 파티클)

#### 기능 설명
- sleeping 상태의 기존 `<text>Z z z</text>`를 CSS 애니메이션 파티클로 업그레이드
- Z 문자가 위로 떠오르며 사라지는 반복 애니메이션
- 3개 Z → 5개로 확대, stagger delay로 물결 효과

#### 수정/신규 파일

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `components/mascot/KimchiSvg.tsx` | **수정** | sleeping Z 렌더 확장 (5개, 배치 조정) |
| `app/globals.css` | **수정** | `@keyframes mascot-zzz` 개선 (float-up + fade) |

#### 예상 코드 변경

```
components/mascot/KimchiSvg.tsx:
  기존 3개 <text> → 5개로 확장, y좌표 분산
  → 약 +8줄 (순증)

app/globals.css:
  @keyframes mascot-zzz 리팩터 (translateY -8px → -15px, 크기 변화 추가)
  + .kimchi-mascot__zzz text:nth-child(4), (5) delay 추가
  → 약 +8줄
```

**예상 총 변경: ~16줄**

#### 기존 코드 영향도
- **Breaking Change**: 없음
- 기존 sleeping SVG 구조 확장 (하위호환)
- CSS nth-child 셀렉터 확장만

#### 타입 변경
- 없음

#### 구현 순서
1. [ ] `components/mascot/KimchiSvg.tsx`: sleeping Z 개수 확장 (3→5)
2. [ ] `app/globals.css`: zzz 파티클 keyframes 개선 + nth-child 4/5 추가
3. [ ] 수동 테스트: 22시 이후 or 강제 sleeping 상태에서 Z 파티클 확인

---

### Sprint A 요약

| 항목 | 값 |
|------|-----|
| 예상 총 변경 | ~61줄 |
| 신규 파일 | 0 |
| 수정 파일 | 4 (useMascot, KimchiSvg, KimchiMascotContainer, globals.css) |
| Breaking Change | 없음 |
| 타입 변경 | 없음 |
| 새 패키지 | 없음 |
| 예상 소요 | 1일 |

---

## 3. Sprint B: 레벨업 시스템 + 성취 배지 (2일, localStorage 의존)

### 3.1 레벨업 시스템

#### 기능 설명
- 사용자 상호작용(질문, 문서 업로드, 클릭) 횟수 카운트
- 누적 포인트 기반 레벨 산정 (1~10)
- 레벨에 따라 김치군 외형 변화 (볼 색상 진해짐, 잎사귀 추가)
- 레벨 배지 UI (캐릭터 옆 작은 뱃지)

#### 레벨 테이블

| 레벨 | 필요 포인트 | 칭호 | 외형 변화 |
|------|-----------|------|----------|
| 1 | 0 | 새싹 김치 | 기본 |
| 2 | 10 | 절임 김치 | 볼 색 +10% opacity |
| 3 | 30 | 양념 김치 | 잎사귀 4장 |
| 4 | 60 | 숙성 김치 | 잎사귀 5장 + 왕관 힌트 |
| 5 | 100 | 명인 김치 | 골든 테두리 + 잎사귀 5장 |

#### 포인트 부여 규칙
- 질문 전송: +2점 (dispatchMascotEvent 발생 시점)
- 문서 업로드: +5점
- 마스코트 클릭: +1점
- 하루 최대 50점 cap

#### 수정/신규 파일

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `types/mascot.ts` | **수정** | MascotSettings 확장 (xp, level, dailyXpDate, dailyXp) |
| `hooks/useMascot.ts` | **수정** | addXp() 콜백, level 계산 로직, localStorage 저장 |
| `components/mascot/KimchiSvg.tsx` | **수정** | level prop → 외형 조건부 렌더 (볼, 잎사귀, 테두리) |
| `components/mascot/KimchiMascotContainer.tsx` | **수정** | level 전달 |
| `components/mascot/MascotLevelBadge.tsx` | **신규** | 레벨 뱃지 컴포넌트 (숫자 + 칭호 툴팁) |
| `lib/utils/mascot-event.ts` | **수정** | MascotEventDetail에 xpReward 옵션 추가 |
| `hooks/useMascotTrigger.ts` | **수정** | xpReward 전달 |

#### 예상 코드 변경

```
types/mascot.ts:
  + MascotSettings에 xp, level, dailyXp, dailyXpDate 필드
  + MascotEventDetail에 xpReward?: number
  + LEVEL_THRESHOLDS 상수 export
  → 약 +20줄

hooks/useMascot.ts:
  + addXp(amount) 함수 (daily cap 체크 + level 계산 + localStorage 저장)
  + calculateLevel(xp) 헬퍼
  + 기존 setState에서 xpReward 처리 연동
  → 약 +40줄

components/mascot/KimchiSvg.tsx:
  + level prop (optional, default 1)
  + 조건부 잎사귀(4~5장), 볼 opacity, 골든 테두리
  → 약 +30줄

components/mascot/MascotLevelBadge.tsx: (신규)
  + 레벨 숫자 원형 뱃지 + 칭호 hover 툴팁
  → 약 45줄

components/mascot/KimchiMascotContainer.tsx:
  + level, addXp 전달
  + MascotLevelBadge 렌더
  → 약 +10줄

lib/utils/mascot-event.ts:
  + xpReward 파라미터 추가
  → 약 +3줄

hooks/useMascotTrigger.ts:
  + onXpGain 콜백 파라미터, xpReward 전달
  → 약 +5줄
```

**예상 총 변경: ~153줄 (신규 45 + 수정 108)**

#### 기존 코드 영향도
- **Breaking Change**: 없음 (MascotSettings에 optional 필드 추가)
- MascotEventDetail에 optional xpReward 추가 — 기존 dispatchMascotEvent 호출부 변경 불필요
- KimchiSvg의 level prop은 optional (default 1) — 기존 호출부 무변경

#### 타입 변경 (types/mascot.ts)

```typescript
// 추가
export interface MascotSettings {
  enabled: boolean;
  speechEnabled: boolean;
  xp: number;           // 누적 경험치
  level: number;        // 현재 레벨 (1~5)
  dailyXp: number;      // 오늘 획득 XP
  dailyXpDate: string;  // YYYY-MM-DD
}

export interface MascotEventDetail {
  state: MascotState;
  context?: MascotContext;
  forcedPhrase?: string;
  xpReward?: number;    // 추가: 이벤트 시 부여할 XP
}

export const LEVEL_THRESHOLDS = [0, 10, 30, 60, 100] as const;
export const LEVEL_TITLES = ['새싹 김치', '절임 김치', '양념 김치', '숙성 김치', '명인 김치'] as const;
```

#### 구현 순서
1. [ ] `types/mascot.ts`: MascotSettings 확장, LEVEL_THRESHOLDS/TITLES 상수
2. [ ] `hooks/useMascot.ts`: addXp + calculateLevel + DEFAULT_SETTINGS 확장
3. [ ] `lib/utils/mascot-event.ts`: xpReward 파라미터 추가
4. [ ] `hooks/useMascotTrigger.ts`: xpReward → addXp 연동
5. [ ] `components/mascot/KimchiSvg.tsx`: level prop → 외형 변화 렌더
6. [ ] `components/mascot/MascotLevelBadge.tsx`: 신규 뱃지 컴포넌트
7. [ ] `components/mascot/KimchiMascotContainer.tsx`: level + badge 통합
8. [ ] 수동 테스트: 질문 → XP 증가 → 레벨업 확인

---

### 3.2 성취 배지 시스템

#### 기능 설명
- 특정 마일스톤 달성 시 팝업 배지 표시
- 배지 목록은 localStorage에 저장
- 획득 시 celebrating 상태 + 축하 대사

#### 배지 목록

| ID | 이름 | 조건 | 아이콘 |
|----|------|------|--------|
| first-chat | 첫 대화 | 첫 질문 전송 | speech bubble |
| first-upload | 첫 업로드 | 첫 문서 업로드 | document |
| chatter-10 | 수다쟁이 | 질문 10회 | chat x10 |
| level-3 | 양념 장인 | 레벨 3 달성 | star |
| level-5 | 김치 명인 | 레벨 5 달성 | crown |
| night-owl | 올빼미 | 야간 3회 사용 | moon |

#### 수정/신규 파일

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `types/mascot.ts` | **수정** | Badge 타입, MascotSettings에 badges/counters |
| `hooks/useMascotAchievements.ts` | **신규** | 배지 조건 체크 + 팝업 트리거 |
| `components/mascot/AchievementPopup.tsx` | **신규** | 배지 획득 팝업 UI |
| `components/mascot/KimchiMascotContainer.tsx` | **수정** | achievement 훅 연동 |
| `app/globals.css` | **수정** | 팝업 slide-in 애니메이션 |

#### 예상 코드 변경

```
types/mascot.ts:
  + Badge interface (id, name, icon, earnedAt)
  + MascotSettings에 badges: Badge[], counters: Record<string, number>
  → 약 +15줄

hooks/useMascotAchievements.ts: (신규)
  + BADGE_DEFINITIONS 배열
  + checkAchievements(settings) → 새 배지 감지
  + useMascotAchievements(settings, updateSettings) 훅
  → 약 80줄

components/mascot/AchievementPopup.tsx: (신규)
  + 배지 이름 + 아이콘 + 축하 메시지
  + slide-up + fade-out 자동 dismiss (4s)
  → 약 55줄

components/mascot/KimchiMascotContainer.tsx:
  + useMascotAchievements 연동
  + AchievementPopup 조건부 렌더
  → 약 +12줄

app/globals.css:
  + @keyframes achievement-popup (slide-up + fade)
  → 약 +10줄
```

**예상 총 변경: ~172줄 (신규 135 + 수정 37)**

#### 기존 코드 영향도
- **Breaking Change**: 없음
- MascotSettings에 optional 필드 추가 (badges, counters) — 기존 로드에 spread fallback

#### 타입 변경 (types/mascot.ts)

```typescript
// 추가
export interface Badge {
  id: string;
  name: string;
  icon: string;       // lucide 아이콘 이름 or emoji
  earnedAt: string;   // ISO date
}

export interface MascotSettings {
  // ... 기존 + 레벨업 필드 ...
  badges: Badge[];
  counters: Record<string, number>;  // 'chatCount', 'uploadCount', 'nightCount'
}
```

#### 구현 순서
1. [ ] `types/mascot.ts`: Badge interface, MascotSettings 확장
2. [ ] `hooks/useMascotAchievements.ts`: 배지 정의 + 조건 체크 로직
3. [ ] `components/mascot/AchievementPopup.tsx`: 팝업 UI
4. [ ] `app/globals.css`: 팝업 애니메이션
5. [ ] `components/mascot/KimchiMascotContainer.tsx`: 훅 + 팝업 연동
6. [ ] 수동 테스트: 첫 질문 → "첫 대화" 배지 팝업 확인

---

### Sprint B 요약

| 항목 | 값 |
|------|-----|
| 예상 총 변경 | ~325줄 (신규 180 + 수정 145) |
| 신규 파일 | 3 (MascotLevelBadge, useMascotAchievements, AchievementPopup) |
| 수정 파일 | 6 (types/mascot, useMascot, KimchiSvg, KimchiMascotContainer, mascot-event, useMascotTrigger) |
| Breaking Change | 없음 |
| 타입 변경 | MascotSettings 확장, Badge 인터페이스, MascotEventDetail xpReward |
| 새 패키지 | 없음 |
| 예상 소요 | 2일 |
| 의존성 | Sprint A의 handleClick (XP 부여 포인트) |

---

## 4. Sprint C: 계절 의상 + 공정 데이터 연동 (2일, 복잡)

### 4.1 계절 의상 오버레이

#### 기능 설명
- 현재 월에 따라 김치군에 계절 장식 SVG 오버레이
- 봄(3~5): 벚꽃 꽃잎, 여름(6~8): 선글라스, 가을(9~11): 단풍 잎, 겨울(12~2): 산타 모자
- 오버레이는 KimchiSvg 내 `<g>` 래퍼로 삽입 (기존 SVG 구조 비파괴)

#### 수정/신규 파일

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `components/mascot/seasonal/SeasonalOverlay.tsx` | **신규** | 계절 감지 + SVG 오버레이 조각 |
| `components/mascot/KimchiSvg.tsx` | **수정** | SeasonalOverlay import + 렌더 |
| `types/mascot.ts` | **수정** | Season 타입 추가 |

#### 계절별 SVG 오버레이 설계

```
봄 (3~5월):
  - 잎사귀 위 작은 벚꽃 3개 (핑크 circle + petal path)
  - 위치: (18,4), (30,2), (42,4)

여름 (6~8월):
  - 선글라스 SVG (눈 위 반투명 렌즈 2개)
  - 위치: 눈 좌표 기준 오버레이

가을 (9~11월):
  - 잎사귀 색상 #52B788 → #E76F51 (단풍색)으로 변경
  - 작은 단풍잎 1개 떨어지는 애니메이션

겨울 (12~2월):
  - 산타 모자 (빨간 삼각형 + 흰 폼폼)
  - 위치: 잎사귀 위 (cx=30, cy=-2)
```

#### 예상 코드 변경

```
components/mascot/seasonal/SeasonalOverlay.tsx: (신규)
  + getSeason(month) 헬퍼
  + SpringOverlay, SummerOverlay, AutumnOverlay, WinterOverlay 서브컴포넌트
  + SeasonalOverlay 메인 (조건부 렌더)
  → 약 120줄

components/mascot/KimchiSvg.tsx:
  + import SeasonalOverlay
  + SVG 끝에 <SeasonalOverlay /> 삽입
  + 가을: 잎사귀 fill 조건부 색상
  → 약 +10줄

types/mascot.ts:
  + type Season = 'spring' | 'summer' | 'autumn' | 'winter'
  → 약 +2줄

app/globals.css:
  + @keyframes leaf-fall (가을 낙엽)
  → 약 +8줄
```

**예상 총 변경: ~140줄 (신규 120 + 수정 20)**

#### 기존 코드 영향도
- **Breaking Change**: 없음
- KimchiSvg 내부에 optional 렌더만 추가
- 가을 모드에서 잎사귀 색상 변경은 동적 props 주입 (기존 하드코딩 fill을 변수화)

#### 타입 변경

```typescript
// types/mascot.ts 추가
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
```

#### 구현 순서
1. [ ] `types/mascot.ts`: Season 타입 추가
2. [ ] `components/mascot/seasonal/SeasonalOverlay.tsx`: 4계절 오버레이
3. [ ] `components/mascot/KimchiSvg.tsx`: SeasonalOverlay 삽입 + 가을 색상 로직
4. [ ] `app/globals.css`: 낙엽 애니메이션
5. [ ] 수동 테스트: 월 변경 mock으로 4계절 전환 확인

---

### 4.2 공정 데이터 연동 (SSE -> 마스코트 자동 반응)

#### 기능 설명
- 기존 `useAlerts` 훅이 수신하는 SSE 알림(critical/warning)에 마스코트가 반응
- critical 알림 → error 상태 + 경고 대사
- warning 알림 → thinking 상태 + 주의 대사
- 알림 해소(heartbeat) → success 상태 + 안도 대사
- 센서 데이터 임계값 근접 시 searching 상태 (선제적 표시)

#### 수정/신규 파일

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `hooks/useMascotAlertBridge.ts` | **신규** | useAlerts 상태 → dispatchMascotEvent 변환 |
| `components/mascot/mascot-phrases.ts` | **수정** | alert 전용 대사 추가 |
| `types/mascot.ts` | **수정** | MascotContext에 'alert' 추가 |
| `app/[locale]/page.tsx` | **수정** | useMascotAlertBridge 연동 |

#### 브릿지 로직

```
useAlerts 출력:
  alerts: Alert[] (severity: 'critical' | 'warning')
  criticalCount: number
  warningCount: number

변환 규칙:
  criticalCount > 0 → dispatchMascotEvent('error', 'alert', '긴급 알림이에요!')
  warningCount > 0 && criticalCount === 0 → dispatchMascotEvent('thinking', 'alert', '주의가 필요해요!')
  이전에 알림 있었는데 둘 다 0 → dispatchMascotEvent('success', 'alert', '상황 정상 복귀!')

디바운스: 500ms (알림 연타 방지)
```

#### 예상 코드 변경

```
hooks/useMascotAlertBridge.ts: (신규)
  + useMascotAlertBridge(alerts, criticalCount, warningCount) 훅
  + useEffect로 상태 변화 감지 + dispatchMascotEvent 호출
  + useRef로 이전 상태 추적 + debounce
  → 약 55줄

components/mascot/mascot-phrases.ts:
  + alert 컨텍스트용 forcedPhrase 목록 (훅에서 직접 사용)
  → 약 +0줄 (브릿지 훅에서 forcedPhrase 직접 지정)

types/mascot.ts:
  + MascotContext에 'alert' 리터럴 추가
  → 약 +1줄

app/[locale]/page.tsx:
  + import useMascotAlertBridge
  + useMascotAlertBridge(alerts, criticalCount, warningCount) 호출
  → 약 +3줄
```

**예상 총 변경: ~59줄 (신규 55 + 수정 4)**

#### 기존 코드 영향도
- **Breaking Change**: 없음
- MascotContext union에 'alert' 추가는 하위호환
- page.tsx에 훅 1줄 추가만 — 기존 레이아웃/로직 변경 없음
- useAlerts 자체는 수정하지 않음 (읽기 전용 브릿지)

#### 타입 변경

```typescript
// types/mascot.ts 수정
export type MascotContext =
  | 'chat'
  | 'upload'
  | 'system'
  | 'time'
  | 'alert';   // 추가
```

#### 구현 순서
1. [ ] `types/mascot.ts`: MascotContext에 'alert' 추가
2. [ ] `hooks/useMascotAlertBridge.ts`: SSE 알림 → 마스코트 브릿지 훅
3. [ ] `app/[locale]/page.tsx`: useMascotAlertBridge 연동
4. [ ] 수동 테스트: 공정 알림 발생 → 마스코트 반응 확인

---

### Sprint C 요약

| 항목 | 값 |
|------|-----|
| 예상 총 변경 | ~199줄 (신규 175 + 수정 24) |
| 신규 파일 | 2 (SeasonalOverlay, useMascotAlertBridge) |
| 수정 파일 | 4 (KimchiSvg, types/mascot, app/[locale]/page, globals.css) |
| Breaking Change | 없음 |
| 타입 변경 | Season 타입, MascotContext 'alert' 추가 |
| 새 패키지 | 없음 |
| 예상 소요 | 2일 |
| 의존성 | 기존 useAlerts SSE 인프라 (이미 구현됨) |

---

## 5. Sprint D: Web Audio 효과음 + 공장 알림 감정 전환 (선택적)

### 5.1 Web Audio API 효과음

#### 기능 설명
- 마스코트 상태 변경 시 짧은 효과음 재생 (40~200ms 합성음)
- Web Audio API로 런타임 합성 (외부 파일 불필요)
- 설정에서 음소거 토글 가능
- 상태별 톤: success(높은 C), error(낮은 buzz), celebrating(멜로디), click(pop)

#### 수정/신규 파일

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `lib/utils/mascot-audio.ts` | **신규** | AudioContext 싱글톤 + 상태별 합성 함수 |
| `hooks/useMascot.ts` | **수정** | setState에서 audio 트리거, soundEnabled 설정 |
| `types/mascot.ts` | **수정** | MascotSettings에 soundEnabled 추가 |
| `components/mascot/MascotToggle.tsx` | **수정** | 소리 토글 버튼 추가 |

#### 예상 코드 변경

```
lib/utils/mascot-audio.ts: (신규)
  + getAudioContext() 싱글톤
  + playStateSound(state: MascotState) — OscillatorNode 기반 합성
  + 상태별 주파수/지속시간 맵
  → 약 80줄

hooks/useMascot.ts:
  + soundEnabled 상태 + toggleSound 콜백
  + setState에서 playStateSound 호출 (soundEnabled 체크)
  → 약 +15줄

types/mascot.ts:
  + MascotSettings에 soundEnabled: boolean
  → 약 +1줄

components/mascot/MascotToggle.tsx:
  + 소리 ON/OFF 메뉴 항목
  → 약 +12줄
```

**예상 총 변경: ~108줄 (신규 80 + 수정 28)**

#### 기존 코드 영향도
- **Breaking Change**: 없음
- MascotSettings에 optional soundEnabled 추가
- AudioContext는 사용자 제스처 이후 자동 resume (브라우저 정책 준수)

#### 타입 변경

```typescript
export interface MascotSettings {
  // ... 기존 ...
  soundEnabled: boolean;  // 추가 (default: false — opt-in)
}
```

#### 구현 순서
1. [ ] `types/mascot.ts`: soundEnabled 필드
2. [ ] `lib/utils/mascot-audio.ts`: Web Audio 합성 함수
3. [ ] `hooks/useMascot.ts`: 상태 변경 시 audio 연동
4. [ ] `components/mascot/MascotToggle.tsx`: 소리 토글 메뉴
5. [ ] 수동 테스트: 소리 ON → 상태 변경 시 효과음 확인

---

### 5.2 공장 알림 -> 마스코트 감정 자동 전환 (Sprint C 확장)

#### 기능 설명
- Sprint C의 useMascotAlertBridge를 확장하여 세분화된 감정 반응
- 온도 이상 → 땀 흘리는 표정 (새 상태: 'hot')
- pH 이상 → 걱정 표정 (기존 thinking 활용)
- 알림 지속 60초 이상 → 불안 강도 증가 (error로 에스컬레이션)

#### 수정/신규 파일

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `hooks/useMascotAlertBridge.ts` | **수정** | 알림 유형별 세분화 로직, 지속 시간 추적 |
| `components/mascot/mascot-phrases.ts` | **수정** | 공정 알림 대사 추가 (온도, pH 전용) |

#### 예상 코드 변경

```
hooks/useMascotAlertBridge.ts:
  + 알림 메트릭별 분기 (alert.metric === 'temperature' 등)
  + 60초 에스컬레이션 타이머
  + 공정별 전용 forcedPhrase 매핑
  → 약 +35줄

components/mascot/mascot-phrases.ts:
  + 공정 관련 대사 8개 추가
  → 약 +10줄
```

**예상 총 변경: ~45줄**

#### 기존 코드 영향도
- **Breaking Change**: 없음
- useMascotAlertBridge 내부 로직 확장만

#### 구현 순서
1. [ ] `hooks/useMascotAlertBridge.ts`: 메트릭별 분기 + 에스컬레이션
2. [ ] `components/mascot/mascot-phrases.ts`: 공정 대사 추가
3. [ ] 수동 테스트: 온도 알림 시뮬레이션 → 맞춤 반응 확인

---

### Sprint D 요약

| 항목 | 값 |
|------|-----|
| 예상 총 변경 | ~153줄 (신규 80 + 수정 73) |
| 신규 파일 | 1 (mascot-audio.ts) |
| 수정 파일 | 4 (useMascot, types/mascot, MascotToggle, useMascotAlertBridge) |
| Breaking Change | 없음 |
| 타입 변경 | MascotSettings에 soundEnabled |
| 새 패키지 | 없음 |
| 예상 소요 | 1~2일 (선택적) |

---

## 6. 전체 요약

### 6.1 Sprint 간 의존성

```
Sprint A ──────────────────────┐
(클릭 인터랙션 + 야간 Zzz)     │
                               ▼
Sprint B ──────────────────────┐
(레벨업 + 성취 배지)           │  Sprint A의 handleClick → XP 부여 포인트
                               │
Sprint C ──────────────────────┤  독립 (useAlerts 기존 인프라 활용)
(계절 의상 + 공정 데이터 연동)  │
                               ▼
Sprint D ──────────────────────
(Web Audio + 알림 세분화)       Sprint C의 useMascotAlertBridge 확장
```

### 6.2 총 변경량

| Sprint | 신규 파일 | 수정 파일 | 예상 LOC | 소요 |
|--------|----------|----------|---------|------|
| A | 0 | 4 | ~61 | 1일 |
| B | 3 | 6 | ~325 | 2일 |
| C | 2 | 4 | ~199 | 2일 |
| D (선택) | 1 | 4 | ~153 | 1~2일 |
| **합계** | **6** | **14 (중복 제외 ~10)** | **~738** | **6~7일** |

### 6.3 types/mascot.ts 최종 변경 요약

| Sprint | 변경 내용 |
|--------|----------|
| A | 변경 없음 |
| B | MascotSettings 확장 (xp, level, dailyXp, dailyXpDate, badges, counters), Badge 인터페이스, MascotEventDetail에 xpReward, LEVEL_THRESHOLDS/TITLES 상수 |
| C | Season 타입, MascotContext에 'alert' |
| D | MascotSettings에 soundEnabled |

### 6.4 Breaking Change 분석

**전 Sprint에 걸쳐 Breaking Change 없음.**

근거:
- 모든 타입 확장은 optional 필드 추가
- 기존 dispatchMascotEvent 호출부 (useChat, DocumentUpload)는 변경 불필요
- KimchiSvg props는 모두 optional (level, onClick)
- MascotSettings의 loadSettings()는 `{ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }` 패턴이므로 새 필드가 있어도 기존 localStorage 데이터와 호환
- useMascot return 값에 새 속성 추가는 디스트럭처링에 영향 없음

### 6.5 새 패키지

**없음.** 모든 기능은 기존 의존성(framer-motion, react, next, tailwind)과 Web API(Web Audio, localStorage, CustomEvent)만 사용.

### 6.6 성능 영향

| 항목 | 영향 | 근거 |
|------|------|------|
| 번들 사이즈 | +2~3KB (gzip) | 순수 TS/TSX, 외부 라이브러리 없음 |
| LCP | +0ms | 마스코트는 fixed 포지션, 메인 콘텐츠 렌더 블로킹 없음 |
| CLS | 0 | 모든 애니메이션은 transform/opacity (레이아웃 시프트 없음) |
| Runtime | Web Audio: AudioContext 1개 (싱글톤) | 메모리 증가 무시 가능 |
| localStorage | +500B~2KB | 레벨/배지 데이터 |

### 6.7 접근성 체크리스트 (전 Sprint)

- [ ] 모든 새 interactive 요소에 `aria-label` 부여
- [ ] 리플/팝업 애니메이션은 `prefers-reduced-motion: reduce`에서 비활성화
- [ ] 효과음은 기본 OFF (opt-in), 토글 UI 제공
- [ ] 배지 팝업에 `role="alert"` + `aria-live="polite"`
- [ ] 색상 대비: 레벨 뱃지 텍스트 WCAG AA 준수

---

## 7. 리스크 및 완화

| 리스크 | 확률 | 영향 | 완화 |
|--------|------|------|------|
| localStorage quota 초과 | 낮음 | 배지 데이터 손실 | try-catch + 오래된 카운터 정리 |
| Web Audio 브라우저 호환 | 중간 | D Sprint 효과음 불가 | 폴백: 효과음 없이 동작, iOS Safari autoplay 정책 준수 |
| SVG 오버레이 복잡도 증가 | 낮음 | 렌더 성능 | SeasonalOverlay는 React.memo, viewBox 내 경량 path만 사용 |
| 알림 SSE 연결 끊김 | 중간 | 마스코트 반응 중단 | useMascotAlertBridge에서 연결 상태 체크, 무반응 시 idle 유지 |
