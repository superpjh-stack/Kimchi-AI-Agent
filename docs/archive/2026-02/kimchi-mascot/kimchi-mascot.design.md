# kimchi-mascot Design Document

> **Summary**: 김치군(김치君) -- 배추김치 캐릭터 마스코트 시스템. SVG 인라인 캐릭터 + CSS 애니메이션 상태 머신 + 상황별 추임새(대사) 시스템을 통해 김치공장 현장 근무자에게 친근한 AI 동료 경험을 제공한다.
>
> **Project**: Kimchi-Agent
> **Version**: 1.0.0
> **Author**: CTO Team (Enterprise 5-member)
> **Date**: 2026-02-28
> **Status**: Draft
> **Planning Doc**: [kimchi-mascot.plan.md](../../01-plan/features/kimchi-mascot.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. **감정 표현 레이어**: AI 시스템의 내부 상태(검색/생성/완료/오류)를 시각적 캐릭터로 표현
2. **공장 현장 친화**: 50대 이상 근무자도 직관적으로 이해하는 비주얼 피드백
3. **제로 성능 영향**: CSS-only 애니메이션, GPU 가속, CLS 0, 번들 사이즈 최소화
4. **접근성 완전 준수**: WCAG 2.1 AA, prefers-reduced-motion, aria-live 지원
5. **비침투적 통합**: 기존 page.tsx, useChat, 이벤트 흐름을 변경하지 않고 추가만으로 동작

### 1.2 Design Principles

- **Single Responsibility**: 마스코트 렌더링, 대사 관리, 이벤트 수신을 각각 분리
- **Pure CSS Animation**: JavaScript requestAnimationFrame 대신 CSS keyframes + will-change
- **Event-Driven Decoupling**: CustomEvent 기반으로 마스코트와 비즈니스 로직 완전 분리
- **Progressive Enhancement**: 마스코트 OFF 시 기능 손실 없음, 장식 전용 레이어

---

## 2. Architecture

### 2.1 Component Diagram

```
┌────────────────────────────────────────────────────────────────┐
│  app/[locale]/page.tsx                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  <KimchiMascotContainer>                                 │  │
│  │    ┌────────────┐   ┌────────────┐   ┌───────────────┐  │  │
│  │    │ KimchiSvg  │   │MascotSpeech│   │ MascotToggle  │  │  │
│  │    │ (SVG 캐릭터)│   │ (말풍선)    │   │ (ON/OFF 토글) │  │  │
│  │    └─────┬──────┘   └─────┬──────┘   └───────────────┘  │  │
│  │          │                │                               │  │
│  │          └────────┬───────┘                               │  │
│  │                   │                                       │  │
│  │           useMascot (상태 관리 훅)                         │  │
│  │                   │                                       │  │
│  │           useMascotTrigger (이벤트 수신 훅)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  기존 컴포넌트 (ChatWindow, DocumentUpload 등)            │  │
│  │  → window.dispatchEvent(CustomEvent) 호출만 추가          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
User Action (전송/업로드/오류 등)
    │
    ▼
CustomEvent('kimchi-mascot', { detail: { state, context } })
    │
    ▼
useMascotTrigger (window.addEventListener)
    │
    ▼
useMascot (상태 머신: idle → thinking → success)
    │
    ├──▶ KimchiSvg (CSS class 전환 → 애니메이션)
    │
    └──▶ MascotSpeech (대사 랜덤 선택 → 말풍선 표시 3초)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| KimchiMascotContainer | useMascot, useMascotTrigger | 상태 관리 + 이벤트 수신 통합 |
| KimchiSvg | MascotState (type) | 상태에 따른 SVG 애니메이션 클래스 전환 |
| MascotSpeech | mascot-phrases.ts | 상태별 대사 데이터 소스 |
| useMascotTrigger | window CustomEvent | 글로벌 이벤트 → 로컬 상태 브릿지 |
| useChat.ts | window.dispatchEvent | 기존 훅에 이벤트 발행 1줄 추가 |

---

## 3. Data Model

### 3.1 Type Definitions

```typescript
// types/mascot.ts

/** 마스코트 감정 상태 */
export type MascotState =
  | 'idle'         // 기본 대기 — 숨쉬기 애니메이션
  | 'thinking'     // AI 처리 중 — 좌우 흔들림
  | 'success'      // 응답 완료 — 폴짝 점프
  | 'error'        // 오류 발생 — 당황 표현
  | 'celebrating'  // 문서 업로드 완료 — 환호
  | 'searching'    // RAG 검색 중 — 두리번
  | 'sleeping';    // 야간 모드 — 졸음

/** 마스코트 이벤트 컨텍스트 */
export type MascotContext =
  | 'chat'         // 채팅 관련
  | 'upload'       // 문서 업로드
  | 'system'       // 시스템 이벤트
  | 'time';        // 시간 기반 이벤트

/** CustomEvent detail 구조 */
export interface MascotEventDetail {
  state: MascotState;
  context?: MascotContext;
  /** 강제 대사 지정 (선택) */
  forcedPhrase?: string;
}

/** 마스코트 설정 (LocalStorage) */
export interface MascotSettings {
  enabled: boolean;        // ON/OFF
  speechEnabled: boolean;  // 대사 표시 여부
}

/** 대사 항목 */
export interface MascotPhrase {
  text: string;
  /** 선택적 이모지 (대사 끝에 추가) */
  emoji?: string;
}
```

### 3.2 LocalStorage Schema

```typescript
// Key: 'kimchi-mascot-settings'
// Value: JSON string of MascotSettings
const DEFAULT_SETTINGS: MascotSettings = {
  enabled: true,
  speechEnabled: true,
};
```

보안 검토 (Security Architect):
- LocalStorage에 민감 정보 없음 (boolean 2개만 저장)
- XSS 공격 시에도 마스코트 설정 변조는 기능적 피해 없음
- JSON.parse 시 try-catch로 파싱 오류 방어

---

## 4. SVG Character Design (Frontend Architect)

### 4.1 캐릭터 구성 요소

```
┌─────────────────────┐
│    잎사귀 (3장)       │  ← 머리 위 배추 잎
├─────────────────────┤
│  눈 (●  ●)          │  ← 깜박임 애니메이션
│  볼 (빨간 동그라미)   │  ← 홍조
│  입 (곡선)           │  ← 상태별 변화
├─────────────────────┤
│  몸통 (배추 형태)     │  ← 연한 초록 + 크림색 그라데이션
├─────────────────────┤
│  팔 (좌/우)          │  ← 상태별 위치 변화
│  다리 (좌/우)        │  ← 점프/흔들림
└─────────────────────┘
```

### 4.2 SVG 코드 (KimchiSvg.tsx)

```tsx
// components/mascot/KimchiSvg.tsx
'use client';

import React from 'react';
import type { MascotState } from '@/types/mascot';

interface KimchiSvgProps {
  state: MascotState;
  size?: number;
  className?: string;
}

const KimchiSvg = React.memo(function KimchiSvg({
  state,
  size = 60,
  className = '',
}: KimchiSvgProps) {
  // 상태별 입 모양 path
  const mouthPath: Record<MascotState, string> = {
    idle: 'M 22 38 Q 30 43 38 38',       // 미소
    thinking: 'M 24 39 Q 30 37 36 39',    // 일자
    success: 'M 22 36 Q 30 45 38 36',     // 활짝 웃음
    error: 'M 24 42 Q 30 38 36 42',       // 찡그림
    celebrating: 'M 20 36 Q 30 48 40 36', // 크게 벌린 입
    searching: 'M 25 38 Q 30 41 35 38',   // 오 모양
    sleeping: 'M 24 40 L 36 40',          // 일자 (잠)
  };

  // 상태별 눈 (sleeping일 때 감은 눈)
  const renderEyes = () => {
    if (state === 'sleeping') {
      return (
        <>
          <path d="M 20 28 Q 24 26 28 28" stroke="#2D1810" strokeWidth="2"
                fill="none" strokeLinecap="round" />
          <path d="M 32 28 Q 36 26 40 28" stroke="#2D1810" strokeWidth="2"
                fill="none" strokeLinecap="round" />
        </>
      );
    }
    if (state === 'error') {
      return (
        <>
          {/* X 눈 (왼) */}
          <line x1="21" y1="25" x2="27" y2="31" stroke="#2D1810" strokeWidth="2"
                strokeLinecap="round" />
          <line x1="27" y1="25" x2="21" y2="31" stroke="#2D1810" strokeWidth="2"
                strokeLinecap="round" />
          {/* X 눈 (오) */}
          <line x1="33" y1="25" x2="39" y2="31" stroke="#2D1810" strokeWidth="2"
                strokeLinecap="round" />
          <line x1="39" y1="25" x2="33" y2="31" stroke="#2D1810" strokeWidth="2"
                strokeLinecap="round" />
        </>
      );
    }
    return (
      <>
        <circle cx="24" cy="28" r="3" fill="#2D1810">
          <animate attributeName="ry" values="3;0.5;3" dur="3s"
                   repeatCount="indefinite" begin="0s"
                   keyTimes="0;0.03;0.06" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                   calcMode="spline" />
        </circle>
        <circle cx="36" cy="28" r="3" fill="#2D1810">
          <animate attributeName="ry" values="3;0.5;3" dur="3s"
                   repeatCount="indefinite" begin="0s"
                   keyTimes="0;0.03;0.06" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                   calcMode="spline" />
        </circle>
        {/* 하이라이트 */}
        <circle cx="25.5" cy="26.5" r="1" fill="white" opacity="0.8" />
        <circle cx="37.5" cy="26.5" r="1" fill="white" opacity="0.8" />
      </>
    );
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`kimchi-mascot kimchi-mascot--${state} ${className}`}
      role="img"
      aria-hidden="true"
    >
      {/* 잎사귀 3장 */}
      <ellipse cx="22" cy="10" rx="6" ry="10" fill="#52B788"
               transform="rotate(-20 22 10)" opacity="0.9" />
      <ellipse cx="30" cy="8" rx="5" ry="11" fill="#2A9D8F" />
      <ellipse cx="38" cy="10" rx="6" ry="10" fill="#52B788"
               transform="rotate(20 38 10)" opacity="0.9" />

      {/* 몸통 (배추 형태 — 타원) */}
      <ellipse cx="30" cy="34" rx="16" ry="20" fill="#F5E6CA" />
      {/* 배추 겉 레이어 (연한 초록 테두리) */}
      <ellipse cx="30" cy="34" rx="16" ry="20" fill="none"
               stroke="#2A9D8F" strokeWidth="1.5" opacity="0.4" />
      {/* 배추 내부 결 */}
      <path d="M 22 20 Q 30 25 38 20" stroke="#EAD2AC" strokeWidth="1"
            fill="none" opacity="0.5" />
      <path d="M 20 28 Q 30 33 40 28" stroke="#EAD2AC" strokeWidth="1"
            fill="none" opacity="0.3" />

      {/* 볼터치 */}
      <circle cx="18" cy="33" r="3.5" fill="#E85D5D" opacity="0.3" />
      <circle cx="42" cy="33" r="3.5" fill="#E85D5D" opacity="0.3" />

      {/* 눈 */}
      {renderEyes()}

      {/* 입 */}
      <path d={mouthPath[state]} stroke="#2D1810" strokeWidth="1.8"
            fill="none" strokeLinecap="round" />

      {/* 팔 (왼) */}
      <path d="M 14 32 Q 8 30 6 26" stroke="#F5E6CA" strokeWidth="3"
            strokeLinecap="round" fill="none"
            className="kimchi-mascot__arm-left" />

      {/* 팔 (오) */}
      <path d="M 46 32 Q 52 30 54 26" stroke="#F5E6CA" strokeWidth="3"
            strokeLinecap="round" fill="none"
            className="kimchi-mascot__arm-right" />

      {/* 다리 */}
      <line x1="24" y1="52" x2="22" y2="58" stroke="#EAD2AC"
            strokeWidth="3" strokeLinecap="round" />
      <line x1="36" y1="52" x2="38" y2="58" stroke="#EAD2AC"
            strokeWidth="3" strokeLinecap="round" />

      {/* searching 상태: 돋보기 */}
      {state === 'searching' && (
        <g transform="translate(44, 18) rotate(30)">
          <circle cx="0" cy="0" r="5" fill="none" stroke="#F77F00"
                  strokeWidth="1.5" />
          <line x1="3.5" y1="3.5" x2="8" y2="8" stroke="#F77F00"
                strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {/* sleeping 상태: Zzz */}
      {state === 'sleeping' && (
        <g className="kimchi-mascot__zzz">
          <text x="44" y="18" fontSize="8" fill="#A8907A" fontWeight="bold"
                opacity="0.7">Z</text>
          <text x="48" y="12" fontSize="6" fill="#A8907A" fontWeight="bold"
                opacity="0.5">z</text>
          <text x="51" y="8" fontSize="5" fill="#A8907A" fontWeight="bold"
                opacity="0.3">z</text>
        </g>
      )}
    </svg>
  );
});

export default KimchiSvg;
```

### 4.3 SVG 디자인 사양

| 속성 | 값 | 비고 |
|------|------|------|
| ViewBox | 0 0 60 60 | 정사각형 기준 |
| 기본 크기 | 60x60px | 데스크톱 |
| 모바일 크기 | 40x40px | `md:` breakpoint 전환 |
| 몸통 색상 | #F5E6CA (kimchi-beige) | 기존 브랜드 색상 재사용 |
| 잎사귀 색상 | #2A9D8F / #52B788 | kimchi-green 계열 |
| 볼터치 색상 | #E85D5D (kimchi-red-light) | 30% opacity |
| 테두리/눈 | #2D1810 (brand-text-primary) | 프로젝트 텍스트 색 |

---

## 5. CSS Animation System (Frontend Architect + Performance Architect)

### 5.1 애니메이션 상태 머신

```
                      ┌──────────────────────────────────┐
                      │                                  │
    ┌────────┐  event │  ┌──────────┐     ┌──────────┐  │
    │  idle  │───────▶│  │searching │────▶│ thinking │  │
    │숨쉬기  │        │  │두리번    │     │좌우흔들림│  │
    └────┬───┘        │  └──────────┘     └────┬─────┘  │
         │            │                        │         │
  22~06시│            │                   ┌────┴────┐    │
         ▼            │                   ▼         ▼    │
    ┌────────┐        │  ┌──────────┐  ┌───────┐   │    │
    │sleeping│        │  │  success │  │ error │   │    │
    │  졸음  │        │  │  폴짝   │  │ 당황  │   │    │
    └────────┘        │  └──────────┘  └───────┘   │    │
                      │       │             │       │    │
                      │       └─────────────┴───────┘    │
                      │           3초 후 idle 복귀        │
                      └──────────────────────────────────┘

    ┌────────────┐
    │celebrating │  ← 문서 업로드 완료 시 (별도 트리거)
    │   환호     │
    └────────────┘
```

### 5.2 CSS Keyframes

```css
/* globals.css 또는 mascot.css에 추가 */

/* ========== 마스코트 기본 ========== */
.kimchi-mascot {
  will-change: transform;
  transition: transform 0.3s ease-out;
}

/* ========== idle: 숨쉬기 ========== */
@keyframes mascot-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-3px) scale(1.02); }
}

.kimchi-mascot--idle {
  animation: mascot-breathe 3s ease-in-out infinite;
}

/* ========== thinking: 좌우 흔들림 ========== */
@keyframes mascot-wobble {
  0%, 100% { transform: rotate(0deg); }
  25%      { transform: rotate(-8deg); }
  75%      { transform: rotate(8deg); }
}

.kimchi-mascot--thinking {
  animation: mascot-wobble 0.8s ease-in-out infinite;
}

/* ========== success: 폴짝 점프 ========== */
@keyframes mascot-jump {
  0%   { transform: translateY(0) scale(1); }
  30%  { transform: translateY(-12px) scale(1.05); }
  50%  { transform: translateY(-14px) scale(1.08); }
  70%  { transform: translateY(-8px) scale(1.03); }
  100% { transform: translateY(0) scale(1); }
}

.kimchi-mascot--success {
  animation: mascot-jump 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* ========== error: 부들부들 ========== */
@keyframes mascot-shake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-4px); }
  40%      { transform: translateX(4px); }
  60%      { transform: translateX(-3px); }
  80%      { transform: translateX(3px); }
}

.kimchi-mascot--error {
  animation: mascot-shake 0.5s ease-in-out;
}

/* ========== celebrating: 환호 점프 반복 ========== */
@keyframes mascot-celebrate {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25%      { transform: translateY(-10px) rotate(-5deg); }
  50%      { transform: translateY(0) rotate(0deg); }
  75%      { transform: translateY(-10px) rotate(5deg); }
}

.kimchi-mascot--celebrating {
  animation: mascot-celebrate 0.8s ease-in-out 3;
}

/* ========== searching: 두리번 ========== */
@keyframes mascot-peek {
  0%, 100% { transform: translateX(0); }
  30%      { transform: translateX(-5px) rotate(-3deg); }
  70%      { transform: translateX(5px) rotate(3deg); }
}

.kimchi-mascot--searching {
  animation: mascot-peek 1.2s ease-in-out infinite;
}

/* ========== sleeping: 느린 기울기 ========== */
@keyframes mascot-sleep {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(8deg); }
}

.kimchi-mascot--sleeping {
  animation: mascot-sleep 4s ease-in-out infinite;
}

/* ========== Zzz 부유 ========== */
@keyframes mascot-zzz {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50%      { opacity: 0.8; transform: translateY(-4px); }
}

.kimchi-mascot__zzz text {
  animation: mascot-zzz 2s ease-in-out infinite;
}
.kimchi-mascot__zzz text:nth-child(2) { animation-delay: 0.3s; }
.kimchi-mascot__zzz text:nth-child(3) { animation-delay: 0.6s; }

/* ========== 팔 애니메이션 ========== */
@keyframes arm-wave-left {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(-20deg); }
}
@keyframes arm-wave-right {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(20deg); }
}

.kimchi-mascot--success .kimchi-mascot__arm-left,
.kimchi-mascot--celebrating .kimchi-mascot__arm-left {
  transform-origin: 14px 32px;
  animation: arm-wave-left 0.4s ease-in-out 2;
}
.kimchi-mascot--success .kimchi-mascot__arm-right,
.kimchi-mascot--celebrating .kimchi-mascot__arm-right {
  transform-origin: 46px 32px;
  animation: arm-wave-right 0.4s ease-in-out 2;
}

/* ========== 말풍선 ========== */
@keyframes speech-fade-in {
  0%   { opacity: 0; transform: translateY(4px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes speech-fade-out {
  0%   { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-4px) scale(0.95); }
}

.mascot-speech--enter {
  animation: speech-fade-in 0.25s ease-out forwards;
}

.mascot-speech--exit {
  animation: speech-fade-out 0.25s ease-in forwards;
}

/* ========== 접근성: 모션 축소 ========== */
@media (prefers-reduced-motion: reduce) {
  .kimchi-mascot,
  .kimchi-mascot--idle,
  .kimchi-mascot--thinking,
  .kimchi-mascot--success,
  .kimchi-mascot--error,
  .kimchi-mascot--celebrating,
  .kimchi-mascot--searching,
  .kimchi-mascot--sleeping,
  .kimchi-mascot__zzz text,
  .kimchi-mascot__arm-left,
  .kimchi-mascot__arm-right,
  .mascot-speech--enter,
  .mascot-speech--exit {
    animation: none !important;
    transition: none !important;
  }
}
```

### 5.3 성능 분석 (Performance Architect)

| 항목 | 값 | 근거 |
|------|------|------|
| 렌더링 방식 | CSS-only (GPU composite) | transform/opacity만 사용 = 합성 레이어만 변경 |
| will-change | transform | 브라우저 합성 레이어 사전 할당 |
| 리페인트 발생 | 0 | layout/paint 트리거 속성 사용 안 함 |
| JS animation cost | 0ms | requestAnimationFrame 미사용 |
| CLS 영향 | 0 | position:fixed, 크기 고정, 기존 레이아웃 불변 |
| 번들 사이즈 | ~4KB (gzipped) | SVG inline + CSS keyframes |
| 메모리 누수 | 방지됨 | useEffect cleanup으로 이벤트 리스너 해제 |
| 60fps 보장 | Yes | transform-only 애니메이션 = 합성 스레드 처리 |

---

## 6. Component Interfaces (Developer)

### 6.1 File Structure

```
components/mascot/
  KimchiMascotContainer.tsx   # 메인 통합 컴포넌트 (position:fixed)
  KimchiSvg.tsx               # SVG 캐릭터 (위 4.2 참조)
  MascotSpeech.tsx            # 말풍선 컴포넌트
  MascotToggle.tsx            # ON/OFF 토글 버튼
  mascot-phrases.ts           # 상황별 대사 데이터

hooks/
  useMascot.ts                # 마스코트 상태 관리 훅
  useMascotTrigger.ts         # 글로벌 이벤트 → 상태 브릿지

types/
  mascot.ts                   # 타입 정의 (3.1 참조)
```

### 6.2 KimchiMascotContainer.tsx

```tsx
'use client';

import { useCallback } from 'react';
import KimchiSvg from './KimchiSvg';
import MascotSpeech from './MascotSpeech';
import MascotToggle from './MascotToggle';
import { useMascot } from '@/hooks/useMascot';
import { useMascotTrigger } from '@/hooks/useMascotTrigger';

export default function KimchiMascotContainer() {
  const {
    state,
    phrase,
    showSpeech,
    settings,
    setState,
    dismissSpeech,
    toggleEnabled,
    toggleSpeech,
  } = useMascot();

  // 글로벌 이벤트 수신 → useMascot 상태 변경
  useMascotTrigger(setState);

  // OFF 상태이면 토글 버튼만 표시
  if (!settings.enabled) {
    return (
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50">
        <MascotToggle
          enabled={false}
          onToggle={toggleEnabled}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50
                 flex flex-col items-end gap-1"
      role="complementary"
      aria-label="김치군 마스코트"
    >
      {/* 말풍선 */}
      {showSpeech && phrase && settings.speechEnabled && (
        <MascotSpeech
          text={phrase.text}
          emoji={phrase.emoji}
          onDismiss={dismissSpeech}
        />
      )}

      {/* 캐릭터 */}
      <div className="relative">
        <KimchiSvg
          state={state}
          size={60}
          className="w-[40px] h-[40px] md:w-[60px] md:h-[60px]"
        />

        {/* ON/OFF 토글 — 캐릭터 좌상단 */}
        <div className="absolute -top-1 -left-1">
          <MascotToggle
            enabled={true}
            speechEnabled={settings.speechEnabled}
            onToggle={toggleEnabled}
            onSpeechToggle={toggleSpeech}
          />
        </div>
      </div>
    </div>
  );
}
```

### 6.3 MascotSpeech.tsx

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { MascotPhrase } from '@/types/mascot';

interface MascotSpeechProps {
  text: string;
  emoji?: string;
  /** 표시 지속 시간 (ms) */
  duration?: number;
  onDismiss: () => void;
}

export default function MascotSpeech({
  text,
  emoji,
  duration = 3500,
  onDismiss,
}: MascotSpeechProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setIsExiting(true), duration - 300);
    const dismissTimer = setTimeout(onDismiss, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);

  return (
    <div
      className={`
        max-w-[180px] px-3 py-2 rounded-xl
        bg-white border border-brand-border shadow-lg
        text-sm text-brand-text-primary font-medium leading-snug
        ${isExiting ? 'mascot-speech--exit' : 'mascot-speech--enter'}
      `}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="break-keep">
        {text}
        {emoji && <span className="ml-1">{emoji}</span>}
      </p>
      {/* 말풍선 꼬리 (아래 방향) */}
      <div className="absolute -bottom-1.5 right-4 w-3 h-3
                      bg-white border-r border-b border-brand-border
                      transform rotate-45" />
    </div>
  );
}
```

### 6.4 MascotToggle.tsx

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';

interface MascotToggleProps {
  enabled: boolean;
  speechEnabled?: boolean;
  onToggle: () => void;
  onSpeechToggle?: () => void;
}

export default function MascotToggle({
  enabled,
  speechEnabled = true,
  onToggle,
  onSpeechToggle,
}: MascotToggleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (!enabled) {
    // OFF 상태: 미니 복원 버튼
    return (
      <button
        onClick={onToggle}
        className="w-8 h-8 rounded-full bg-brand-surface border border-brand-border
                   shadow-md flex items-center justify-center
                   text-xs text-brand-text-muted hover:text-brand-text-primary
                   transition-colors"
        aria-label="김치군 켜기"
        title="김치군 켜기"
      >
        🥬
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="w-5 h-5 rounded-full bg-white/80 border border-brand-border
                   shadow-sm flex items-center justify-center
                   text-[10px] hover:bg-white transition-colors"
        aria-label="김치군 설정"
        aria-expanded={menuOpen}
      >
        ...
      </button>

      {menuOpen && (
        <div className="absolute top-6 right-0 bg-white border border-brand-border
                        rounded-lg shadow-lg py-1 min-w-[120px] z-50 text-xs">
          <button
            onClick={() => { onToggle(); setMenuOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-kimchi-cream
                       transition-colors text-brand-text-primary"
          >
            김치군 끄기
          </button>
          {onSpeechToggle && (
            <button
              onClick={() => { onSpeechToggle(); setMenuOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-kimchi-cream
                         transition-colors text-brand-text-primary"
            >
              {speechEnabled ? '대사 끄기' : '대사 켜기'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

### 6.5 useMascot.ts

```typescript
// hooks/useMascot.ts
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { MascotState, MascotPhrase, MascotSettings } from '@/types/mascot';
import { getRandomPhrase } from '@/components/mascot/mascot-phrases';

const STORAGE_KEY = 'kimchi-mascot-settings';
const DEFAULT_SETTINGS: MascotSettings = { enabled: true, speechEnabled: true };
const STATE_RESET_DELAY: Record<MascotState, number> = {
  idle: 0,
  thinking: 0,       // thinking은 자동 해제 안 함 (done 이벤트로 전환)
  success: 3000,
  error: 3000,
  celebrating: 3000,
  searching: 0,       // searching도 자동 해제 안 함
  sleeping: 0,        // sleeping도 자동 해제 안 함
};

function loadSettings(): MascotSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: MascotSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage 사용 불가 시 무시
  }
}

export function useMascot() {
  const [state, setStateInternal] = useState<MascotState>('idle');
  const [phrase, setPhrase] = useState<MascotPhrase | null>(null);
  const [showSpeech, setShowSpeech] = useState(false);
  const [settings, setSettings] = useState<MascotSettings>(DEFAULT_SETTINGS);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 마운트 시 설정 로드 + 야간 체크
  useEffect(() => {
    setSettings(loadSettings());
    checkNightMode();
  }, []);

  // 야간 모드 체크 (22:00~06:00)
  const checkNightMode = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      setStateInternal('sleeping');
      setPhrase(getRandomPhrase('sleeping'));
      setShowSpeech(true);
    }
  }, []);

  const setState = useCallback((newState: MascotState, forcedPhrase?: string) => {
    // 이전 타이머 정리
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    setStateInternal(newState);

    // 대사 선택
    if (forcedPhrase) {
      setPhrase({ text: forcedPhrase });
    } else {
      setPhrase(getRandomPhrase(newState));
    }
    setShowSpeech(true);

    // 자동 idle 복귀
    const delay = STATE_RESET_DELAY[newState];
    if (delay > 0) {
      resetTimerRef.current = setTimeout(() => {
        setStateInternal('idle');
        setShowSpeech(false);
        resetTimerRef.current = null;
      }, delay);
    }
  }, []);

  const dismissSpeech = useCallback(() => {
    setShowSpeech(false);
  }, []);

  const toggleEnabled = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleSpeech = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, speechEnabled: !prev.speechEnabled };
      saveSettings(next);
      return next;
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  return {
    state,
    phrase,
    showSpeech,
    settings,
    setState,
    dismissSpeech,
    toggleEnabled,
    toggleSpeech,
  };
}
```

### 6.6 useMascotTrigger.ts

```typescript
// hooks/useMascotTrigger.ts
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
  onStateChange: (state: MascotState, forcedPhrase?: string) => void
) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<MascotEventDetail>).detail;
      if (detail?.state) {
        onStateChange(detail.state, detail.forcedPhrase);
      }
    };

    window.addEventListener('kimchi-mascot', handler);
    return () => window.removeEventListener('kimchi-mascot', handler);
  }, [onStateChange]);
}
```

---

## 7. Phrase Data (mascot-phrases.ts) (Product Manager + Developer)

```typescript
// components/mascot/mascot-phrases.ts

import type { MascotState, MascotPhrase } from '@/types/mascot';

/**
 * 상황별 대사 풀 — 공장 현장 감성의 친근한 한국어.
 * 각 상태별 5~8개의 대사로 반복 사용 시에도 다양한 표현 제공.
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
let lastPhraseIndex: Record<string, number> = {};

export function getRandomPhrase(state: MascotState): MascotPhrase {
  const pool = PHRASES[state];
  if (!pool || pool.length === 0) {
    return { text: '...' };
  }

  const lastIdx = lastPhraseIndex[state] ?? -1;
  let idx: number;

  // 연속 같은 대사 방지 (최대 3회 재시도)
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
```

---

## 8. Global Event Integration

### 8.1 CustomEvent Specification

```typescript
// 이벤트 이름: 'kimchi-mascot'
// TypeScript global 타입 확장 (types/mascot.ts에 추가)

declare global {
  interface WindowEventMap {
    'kimchi-mascot': CustomEvent<MascotEventDetail>;
  }
}
```

### 8.2 Event Dispatch Utility

```typescript
// lib/utils/mascot-event.ts

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
```

### 8.3 Integration Points (기존 코드 변경 최소화)

#### useChat.ts 수정 사항 (3줄 추가)

```typescript
// hooks/useChat.ts 에 추가할 import
import { dispatchMascotEvent } from '@/lib/utils/mascot-event';

// sendMessage 함수 내부 — 기존 코드의 적절한 위치에 삽입:

// 1) 메시지 전송 시작 (fetch 직전)
dispatchMascotEvent('searching', 'chat');

// 2) 첫 토큰 수신 시 (event.type === 'token' 분기 내, 한 번만)
// setChatStatus 호출 직후
if (chatStatus === 'rag-searching') {
  dispatchMascotEvent('thinking', 'chat');
}

// 3) 완료 시 (event.type === 'done' 분기 내)
dispatchMascotEvent('success', 'chat');

// 4) 에러 시 (catch 블록)
dispatchMascotEvent('error', 'chat');
```

#### DocumentUpload.tsx 수정 사항 (1줄 추가)

```typescript
// 업로드 성공 시
dispatchMascotEvent('celebrating', 'upload');
```

---

## 9. app/[locale]/page.tsx Integration (Developer)

### 9.1 변경 사항 (기존 코드 비침투적 추가)

```tsx
// app/[locale]/page.tsx — 추가/변경 사항만 표시

// 1) import 추가
import KimchiMascotContainer from '@/components/mascot/KimchiMascotContainer';

// 2) JSX — 닫는 </div> 직전, BottomNav와 같은 레벨에 추가
return (
  <div className="flex h-screen overflow-hidden bg-kimchi-cream">
    {/* Sidebar */}
    <Sidebar ... />

    {/* Main Content */}
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <Header ... />
      <div className="flex flex-1 overflow-hidden">
        <main ...>
          {/* ... 기존 tab 콘텐츠 ... */}
        </main>
        <QuestionPanel ... />
      </div>
    </div>

    {/* Mobile bottom navigation */}
    <BottomNav ... />

    {/* === 김치군 마스코트 (새로 추가) === */}
    <KimchiMascotContainer />
  </div>
);
```

### 9.2 충돌 분석

| 잠재적 충돌 | 해결 방법 |
|-------------|-----------|
| z-index 겹침 (BottomNav) | 마스코트 z-50, BottomNav도 z-50이지만 bottom 위치가 다름 (bottom-20 vs bottom-0) |
| 모바일 BottomNav 가려짐 | `bottom-20 lg:bottom-6`으로 모바일에서 BottomNav 위에 위치 |
| 기존 useChat 훅 변경 | dispatchMascotEvent 3줄만 추가, 기존 로직 변경 없음 |
| SSR/hydration 미스매치 | localStorage는 useEffect 내에서만 접근 (hydration-safe) |
| 다크 모드 | 현재 미지원, future consideration |

---

## 10. i18n Support

### 10.1 messages/ko.json 추가

```json
{
  "mascot": {
    "label": "김치군 마스코트",
    "turnOn": "김치군 켜기",
    "turnOff": "김치군 끄기",
    "speechOn": "대사 켜기",
    "speechOff": "대사 끄기",
    "settings": "김치군 설정"
  }
}
```

### 10.2 messages/en.json 추가

```json
{
  "mascot": {
    "label": "Kimchi-kun Mascot",
    "turnOn": "Turn on Kimchi-kun",
    "turnOff": "Turn off Kimchi-kun",
    "speechOn": "Turn on speech",
    "speechOff": "Turn off speech",
    "settings": "Kimchi-kun settings"
  }
}
```

참고: 마스코트 대사(mascot-phrases.ts)는 한국어만 지원한다. 영어 대사 풀은 Phase 2 확장 범위로 남긴다. 이유: 타겟 사용자가 한국 공장 현장 근무자이므로 한국어 감성이 핵심 가치.

---

## 11. Accessibility (QA Strategist)

### 11.1 WCAG 2.1 AA Compliance Checklist

| 기준 | 구현 방법 | 상태 |
|------|-----------|------|
| 1.1.1 Non-text Content | SVG: `aria-hidden="true"` (순수 장식) | 설계 완료 |
| 1.4.3 Contrast | 말풍선 텍스트 #2D1810 on #FFFFFF = 15.4:1 | 설계 완료 |
| 2.3.1 Three Flashes | 모든 애니메이션 0.5s+ 주기, 깜박임 없음 | 설계 완료 |
| 2.3.3 Animation from Interactions | `prefers-reduced-motion: reduce` 시 모든 animation/transition 제거 | 설계 완료 |
| 4.1.3 Status Messages | 말풍선: `role="status"` + `aria-live="polite"` | 설계 완료 |
| 2.1.1 Keyboard | 토글 버튼 Tab 접근 가능, Enter/Space 동작 | 설계 완료 |

### 11.2 성능 테스트 기준

| 항목 | 기준 | 측정 방법 |
|------|------|-----------|
| CLS (Cumulative Layout Shift) | 0 (마스코트 추가로 인한 증가 없음) | Lighthouse / Web Vitals |
| 애니메이션 FPS | 60fps (모든 상태) | Chrome DevTools Performance |
| 번들 사이즈 증가 | < 5KB gzipped | `npm run build` 비교 |
| First Paint 영향 | 0ms (lazy 렌더링) | Lighthouse FCP |
| 메모리 누수 | 없음 | Chrome DevTools Memory (24h soak test) |
| 리렌더링 | React.memo로 불필요한 리렌더링 0 | React DevTools Profiler |

### 11.3 사용성 테스트 시나리오

| TC-ID | 시나리오 | 기대 결과 |
|-------|----------|-----------|
| TC-M01 | 채팅 메시지 전송 | 김치군이 searching → thinking → success 순서로 변화 |
| TC-M02 | 문서 업로드 완료 | 김치군이 celebrating 상태 + 환호 대사 |
| TC-M03 | 서버 오류 응답 | 김치군이 error 상태 + 당황 대사 |
| TC-M04 | 22:00 이후 접속 | 김치군이 sleeping 상태 + 야간 대사 |
| TC-M05 | 김치군 OFF 토글 | 캐릭터 숨김, 미니 복원 버튼만 표시 |
| TC-M06 | 대사 OFF 설정 | 캐릭터 애니메이션은 유지, 말풍선만 숨김 |
| TC-M07 | 새로고침 후 설정 유지 | localStorage에서 설정 복원 |
| TC-M08 | 접근성: 스크린리더 | 말풍선 텍스트가 aria-live로 읽힘 |
| TC-M09 | 접근성: 모션 감소 | prefers-reduced-motion 시 정적 표시 |
| TC-M10 | 모바일 레이아웃 | 40x40px, BottomNav 위에 표시, 터치 가능 |

---

## 12. Security Considerations (Security Architect)

### 12.1 Threat Analysis

| 위협 | 심각도 | 완화 조치 |
|------|--------|-----------|
| XSS via forcedPhrase | Low | 대사는 텍스트 노드로만 렌더링 (dangerouslySetInnerHTML 미사용) |
| LocalStorage 변조 | Negligible | 설정값이 boolean 2개뿐, 변조 시 기능적 피해 없음 |
| CustomEvent 스푸핑 | Low | 이벤트 핸들러가 UI 상태만 변경, 보안 민감 동작 없음 |
| SVG injection | None | SVG는 하드코딩된 인라인, 외부 입력 반영 없음 |

### 12.2 Performance Safety

| 항목 | 구현 |
|------|------|
| 메모리 누수 방지 | useEffect return에서 clearTimeout, removeEventListener 호출 |
| 이벤트 리스너 중복 | useMascotTrigger에서 mount/unmount lifecycle으로 1개만 유지 |
| 무한 애니메이션 | CSS animation + will-change로 JS 스레드 부하 없음 |
| localStorage 예외 | try-catch로 Private Browsing 등에서 예외 방어 |

---

## 13. Implementation Guide

### 13.1 Implementation Order

```
Sprint 1 (Day 1):
  1. [x] types/mascot.ts 타입 정의
  2. [x] components/mascot/KimchiSvg.tsx SVG 캐릭터
  3. [x] globals.css에 mascot 애니메이션 keyframes 추가
  4. [x] hooks/useMascot.ts 상태 관리 훅
  5. [x] components/mascot/MascotSpeech.tsx 말풍선

Sprint 2 (Day 2):
  6. [ ] components/mascot/mascot-phrases.ts 대사 데이터
  7. [ ] lib/utils/mascot-event.ts 이벤트 유틸
  8. [ ] hooks/useMascotTrigger.ts 이벤트 수신 훅
  9. [ ] components/mascot/KimchiMascotContainer.tsx 통합 컴포넌트
  10. [ ] components/mascot/MascotToggle.tsx ON/OFF 토글

Sprint 3 (Day 3):
  11. [ ] hooks/useChat.ts에 dispatchMascotEvent 추가
  12. [ ] components/documents/DocumentUpload.tsx에 이벤트 추가
  13. [ ] app/[locale]/page.tsx에 KimchiMascotContainer 통합
  14. [ ] messages/ko.json, messages/en.json i18n 추가

Sprint 4 (Day 3.5):
  15. [ ] 접근성 검증 (aria, prefers-reduced-motion)
  16. [ ] 성능 검증 (CLS, FPS, bundle size)
  17. [ ] 모바일 레이아웃 검증
  18. [ ] 수동 테스트 (TC-M01~TC-M10)
```

### 13.2 Dependencies

| 패키지 | 필요 여부 | 비고 |
|--------|-----------|------|
| 추가 패키지 | 없음 | SVG + CSS + React 내장 기능만 사용 |
| Tailwind | 기존 사용 중 | 클래스 추가만 |
| clsx | 기존 설치됨 | 조건부 클래스 결합 |

### 13.3 Key File Summary

| 파일 경로 | 종류 | 설명 |
|-----------|------|------|
| `types/mascot.ts` | 신규 | MascotState, MascotEventDetail 등 타입 |
| `components/mascot/KimchiSvg.tsx` | 신규 | SVG 배추김치 캐릭터 |
| `components/mascot/MascotSpeech.tsx` | 신규 | 말풍선 컴포넌트 |
| `components/mascot/MascotToggle.tsx` | 신규 | ON/OFF + 대사 토글 |
| `components/mascot/KimchiMascotContainer.tsx` | 신규 | 통합 래퍼 (fixed position) |
| `components/mascot/mascot-phrases.ts` | 신규 | 상태별 대사 데이터 48개 |
| `hooks/useMascot.ts` | 신규 | 마스코트 상태 머신 훅 |
| `hooks/useMascotTrigger.ts` | 신규 | CustomEvent 수신 훅 |
| `lib/utils/mascot-event.ts` | 신규 | dispatchMascotEvent 유틸 |
| `hooks/useChat.ts` | 수정 | dispatchMascotEvent 3줄 추가 |
| `components/documents/DocumentUpload.tsx` | 수정 | dispatchMascotEvent 1줄 추가 |
| `app/[locale]/page.tsx` | 수정 | KimchiMascotContainer import + JSX 1줄 |
| `app/globals.css` | 수정 | 마스코트 CSS keyframes 추가 |
| `messages/ko.json` | 수정 | mascot 섹션 추가 |
| `messages/en.json` | 수정 | mascot 섹션 추가 |

---

## 14. Creative UX Details (Product Manager)

### 14.1 캐릭터 개성 설정

| 항목 | 설정 |
|------|------|
| 이름 | 김치군 (김치君) |
| 성격 | 밝고 열정적, 약간 덜렁대는 동료 |
| 말투 | 반말 + 존댓말 혼합 (공장 선후배 느낌) |
| 특기 | 공장 데이터 찾기, 응원 |
| 약점 | 오류 발생 시 당황함, 밤에 졸림 |

### 14.2 감정 전환 타이밍

```
메시지 전송 → [0ms] searching(두리번) → [첫 토큰] thinking(흔들림) → [done] success(점프)
                                                                    └─ [error] error(부들부들)

문서 업로드 → [완료 응답] celebrating(환호) → [3초 후] idle(숨쉬기)

첫 접속 → [렌더링] idle(숨쉬기) + 인사 대사
22~06시 → [렌더링] sleeping(졸음) + 야간 대사
```

### 14.3 UX 원칙

1. **비침투적**: 마스코트가 콘텐츠를 가리지 않음 (우하단 고정, 60px)
2. **비산만적**: 대사는 3.5초 자동 소멸, 반복 표시 안 함
3. **통제 가능**: 사용자가 완전히 끌 수 있음 (ON/OFF 토글)
4. **컨텍스트 민감**: 현재 상태에 맞는 대사만 표시 (관련 없는 대사 없음)

---

## 15. Future Considerations

| 아이디어 | 우선순위 | 구현 난이도 |
|----------|----------|------------|
| 레벨업 시스템 (사용 빈도 기반) | Medium | High |
| 계절 특별 의상 (김장철 등) | Low | Medium |
| 요일별 특별 대사 (월요일 응원) | Low | Low |
| 김치 숙성도 연동 (공정 데이터 → 캐릭터 색상) | Medium | Medium |
| 사운드 이펙트 | Low | Low |
| 영어 대사 풀 | Low | Low |
| 다크 모드 대응 | Medium | Low |
| 터치 상호작용 (쓰다듬기) | Low | Medium |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-28 | 초기 설계 완성 (5인 팀 통합) | CTO Team |
