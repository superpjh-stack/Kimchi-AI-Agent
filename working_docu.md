# Kimchi-Agent — Working Documentation

> **작성일**: 2026-02-28
> **작성자**: CTO Team (Claude Code + bkit Enterprise Agent Teams)
> **버전**: 1.0
> **범위**: Phase 1 ~ Phase 6 (전체 개발 히스토리)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [아키텍처 요약](#2-아키텍처-요약)
3. [Phase별 개발 히스토리](#3-phase별-개발-히스토리)
   - [Phase 1+2 — MVP + 운영 안정화](#31-phase-12--mvp--운영-안정화)
   - [Phase 3 — ML 통합 + 영속성 + 대시보드](#32-phase-3--ml-통합--영속성--대시보드)
   - [Phase 4 — 배포 + 테스트 자동화](#33-phase-4--배포--테스트-자동화)
   - [Phase 5 — Production Hardening](#34-phase-5--production-hardening)
   - [김치군 마스코트 — UX 차별화](#35-김치군-마스코트--ux-차별화)
   - [Phase 6 — 보안 강화 + 테스트 + 배포 (진행 중)](#36-phase-6--보안-강화--테스트--배포-진행-중)
4. [전체 파일 구조](#4-전체-파일-구조)
5. [환경 변수 전체 목록](#5-환경-변수-전체-목록)
6. [버그 수정 이력](#6-버그-수정-이력)
7. [기술 결정 사항 (ADR)](#7-기술-결정-사항-adr)
8. [PDCA Match Rate 이력](#8-pdca-match-rate-이력)
9. [Git 커밋 이력 요약](#9-git-커밋-이력-요약)
10. [알려진 이슈 및 TODO](#10-알려진-이슈-및-todo)

---

## 1. 프로젝트 개요

**Kimchi-Agent**는 김치공장 전용 AI 에이전트다. 채팅 중심 UI에서 음성·텍스트로 질문하고, RAG(Retrieval-Augmented Generation) 기반 답변을 제공하는 Next.js 14 풀스택 애플리케이션이다.

### 핵심 목표
- 공장 현장 근무자가 발효 공정, 품질 관리, HACCP 기준을 AI에게 실시간으로 질문
- 공정 센서 데이터(온도·습도·염도·pH)를 실시간으로 모니터링하고 AI 컨텍스트에 주입
- ML 기반 발효 완성도 예측 및 품질 등급 분류
- 한국어/영어 다국어 지원, WCAG 2.1 AA 접근성 준수

### 기술 스택 요약

| 레이어 | 기술 |
|--------|------|
| **Frontend** | Next.js 14 App Router, React 18, Tailwind CSS, Recharts |
| **AI** | Claude claude-sonnet-4-6 / GPT-4o-mini (fallback) |
| **RAG** | OpenAI text-embedding-3-small, BM25 (순수 TS), IVFFlat (pgvector) |
| **DB/Vector** | bkend.ai (대화 저장) + PostgreSQL+pgvector (벡터 저장) |
| **i18n** | next-intl v4 (ko/en) |
| **로깅** | pino (JSON 포맷) |
| **테스트** | Jest 61 tests (4 suites) |
| **모니터링** | Sentry (client+server+edge), Vercel Analytics |
| **CI/CD** | GitHub Actions (lint → tsc → jest) |

---

## 2. 아키텍처 요약

```
Browser ──SSE──▶ Next.js API Routes ──▶ AI API (Claude / OpenAI)
                       │
                  RAG Pipeline ──▶ Vector Store (pgvector / In-Memory)
                       │              BM25 Index (Hybrid Search)
                  Process Data ──▶ Sensor Simulator / Real Sensor API
                       │
                  ML Predictor ──▶ RuleBasedPredictor (Q10 온도보정)
                       │
                  bkend.ai ──▶ 대화/메시지/문서 영구 저장
```

### 핵심 데이터 흐름
1. **Chat**: `useChat` hook → `POST /api/chat` → RAG 검색 + 센서 데이터 병렬 fetch → AI 스트리밍 → SSE tokens
2. **Upload**: `DocumentUpload` → `POST /api/documents/upload` → 청킹(1000자/200 overlap) → 임베딩 → Vector Store
3. **Dashboard**: `useSensorHistory` → `/api/process-data/history` 폴링 → Recharts LineChart
4. **ML**: `useMlPrediction` → `POST /api/ml/predict` → RuleBasedPredictor → ConfidenceBar + FermentationProgressBar
5. **Alert**: `useAlerts` → `GET /api/alerts/stream` (SSE) → AlertBadge → 채팅 통합

---

## 3. Phase별 개발 히스토리

---

### 3.1 Phase 1+2 — MVP + 운영 안정화

**기간**: 2026-02-27
**Match Rate**: Phase 1 — 97.4% / Phase 2 — 92.2%
**커밋**: `a0eccfa`

#### Phase 1 — MVP 기본 구현

- Next.js 14 App Router 프로젝트 구성 (TypeScript, Tailwind CSS)
- Claude claude-sonnet-4-6 스트리밍 채팅 (SSE)
- RAG 파이프라인 기초: 청킹 → 임베딩 → 인메모리 벡터 스토어
- 문서 업로드 (TXT, CSV, XLSX, PDF)
- 대화 목록/생성/삭제 (인메모리)
- 기본 UI: Sidebar, Header, ChatWindow, MessageBubble, ChatInput

#### Phase 2 — 운영 안정화

**Sprint 1-A: 즉시 버그 수정 & 인프라**
- `.env.example` 추가 (개발자 온보딩 단순화)
- `crypto.randomUUID()` 도입 (Date.now()+random 대체)
- SSE `conversationId` 버그 수정 (`streaming.ts:64`)
- Claude 모델/토큰 환경변수화 (`CLAUDE_MODEL`, `CLAUDE_MAX_TOKENS`)
- AI 가드레일 추가 (의료·법률·HACCP 우회 차단)
- `ApiResponse<T>` 래퍼 도입 (모든 API 응답 표준화)

**Sprint 1-B: bkend.ai 영구 저장소 연동**
- `lib/db/bkend.ts` 실제 CRUD 구현 (conversations/messages/documents)
- 인메모리 폴백 패턴 (bkend.ai 미설정 시 자동 전환)
- 네트워크 오류 시 재시도 로직 (최대 3회)
- 메시지 영구 저장 (사용자/어시스턴트 모두)

**Sprint 1-C: 문서 관리 API 확장**
- `GET /api/documents` (목록 + 페이지네이션)
- `DELETE /api/documents/[id]` (청크+벡터+메타데이터 삭제)
- `GET /api/rag/debug` (Hybrid Search 결과 상세 조회)

**Sprint 2: 공정 데이터 시스템**
- `lib/process/simulator.ts` — 센서 시뮬레이터 (온도·습도·염도·pH + drift/jitter)
- `lib/process/sensor-client.ts` — SensorClient 인터페이스 (시뮬레이터 ↔ 실제 센서 전환 가능)
- `lib/process/alert-rules.ts` — 임계값 기반 이상 감지 (4가지 규칙)
- `GET /api/process-data` — 현재 센서 수치
- `GET /api/process-data/history` — 이력 데이터 (최대 168시간)
- `GET /api/alerts/stream` — 실시간 알림 SSE 스트림
- AI 프롬프트에 실시간 센서 데이터 주입
- RAG + 센서 데이터 `Promise.all` 병렬 fetch (~500ms → ~250ms)

**Sprint 3: UI 컴포넌트**
- `hooks/useProcessData.ts` — 센서 폴링 훅 (30초)
- `hooks/useAlerts.ts` — 알림 SSE 수신 훅
- `components/process/SensorCard.tsx` — 개별 센서 카드
- `components/process/ProcessStatusPanel.tsx` — 4센서 + 발효 진행률 통합 패널
- `components/process/AlertBadge.tsx` — Sidebar 알림 배지
- `components/documents/DocumentList.tsx` — 문서 목록 + 삭제 UI

**Sprint 4: RAG 고도화**
- `lib/rag/bm25.ts` — 순수 TypeScript BM25 구현 (외부 의존성 0, 한국어 지원)
- Hybrid Search: 벡터(코사인 유사도) + BM25 + RRF(Reciprocal Rank Fusion, k=60)
- `EmbeddingProvider` 패턴 도입 (OpenAI / Mock 전환 가능)

---

### 3.2 Phase 3 — ML 통합 + 영속성 + 대시보드

**기간**: 2026-02-27 ~ 2026-02-28
**Match Rate**: 91.0%
**커밋**: `40afea7`

**Sprint 1: Persistence Infrastructure**
- `docker-compose.yml` — PostgreSQL+pgvector 컨테이너 (healthcheck 포함)
- `lib/rag/retriever-pg.ts` — `PgVectorStore` 클래스 (IVFFlat cosine 인덱스, 차원 자동 재생성)
- `lib/rag/retriever.ts` — `getVectorStore()` 팩토리 (pgvector ↔ InMemory 자동 폴백)
- `GET /api/documents/stats` — 문서/청크 통계
- `PATCH /api/alerts/[id]` — Alert acknowledged 필드 업데이트
- `lib/db/alert-store.ts` — Alert 저장소 모듈

**Sprint 2: Local Embedding**
- `lib/rag/embedder-local.ts` — `LocalEmbedder` (Ollama nomic-embed-text, 768차원)
- 3-way auto-fallback: openai → local → mock
- `OLLAMA_BASE_URL` / `OLLAMA_URL` 이중 지원
- 병렬 임베딩 배칭 (`Promise.all`, BATCH_SIZE=32)
- pgvector 테이블 차원 불일치 시 자동 재생성

**Sprint 3: ML Prediction**
- `lib/ml/predictor.ts` — `IPredictor` 인터페이스
- `lib/ml/rule-based-predictor.ts` — `RuleBasedPredictor` (Q10 온도보정, A/B/C 등급)
- `lib/ml/remote-predictor.ts` — `RemoteMLPredictor` (3초 timeout + graceful fallback)
- `lib/ml/predictor-factory.ts` — 싱글턴 팩토리
- `POST /api/ml/predict` — 발효 완성도 예측 API
- `POST /api/ml/quality` — 품질 등급 분류 API
- ML 예측 결과 AI 프롬프트 주입
- 시뮬레이터 히스토리 버퍼 200 → 2880포인트 확대

**Sprint 4: Dashboard Layout**
- `components/ml/MLPredictionPanel.tsx` — ML 예측 결과 카드
- `components/ml/FermentationProgressBar.tsx` — 발효 진행도 시각화
- `components/ml/QualityGradeBadge.tsx` — 품질 등급 배지
- `components/layout/BottomNav.tsx` — 5탭 네비게이션 (Dashboard/Chat/Conversations/Documents/Questions)
- `hooks/useMlPrediction.ts` — 30초 폴링 + refresh() 함수

**Sprint 5: Recharts Dashboard (설계 초과)**
- `recharts` 패키지 설치
- `hooks/useSensorHistory.ts` — 센서 이력 폴링
- `components/dashboard/SensorChart.tsx` — Recharts LineChart (온도/염도/pH/당도, 60포인트)
- `components/dashboard/MLPredictionWidget.tsx` — 컴팩트 ML 위젯
- `components/dashboard/DashboardPanel.tsx` — 공정현황 + ML 예측 + 4개 센서 차트 통합

---

### 3.3 Phase 4 — 배포 + 테스트 자동화

**기간**: 2026-02-28
**Match Rate**: 85.7% → **93.9%** (Act-1 이터레이션 1회)
**커밋**: `451f365`

**Sprint 1: Vercel 배포 설정**
- `vercel.json` — Cron 워밍업 (3분 간격, `/api/health`)
- `GET /api/health` — 서비스 상태 확인 (vectorStore, embedding, Ollama, ML 서버)
- `docs/05-deploy/vercel-setup.md` (146줄)
- `docs/05-deploy/supabase-setup.md` (153줄)
- `docs/05-deploy/env-variables.md` (151줄)

**Sprint 2: Jest 테스트 인프라**
- `jest.config.ts`, `jest.setup.ts` — Next.js App Router 호환 설정
- `__tests__/lib/rag/embedder.test.ts` — **7 tests**
- `__tests__/lib/rag/retriever.test.ts` — **14 tests**
- `__tests__/lib/ml/rule-based-predictor.test.ts` — **20 tests**
- `__tests__/lib/ml/prediction-cache.test.ts` — **15 tests** (Act-1에서 추가)
- `.github/workflows/ci.yml` — GitHub Actions CI (lint → tsc → jest → coverage upload)
- **총 61 PASS, TypeScript EXIT:0**

**Sprint 3: 베타 테스트 전략**
- `docs/03-analysis/kimchi-agent-phase4-qa-strategy.md` (348줄)
- TC-01~05: 5개 시나리오 (발효 예측, RAG 검색, 대시보드, 알림, 모바일)
- 베타 테스터 5명 계획 (2026-03-07 예정)

**Sprint 4: ML 캐싱 + 모니터링**
- `lib/ml/prediction-cache.ts` — `PredictionCache<T>` (Map 기반 TTL 30초)
- `/api/ml/predict`, `/api/ml/quality` 캐시 적용 (`cached: true/false` 플래그)
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` — Sentry PII 필터 (email, ip_address, authorization)
- `app/layout.tsx` — Vercel Analytics + SpeedInsights 통합
- `next.config.js` — `withSentryConfig` 래핑

---

### 3.4 Phase 5 — Production Hardening

**기간**: 2026-02-28 (4 Sprint 완료)
**Match Rate**: 94.8% → **98.2%** (Act-1 이터레이션 1회)
**커밋**: `7aff10e` (Sprint 1+2+3 prep), `e325a93` (Sprint 3+4), `1027433` (Act-1), `a29ac67` (Report), `bd6df51` (Archive)

**Sprint 1: 베타 피드백 반영**
- `/api/health` `services.chat` 필드 추가 + 메모리 정보(heapUsedMB 등) 추가
- `docs/05-deploy/troubleshooting.md` 신규 작성 (10+ FAQ)
- `lib/ai/streaming.ts` — SSE keep-alive ping 15초 (Vercel 30초 타임아웃 대응)
- `components/chat/QuickQuestions.tsx` — 6문항 갱신 + lucide-react 아이콘 통일
- `components/documents/DocumentList.tsx` — 페이지네이션 (20건 제한, "더 보기" 버튼)
- `components/chat/ChatInput.tsx` — 전송 중 비활성화 UX 개선
- `components/chat/MessageBubble.tsx` — 500자 접기 + React.memo
- `components/layout/Sidebar.tsx` — 대화 검색 기능 (제목 필터 + 포커스 트랩)
- `components/layout/Header.tsx` — online/offline 인디케이터

**Sprint 2: ML 고도화**
- `config/ml.config.ts` — `MLConfig` 인터페이스 + `loadMLConfig()` (파라미터 외부화)
- `lib/ml/rule-based-predictor.ts` — 생성자 config 주입 (외부화)
- `PATCH /api/ml/thresholds`, `GET /api/ml/thresholds` — 런타임 임계값 조정 API
- `components/ml/ConfidenceBar.tsx` — 3색 신뢰도 시각화 (green/amber/red, React.memo)
- `lib/ml/prediction-history.ts` — 링 버퍼 1000건 예측 이력 저장
- `GET /api/ml/history` — 이력 조회 (type, hours 파라미터)
- `components/ml/PredictionTrendChart.tsx` — Recharts 예측 이력 시각화
- `instrumentation.ts` + Sentry `startSpan` — ml.predict 레이턴시 트레이싱

**Sprint 3: i18n/접근성**
- `next-intl` v4 도입
- `i18n/config.ts`, `i18n/request.ts` — 서버사이드 i18n 설정
- `middleware.ts` — 로케일 감지 (localePrefix='as-needed', 기본 ko)
- `app/[locale]/layout.tsx`, `app/[locale]/page.tsx` — 로케일별 레이아웃/페이지
- `messages/ko.json`, `messages/en.json` — 79개+ 번역 키
- `components/layout/LocaleSwitcher.tsx` — KO|EN 토글 UI
- WCAG 2.1 AA 감사 (10개 컴포넌트 접근성 수정):
  - Skip Navigation, ChatInput aria-label, VoiceInput aria-live
  - Header role=tablist/tab + aria-selected, Sidebar 포커스 트랩 (Esc 닫기)
  - FermentationProgressBar role="progressbar", DocumentUpload 키보드 지원
  - 고대비 모드 CSS (`@media (prefers-contrast: high)`, 6개 변수)
- next/font/google 마이그레이션 (Google Fonts CDN 제거)

**Sprint 4: 운영 최적화**
- `lib/logger.ts` — pino 구조화 로거 (JSON 포맷, `LOG_LEVEL` 환경변수)
- 10개 API 라우트 console → pino 전환
- `lib/middleware/rate-limit.ts` — 슬라이딩 윈도우 Rate Limiter
  - `/api/chat` 20 req/min, `/api/upload` 10 req/min, `/api/ml/*` 30 req/min
- 쿼리 임베딩 캐시 (30초 TTL) — `lib/rag/pipeline.ts`
- `dynamic import` — DashboardPanel, MLPredictionPanel (ssr: false)
- 메모리 누수 방지: VectorStore 최대 10k 청크 (LRU eviction), conversationStore 최대 500
- `lib/config/validate-env.ts` 확장 — 신규 환경변수 검증 (ML_CONFIDENCE_THRESHOLD, LOG_LEVEL, RATE_LIMIT_MAX, SENTRY_TRACES_SAMPLE_RATE)

**Act-1 (갭 수정 7건)**
1. DashboardPanel 베타 만족도 위젯 구현
2. Sentry `startSpan` 추가 (ml.predict 레이턴시)
3. VoiceInput `aria-live="polite"` 추가
4. Header `role="tablist"` + `aria-selected` 추가
5. 고대비 CSS 변수 6개 추가
6. next/font 마이그레이션 완료
7. QualityGradeBadge React.memo 래핑

---

### 3.5 김치군 마스코트 — UX 차별화

**기간**: 2026-02-28 (단일 세션)
**Match Rate**: **97.0%** (이터레이션 0회)
**커밋**: `176820c` (기획/설계), `c607a07` (구현)

**캐릭터 개요**
- 이름: 김치군(김치君)
- 디자인: 배추김치 모양 SVG (60×60px, 외부 이미지 0, ~4KB gzipped)
- 감정 상태: idle / thinking / success / error / celebrating / searching / sleeping (7종)
- 대사: 47개 한국어 문장 (상태별 5~8개, 공장 현장 감성)

**신규 파일 9개**
| 파일 | 역할 |
|------|------|
| `types/mascot.ts` | MascotState, MascotContext, MascotSettings 등 6개 타입 |
| `components/mascot/KimchiSvg.tsx` | SVG 캐릭터 렌더링 (7개 상태 표정) |
| `components/mascot/MascotSpeech.tsx` | 말풍선 UI (3~4초 후 자동 소실) |
| `components/mascot/MascotToggle.tsx` | ON/OFF 토글 + 설정 메뉴 |
| `components/mascot/KimchiMascotContainer.tsx` | 통합 컨테이너 |
| `components/mascot/mascot-phrases.ts` | 47개 상황별 대사 |
| `hooks/useMascot.ts` | 상태 관리 (LocalStorage 저장, 야간 모드 22:00~06:00) |
| `hooks/useMascotTrigger.ts` | 글로벌 이벤트 리스너 |
| `lib/utils/mascot-event.ts` | CustomEvent 디스패처 |

**기존 파일 수정 6개**
- `hooks/useChat.ts` — 4개 dispatch 포인트 (searching/thinking/success/error)
- `components/documents/DocumentUpload.tsx` — celebrating dispatch
- `app/[locale]/page.tsx` — KimchiMascotContainer 통합
- `app/globals.css` — 12개 @keyframes + 12개 prefers-reduced-motion
- `messages/ko.json`, `messages/en.json` — 마스코트 i18n 키 6개

**핵심 설계 패턴**
- **Event-Driven Decoupling**: CustomEvent 기반 — 비즈니스 로직과 마스코트 완전 분리
- **Pure CSS Animation**: GPU 가속 (will-change: transform, translateZ(0)), LCP +0ms, CLS 0
- **State Machine**: 자동 리셋 타이머 (success 1.5초, thinking 2초 후 idle 복귀)
- **LocalStorage 설정**: 세션 간 enabled/speechEnabled 유지
- WCAG 2.1 AA 100% (aria-live, prefers-reduced-motion, role=complementary)

---

### 3.6 Phase 6 — 보안 강화 + 테스트 + 배포 (진행 중)

**상태**: Plan ✅ (v1.3, 2026-02-28) + Design ✅ (v1.0, 2026-02-28) → Do (착수 대기)
**커밋**: `20dbc34` (Plan), `c34b24b` (상태 반영), `e9fb393` (Design)

#### 보안 감사 결과 (OWASP Top 10, 2026-02-28)

| 심각도 | 건수 | 핵심 이슈 |
|--------|------|---------|
| **CRITICAL** | 2 | 전체 API 인증 부재 (17개 엔드포인트), xlsx Prototype Pollution |
| **HIGH** | 5 | ML 임계값 무인증 변경, RAG 디버그 노출, CSP unsafe-inline/eval, Rate Limiter 우회, npm 12 high |
| **MEDIUM** | 4 | Prompt Injection, MIME 미검증, 감사 로그 부재, Edge PII 필터 누락 |
| **LOW** | 2 | X-XSS-Protection 레거시, SSRF 잠재 위험 |

#### Sprint 1 — 보안 강화 + 코드 정비 (최우선)

**신규 파일 예정**
```
lib/auth/
  auth-middleware.ts    # JWT 기반 API 인증 미들웨어
  rbac.ts               # RBAC (admin/operator/viewer)
  audit-logger.ts       # 중요 작업 감사 로깅
lib/security/
  csp.ts                # nonce 기반 CSP
  file-validator.ts     # Magic bytes MIME 검증
  input-sanitizer.ts    # Prompt injection 완화
app/api/auth/
  login/route.ts
  me/route.ts
```

**주요 작업**
- FR-01: API 인증 미들웨어 (17개 엔드포인트 전체)
- FR-02: RBAC 3역할 (admin/operator/viewer)
- FR-03: xlsx → exceljs 교체 (Prototype Pollution 해결)
- FR-06: CSP nonce 기반 강화 (unsafe-inline/eval 제거)
- FR-07b/c/d: Rate Limiter TTL cleanup + conversations + SSE 제한
- FR-10: npm audit fix (1 critical + 12 high → 0)
- FR-12: ESLint strict 설정 (`.eslintrc.json`)
- FR-13: console.log 11건 → pino 완전 전환

#### Sprint 2 — 테스트 강화 + 프로덕션 배포 + Questions 통합

- Jest 확대: 4 suites, 61 tests → 15+ suites, 150+ tests (>= 80% coverage)
- Playwright E2E: `e2e/chat.spec.ts`, `e2e/i18n.spec.ts`, `e2e/upload.spec.ts`
- Lighthouse CI: Performance >= 80, Accessibility >= 90
- Vercel 프로덕션 배포 + 24시간 모니터링
- **Questions 패널 통합**: `components/questions/QuestionPanel.tsx` (6카테고리, 60질문) → `app/[locale]/page.tsx` 연결 + i18n 키 추가

#### Sprint 3 — ML A/B 테스트 프레임워크

- `lib/ml/ab-test.ts` — Experiment, Variant, Assignment 타입
- `lib/ml/ab-manager.ts` — 해시 기반 일관된 사용자 배분 (% split)
- `POST/GET /api/ml/experiments` — 실험 생성/목록 API
- `GET /api/ml/experiments/[id]/results` — 결과 메트릭 조회
- `AB_TEST_ENABLED` 환경변수 기반 기능 활성화

#### Sprint 4 — Multi-tenant 기반 구조

- `types/tenant.ts` — TenantId, TenantConfig, TenantContext
- `lib/tenant/tenant-context.ts` — AsyncLocalStorage 기반 컨텍스트
- VectorStore + ConversationStore tenant별 격리
- `GET/POST /api/admin/tenants` — tenant 관리 API
- `TENANT_MODE` 환경변수 (`single` / `multi`)

#### Phase 6 성공 기준

| 기준 | 현재 | 목표 |
|------|------|------|
| API 인증 | 0/17 엔드포인트 | 17/17 전체 |
| npm audit critical/high | 13건 | 0건 |
| Jest 커버리지 | ~30% | >= 80% |
| Playwright E2E | 0건 | >= 5 시나리오 |
| Lighthouse Performance | 미측정 | >= 80 |
| console.log | 11건 | 0건 |
| ESLint | 미설정 | 0 errors (strict) |
| Questions 패널 통합 | 미통합 | 완료 + i18n + 접근성 |

---

## 4. 전체 파일 구조

```
Kimchi-AI-Agent/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx              # next-intl + next/font 레이아웃
│   │   └── page.tsx                # 메인 페이지 (실제 서빙 페이지)
│   ├── api/
│   │   ├── chat/route.ts           # POST — Claude/OpenAI 스트리밍 + RAG
│   │   ├── conversations/
│   │   │   ├── route.ts            # GET/POST — 대화 목록/생성
│   │   │   └── [id]/route.ts       # GET/DELETE — 대화 조회/삭제
│   │   ├── documents/
│   │   │   ├── route.ts            # GET — 문서 목록
│   │   │   ├── [id]/route.ts       # DELETE — 문서 삭제
│   │   │   ├── stats/route.ts      # GET — 문서 통계
│   │   │   └── upload/route.ts     # POST — 문서 업로드
│   │   ├── process-data/
│   │   │   ├── route.ts            # GET — 현재 센서 수치
│   │   │   └── history/route.ts    # GET — 이력 데이터
│   │   ├── alerts/
│   │   │   ├── stream/route.ts     # GET — SSE 알림 스트림
│   │   │   └── [id]/route.ts       # PATCH — Alert acknowledged
│   │   ├── ml/
│   │   │   ├── predict/route.ts    # POST — 발효 완성도 예측
│   │   │   ├── quality/route.ts    # POST — 품질 등급 분류
│   │   │   ├── history/route.ts    # GET — 예측 이력
│   │   │   └── thresholds/route.ts # GET/PATCH — 임계값 조정
│   │   ├── rag/debug/route.ts      # GET — RAG 디버그
│   │   └── health/route.ts         # GET — 서비스 상태
│   ├── layout.tsx                  # 루트 레이아웃
│   └── globals.css                 # Tailwind + 김치군 애니메이션
│
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx          # 메시지 목록 + 입력 통합
│   │   ├── MessageBubble.tsx       # Markdown 렌더링, 500자 접기, React.memo
│   │   ├── ChatInput.tsx           # 자동 높이 textarea
│   │   ├── VoiceInput.tsx          # Web Speech API (ko-KR)
│   │   └── QuickQuestions.tsx      # 6개 카드
│   ├── layout/
│   │   ├── Sidebar.tsx             # 대화 목록 + 검색 + 포커스 트랩
│   │   ├── Header.tsx              # 탭 스위처 + online/offline
│   │   ├── BottomNav.tsx           # 5탭 모바일 네비게이션
│   │   └── LocaleSwitcher.tsx      # KO|EN 토글
│   ├── documents/
│   │   ├── DocumentUpload.tsx      # 드래그앤드롭 업로드
│   │   └── DocumentList.tsx        # 문서 목록 + 페이지네이션 + 삭제
│   ├── process/
│   │   ├── SensorCard.tsx          # 개별 센서 카드
│   │   ├── ProcessStatusPanel.tsx  # 공정 현황 패널
│   │   └── AlertBadge.tsx          # 알림 배지
│   ├── ml/
│   │   ├── MLPredictionPanel.tsx   # ML 예측 카드
│   │   ├── FermentationProgressBar.tsx # 발효 진행도
│   │   ├── QualityGradeBadge.tsx   # 품질 등급 배지 (React.memo)
│   │   ├── ConfidenceBar.tsx       # 신뢰도 시각화
│   │   └── PredictionTrendChart.tsx # 예측 이력 차트 (Recharts)
│   ├── dashboard/
│   │   ├── SensorChart.tsx         # Recharts LineChart
│   │   ├── MLPredictionWidget.tsx  # 컴팩트 ML 위젯
│   │   └── DashboardPanel.tsx      # 통합 대시보드
│   ├── mascot/
│   │   ├── KimchiSvg.tsx           # SVG 캐릭터 (7상태)
│   │   ├── MascotSpeech.tsx        # 말풍선
│   │   ├── MascotToggle.tsx        # ON/OFF 토글
│   │   ├── KimchiMascotContainer.tsx # 통합 컨테이너
│   │   └── mascot-phrases.ts       # 47개 대사
│   └── questions/
│       └── QuestionPanel.tsx       # 6카테고리 60질문 (미통합)
│
├── hooks/
│   ├── useChat.ts                  # SSE 스트리밍 파서
│   ├── useConversations.ts         # 대화 목록 CRUD
│   ├── useProcessData.ts           # 센서 30초 폴링
│   ├── useAlerts.ts                # 알림 SSE 수신
│   ├── useMlPrediction.ts          # ML 30초 폴링
│   ├── useSensorHistory.ts         # 센서 이력 폴링
│   ├── useMascot.ts                # 마스코트 상태 관리
│   └── useMascotTrigger.ts         # 이벤트 리스너
│
├── lib/
│   ├── ai/
│   │   ├── claude.ts               # Anthropic 클라이언트
│   │   ├── system-prompt.ts        # 김치공장 전문 프롬프트
│   │   └── streaming.ts            # SSE 변환 + keep-alive
│   ├── rag/
│   │   ├── chunker.ts              # RecursiveCharacterTextSplitter
│   │   ├── embedder.ts             # EmbeddingProvider 팩토리
│   │   ├── embedder-local.ts       # LocalEmbedder (Ollama)
│   │   ├── retriever.ts            # InMemoryVectorStore + getVectorStore()
│   │   ├── retriever-pg.ts         # PgVectorStore (IVFFlat)
│   │   ├── bm25.ts                 # 순수 TS BM25
│   │   └── pipeline.ts             # Hybrid Search (BM25+Vector+RRF)
│   ├── ml/
│   │   ├── predictor.ts            # IPredictor 인터페이스
│   │   ├── rule-based-predictor.ts # Q10 규칙 기반 예측
│   │   ├── remote-predictor.ts     # 원격 ML 서버 연동
│   │   ├── predictor-factory.ts    # 싱글턴 팩토리
│   │   ├── prediction-cache.ts     # TTL 30초 캐시
│   │   └── prediction-history.ts   # 링 버퍼 1000건
│   ├── process/
│   │   ├── simulator.ts            # 센서 시뮬레이터 (버퍼 2880)
│   │   ├── sensor-client.ts        # SensorClient 인터페이스 + 팩토리
│   │   ├── alert-rules.ts          # 임계값 규칙 엔진
│   │   └── alert-store.ts          # Alert 저장소 (MAX_ALERTS 제한 예정)
│   ├── db/
│   │   ├── bkend.ts                # bkend.ai CRUD (conversations/messages/documents)
│   │   └── conversations-store.ts  # 인메모리 폴백 저장소 (최대 500)
│   ├── middleware/
│   │   └── rate-limit.ts           # 슬라이딩 윈도우 Rate Limiter
│   ├── config/
│   │   └── validate-env.ts         # 환경변수 유효성 검사
│   └── utils/
│       ├── api-response.ts         # ApiResponse<T> 래퍼 (ok/created/err)
│       ├── markdown.ts             # stripMarkdown, generateTitle
│       └── mascot-event.ts         # CustomEvent 디스패처
│
├── config/
│   └── ml.config.ts                # ML 파라미터 외부화
│
├── i18n/
│   ├── config.ts                   # locales 설정
│   └── request.ts                  # getRequestConfig
│
├── messages/
│   ├── ko.json                     # 한국어 번역 (79개+ 키)
│   └── en.json                     # 영어 번역
│
├── types/
│   ├── index.ts                    # Message, Conversation, DocumentSource, SSEEvent
│   └── mascot.ts                   # MascotState, MascotSettings 등
│
├── __tests__/
│   └── lib/
│       ├── rag/embedder.test.ts    # 7 tests
│       ├── rag/retriever.test.ts   # 14 tests
│       ├── ml/rule-based-predictor.test.ts # 20 tests
│       └── ml/prediction-cache.test.ts     # 15 tests
│
├── docs/
│   ├── 01-plan/features/           # Plan 문서
│   ├── 02-design/features/         # Design 문서
│   ├── 03-analysis/                # Gap Analysis 문서
│   ├── 04-report/                  # 완료 보고서
│   ├── 05-deploy/                  # 배포 가이드
│   └── archive/2026-02/            # 완료된 Phase 아카이브
│
├── middleware.ts                   # next-intl 로케일 + 인증 (Phase 6)
├── docker-compose.yml              # PostgreSQL+pgvector + Ollama
├── vercel.json                     # Cron 워밍업 설정
├── jest.config.ts                  # Jest + Next.js App Router 설정
├── jest.setup.ts                   # 글로벌 테스트 설정
├── instrumentation.ts              # Sentry 초기화
├── sentry.client.config.ts         # Sentry 클라이언트 설정
├── sentry.server.config.ts         # Sentry 서버 설정
├── sentry.edge.config.ts           # Sentry Edge 설정
├── .github/workflows/ci.yml        # GitHub Actions CI
├── .env.example                    # 환경변수 템플릿
└── next.config.js                  # withSentryConfig 래핑
```

---

## 5. 환경 변수 전체 목록

```dotenv
# ── AI ───────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...       # Claude API (현재 크레딧 부족)
OPENAI_API_KEY=sk-...              # OpenAI 임베딩 + Chat fallback
OPENAI_CHAT_MODEL=gpt-4o-mini      # OpenAI 채팅 모델 (fallback)
CLAUDE_MODEL=claude-sonnet-4-6     # Claude 모델 선택
CLAUDE_MAX_TOKENS=2048             # Claude 응답 최대 토큰

# ── 임베딩 ─────────────────────────────────────────────────
EMBEDDING_PROVIDER=openai          # openai | local | mock
OLLAMA_URL=http://localhost:11434  # Ollama URL (LocalEmbedder)
OLLAMA_BASE_URL=http://localhost:11434 # 대체 키
OLLAMA_EMBEDDING_MODEL=nomic-embed-text # 임베딩 모델

# ── 데이터베이스 ────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/kimchi_db  # pgvector

# ── bkend.ai ────────────────────────────────────────────────
BKEND_BASE_URL=https://api.bkend.ai
BKEND_PUBLISHABLE_KEY=pub_...      # bkend.ai 인증 키

# ── ML ──────────────────────────────────────────────────────
ML_SERVER_URL=http://localhost:8000 # 원격 ML 서버 (선택)
ML_CONFIDENCE_THRESHOLD=0.6        # 신뢰도 임계값 (0-1)
NEXT_PUBLIC_ML_CONFIDENCE_THRESHOLD=0.6 # 클라이언트 노출 버전

# ── 공정 데이터 ─────────────────────────────────────────────
PROCESS_DATA_MODE=simulator        # simulator | api
PROCESS_DATA_API_URL=              # 실제 센서 API URL
ALERT_TEMP_MIN=15                  # 온도 하한 (°C)
ALERT_TEMP_MAX=25                  # 온도 상한 (°C)
ALERT_HUMIDITY_MIN=70              # 습도 하한 (%)
ALERT_HUMIDITY_MAX=90              # 습도 상한 (%)
ALERT_SALINITY_MIN=1.5             # 염도 하한 (%)
ALERT_SALINITY_MAX=3.0             # 염도 상한 (%)
ALERT_PH_MIN=4.0                   # pH 하한
ALERT_PH_MAX=5.5                   # pH 상한

# ── 로깅 ────────────────────────────────────────────────────
LOG_LEVEL=info                     # info | warn | error | debug

# ── Rate Limiting ────────────────────────────────────────────
RATE_LIMIT_MAX=20                  # req/min (기본값)

# ── Sentry ──────────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=            # 클라이언트 Sentry DSN
SENTRY_DSN=                        # 서버 Sentry DSN
SENTRY_TRACES_SAMPLE_RATE=0.1      # 샘플링 비율 (0-1)

# ── Phase 6 예정 ─────────────────────────────────────────────
NEXTAUTH_SECRET=                   # NextAuth.js JWT 서명 키
NEXTAUTH_URL=http://localhost:3000 # 인증 콜백 URL
AUTH_ADMIN_EMAILS=                 # admin 이메일 목록 (콤마 구분)
AB_TEST_ENABLED=false              # A/B 테스트 활성화
TENANT_MODE=single                 # single | multi
DEFAULT_TENANT_ID=default          # 기본 tenant ID
PLAYWRIGHT_BASE_URL=http://localhost:3000 # E2E 테스트 대상
```

---

## 6. 버그 수정 이력

| 날짜 | 파일 | 버그 | 수정 방법 |
|------|------|------|---------|
| 2026-02-27 | `lib/ai/streaming.ts` | SSE `done` 이벤트에 `conversationId` 항상 `""` | `createSSEStream(stream, { conversationId })` 파라미터 추가 |
| 2026-02-27 | `components/documents/DocumentUpload.tsx` | API 응답 `{ data: {...} }` 언래핑 안 함 | `json.data ?? json` 으로 수정 |
| 2026-02-27 | `components/documents/DocumentList.tsx` | `doc.fileType.toUpperCase()` undefined 오류 | `(doc.fileType ?? doc.type ?? '')` null 방어 추가 |
| 2026-02-27 | `app/api/alerts/stream/route.ts` | `setInterval` 누수 + `ERR_INVALID_STATE` | `cancel()` 플래그 + `cancelled` 변수로 cleanup |
| 2026-02-28 | `components/chat/VoiceInput.tsx` | `onend` 스테일 클로저 | `setVoiceState((prev) => ...)` 함수형 업데이터 적용 |
| 2026-02-28 | `components/chat/VoiceInput.tsx` | `onTranscript` 스테일 클로저 | `onTranscriptRef = useRef()` 패턴으로 항상 최신 함수 참조 |
| 2026-02-28 | `next.config.js` | `microphone=()` — 마이크 완전 차단 | `microphone=(self)` 로 수정 (음성버튼 근본 원인) |
| 2026-02-28 | `app/[locale]/page.tsx` | TTS(useTextToSpeech) 연동 누락 | 실제 서빙 페이지(`[locale]/page.tsx`)에 추가 |
| 2026-02-28 | `components/layout/LocaleSwitcher.tsx` | `router.replace(pathname, { locale })` 무효 API | `window.location.href` 직접 URL 구성으로 교체 |
| 2026-02-28 | `components/mascot/VoiceInput.tsx` | 미사용 `MicOff` import | import 제거 |

---

## 7. 기술 결정 사항 (ADR)

| # | 결정 | 선택 | 이유 | 대안 |
|---|------|------|------|------|
| 1 | **ID 생성** | `crypto.randomUUID()` | Node.js 내장, 충돌 없음 | Date.now()+random (레거시) |
| 2 | **BM25 구현** | 순수 TypeScript | 외부 의존성 0, 한국어 커스터마이징 | wink-bm25 (무거움) |
| 3 | **영구 저장소** | bkend.ai + InMemory 폴백 | BaaS → 운영 복잡도 ↓, 자격증명 없이도 개발 가능 | PostgreSQL 직접 |
| 4 | **벡터 저장소** | pgvector + InMemory 폴백 | IVFFlat cosine 인덱스, Docker 없이 폴백 | Supabase pgvector |
| 5 | **임베딩** | 3-way 팩토리 (openai/local/mock) | 환경별 자동 전환, 개발 시 mock | 단일 고정 제공자 |
| 6 | **알림 채널** | SSE (EventSource) | 단방향 서버 → 클라이언트, 기존 패턴 재사용 | WebSocket (오버스펙) |
| 7 | **ML 예측** | RuleBasedPredictor (JS 규칙) | ~1ms 응답, 외부 의존성 없음, 폴백 용이 | Python FastAPI 외부 서버 |
| 8 | **마스코트 이벤트** | CustomEvent (window) | 비즈니스 로직 분리, 마스코트 OFF 시에도 앱 정상 동작 | Context/Redux (과도한 결합) |
| 9 | **CSS 애니메이션** | Pure CSS @keyframes | LCP +0ms, CLS 0, GPU 가속 | JS requestAnimationFrame (메인스레드 부하) |
| 10 | **i18n** | next-intl v4 | App Router 네이티브 지원, middleware 통합 | react-i18next (별도 설정) |
| 11 | **로깅** | pino (JSON 포맷) | 구조화 로그, 프로덕션 성능 최적 | console.log (비구조적) |
| 12 | **Rate Limiting** | 슬라이딩 윈도우 (InMemory) | 단순 구현, Redis 불필요 (MVP) | Redis+lua (분산 환경) |
| 13 | **E2E 테스트** | Playwright (Phase 6 예정) | Next.js App Router 네이티브 지원, 경량 | Cypress (무거움) |
| 14 | **CSP** | nonce 기반 (Phase 6 예정) | unsafe-inline/eval 제거로 XSS 방어 극대화 | Hash 기반 (빌드 복잡도 증가) |
| 15 | **Multi-tenant** | AsyncLocalStorage (Phase 6 예정) | Node.js 네이티브, 요청 스코프 자동 관리 | Context 파라미터 전파 (코드 침투적) |

---

## 8. PDCA Match Rate 이력

| Phase | Sprint 결과 | 최종 Match Rate | 이터레이션 |
|-------|-----------|----------------|----------|
| Phase 1 | - | **97.4%** | 0 |
| Phase 2 | Sprint 1~4 완료 | **92.2%** | 0 |
| Phase 3 | Sprint 1~5 완료 (Sprint 5 설계 초과) | **91.0%** | 0 |
| Phase 4 | Sprint 1~4 완료 | 85.7% → **93.9%** | 1 (Act-1) |
| Phase 5 | Sprint 1~4 완료 | 94.8% → **98.2%** | 1 (Act-1) |
| 김치군 마스코트 | 단일 세션 | **97.0%** | 0 |
| Phase 6 | 착수 대기 | 목표 **>= 95%** | - |

---

## 9. Git 커밋 이력 요약

```
e9fb393 docs: Phase 6 설계서 작성 (v1.0)
c34b24b chore: Phase 6 착수 상태 반영 — CLAUDE.md + bkit-memory 업데이트
20dbc34 feat: Phase 6 계획서 작성 — 보안강화/테스트/배포/A/B테스트/Multi-tenant
c607a07 feat: 김치군 마스코트 구현 (배추 SVG, 7감정 상태, CustomEvent 이벤트 시스템)
176820c feat: 대화 삭제 기능 + 언어 전환 수정 + 김치군 마스코트 기획/설계
c7dffa5 feat: 공정 센서 시뮬레이터 seed data 10개 추가
1328a95 fix: 운영계 4대 버그 수정 (documents 404, lang switch, chat, mobile)
215c8d7 fix: npm ci --include=dev to fix Amplify build with NODE_ENV=production
8f606ab fix: add @swc/helpers@^0.5.19 to fix Amplify npm ci build failure
05d5541 feat: AWS Amplify 배포 환경 구축
e17601c fix: 음성버튼 3가지 근본 버그 수정 + Phase 5 TTS 기능 완성
bd6df51 chore: kimchi-agent-phase5 아카이브 + next.config.js next-intl 플러그인 추가
a29ac67 docs: Kimchi-Agent Phase 5 PDCA 완료 보고서
1027433 fix: Kimchi-Agent Phase 5 Act-1 갭 수정 (94.8% → 98.2%)
e325a93 feat: Kimchi-Agent Phase 5 Sprint 3+4 구현
7aff10e feat: Kimchi-Agent Phase 5 Sprint 1+2+3-prep 구현
b4cc9af fix: Sentry Next.js App Router 권장 방식으로 마이그레이션
40afea7 feat: Phase 1~3 구현 파일 + 미커밋 항목 일괄 반영
ad2d8b3 chore: archive kimchi-agent-phase4 (--summary)
451f365 feat: Kimchi-Agent Phase 4 완료 — 배포/테스트/ML캐싱/모니터링
a0eccfa feat: Kimchi-Agent Phase 1+2 완료 + Phase 3 기초 구현
```

---

## 10. 알려진 이슈 및 TODO

### 긴급 (Phase 6 Sprint 1)

| # | 이슈 | 파일 | 우선순위 |
|---|------|------|---------|
| 1 | **API 인증 전무** — 17개 엔드포인트 모두 무인증 | `app/api/**` | CRITICAL |
| 2 | **xlsx Prototype Pollution** — npm audit critical 1건 | `package.json` | CRITICAL |
| 3 | ML 임계값 API 무인증 변경 가능 | `app/api/ml/thresholds/route.ts` | HIGH |
| 4 | RAG 디버그 엔드포인트 프로덕션 노출 | `app/api/rag/debug/route.ts` | HIGH |
| 5 | CSP `unsafe-inline` / `unsafe-eval` | `next.config.js` | HIGH |
| 6 | `console.log` 잔존 11건 (5개 파일) | 다수 | MEDIUM |
| 7 | ESLint 설정 미생성 (`.eslintrc.json` 없음) | 프로젝트 루트 | HIGH |
| 8 | npm audit high 12건 | `package.json` | HIGH |

### 중간 (Phase 6 Sprint 2)

| # | 이슈 | 파일 | 우선순위 |
|---|------|------|---------|
| 9 | **Questions 패널 미통합** | `components/questions/QuestionPanel.tsx` | HIGH |
| 10 | Questions 패널 i18n 키 없음 | `messages/ko.json`, `messages/en.json` | MEDIUM |
| 11 | Jest 커버리지 ~30% (목표 80%) | `__tests__/` | HIGH |
| 12 | Playwright E2E 테스트 0건 | `e2e/` (미생성) | MEDIUM |
| 13 | Vercel 프로덕션 배포 미완료 | — | HIGH |

### 낮음 (Phase 6 이후)

| # | 이슈 | 설명 |
|---|------|------|
| 14 | Rate Limiter TTL cleanup 없음 | 메모리 누수 가능성 |
| 15 | alerts SSE 무제한 동시 연결 | 서버 부하 잠재 위험 |
| 16 | Edge Sentry `beforeSend` PII 필터 누락 | `sentry.edge.config.ts` |
| 17 | `useChat` sendMessage deps memo 무효화 | `hooks/useChat.ts` |
| 18 | alertStore MAX_ALERTS 크기 제한 없음 | `lib/process/alert-store.ts` |
| 19 | Sentry server cookie 헤더 필터 미구현 | `sentry.server.config.ts` |

### 미정 (Phase 7+)

- 모바일 앱 (React Native)
- IoT 센서 직접 연동 (MQTT/LoRaWAN)
- 다중 공장 통합 관리 Collaborative Dashboard
- ML 모델 고도화 (LSTM 시계열 예측)
- 김치군 마스코트 레벨업 시스템 (씨앗 → 배추 → 김치)
- 김치군 마스코트 공정 연동 색상 변화

---

> **Note**: 이 문서는 2026-02-28 기준으로 CTO팀이 작성한 작업 히스토리 문서입니다.
> 코드 변경 시 해당 섹션을 업데이트하거나 `/pdca report` 명령으로 최신 완료 보고서를 생성하세요.
