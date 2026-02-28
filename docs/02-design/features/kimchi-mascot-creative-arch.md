# 김치군 마스코트 창의적 기능 — 기술 아키텍처 설계

> **Version**: 1.0
> **Date**: 2026-02-28
> **Author**: Architect Agent
> **Status**: Draft

---

## 1. 현재 아키텍처 요약

```
                    dispatchMascotEvent()
useChat.ts ─────────────┐
DocumentUpload.tsx ─────┤
                        ▼
              CustomEvent('kimchi-mascot')
                        │
              useMascotTrigger(setState)
                        │
                   useMascot()
                   ├── state (MascotState: 7종)
                   ├── phrase (MascotPhrase)
                   ├── position ({x,y})
                   └── settings (MascotSettings: localStorage)
                        │
            KimchiMascotContainer
              ├── motion.div (Framer Motion spring)
              ├── MascotSpeech (말풍선)
              ├── KimchiSvg (SVG + CSS @keyframes)
              └── MascotToggle (ON/OFF 메뉴)
```

**핵심 패턴**:
- Event-Driven Decoupling: 비즈니스 로직(useChat 등)은 `dispatchMascotEvent()`만 호출, 마스코트 내부 구현에 의존하지 않음
- CSS-only Animation + Framer Motion spring: GPU 가속, will-change 활용
- localStorage 기반 설정 영속화 (enabled, speechEnabled)

---

## 2. 레벨업 시스템 상태 관리

### 2.1 저장소 결정: localStorage

| 방식 | 장점 | 단점 |
|------|------|------|
| **localStorage** | 즉시 구현 가능, 서버 비용 0, 오프라인 동작 | 기기 간 동기화 불가, 초기화 위험 |
| 서버 저장 (API) | 기기 간 동기화, 데이터 안전 | Phase 6 인증 시스템 필요, API 엔드포인트 추가 |

**결정: localStorage** (Phase 6 인증 미완료 상태에서 서버 저장은 premature)

- 기존 `MascotSettings` 저장 메커니즘(`STORAGE_KEY = 'kimchi-mascot-settings'`)을 확장
- 향후 Phase 6 Sprint 4 (Multi-tenant) 완료 시 서버 마이그레이션 경로 확보

### 2.2 MascotSettings 타입 확장

```typescript
// types/mascot.ts — 기존 타입 확장
export interface MascotSettings {
  enabled: boolean;
  speechEnabled: boolean;
  // --- 레벨업 시스템 추가 ---
  level: MascotLevel;
}

export interface MascotLevel {
  current: number;       // 현재 레벨 (1~10)
  totalInteractions: number;  // 누적 상호작용 횟수
  chatCount: number;     // 채팅 응답 완료 횟수
  uploadCount: number;   // 문서 업로드 횟수
  streak: number;        // 연속 사용 일수
  lastActiveDate: string; // 마지막 활성 날짜 (YYYY-MM-DD)
}
```

### 2.3 레벨 계산 로직

```typescript
// lib/mascot/level.ts (신규)
const LEVEL_THRESHOLDS = [
  0,    // Lv.1: 새싹 김치 (기본)
  10,   // Lv.2: 절임 김치
  30,   // Lv.3: 양념 김치
  60,   // Lv.4: 숙성 김치
  100,  // Lv.5: 명인 김치
  150,  // Lv.6: 달인 김치
  220,  // Lv.7: 장인 김치
  300,  // Lv.8: 국보 김치
  400,  // Lv.9: 전설의 김치
  500,  // Lv.10: 김치의 신
] as const;

export function calculateLevel(totalInteractions: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalInteractions >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getProgressToNext(level: number, total: number): number {
  if (level >= 10) return 1; // max level
  const current = LEVEL_THRESHOLDS[level - 1];
  const next = LEVEL_THRESHOLDS[level];
  return (total - current) / (next - current);
}
```

### 2.4 레벨업 경험치 적립 포인트

| 행동 | 경험치 |
|------|--------|
| 채팅 응답 완료 (success) | +1 |
| 문서 업로드 완료 (celebrating) | +3 |
| 연속 사용 일수 보너스 | +streak (최대 +7) |
| 대시보드 확인 | +1 (1일 1회) |

**적립 위치**: `useMascot.ts`의 `setState()` 내부에서 state가 `success` 또는 `celebrating`일 때 카운터 증가 및 레벨 재계산

### 2.5 데이터 흐름

```
dispatchMascotEvent('success', 'chat')
        │
useMascotTrigger → useMascot.setState('success')
        │
        ├── 기존: setPhrase, setPosition, resetTimer
        └── 신규: incrementInteraction()
                    ├── totalInteractions++
                    ├── chatCount++ (context === 'chat')
                    ├── calculateLevel(totalInteractions)
                    ├── if (newLevel > oldLevel) → levelUpEvent!
                    └── saveSettings(updatedSettings)
```

---

## 3. 이벤트 시스템 확장

### 3.1 현재 이벤트 구조

```typescript
// 현재
interface MascotEventDetail {
  state: MascotState;
  context?: MascotContext;
  forcedPhrase?: string;
}
```

### 3.2 확장 설계

```typescript
// 확장 — 하위 호환 유지 (모든 신규 필드는 optional)
interface MascotEventDetail {
  state: MascotState;
  context?: MascotContext;
  forcedPhrase?: string;
  // --- 신규 (optional) ---
  levelUp?: { from: number; to: number };  // 레벨업 발생 시
  badge?: string;                          // 뱃지 획득 시
  sound?: MascotSoundEffect;              // 효과음 지정
  processAlert?: ProcessAlertBridge;       // 공정 알림 연동
}

type MascotSoundEffect = 'levelup' | 'badge' | 'alert' | 'success' | 'error';

interface ProcessAlertBridge {
  severity: 'info' | 'warning' | 'critical';
  metric: string;    // 예: 'temperature', 'pH'
  value: number;
  message: string;
}
```

### 3.3 영향 범위 분석

| 파일 | 변경 사항 | 영향도 |
|------|-----------|--------|
| `types/mascot.ts` | MascotEventDetail에 optional 필드 추가 | **Low** (하위 호환) |
| `lib/utils/mascot-event.ts` | dispatchMascotEvent 시그니처에 options 파라미터 추가 | **Low** (기존 호출부 변경 불필요) |
| `hooks/useMascotTrigger.ts` | 새 필드를 onStateChange에 전달하도록 확장 | **Medium** |
| `hooks/useMascot.ts` | setState에 levelUp/badge/sound 처리 로직 추가 | **Medium** |
| `hooks/useChat.ts` | 변경 없음 (기존 호출 그대로 동작) | **None** |
| `components/documents/DocumentUpload.tsx` | 변경 없음 | **None** |

### 3.4 확장된 dispatchMascotEvent 시그니처

```typescript
// lib/utils/mascot-event.ts
export function dispatchMascotEvent(
  state: MascotState,
  context?: MascotContext,
  forcedPhrase?: string,
  options?: Partial<Pick<MascotEventDetail, 'levelUp' | 'badge' | 'sound' | 'processAlert'>>
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<MascotEventDetail>('kimchi-mascot', {
      detail: { state, context, forcedPhrase, ...options },
    })
  );
}
```

기존 4개 호출부 (`useChat.ts` 4개 + `DocumentUpload.tsx` 1개)는 **변경 불필요** — 새 파라미터는 모두 optional.

---

## 4. Web Audio API 통합

### 4.1 브라우저 호환성 전략

```typescript
// Safari는 webkitAudioContext를 사용하는 레거시 버전 존재
// 현대 Safari (14.1+)는 표준 AudioContext 지원
const AudioCtx = typeof window !== 'undefined'
  ? (window.AudioContext || (window as any).webkitAudioContext)
  : null;
```

**타겟 브라우저**: Chrome 90+, Safari 14.1+, Firefox 90+, Edge 90+
**폴백**: AudioContext 미지원 시 무음 동작 (graceful degradation)

### 4.2 useSound 커스텀 훅 설계

```typescript
// hooks/useSound.ts (신규)

type SoundName = 'levelup' | 'badge' | 'alert-warning' | 'alert-critical'
              | 'pop' | 'whoosh' | 'ding';

interface UseSoundOptions {
  enabled?: boolean;     // 전역 ON/OFF
  volume?: number;       // 0.0 ~ 1.0 (기본 0.3)
}

interface UseSoundReturn {
  play: (name: SoundName) => void;
  isReady: boolean;
  setVolume: (v: number) => void;
}

export function useSound(options?: UseSoundOptions): UseSoundReturn;
```

### 4.3 내부 구현 전략

```
[마운트] → lazy AudioContext 생성 (유저 제스처 후)
               │
        preloadSounds() ← 첫 유저 인터랙션 시 1회
               │
        AudioBuffer Map (캐시)
        ┌──────────────┐
        │ levelup: buf │
        │ badge:   buf │
        │ pop:     buf │
        │ ...          │
        └──────────────┘
               │
        play(name) → bufferSource.start(0)
```

**핵심 설계 결정**:

1. **Lazy Initialization**: AudioContext는 첫 사용자 클릭/터치 이벤트 이후에만 생성 (브라우저 autoplay 정책 준수)
2. **Buffer Preloading**: `useEffect`에서 첫 유저 인터랙션 감지 → 모든 사운드를 `fetch` + `decodeAudioData`로 미리 로드
3. **싱글톤 AudioContext**: 전역 1개만 생성하여 여러 컴포넌트에서 공유

```typescript
// lib/mascot/sound-manager.ts (신규) — 싱글톤 패턴

let audioCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
let initialized = false;

export async function initAudio(): Promise<void> {
  if (initialized) return;
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) return;
  audioCtx = new AudioCtxClass();
  // Safari resume 필요
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  initialized = true;
}

export async function preloadSound(name: string, url: string): Promise<void> {
  if (!audioCtx || bufferCache.has(name)) return;
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  bufferCache.set(name, audioBuffer);
}

export function playSound(name: string, volume = 0.3): void {
  if (!audioCtx) return;
  const buffer = bufferCache.get(name);
  if (!buffer) return;
  const source = audioCtx.createBufferSource();
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = volume;
  source.buffer = buffer;
  source.connect(gainNode).connect(audioCtx.destination);
  source.start(0);
}
```

### 4.4 사운드 파일 전략

| 방식 | 크기 | 권장 |
|------|------|------|
| **생성형 (OscillatorNode)** | 0 bytes | 단순 효과음 (beep, ding) |
| **짧은 WAV/MP3** | 2~10 KB each | 레벨업 팡파레, 뱃지 획득 |
| **Web Audio Synth** | 0 bytes | 경고음 |

**결정**: 레벨업/뱃지는 짧은 MP3 (5KB 이하), 나머지는 OscillatorNode로 프로그래매틱 생성

```
public/
  sounds/
    levelup.mp3    (~5KB, 0.5초)
    badge.mp3      (~3KB, 0.3초)
```

나머지 효과음(pop, ding, alert)은 OscillatorNode로 런타임 생성 → 번들 사이즈 0 추가:

```typescript
// 프로그래매틱 사운드 생성 예시
export function synthesizeBeep(ctx: AudioContext, freq = 440, duration = 0.15): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}
```

### 4.5 MascotSettings 사운드 설정 확장

```typescript
export interface MascotSettings {
  enabled: boolean;
  speechEnabled: boolean;
  level: MascotLevel;
  // --- 사운드 설정 ---
  soundEnabled: boolean;  // 효과음 ON/OFF (기본: true)
  soundVolume: number;    // 0.0~1.0 (기본: 0.3)
}
```

---

## 5. 공정 데이터 → 마스코트 연동

### 5.1 현재 SSE 알림 흐름

```
[센서 시뮬레이터] → GET /api/alerts/stream (SSE)
                         │
                   { type: 'alerts', alerts: [...] }
                         │
                   (현재: 클라이언트 컴포넌트에서 소비)
```

### 5.2 브릿지 설계: useAlertMascotBridge

기존 alerts SSE를 소비하는 클라이언트 훅에서 마스코트 이벤트로 변환하는 브릿지 훅:

```typescript
// hooks/useAlertMascotBridge.ts (신규)

import { useEffect, useRef } from 'react';
import { dispatchMascotEvent } from '@/lib/utils/mascot-event';
import type { MascotState } from '@/types/mascot';

interface Alert {
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  value: number;
  message: string;
}

const SEVERITY_TO_STATE: Record<Alert['severity'], MascotState> = {
  info: 'idle',
  warning: 'searching',   // 두리번거리는 표정 → "뭔가 이상한데?"
  critical: 'error',      // 당황 표정 → "위험해요!"
};

const SEVERITY_PHRASES: Record<Alert['severity'], string[]> = {
  info: ['공장 상태 양호해요~'],
  warning: [
    '음... 이 수치가 좀 이상한데요?',
    '잠깐! 확인해 볼게요!',
    '주의가 필요해 보여요!',
  ],
  critical: [
    '위험해요! 바로 확인하세요!',
    '긴급 알림이에요! 조치가 필요해요!',
    '큰일이에요! 공정 확인 부탁드려요!',
  ],
};

// 중복 알림 스로틀링 (같은 심각도 알림은 30초 간격으로)
const THROTTLE_MS = 30_000;

export function useAlertMascotBridge(alerts: Alert[]) {
  const lastAlertTimeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!alerts || alerts.length === 0) return;

    // 가장 심각한 알림 선택
    const sorted = [...alerts].sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
    const top = sorted[0];

    // 스로틀 체크
    const now = Date.now();
    const lastTime = lastAlertTimeRef.current[top.severity] ?? 0;
    if (now - lastTime < THROTTLE_MS) return;
    lastAlertTimeRef.current[top.severity] = now;

    const state = SEVERITY_TO_STATE[top.severity];
    const phrases = SEVERITY_PHRASES[top.severity];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];

    dispatchMascotEvent(state, 'system', phrase, {
      processAlert: {
        severity: top.severity,
        metric: top.metric,
        value: top.value,
        message: top.message,
      },
    });
  }, [alerts]);
}
```

### 5.3 데이터 흐름 다이어그램

```
[센서 시뮬레이터]
       │
       ▼
  GET /api/alerts/stream (SSE)
       │
       ▼
  [AlertPanel / DashboardPanel]  ←── 기존 SSE 소비 컴포넌트
       │
       │  alerts state (useState)
       ▼
  useAlertMascotBridge(alerts)   ←── 신규 브릿지 훅
       │
       │  severity → MascotState 매핑
       │  + 30초 스로틀링
       ▼
  dispatchMascotEvent('error', 'system', '위험해요!', { processAlert })
       │
       ▼
  CustomEvent('kimchi-mascot')
       │
       ▼
  useMascotTrigger → useMascot.setState('error')
       │
       ├── KimchiSvg: X_X 표정
       ├── MascotSpeech: "위험해요! 바로 확인하세요!"
       └── useSound: play('alert-critical')  ←── 신규
```

### 5.4 통합 포인트

브릿지 훅은 alerts를 소비하는 페이지 컴포넌트(`app/[locale]/page.tsx`)에서 호출:

```tsx
// app/[locale]/page.tsx 내부 (개념적)
const { alerts } = useAlerts();  // 기존 SSE 훅
useAlertMascotBridge(alerts);    // 브릿지: 1줄 추가
```

---

## 6. 성능 영향 분석

### 6.1 Bundle Size 증가 예측

| 모듈 | 예상 크기 (gzipped) | 비고 |
|------|---------------------|------|
| `lib/mascot/level.ts` | ~0.3 KB | 순수 산술 함수 |
| `hooks/useSound.ts` | ~0.5 KB | Web Audio API (브라우저 내장) |
| `lib/mascot/sound-manager.ts` | ~0.7 KB | 싱글톤 AudioContext |
| `hooks/useAlertMascotBridge.ts` | ~0.4 KB | 이벤트 브릿지 |
| `types/mascot.ts` 확장분 | ~0.1 KB | 타입만 (런타임 0) |
| **사운드 에셋** | ~8 KB | levelup.mp3 + badge.mp3 (public/) |
| **소계** | **~10 KB** | 현재 번들 대비 <0.5% 증가 |

**framer-motion (^12.34.3)**: 이미 설치됨. 레벨업 연출에 재사용 → 추가 의존성 0.

### 6.2 런타임 성능 영향

| 항목 | 영향 | 완화 전략 |
|------|------|-----------|
| localStorage 접근 빈도 | 레벨업 시마다 write | 배치 업데이트 (debounce 1초) |
| AudioContext 메모리 | AudioBuffer 캐시 (~50KB 총합) | 싱글톤 + lazy init |
| 추가 CustomEvent dispatch | ~0.01ms per event | 무시 가능 |
| 연속 사용 일수 계산 | Date 비교 1회/마운트 | useEffect 마운트 시 1회만 |
| SSE → 마스코트 브릿지 | 30초 스로틀 | 최대 1회/30초 이벤트 |

### 6.3 GPU 가속 가능 여부

| 애니메이션 | 방식 | GPU 가속 |
|-----------|------|----------|
| 기존 CSS @keyframes (7종) | `transform`, `opacity` | **Yes** (will-change: transform 적용 중) |
| Framer Motion spring (비행) | `x`, `y` transform | **Yes** (Framer 자동 GPU 가속) |
| 레벨업 연출 (신규) | `scale` + `opacity` + `filter` | **Yes** (compositing layer) |
| 경험치 바 진행 | `width` transition | **No** (layout trigger) → `transform: scaleX()` 사용 권장 |
| 뱃지 획득 반짝 | `opacity` + `scale` | **Yes** |

**권장**: 경험치 바의 진행 애니메이션은 `width` 대신 `transform: scaleX()`를 사용하여 layout thrashing 방지.

### 6.4 prefers-reduced-motion 대응

```css
@media (prefers-reduced-motion: reduce) {
  .kimchi-mascot-levelup,
  .kimchi-mascot-badge {
    animation: none !important;
    transition: none !important;
  }
}
```

기존 `getRandomFlyTarget()`에서 이미 `prefers-reduced-motion` 체크 구현 → 동일 패턴 적용.

---

## 7. 신규 파일 목록 및 수정 파일

### 신규 파일

| 파일 | 역할 |
|------|------|
| `lib/mascot/level.ts` | 레벨 계산 로직, 임계값, 진행도 |
| `lib/mascot/sound-manager.ts` | AudioContext 싱글톤, buffer 캐시, playSound |
| `hooks/useSound.ts` | useSound 커스텀 훅 (React 래퍼) |
| `hooks/useAlertMascotBridge.ts` | 공정 알림 → 마스코트 이벤트 변환 브릿지 |
| `public/sounds/levelup.mp3` | 레벨업 효과음 (~5KB) |
| `public/sounds/badge.mp3` | 뱃지 획득 효과음 (~3KB) |

### 수정 파일

| 파일 | 변경 내용 | 영향도 |
|------|-----------|--------|
| `types/mascot.ts` | MascotLevel, MascotSoundEffect, ProcessAlertBridge 타입 추가, MascotSettings 확장, MascotEventDetail 확장 | Medium |
| `hooks/useMascot.ts` | setState 내부에 경험치 적립 + 레벨 계산 로직 추가, DEFAULT_SETTINGS에 level 초기값 | Medium |
| `hooks/useMascotTrigger.ts` | 확장된 MascotEventDetail 필드를 onStateChange에 전달 | Low |
| `lib/utils/mascot-event.ts` | options 파라미터 추가 (하위 호환) | Low |
| `components/mascot/KimchiMascotContainer.tsx` | useSound 훅 연결, 레벨 표시 UI | Medium |
| `components/mascot/MascotToggle.tsx` | 사운드 ON/OFF 메뉴 항목 추가 | Low |
| `app/[locale]/page.tsx` | useAlertMascotBridge 훅 연결 (1줄) | Low |
| `app/globals.css` | 레벨업/뱃지 @keyframes 추가 | Low |

---

## 8. 아키텍처 결정 요약 (ADR)

| # | 결정 | 이유 |
|---|------|------|
| ADR-1 | 레벨 데이터를 localStorage에 저장 | Phase 6 인증 미완료, MVP 우선, 기존 settings 패턴 재사용 |
| ADR-2 | MascotEventDetail 확장은 optional 필드로 | 기존 5개 호출부 변경 불필요 (하위 호환) |
| ADR-3 | Web Audio는 lazy init + 싱글톤 AudioContext | autoplay 정책 준수, 메모리 효율 |
| ADR-4 | 대부분의 효과음은 OscillatorNode로 합성 | 번들 사이즈 0 추가, MP3는 레벨업/뱃지만 |
| ADR-5 | 공정 알림 브릿지는 별도 훅 (useAlertMascotBridge) | 기존 SSE 컴포넌트 변경 최소화, 관심사 분리 |
| ADR-6 | 경험치 바는 scaleX() transform | layout thrashing 방지, GPU 가속 |
| ADR-7 | 스로틀 30초 (공정 알림) | 마스코트 과도한 반응 방지, UX 품질 유지 |

---

## 9. 의존성 영향

- **신규 npm 패키지: 0개** (Web Audio API는 브라우저 내장)
- **framer-motion**: 이미 설치됨 (레벨업 연출에 재사용)
- **public/ 에셋 추가**: ~8KB (2개 MP3 파일)
- **총 번들 사이즈 증가**: ~2KB gzipped (JS만) + ~8KB 에셋 = **~10KB 총합**
