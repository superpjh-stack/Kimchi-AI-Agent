# Plan: Kimchi-Agent — 김치공장 전용 AI Agent

**Feature ID**: kimchi-agent
**Created**: 2026-02-27
**Level**: Dynamic
**Priority**: High
**Status**: Planning

---

## 1. Overview (개요)

김치공장 운영을 위한 Chat 중심의 AI Agent 시스템.
음성/텍스트 입력 → RAG 기반 답변 → 공정데이터 학습 → ML 모델 통합 → 데이터 기반 공장 운영의 단계적 진화를 목표로 한다.

---

## 2. Problem Statement (문제 정의)

- 공장 운영자들이 산재된 공정 데이터, 레시피, 운영 지침에 빠르게 접근하기 어렵다
- 반복적인 일상 질문(온도, 발효시간, 품질체크 등)에 즉각 답변이 필요하다
- 비전문가도 공장 데이터를 이해하고 판단할 수 있는 인터페이스가 없다
- 장기적으로 공정 데이터 기반의 예측/자동화가 필요하다

---

## 3. Goals (목표)

### Phase 1 — MVP: Chat + RAG
- [ ] 챗팅창 중심의 UI (텍스트 + 음성 입력)
- [ ] 일상적 질문을 위한 Predefined Quick Questions
- [ ] RAG 기반 공정 문서/데이터 질의응답
- [ ] 최소 메뉴: 대화 히스토리, 문서 업로드, 설정

### Phase 2 — 공정 데이터 학습
- [ ] 공정 데이터(온도, 습도, 염도, 발효도 등) 연동
- [ ] 데이터 기반 답변 향상
- [ ] 운영 이상 감지 알림

### Phase 3 — ML 모델 통합
- [ ] 예측 모델(발효 완성도, 품질 예측) 적용
- [ ] 데이터 기반 공장 제어 추천
- [ ] 대시보드 + 챗 통합 뷰

---

## 4. User Stories (사용자 스토리)

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | 공장 운영자 | 텍스트/음성으로 공정 질문을 하고 싶다 | 즉각적인 답변을 얻을 수 있다 |
| US-02 | 품질 관리자 | "오늘 발효 상태가 어때?" 같은 predefined 질문을 탭 한 번으로 하고 싶다 | 빠르게 일상 체크를 할 수 있다 |
| US-03 | 공장장 | 공정 문서를 업로드하고 질문하고 싶다 | RAG 기반으로 정확한 답변을 얻을 수 있다 |
| US-04 | 운영자 | 공장 이상 상황을 챗으로 즉시 알림받고 싶다 | 빠르게 대응할 수 있다 |
| US-05 | 공장장 | ML 예측 결과를 챗으로 확인하고 싶다 | 데이터 기반 의사결정을 할 수 있다 |

---

## 5. Functional Requirements (기능 요구사항)

### 5.1 Chat Interface
- FR-01: 텍스트 입력 + 전송 버튼
- FR-02: 음성 입력 (Web Speech API / Whisper)
- FR-03: 챗 하단 Predefined Quick Questions (카드 버튼)
- FR-04: 대화 히스토리 (세션 내 + 영구 저장)
- FR-05: Markdown 렌더링 (표, 코드블록 등)
- FR-06: 스트리밍 응답 (타이핑 효과)

### 5.2 Navigation (최소 메뉴)
- FR-07: 사이드바 — 대화 목록, 새 대화
- FR-08: 문서 업로드 (RAG 소스 추가)
- FR-09: 설정 (언어, 음성 On/Off)
- FR-10: 공장 현황 요약 패널 (Phase 2)

### 5.3 RAG Engine
- FR-11: 공정 문서 임베딩 (PDF, Excel, 텍스트)
- FR-12: 벡터 검색 기반 컨텍스트 주입
- FR-13: 출처 표시 (어떤 문서에서 답변했는지)

### 5.4 AI Backend
- FR-14: Claude API 연동 (claude-sonnet-4-6)
- FR-15: 시스템 프롬프트 — 김치공장 전문 Agent 역할
- FR-16: 공정 데이터 컨텍스트 주입
- FR-17: 스트리밍 응답 지원

---

## 6. Non-Functional Requirements (비기능 요구사항)

- NFR-01: 응답 지연 < 3초 (첫 토큰 기준)
- NFR-02: 모바일 반응형 (태블릿 + PC 우선)
- NFR-03: 한국어 우선, 영어 지원
- NFR-04: 오프라인 시 기본 Predefined 답변 가능

---

## 7. Tech Stack (기술 스택)

| 계층 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| AI | Claude API (claude-sonnet-4-6), Streaming |
| RAG | LangChain.js / Vercel AI SDK |
| Vector DB | Chroma or pgvector (추후 결정) |
| Backend API | Next.js API Routes |
| Storage | bkend.ai (대화 히스토리, 문서 메타) |
| Voice | Web Speech API (STT), ElevenLabs or TTS (추후) |
| Deploy | Vercel (Phase 1) |

---

## 8. Predefined Quick Questions (일상 질문 예시)

```
🌡️ 현재 발효실 온도는?
🧂 오늘 염도 측정 결과는?
⏱️ 배치 #[현재] 발효 완료까지 남은 시간?
✅ 오늘 품질 체크 항목 알려줘
📋 이번 주 생산 계획은?
⚠️ 현재 이상 경보 있어?
```

---

## 9. Implementation Phases (구현 순서)

```
Phase 1 (MVP - 이번 스프린트):
  1. Next.js 프로젝트 초기화
  2. 챗 UI 컴포넌트 (입력창, 메시지 버블, Quick Questions)
  3. Claude API 연동 (스트리밍)
  4. 기본 RAG 파이프라인 (문서 업로드 → 벡터 검색 → 답변)
  5. 대화 히스토리 저장 (bkend.ai)

Phase 2 (공정 데이터):
  6. 공정 데이터 API 연동
  7. 실시간 상태 패널
  8. 알림 시스템

Phase 3 (ML):
  9. 예측 모델 통합
  10. 대시보드 + 챗 통합
```

---

## 10. Success Metrics (성공 지표)

- 공장 운영자 일 1회 이상 사용률 > 80%
- 일상 질문 응답 정확도 > 90%
- 평균 응답 시간 < 3초
- 문서 기반 RAG 답변 정확도 > 85%

---

## Stakeholders

- **공장장**: 전체 현황 파악, 의사결정 지원
- **운영자**: 일상 공정 질문, 절차 확인
- **품질관리자**: 품질 기준, 이상 감지
- **IT 관리자**: 시스템 유지보수, 데이터 관리

---

*Plan created by CTO Team — 2026-02-27*
