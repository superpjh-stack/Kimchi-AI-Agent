# Kimchi-Agent 아키텍처 리뷰

> **Version**: 2.0
> **Date**: 2026-02-28
> **Reviewer**: Enterprise Architect Agent
> **Scope**: Full-stack architecture analysis (Phase 1-5 codebase + Phase 6 준비 상태)

---

## 1. 현재 아키텍처 현황

### 1.1 레이어 구조

현재 Kimchi-Agent는 **Next.js 14 App Router** 기반의 모놀리식 풀스택 아키텍처를 채택하고 있다. 논리적으로 5개 레이어로 분리된다:

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer                                         │
│  app/[locale]/page.tsx  (Single-page orchestrator)          │
│  components/  (chat/, dashboard/, documents/, layout/,      │
│               mascot/, ml/, questions/)  ~25 TSX files      │
│  hooks/  (useChat, useConversations, useAlerts, useMascot,  │
│           useMlPrediction, useTextToSpeech, ...)  11 hooks  │
├─────────────────────────────────────────────────────────────┤
│  Application Layer (API Routes)                             │
│  app/api/  — 20 route files, 21+ HTTP handlers              │
│  /api/chat          POST   — Chat + RAG + SSE streaming     │
│  /api/conversations GET/POST/DELETE — 대화 관리              │
│  /api/documents     GET/POST/DELETE + upload + stats         │
│  /api/ml            predict / quality / history / thresholds │
│  /api/alerts        stream (SSE) / [id] PATCH               │
│  /api/process-data  GET / history                           │
│  /api/rag           debug                                   │
│  /api/health        GET                                     │
│  /api/auth          login / logout / me / refresh           │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer                                               │
│  lib/ai/       — LLM 클라이언트 (Claude, OpenAI, Ollama)     │
│                  streaming.ts, system-prompt.ts  (5 modules) │
│  lib/rag/      — Hybrid Search (Vector + BM25 + RRF 융합)    │
│                  pipeline, retriever, embedder, chunker,     │
│                  bm25, retriever-pg  (7 modules)             │
│  lib/ml/       — IPredictor 인터페이스 + 팩토리               │
│                  rule-based, remote, cache, history (6 mods) │
│  lib/auth/     — JWT + RBAC (신규, 부분 통합)                 │
│                  jwt, rbac, credentials, middleware,          │
│                  audit-logger  (5 modules)                   │
│  lib/security/ — 입력 정제, 파일 MIME 검증  (2 modules)       │
│  lib/middleware — Rate Limiter  (1 module)                   │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                       │
│  lib/db/bkend.ts             — bkend.ai REST 클라이언트      │
│  lib/db/conversations-store  — 파일 기반 영구 저장            │
│  lib/db/file-store.ts        — JSON 파일 I/O                │
│  lib/rag/retriever.ts        — InMemoryVectorStore          │
│  lib/rag/retriever-pg.ts     — PgVectorStore (pgvector)     │
│  lib/rag/bm25.ts             — BM25 인메모리 인덱스          │
│  lib/process/                — 센서 시뮬레이터 (2 modules)   │
├─────────────────────────────────────────────────────────────┤
│  External Services                                          │
│  Anthropic API (claude-sonnet-4-6)                          │
│  OpenAI API (gpt-4o-mini chat, text-embedding-3-small)      │
│  Ollama (local LLM + embeddings, optional)                  │
│  PostgreSQL + pgvector (optional via DATABASE_URL)           │
│  bkend.ai (Phase 2 DB client, optional)                     │
│  Sentry (error tracking), Vercel Analytics                  │
└─────────────────────────────────────────────────────────────┘
```

**레이어별 파일 수:**
| 레이어 | 주요 디렉터리 | 파일 수 |
|--------|-------------|---------|
| Presentation | `components/`, `hooks/`, `app/[locale]/` | ~36 |
| Application | `app/api/` | 20 route files |
| Domain | `lib/ai/`, `lib/rag/`, `lib/ml/`, `lib/auth/`, `lib/security/` | ~26 |
| Infrastructure | `lib/db/`, `lib/process/` | ~7 |
| Tests | `__tests__/` | 4 test files |

### 1.2 데이터 흐름

#### Flow 1: Chat (핵심 경로, SSE Streaming)

```
[Browser]
  │ useChat.sendMessage(text)
  │ POST /api/chat { message, history, conversationId }
  ▼
[API Route: app/api/chat/route.ts — 160 LOC]
  │ 1. Rate Limiting (IP 기반, 20 req/min, 슬라이딩 윈도우)
  │ 2. Input Validation (JSON 파싱, message 필수, 길이 10,000자)
  │    ※ sanitizeChatInput import됨 but 미호출 (P3)
  │    ※ withAuth import됨 but 미적용 (P1)
  │ 3. 병렬 조회:
  │    ├─ retrieveContext(query) — RAG
  │    │   ├─ embed(query) → OpenAI text-embedding-3-small (캐시 30s TTL)
  │    │   ├─ vectorStore.search(top-10, threshold 0.3) — 코사인 유사도
  │    │   ├─ bm25Index.search(top-10) — BM25 키워드
  │    │   └─ reciprocalRankFusion() → RRF 융합 → top 5 결과
  │    └─ sensorClient.getCurrentData() → 센서 시뮬레이터
  │ 4. buildSystemPrompt(ragContext, sensorData)
  │ 5. LLM 프로바이더 선택 (우선순위: Ollama > OpenAI > Claude)
  │    ├─ createOllamaSSEStream()    (OLLAMA_BASE_URL 설정 시)
  │    ├─ createOpenAISSEStream()    (OPENAI_CHAT_MODEL 설정 시) ← 현재 활성
  │    └─ createSSEStream()          (기본: Anthropic SDK)
  │ 6. SSE 스트리밍 응답
  │ 7. onComplete 콜백: 대화 영속 저장 (bkend.ai 또는 file-store)
  ▼
[Browser]
  │ SSE Parser (useChat hook)
  │ → token/sources/done/error 이벤트 처리
  │ → 마스코트 이벤트 발행 (CustomEvent: searching→thinking→success)
  │ → TTS 연동 (Web Speech API ko-KR)
```

#### Flow 2: 문서 업로드

```
[Browser]
  │ DocumentUpload → POST /api/documents/upload (FormData)
  ▼
[API Route — 167 LOC]
  │ 1. Rate Limiting (10 req/min)
  │ 2. 파일 검증: 크기 (10MB), 확장자 (.txt/.csv/.pdf/.xlsx)
  │    ※ file-validator.ts의 magic-bytes 검증 미호출
  │ 3. extractText(file) — 형식별 파서
  │    ├─ .txt/.csv: file.text()
  │    ├─ .pdf: pdf-parse (폴백: naive extraction)
  │    └─ .xlsx: xlsx.read() → sheet_to_csv  [VULNERABLE — CVE]
  │ 4. ingestDocument(text, docId, name, chunkingOptions)
  │    ├─ chunkText (5 strategies: recursive/fixed/paragraph/row/sentence)
  │    ├─ embedBatch (OpenAI, 100개 단위 배치)
  │    ├─ vectorStore.addDocuments() — 벡터 저장
  │    └─ bm25Index.add() — BM25 인덱스 추가
  │ 5. bkend.ai 메타데이터 저장 (설정 시)
  ▼
[응답] 201 Created { id, name, type, chunks, status }
```

#### Flow 3: ML 예측

```
[Browser]
  │ useMlPrediction hook (30초 폴링)
  │ POST /api/ml/predict
  ▼
[API Route]
  │ 1. getSensorData()
  │ 2. getPredictor() — 팩토리: RuleBasedPredictor (기본) 또는 RemoteMLPredictor
  │ 3. PredictionCache 조회 (TTL 30s, 센서값 정규화 키)
  │ 4. predictFermentation(sensorData) — Q10 모델 기반 규칙
```

#### Flow 4: 대화 관리

```
useConversations hook
  → GET /api/conversations (목록, 페이지네이션)
  → POST /api/conversations (생성)
  → GET /api/conversations/[id] (메시지 포함 조회)
  → DELETE /api/conversations/[id]
  → 저장: bkend.ai (설정 시) 또는 .local-db/conversations.json (파일 폴백)
```

### 1.3 의존성 그래프

```
                    page.tsx
                       │
           ┌───────────┼───────────┬──────────────┐
           ▼           ▼           ▼              ▼
       useChat    useConversations useAlerts  useTextToSpeech
           │           │           │
           ▼           ▼           ▼
      /api/chat   /api/conv    /api/alerts/stream
           │           │
     ┌─────┼─────┐     │
     ▼     ▼     ▼     ▼
  claude openai  rag  bkend/file-store
               │
         ┌─────┼─────┐
         ▼     ▼     ▼
     embedder bm25  retriever
                      │
               ┌──────┼──────┐
               ▼             ▼
           InMemory      PgVector
```

**외부 런타임 의존성:**
| 패키지 | 버전 | 용도 | 위험도 |
|--------|------|------|--------|
| `xlsx` | 0.18.5 | Excel 파서 | **Critical** — Prototype Pollution CVE |
| `exceljs` | 4.4.0 | Excel 파서 (교체 대상) | None — 설치 완료, 미적용 |
| `@anthropic-ai/sdk` | 0.27.0 | Claude API | None |
| `pdf-parse` | 1.1.1 | PDF 텍스트 추출 | Low (2019년 마지막 업데이트) |
| `jose` | 6.1.3 | JWT sign/verify (Edge 호환) | None |
| `pg` | 8.19.0 | PostgreSQL 클라이언트 | None |
| `pino` | 10.3.1 | 구조화 로깅 | None |
| `recharts` | 3.7.0 | 대시보드 차트 | None |
| `@sentry/nextjs` | 10.40.0 | 에러 추적 | **배치 오류**: devDependencies |
| `next` | 14.2.5 | 프레임워크 | Low (14.x 안정) |

---

## 2. 문제점 분석

### 2.1 보안 (Critical)

| ID | 이슈 | 심각도 | 상세 |
|----|------|--------|------|
| **S1** | **API 인증 미적용 (17+ 엔드포인트)** | Critical | `lib/auth/` 모듈이 완성되어 있으나 `withAuth()`가 실제 라우트에 적용되지 않음. 20개 API 중 `/api/auth/me` **1개만** 보호됨. `chat/route.ts`에서 `withAuth`를 import하지만 **실제 사용하지 않는 dead import**. |
| **S2** | **xlsx Prototype Pollution (CVE-2024-22363)** | Critical | `xlsx@0.18.5` CVSS 9.8. 조작된 .xlsx 업로드로 서버 코드 실행 가능. `exceljs@4.4.0` 설치 완료되었으나 upload 라우트에서 여전히 `xlsx` 사용 중. |
| **S3** | **보안 모듈 미연결** | High | `sanitizeChatInput()`이 chat route에서 import만 되고 **호출되지 않음** — 프롬프트 인젝션/XSS 무방비. `validateUploadedFile()`도 upload route에서 미사용 — magic bytes 검증 우회. |
| **S4** | **CSP unsafe-inline/unsafe-eval** | Medium | `next.config.js` CSP: `'unsafe-inline' 'unsafe-eval'` 포함 — eval() 기반 XSS 가능. nonce 기반 전환 필요. |
| **S5** | **Rate Limiter IP 전용, 인메모리** | Medium | IP 기반만 (사용자별 미지원), `x-forwarded-for` 신뢰 (스푸핑 가능), 서버 재시작 시 리셋, 멀티 인스턴스 미공유. 만료 항목 정리 메커니즘 부재. |
| **S6** | **bcryptjs 미설치 (평문 폴백)** | Medium | `credentials.ts`에서 bcryptjs 동적 import 실패 시 개발 환경에서 평문 비교 폴백. `package.json`에 bcryptjs 없음. |
| **S7** | **CSRF 보호 없음** | Medium | 쿠키 기반 인증에 CSRF 토큰 없음. `SameSite=Strict`이 대부분 완화하지만 완전하지 않음. |

### 2.2 확장성

| ID | 이슈 | 심각도 | 상세 |
|----|------|--------|------|
| **SC1** | **인메모리 BM25 비영속** | High | `bm25.ts` 모듈 싱글톤 — 서버 재시작/cold start 시 전체 소실. VectorStore는 pgvector 폴백이 있지만 BM25는 영속화 경로 없음. |
| **SC2** | **인메모리 Vector Store 한계** | High | 기본 InMemory 모드에서 재시작 시 소실. maxChunks=10,000 제한. pgvector 전환 시 해결되지만 BM25와 동기화 문제 남음. |
| **SC3** | **파일 기반 대화 저장소** | Medium | `conversations-store.ts` — 동기 JSON 기록, 동시 쓰기 보호 없음, MAX_CONVERSATIONS=500. |
| **SC4** | **모듈 레벨 싱글톤** | Medium | `_provider`(embedder), `_storeInstance`(vector store), `bm25Index` — 모두 모듈 레벨. Serverless/멀티 인스턴스에서 인스턴스별 독립. |
| **SC5** | **쿼리 임베딩 캐시** | Low | `pipeline.ts` 내 `queryEmbeddingCache` — 최대 크기 제한 없음, TTL 만료 정리만 있음. |

### 2.3 유지보수성

| ID | 이슈 | 심각도 | 상세 |
|----|------|--------|------|
| **M1** | **Dead imports (보안 오인 위험)** | High | `chat/route.ts`에서 `withAuth`, `sanitizeChatInput` import 후 미사용. 코드 리뷰 시 "인증 적용됨"으로 오인 가능. |
| **M2** | **Chat route 복잡도** | Medium | 160 LOC에 검증, RAG, 3개 LLM 프로바이더, 영속화, SSE 스트리밍 — SRP 위반. |
| **M3** | **LLM 3중 분기** | Medium | Ollama/OpenAI/Claude를 if/else로 분기. 각 스트리밍 함수의 시그니처와 콜백 패턴이 미묘하게 다름. |
| **M4** | **이중 xlsx/exceljs** | Low | 두 패키지 모두 dependencies에 존재. 마이그레이션 미완 — 혼란과 번들 블로트. |
| **M5** | **혼합 영속화 전략** | Medium | bkend.ai/file-store/in-memory가 런타임 분기(if/else)로 공존. Strategy Pattern이 아닌 직접 분기. |
| **M6** | **테스트 커버리지 부족** | Medium | 4개 테스트 파일만 존재 (embedder, retriever, predictor, cache). API 라우트/인증 통합 테스트 전무. |
| **M7** | **Questions i18n 미완** | Low | QuestionPanel 통합 완료되었으나 60개 질문 텍스트가 한국어 하드코딩. messages/*.json 번역 키 미등록. |

### 2.4 성능

| ID | 이슈 | 심각도 | 상세 |
|----|------|--------|------|
| **P1** | **선형 벡터 검색 O(N)** | Medium | `InMemoryVectorStore.search()` — 전체 항목 순회. maxChunks=10,000 이하에서는 수용 가능. pgvector IVFFlat으로 O(sqrt(N)) 개선. |
| **P2** | **BM25 전체 스캔** | Low | 매 검색마다 전체 문서 순회 O(N*|query|). 역인덱스 구조로 전환 가능. |
| **P3** | **동기 파일 I/O** | Medium | `saveConversations()` — 메시지마다 전체 JSON 동기 기록. debounce 또는 비동기 write 필요. |
| **P4** | **OpenAI SSE keep-alive 부재** | Low | Claude 경로는 15초 ping 있음, OpenAI 경로는 없음. 긴 응답 시 프록시 타임아웃 위험. |
| **P5** | **Sentry devDependencies 배치** | Low | 프로덕션 빌드에서 제외될 수 있음. `withSentryConfig`가 next.config.js에서 사용되므로 dependencies 이동 필요. |

### 2.5 신뢰성

| ID | 이슈 | 심각도 | 상세 |
|----|------|--------|------|
| **R1** | **의존 서비스 헬스 체크 미흡** | Medium | `/api/health` 존재하지만 LLM API 연결, Vector Store 상태 미확인. |
| **R2** | **메시지 영속화 fire-and-forget** | Medium | `onComplete` 콜백 실패 시 조용히 무시. 재시도 또는 dead-letter 없음. |
| **R3** | **LLM 자동 폴백 없음** | Low | 선택된 프로바이더 다운 시 에러 반환만, 다른 프로바이더로 자동 전환 없음. |

---

## 3. 개선사항 목록 (우선순위별)

| 우선순위 | ID | 항목 | 현재 | 목표 | 예상 효과 |
|---------|-----|------|------|------|-----------|
| **Critical** | S1 | API 인증 전체 적용 | 1/20 라우트 보호 | 전체 withAuth 래핑 | LLM 비용 보호, 데이터 탈취 방지 |
| **Critical** | S2 | xlsx → exceljs 교체 | xlsx 0.18.5 (CVE) | exceljs 4.4.0 | Prototype Pollution 제거 |
| **Critical** | S3 | 보안 모듈 연결 | import만 존재 | sanitize + validate 실제 호출 | 프롬프트 인젝션/XSS/MIME 스푸핑 방어 |
| **High** | M1 | Dead imports 제거/적용 | 미사용 import | 제거 또는 실제 적용 | 보안 오인 방지 |
| **High** | S6 | bcryptjs 설치 | 미설치 (평문 폴백) | dependencies 추가 | 프로덕션 인증 정상화 |
| **High** | S4 | CSP nonce 전환 | unsafe-inline/eval | nonce 기반 | XSS 공격 면적 축소 |
| **Medium** | S5 | Rate Limiter 개선 | 인메모리 IP-only | 사용자별 + 외부화 (Redis/KV) | 분산 환경 보호 |
| **Medium** | P5 | Sentry → dependencies | devDependencies | dependencies | 프로덕션 에러 추적 보장 |
| **Medium** | SC1 | BM25 영속화 | 인메모리 | pgvector 동일 생명주기 | cold start 후 검색 유지 |
| **Medium** | M5 | 저장소 Repository Pattern | if/else 분기 | IConversationRepo 인터페이스 | 저장소 교체 용이 |
| **Medium** | M3 | LLM 클라이언트 통합 | 3중 if/else | LLMAdapter 인터페이스 | 확장성/테스트 용이 |
| **Medium** | M6 | 테스트 확충 | 4개 파일 | Jest 80%+, Playwright E2E | 회귀 방지, CI 신뢰도 |
| **Medium** | P3 | 파일 I/O 비동기화 | 동기 매 저장 | debounce 1초 + async write | I/O 병목 해소 |
| **Low** | SC5 | 캐시 크기 제한 | 무제한 Map | LRU + maxSize | 메모리 누수 방지 |
| **Low** | M7 | Questions i18n | 한국어 하드코딩 | ko/en 번역 키 등록 | 다국어 UX |
| **Low** | P4 | OpenAI SSE keep-alive | 없음 | 15초 ping 추가 | 프록시 타임아웃 방지 |

---

## 4. 대안 아키텍처 제안

### Option A: 점진적 개선 (Recommended)

**핵심:** 현재 모놀리식 구조를 유지하면서 보안/안정성 Critical 이슈만 해결

#### 변경 범위

| 영역 | 작업 | 공수 |
|------|------|------|
| Auth | `withAuth()`를 17개 API 라우트에 적용 | 2일 |
| xlsx | upload route에서 `xlsx` → `exceljs` 교체, `xlsx` 제거 | 0.5일 |
| Security | `sanitizeChatInput()` → chat route, `validateUploadedFile()` → upload route 연결 | 1일 |
| CSP | nonce 기반 CSP (next.config.js headers + middleware) | 1일 |
| Persistence | 대화 저장소 비동기화 (debounce flush) | 1일 |
| Rate Limit | 사용자별 Rate Limiting 추가 | 0.5일 |
| Tests | Jest 80%+ (Phase 6 Sprint 2) | 3일 |
| Dependencies | bcryptjs 설치, Sentry → dependencies 이동 | 0.5일 |

#### 변경 후 아키텍처

```
Browser → Next.js Middleware (i18n + CSRF check)
       → API Routes + withAuth(handler, { permissions })
         → Rate Limiter (IP + user)
         → Input Sanitizer / File Validator
         → Business Logic (현행 유지)
         → Persistence (file-store with async queue)
```

**장점:**
- 최소 변경으로 Critical 보안 위험 제거
- 기존 코드 구조 유지 — 학습 비용 없음
- Phase 6 Sprint 1-2 일정에 부합 (총 ~9일)
- 이미 구현된 auth/security 모듈 활용

**단점:**
- 구조적 결합도(API 라우트 내 비즈니스 로직) 미해결
- 단일 프로세스 제약 유지
- 테스트 시 모듈 모킹 필요

**권고 대상:** 현재 팀 규모 (1-2인), MVP/초기 운영

---

### Option B: 레이어 아키텍처 강화

**핵심:** Service Layer + Repository Pattern 도입으로 관심사 명확 분리

#### 신규 구조

```
app/api/ (얇은 컨트롤러, <30 LOC each)
  ├── chat/route.ts        → ChatService에 위임
  ├── documents/upload/    → DocumentService에 위임
  ├── conversations/       → ConversationService에 위임
  └── ml/                  → MLService에 위임

lib/services/ (NEW — 비즈니스 로직)
  ├── ChatService.ts       — RAG 검색 + LLM 선택 + 스트리밍 오케스트레이션
  ├── DocumentService.ts   — 텍스트 추출 + 청킹 + 임베딩 + 인덱싱
  ├── ConversationService  — CRUD + 영속화
  └── MLService.ts         — 예측 + 캐싱

lib/repositories/ (NEW — 영속화 추상화)
  ├── IConversationRepo.ts — interface
  ├── FileConversationRepo — .local-db JSON 구현
  ├── BkendConversationRepo — bkend.ai REST 구현
  ├── IDocumentRepo.ts     — interface
  └── IVectorRepo.ts       — (기존 VectorStore 인터페이스 활용)

lib/adapters/ (NEW — 외부 서비스 추상화)
  ├── ILLMAdapter.ts       — interface
  ├── ClaudeAdapter.ts     — Anthropic SDK 래핑
  ├── OpenAIAdapter.ts     — fetch 기반 SSE
  └── OllamaAdapter.ts     — Ollama API
```

#### 변경 후 아키텍처

```
API Route (auth + validation only, <30 LOC)
  → Service (business logic, provider selection)
    → Adapter (LLM provider abstraction)
    → Repository (persistence abstraction)
      → Concrete store (file / bkend / pgvector / memory)
```

**장점:**
- 테스트 용이성 대폭 향상 (Service/Repository 단위 테스트)
- 저장소 교체 시 Repository 구현체만 추가
- API 라우트 가독성 향상 (5-10줄로 축소)
- 새 LLM 프로바이더 추가 시 Adapter만 구현

**단점:**
- 파일/폴더 수 증가 (~15-20개 신규)
- 초기 리팩터링 비용 (~10일)
- 소규모 프로젝트에는 과도한 추상화 위험

**권고 대상:** 팀 3-5인, 장기 운영/유지보수 계획

---

### Option C: 부분 마이크로서비스

**핵심:** RAG와 ML을 별도 서비스로 분리, Next.js는 BFF(Backend For Frontend) 역할

#### 서비스 구성

| 서비스 | 역할 | 런타임 |
|--------|------|--------|
| **Next.js BFF** | UI 렌더링, 인증/세션, SSE 프록시 | Vercel Serverless |
| **RAG Service** | 임베딩, 인덱싱, 검색 (Vector + BM25) | FastAPI/Python + pgvector |
| **ML Service** | 예측, A/B 테스트, 모델 관리 | FastAPI/Python + scikit-learn |

#### 아키텍처

```
┌─────────────────┐     ┌──────────────────┐
│  Next.js BFF     │────▶│  RAG Service      │
│  (Vercel)        │     │  (FastAPI/Python)  │
│                  │     │  - pgvector        │
│  - UI 렌더링     │     │  - Embedding       │
│  - 인증/세션     │     │  - BM25 (whoosh)   │
│  - SSE 프록시    │     │  - Chunking        │
│                  │     └──────────────────┘
│                  │
│                  │     ┌──────────────────┐
│                  │────▶│  ML Service        │
│                  │     │  (FastAPI/Python)  │
│                  │     │  - scikit-learn    │
│                  │     │  - TensorFlow Lite │
│                  │     │  - A/B Framework   │
│                  │     └──────────────────┘
│                  │
│                  │────▶ Claude/OpenAI API (직접 호출)
│                  │────▶ bkend.ai (직접 호출)
└─────────────────┘
```

**장점:**
- Python ML 생태계 네이티브 활용 (scikit-learn, transformers)
- 서비스별 독립 스케일링 (RAG: CPU, ML: GPU)
- Next.js 번들 크기 대폭 축소

**단점:**
- 인프라 복잡도 급증 (Docker, 서비스 간 통신, 장애 전파)
- 개발 비용 (~4주+)
- 소규모 팀에서 운영 부담 과중

**권고 대상:** 팀 5인+, ML 모델 자체 개발, 대규모 트래픽

---

## 5. 비교 매트릭스

| 기준 | Option A (점진적) | Option B (레이어 강화) | Option C (마이크로서비스) |
|------|------------------|---------------------|----------------------|
| **보안 해결 속도** | 3-5일 | 5-8일 | 15+일 |
| **구조적 개선** | 낮음 | 높음 | 매우 높음 |
| **위험도** | 낮음 | 중간 | 높음 |
| **팀 공수** | 1인, 1 Sprint | 1-2인, 2 Sprint | 3+인, 3+ Sprint |
| **Multi-tenant 준비** | 부분 (AsyncLocalStorage) | 양호 (Repository 추상화) | 네이티브 |
| **테스트 개선** | 보통 | 높음 | 높음 |
| **운영 복잡도** | 현행 수준 | 현행 수준 | Docker/K8s 필요 |

---

## 6. 권고안

### 5.1 단기 (Sprint 1-2, Phase 6) — Option A 실행

**즉시 조치 (Week 1):**

1. **전체 API 라우트에 `withAuth()` 적용** — S1, M1 동시 해결
   - 공개 라우트(`/api/auth/login`, `/api/health`) 제외
   - 각 라우트에 적절한 permissions 설정
   - chat/route.ts의 dead imports를 실제 적용으로 전환

2. **`sanitizeChatInput()` 실제 호출** — S3 해결
   - chat route POST 핸들러에서 message 검증 전 호출
   - 프롬프트 인젝션 탐지 시 400 반환

3. **xlsx → exceljs 교체** — S2 해결
   - `upload/route.ts` 내 `import('xlsx')` → `import('exceljs')` 전환
   - `package.json`에서 `xlsx` 의존성 제거
   - `next.config.js` serverComponentsExternalPackages에서 'xlsx' → 'exceljs' 교체

4. **bcryptjs 설치** — S6 해결
   - `npm install bcryptjs && npm install -D @types/bcryptjs`

5. **Sentry → dependencies 이동** — P5 해결

**Sprint 2 (Week 2-3):**

6. **CSP nonce 전환** — S4 해결
7. **`validateUploadedFile()` upload route 연결** — S3 완료
8. **OpenAI SSE keep-alive 추가** — P4 해결
9. **테스트 확충** (Jest 80%+ 목표) — M6 해결
10. **대화 저장소 async 전환** — P3 해결

### 5.2 중기 (3-6개월) — Option B 일부 채택

11. **LLMAdapter 인터페이스 추출** — M3 해결
12. **Repository Pattern 도입** — M5 해결 (IConversationRepo → File/Bkend 구현체)
13. **Service Layer 도입** (ChatService, DocumentService) — M2 해결
14. **Rate Limiter 외부화** — S5 해결 (Vercel KV / Upstash Redis)
15. **BM25 영속화** — SC1 해결
16. **Multi-tenant 기반 구조** (Phase 6 Sprint 4)

### 5.3 장기 (6개월+) — 선택적 Option C

17. **ML Service 분리** — scikit-learn/transformers 실제 모델 필요 시에만
18. **RAG Service 분리** — 문서 10,000건+, 동시 사용자 100+ 시에만
19. **Container 오케스트레이션** — 서비스 3개 이상 분리 시에만

---

## 7. 현재 아키텍처 강점

Critical 이슈에도 불구하고, 현재 아키텍처에는 주목할 강점이 있다:

1. **유연한 LLM 프로바이더 시스템**: Claude/OpenAI/Ollama 3개 프로바이더, 환경변수 기반 선택
2. **정교한 RAG 파이프라인**: Hybrid Search (Vector + BM25 + RRF) — 프로덕션급 검색 품질
3. **5가지 청킹 전략**: recursive/fixed/paragraph/row/sentence — 파일 형식별 최적화
4. **타입 시스템**: 공유 `types/index.ts`, SSE 이벤트 discriminated union
5. **Provider/Factory 패턴**: Embedder, VectorStore, Predictor 모두 인터페이스 + 팩토리
6. **점진적 향상**: pgvector/bkend.ai opt-in, graceful fallback to in-memory/file
7. **보안 모듈 사전 구축**: JWT/RBAC/sanitizer/validator 완성 — 연결만 하면 됨
8. **i18n 지원**: next-intl (ko/en), URL prefix routing, middleware rewrite
9. **김치군 마스코트**: Event-Driven Decoupling (CustomEvent), CSS-only 애니메이션
10. **구조화 로깅**: pino + module-scoped child loggers

---

## Appendix A: API 엔드포인트 인벤토리

| 엔드포인트 | 메서드 | 인증 | Rate Limit | Sanitized |
|-----------|--------|------|------------|-----------|
| `/api/chat` | POST | **None** (dead import) | Yes (IP 20/min) | **No** (dead import) |
| `/api/conversations` | GET, POST | None | No | No |
| `/api/conversations/[id]` | GET, DELETE | None | No | No |
| `/api/documents` | GET | None | No | N/A |
| `/api/documents/[id]` | DELETE | None | No | N/A |
| `/api/documents/upload` | POST | None | Yes (IP 10/min) | No |
| `/api/documents/stats` | GET | None | No | N/A |
| `/api/ml/predict` | POST | None | No | No |
| `/api/ml/quality` | POST | None | No | No |
| `/api/ml/history` | GET | None | No | N/A |
| `/api/ml/thresholds` | GET, PUT | None | No | No |
| `/api/process-data` | GET | None | No | N/A |
| `/api/process-data/history` | GET | None | No | N/A |
| `/api/rag/debug` | GET | None | No | N/A |
| `/api/health` | GET | None | No | N/A |
| `/api/alerts/stream` | GET (SSE) | None | No | N/A |
| `/api/alerts/[id]` | PATCH | None | No | No |
| `/api/auth/login` | POST | N/A (공개) | No | Partial (email) |
| `/api/auth/logout` | POST | None | No | N/A |
| `/api/auth/me` | GET | **Yes** (withAuth) | No | N/A |
| `/api/auth/refresh` | POST | N/A (refresh token) | No | N/A |

## Appendix B: 환경변수 맵

| 변수 | 필수 여부 | 사용처 | 기본값 |
|------|----------|--------|--------|
| `ANTHROPIC_API_KEY` | 조건부 | `lib/ai/claude.ts` | None (OpenAI 폴백) |
| `OPENAI_API_KEY` | 조건부 | Embedder, Chat 폴백 | Mock 임베더 |
| `OPENAI_CHAT_MODEL` | 선택 | `lib/ai/openai-chat.ts` | gpt-4o-mini |
| `OLLAMA_BASE_URL` | 선택 | Ollama 프로바이더 | None |
| `DATABASE_URL` | 선택 | pgvector | InMemory |
| `BKEND_PUBLISHABLE_KEY` | 선택 | bkend.ai 클라이언트 | File-store |
| `JWT_SECRET` | 인증 시 필수 | `lib/auth/jwt.ts` | Error |
| `AUTH_USERS` | 인증 시 필수 | `lib/auth/credentials.ts` | 빈 배열 |
| `RATE_LIMIT_MAX` | 선택 | Rate limiter | 30 |
| `EMBEDDING_PROVIDER` | 선택 | Embedder 팩토리 | Auto-detect |
| `CLAUDE_MODEL` | 선택 | Claude 클라이언트 | claude-sonnet-4-6 |
| `CLAUDE_MAX_TOKENS` | 선택 | Claude 클라이언트 | 2048 |
| `ML_SERVER_URL` | 선택 | ML Remote Predictor | Rule-based |
| `LOG_LEVEL` | 선택 | Pino 로거 | debug(dev) / info(prod) |
| `SENTRY_DSN` | 선택 | Sentry | Disabled |

## Appendix C: 점수 요약

| 관점 | 현재 점수 | 목표 (6개월) | 핵심 조치 |
|------|----------|-------------|----------|
| **보안** | 3/10 | 8/10 | withAuth 전 라우트 적용, xlsx 교체, sanitize 호출 |
| **확장성** | 5/10 | 7/10 | Repository Pattern, Rate Limiter 외부화 |
| **유지보수성** | 6/10 | 8/10 | LLM Adapter, Service Layer, 테스트 80%+ |
| **성능** | 7/10 | 8/10 | pgvector 전환, BM25 영속화, keep-alive |

---

**최우선 권고: Option A (점진적 개선)** — 현재 팀 규모와 Phase 6 일정에 가장 부합하며, 보안 Critical 이슈를 1주 이내에 해결할 수 있다. 이미 구현된 auth/security 모듈을 연결하는 것만으로 보안 점수를 3→7로 끌어올릴 수 있다. Option B의 Service/Repository 패턴은 중기 과제로 점진 도입한다.

---

*이 문서는 2026-02-28 시점의 Kimchi-Agent v0.1.0 코드베이스를 기준으로 작성되었습니다.*
