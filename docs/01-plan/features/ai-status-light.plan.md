# AI 상태 신호등 (AI Status Light) — Feature Plan

**Date**: 2026-02-27
**Status**: Draft
**Priority**: Medium

---

## 1. Feature Overview

사용자가 채팅 질문을 보낸 뒤, RAG 검색 → LLM 응답 생성 → 완료까지의 **처리 단계를 시각적으로 표시**하는 상태 인디케이터.

현재 `useChat` 훅은 `isStreaming` 불리언 하나만 노출하므로, 사용자는 "지금 무슨 일이 일어나는지" 알 수 없다. 이 기능은 단계별 상태를 분리하여 대기 경험(perceived performance)을 크게 개선한다.

**핵심 가치**:
- 답변 전 최대 1~3초의 RAG/LLM 지연을 사용자가 자연스럽게 이해
- 김치공장 현장 직원 친화적 — 직관적 색상 + 짧은 한국어 텍스트
- 에러 발생 시 명확한 피드백

---

## 2. UI 위치

```
┌─────────────────────────────────────────────────────┐
│  Header                                             │
├─────────────────────────────────────────────────────┤
│  ProcessStatusPanel (기존)                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [AI Status Light Bar]  ← ★ 여기 신규 삽입          │
│  ─────────────────────────────────────────          │
│  ChatWindow (메시지 목록)                            │
│                                                     │
│  [ChatInput]                                        │
└─────────────────────────────────────────────────────┘
```

- **위치**: `ProcessStatusPanel` 아래, `ChatWindow` 내부 메시지 목록 상단 (스티키)
- **크기**: 높이 36px (idle 시 0px로 collapse), 가로 100%
- **표시 조건**: idle 상태가 아닐 때만 visible (CSS height transition으로 자연스럽게 등장/소멸)
- **모바일**: 동일 위치, 텍스트 폰트 크기 12px

---

## 3. 상태 정의

| 상태 ID         | 발생 시점                              | 색상 코드 | 설명 텍스트 (기본)     |
|----------------|--------------------------------------|-----------|----------------------|
| `idle`         | 전송 전 / done 수신 후                 | —         | (비표시)              |
| `rag-searching`| `sendMessage()` 호출 ~ 첫 `token` 전  | 노란색     | 상태별 다름 (아래 참조) |
| `llm-generating`| 첫 `token` SSE 수신 후               | 초록색     | 상태별 다름 (아래 참조) |
| `done`         | `done` SSE 이벤트 수신 후 1.5초       | 초록색 → fade out | (아래 참조) |
| `error`        | `error` SSE 이벤트 또는 fetch 실패    | 빨간색     | (아래 참조) |

**상태 전환 시퀀스**:
```
idle → rag-searching → llm-generating → done → idle
                                      ↘ error → idle
```

---

## 4. 창의적 표현 방안 — 3가지 컨셉

### 컨셉 A: 신호등형 (Traffic Light)

```
● ● ●
🔴 🟡 🟢

[rag-searching] → 🟡 노란 불 점멸 + "관련 문서를 찾는 중..."
[llm-generating] → 🟢 초록 불 점등 + "답변을 만드는 중..."
[done]           → 🟢 초록 불 + "완료!" → 1.5초 후 소멸
[error]          → 🔴 빨간 불 + "오류가 발생했습니다"
```

- 신호등 3개 원형 아이콘 (12px)이 나란히 배치
- 활성 상태의 원만 밝게, 나머지는 dim(opacity 0.2)
- 점멸 애니메이션: `@keyframes pulse` (0.8s ease-in-out infinite)

---

### 컨셉 B: 김치 발효형 (Kimchi Fermentation)

```
[rag-searching]  → 🥬 재료 준비 중...    (배추/재료 아이콘 흔들림)
[llm-generating] → 🌶️ 버무리는 중...     (고추 아이콘 회전)
[done]           → 🫙 숙성 완료!         (항아리 아이콘 팝)
[error]          → ❌ 발효 실패          (X 아이콘 + 빨간 배경)
```

- 각 단계마다 단계 아이콘(이모지 또는 SVG)이 좌측에 배치
- `rag-searching`: 좌우로 흔들리는 흔들기 애니메이션 (`@keyframes wiggle`)
- `llm-generating`: 360도 회전 (`@keyframes spin`, 2s linear infinite)
- `done`: scale 1 → 1.3 → 1 팝 효과 (`@keyframes pop`, 0.3s)
- 프로그레스 바(점선 형태, 점이 흘러가는)를 하단에 결합 가능

---

### 컨셉 C: 프로그레스 바형 (Progress Bar with Steps)

```
──●────────────────────────────────  (25%)
  RAG 검색    LLM 생성       완료

[rag-searching]  → 0~40% 채움, 파란→노란 그라데이션
[llm-generating] → 40~95% 채움, 노란→초록 그라데이션, 토큰 수신 시마다 미세 증가
[done]           → 100%, 초록 → 0.5s 후 사라짐
[error]          → 빨간 100%
```

- 스텝 인디케이터: 3개 원 (RAG / LLM / 완료) + 연결선
- 활성 스텝에 `pulse` 효과
- 토큰 카운터 텍스트 옵션 ("응답 생성 중 · 142자")
- 가장 정보량이 많지만, 좁은 채팅 UI에서 시각적으로 무거울 수 있음

---

## 5. 선정 컨셉

### 최종 선정: **컨셉 B — 김치 발효형** (기본) + **컨셉 A 신호등 색상** (보조)

**선정 이유**:

1. **차별성**: 단순 스피너나 프로그레스 바는 모든 서비스에 있다. 김치공장 전용 에이전트라는 정체성을 UI에서도 표현하면, 현장 직원에게 친근하고 기억에 남는다.
2. **직관성**: 이모지+짧은 한국어 텍스트 조합은 IT 비숙련 현장 직원도 즉시 이해 가능.
3. **구현 단순성**: CSS 애니메이션 3~4줄 수준, 외부 라이브러리 불필요.
4. **색상 보조**: 신호등 색상(노랑/초록/빨강)을 배경 색조로 사용해 접근성을 확보하면서 유머를 더함.

**최종 각 상태 표현**:

| 상태              | 아이콘 | 배경 색조      | 텍스트                  | 애니메이션      |
|-----------------|--------|--------------|------------------------|----------------|
| `rag-searching`  | 🥬     | amber-50     | `관련 문서를 찾는 중...`  | wiggle (1s)    |
| `llm-generating` | 🌶️    | green-50     | `답변을 만드는 중...`     | spin (2s)      |
| `done`           | 🫙     | green-100    | `답변 완료!`             | pop → fade out |
| `error`          | ❌     | red-50       | `오류: {message}`       | shake (0.4s)   |

---

## 6. 컴포넌트 구조

### 신규 파일

```
components/
  chat/
    AiStatusLight.tsx          # 상태 표시 컴포넌트 (순수 표현 컴포넌트)

hooks/
  useChatStatus.ts             # 채팅 상태 파생 훅 (useChat에서 status 추출)
```

### 수정 파일

```
hooks/
  useChat.ts                   # chatStatus 상태 추가 + 반환

types/
  index.ts                     # ChatStatus 타입 추가

app/
  page.tsx                     # chatStatus를 ChatWindow에 전달

components/chat/
  ChatWindow.tsx               # AiStatusLight 렌더링
```

### 타입 정의

```ts
// types/index.ts 추가
export type ChatStatus =
  | 'idle'
  | 'rag-searching'
  | 'llm-generating'
  | 'done'
  | 'error';

export interface ChatStatusInfo {
  status: ChatStatus;
  errorMessage?: string;   // error 상태일 때만
}
```

### AiStatusLight 컴포넌트 인터페이스

```ts
interface AiStatusLightProps {
  status: ChatStatus;
  errorMessage?: string;
  className?: string;
}
```

---

## 7. SSE 연동 방법 — useChat 훅 수정 방향

### 현재 상태 전환 로직 (useChat.ts)

```
sendMessage 호출
  → setIsStreaming(true)
  → [SSE 수신 루프]
    → token 이벤트: 메시지 내용 추가
    → done 이벤트: isStreaming: false
    → error 이벤트: throw Error
  → finally: setIsStreaming(false)
```

### 수정 후 상태 전환 로직

```
sendMessage 호출
  → setChatStatus('rag-searching')     ← 신규: fetch 직후, 첫 token 전
  → [SSE 수신 루프]
    → token 이벤트 (첫 번째):
        setChatStatus('llm-generating') ← 신규: 첫 토큰 수신 시 한 번만
    → token 이벤트 (이후): 기존과 동일
    → sources 이벤트: 기존과 동일
    → done 이벤트:
        setChatStatus('done')           ← 신규
        setTimeout(() => setChatStatus('idle'), 1500)
    → error 이벤트:
        setChatStatus('error')          ← 신규
        setTimeout(() => setChatStatus('idle'), 3000)
  → finally: setIsStreaming(false)
```

**핵심 변경점**:
- `isStreaming` boolean은 유지 (기존 호환성)
- `chatStatus: ChatStatus` 상태를 병렬 추가
- "첫 token 수신" 감지를 위해 `hasFirstToken` ref 사용 (`useRef<boolean>`)
- `useChat` 반환값에 `chatStatus`, `errorMessage` 추가

### 서버 측 SSE 이벤트 추가 (선택 사항 — Phase 2)

현재 서버는 `token` / `sources` / `done` / `error` 만 전송.
선택적으로 서버에서 `status` 이벤트를 추가하면 더 정확한 RAG 완료 시점을 클라이언트에 전달할 수 있다:

```ts
// lib/ai/streaming.ts — 선택적 확장
// RAG 완료 후, LLM 스트리밍 시작 전:
data: {"type":"status","phase":"llm-generating"}
```

단, MVP에서는 **클라이언트 사이드 추론** (fetch 호출 = rag-searching, 첫 token = llm-generating)으로 충분하다.

---

## 8. Acceptance Criteria

| # | 조건 | 검증 방법 |
|---|------|----------|
| AC-1 | 질문 전송 직후 `rag-searching` 상태(🥬 배추)가 amber 배경과 함께 표시된다 | 브라우저 수동 테스트 |
| AC-2 | 첫 번째 SSE `token` 수신 시 `llm-generating` 상태(🌶️ 고추)로 전환된다 | 브라우저 수동 테스트 + 네트워크 탭 확인 |
| AC-3 | `done` SSE 수신 후 1.5초 안에 `idle`(비표시)로 돌아가며 컴포넌트가 사라진다 | 브라우저 수동 테스트 |
| AC-4 | 네트워크 오류 또는 `error` SSE 수신 시 `error` 상태(❌ 빨간 배경)가 표시되고 오류 메시지가 포함된다 | 네트워크 오프라인 시뮬레이션 |
| AC-5 | 각 상태 전환 시 Tailwind CSS 애니메이션(wiggle / spin / pop / shake)이 적용된다 | 육안 확인 |
| AC-6 | `idle` 상태에서는 컴포넌트 높이가 0이며 레이아웃 공간을 차지하지 않는다 | DevTools Elements 패널 |
| AC-7 | 모바일(375px) 화면에서도 텍스트가 잘리지 않고 정상 표시된다 | DevTools 모바일 에뮬레이터 |
| AC-8 | 기존 `isStreaming` 동작이 깨지지 않는다 (ChatInput disabled, 메시지 스트리밍) | 기존 채팅 플로우 수동 테스트 |

---

## 9. 구현 우선순위 및 Phase

| Phase | 내용 | 난이도 |
|-------|------|--------|
| Phase A | `ChatStatus` 타입 + `useChat` 훅 상태 추가 | 낮음 |
| Phase B | `AiStatusLight.tsx` 컴포넌트 구현 + Tailwind 애니메이션 | 낮음 |
| Phase C | `ChatWindow`에 삽입 + `page.tsx` props 연결 | 낮음 |
| Phase D (선택) | 서버 SSE `status` 이벤트 추가로 RAG 완료 시점 정확도 향상 | 중간 |

Phase A~C는 서버 변경 없이 프론트엔드만으로 구현 가능.

---

## 10. 관련 파일 참조

- `hooks/useChat.ts` — 수정 대상 (chatStatus 상태 추가)
- `types/index.ts` — 수정 대상 (ChatStatus 타입 추가)
- `components/chat/ChatWindow.tsx` — 수정 대상 (AiStatusLight 삽입)
- `app/page.tsx` — 수정 대상 (chatStatus props 전달)
- `lib/ai/streaming.ts` — 참조 (SSE 이벤트 타입 확인)
- `app/api/chat/route.ts` — 참조 (서버 처리 흐름 확인)
