# Kimchi-Agent Architecture Review

> **Version**: 1.0
> **Date**: 2026-02-28
> **Reviewer**: Enterprise Architect Agent
> **Scope**: Full-stack architecture analysis (Phase 1-5 codebase + Phase 6 준비 상태)

---

## 1. Executive Summary

Kimchi-Agent is a Next.js 14 full-stack application serving as an AI-powered assistant for kimchi factory operations. It provides chat-based interactions (text + voice), RAG-based document retrieval, ML fermentation/quality prediction, and a real-time sensor dashboard.

The codebase has evolved through 5 phases to a feature-rich MVP with ~60 source files. While the application functions well for single-tenant development use, critical architectural gaps remain before production deployment:

- **17 unprotected API endpoints** (auth module created but not yet wired)
- **Dual vulnerability** in `xlsx` package (Critical Prototype Pollution) alongside the new `exceljs` dependency
- **In-memory data stores** that reset on server restart
- **Tight coupling** between page components and business logic

This review analyzes the current architecture, identifies key problems, and proposes three improvement options.

---

## 2. Current Architecture Analysis

### 2.1 Layer Overview

```
+------------------------------------------------------+
|                    Browser (Client)                   |
|  app/[locale]/page.tsx  (Single-page orchestrator)    |
|  components/  (chat/, dashboard/, documents/,         |
|               layout/, mascot/, ml/, questions/)      |
|  hooks/  (useChat, useConversations, useAlerts,       |
|           useMascot, useMlPrediction, useTTS, ...)    |
+------------------------------------------------------+
                       | SSE / REST
+------------------------------------------------------+
|                 Next.js API Routes                    |
|  /api/chat          POST   - Chat + RAG + streaming   |
|  /api/conversations GET/POST/DELETE                   |
|  /api/documents     GET/POST/DELETE + upload + stats  |
|  /api/ml            predict / quality / history / thr |
|  /api/alerts        stream (SSE) / [id] PATCH         |
|  /api/process-data  GET / history                     |
|  /api/rag           debug                             |
|  /api/health        GET                               |
|  /api/auth          login / logout / me / refresh     |
+------------------------------------------------------+
                       |
+------------------------------------------------------+
|                  Business Logic (lib/)                |
|  ai/     - claude.ts, openai-chat.ts, ollama.ts,     |
|            streaming.ts, system-prompt.ts             |
|  rag/    - pipeline.ts, retriever.ts, retriever-pg,   |
|            embedder.ts, chunker.ts, bm25.ts           |
|  ml/     - predictor.ts, rule-based.ts, remote.ts,    |
|            prediction-cache.ts, factory.ts            |
|  auth/   - jwt.ts, rbac.ts, credentials.ts,           |
|            auth-middleware.ts, audit-logger.ts         |
|  security/ - input-sanitizer.ts, file-validator.ts    |
|  middleware/ - rate-limit.ts                          |
|  process/ - sensor-client.ts, simulator.ts            |
|  db/     - bkend.ts, conversations-store.ts,          |
|            file-store.ts                              |
|  config/ , utils/ , logger.ts                        |
+------------------------------------------------------+
                       |
+------------------------------------------------------+
|              External Services                       |
|  Claude API  (claude-sonnet-4-6)                     |
|  OpenAI API  (gpt-4o-mini fallback, embeddings)      |
|  Ollama      (local LLM + embeddings, optional)      |
|  PostgreSQL  (pgvector, optional via DATABASE_URL)    |
|  bkend.ai    (Phase 2 DB client, optional)           |
|  Sentry      (error tracking, optional)              |
+------------------------------------------------------+
```

### 2.2 Data Flow Analysis

#### Flow 1: Chat (SSE Streaming)
```
useChat hook
  -> POST /api/chat (route.ts, 160 lines)
    -> Rate limiter check (IP-based, 20 req/min)
    -> Validate & parse ChatRequest
    -> Parallel: [retrieveContext(query), getSensorData()]
      -> retrieveContext:
        -> Embed query (OpenAI/Ollama/Mock)
        -> Vector search (InMemory or pgvector, top 10)
        -> BM25 keyword search (top 10)
        -> Reciprocal Rank Fusion -> top 5
    -> buildSystemPrompt(ragContext, sensorData)
    -> Select LLM provider (Ollama > OpenAI > Claude)
    -> Stream response via SSE
    -> onComplete callback: persist to conversationStore or bkend.ai
  <- SSE events: token -> sources -> done | error
```

**Observations**:
- The chat route is the most complex handler (160 LOC) with 3 LLM provider paths
- RAG retrieval uses a sophisticated Hybrid Search (Vector + BM25 + RRF fusion)
- History limited to 20 messages (good for token budget)
- Message persistence happens after streaming completes (fire-and-forget)

#### Flow 2: Document Upload
```
DocumentUpload component
  -> POST /api/documents/upload (route.ts, 167 lines)
    -> Rate limiter (10 req/min)
    -> Validate: size (10MB), extension (.txt/.csv/.pdf/.xlsx)
    -> extractText(): dispatch by extension
      -> .txt/.csv: file.text()
      -> .pdf: pdf-parse (fallback: naive extraction)
      -> .xlsx: xlsx.read() -> sheet_to_csv  [VULNERABLE]
    -> ingestDocument(text, docId, name, chunkingOptions)
      -> chunkText (5 strategies: recursive/fixed/paragraph/row/sentence)
      -> embedBatch (OpenAI/Ollama/Mock)
      -> store.addDocuments (vector store)
      -> bm25Index.add (keyword index)
    -> Optionally persist metadata to bkend.ai
```

**Observations**:
- Still using `xlsx` package for extraction (Critical vulnerability)
- `exceljs` is in package.json but not yet wired into upload route
- No magic-bytes validation applied in the actual upload handler (module exists but unused)
- No auth check on upload

#### Flow 3: ML Prediction
```
DashboardPanel / useMlPrediction hook (30s polling)
  -> POST /api/ml/predict
    -> getSensorData()
    -> getPredictor() (factory: RuleBased or Remote)
    -> predictFermentation(sensorData)
    -> Prediction cache (TTL 30s)
  -> POST /api/ml/quality
    -> predictQuality(input)
```

**Observations**:
- RuleBasedPredictor uses hardcoded heuristics (Q10 model) -- adequate for MVP
- 30s polling from client is acceptable but could benefit from SSE push
- No auth on ML endpoints

#### Flow 4: Conversation Management
```
useConversations hook
  -> GET /api/conversations (list all)
  -> POST /api/conversations (create)
  -> GET /api/conversations/[id] (get with messages)
  -> DELETE /api/conversations/[id]
  -> Data persisted to .local-db/conversations.json (file-based)
```

**Observations**:
- File-based persistence is a single-process solution (no concurrent write safety)
- MAX_CONVERSATIONS=500 provides memory leak protection
- No tenant isolation -- all users see all conversations

### 2.3 Component Architecture

| Layer | Count | Key Responsibility |
|-------|-------|--------------------|
| `app/api/` | 17 route files | REST/SSE endpoints, no auth applied |
| `components/` | ~25 TSX files | UI across 8 subdirectories |
| `hooks/` | 11 hooks | Client state, SSE parsing, polling |
| `lib/ai/` | 5 modules | LLM clients, streaming, prompts |
| `lib/rag/` | 6 modules | Chunking, embedding, retrieval, BM25 |
| `lib/ml/` | ~6 modules | Prediction, caching, factory |
| `lib/auth/` | 5 modules | JWT, RBAC, credentials, middleware |
| `lib/security/` | 2 modules | Input sanitizer, file validator |
| `types/` | 1 file | Shared TypeScript types |

---

## 3. Problem Analysis

### 3.1 Security (CRITICAL)

| Issue | Severity | Detail |
|-------|----------|--------|
| **S1. No authentication on 17 API endpoints** | Critical | `lib/auth/` modules exist but `withAuth()` is not applied to any route handler. All endpoints are fully public. |
| **S2. xlsx Prototype Pollution (CVE)** | Critical | `xlsx@0.18.5` has known Critical-severity Prototype Pollution. `exceljs@4.4.0` is installed but the upload route still imports `xlsx`. |
| **S3. Security modules unused** | High | `input-sanitizer.ts` and `file-validator.ts` exist in `lib/security/` but are not called from `POST /api/chat` or `POST /api/documents/upload`. Only `sanitizeEmail` is used in login route. |
| **S4. CSP uses unsafe-inline/unsafe-eval** | Medium | `next.config.js` CSP includes `'unsafe-inline' 'unsafe-eval'` for scripts -- effectively negates CSP protection. Needs nonce-based approach. |
| **S5. Rate limiter is IP-only, in-memory** | Medium | Rate limiting resets on server restart. Relies on `x-forwarded-for` (spoofable without proxy trust). No per-user rate limiting. |
| **S6. Development plaintext password fallback** | Medium | `credentials.ts` falls back to plaintext comparison when bcryptjs is not installed in non-production environments. |
| **S7. No CSRF protection** | Medium | Cookie-based auth without CSRF tokens. `SameSite=Strict` mitigates most vectors but not all. |

### 3.2 Scalability

| Issue | Severity | Detail |
|-------|----------|--------|
| **SC1. In-memory Vector Store** | High | Default storage resets on restart. Module-level `Map<string, StoredEntry>` in `retriever.ts` cannot scale beyond single process. pgvector support exists but requires external Docker setup. |
| **SC2. In-memory BM25 index** | High | `bm25.ts` singleton resets on restart. No persistence layer. Not synchronized with vector store lifecycle. |
| **SC3. File-based conversation store** | Medium | `conversations-store.ts` uses synchronous JSON file writes. No concurrent write protection. MAX_CONVERSATIONS=500 is a blunt limit. |
| **SC4. In-memory rate limiter** | Medium | `rate-limit.ts` Map resets on restart/deploy. Not shared across serverless instances. |
| **SC5. Module-level singletons** | Medium | `_provider` (embedder), `_storeInstance` (vector store), `bm25Index` -- all module-level. Works for single-process but breaks in serverless/multi-instance. |

### 3.3 Maintainability

| Issue | Severity | Detail |
|-------|----------|--------|
| **M1. God page component** | Medium | `app/[locale]/page.tsx` (163 lines) orchestrates 8+ components, manages tab state, sidebar, conversation selection, TTS, mascot -- too many responsibilities. |
| **M2. Chat route complexity** | Medium | `app/api/chat/route.ts` (160 lines) handles validation, RAG, 3 LLM providers, conversation persistence, SSE streaming -- violates SRP. |
| **M3. Dual xlsx/exceljs** | Low | Both packages in dependencies. Migration incomplete, creating confusion and bloat. |
| **M4. Mixed persistence strategies** | Medium | bkend.ai, file-store, and in-memory all coexist with runtime branching. Makes testing and reasoning about data flow difficult. |
| **M5. No dependency injection** | Low | Business logic directly imports singletons. Makes unit testing require module mocking. |

### 3.4 Performance

| Issue | Severity | Detail |
|-------|----------|--------|
| **P1. Linear vector search** | Medium | `InMemoryVectorStore.search()` iterates all entries for cosine similarity. O(n) per query. Acceptable for <10k chunks but degrades beyond. |
| **P2. No embedding cache for documents** | Low | Only query embeddings are cached (30s TTL). Document re-ingestion always re-embeds. |
| **P3. Synchronous file I/O** | Medium | `saveConversations()` performs synchronous writes on every message. Could block the event loop under load. |
| **P4. Client-side 30s polling for ML** | Low | `useMlPrediction` polls every 30s. Server-Sent Events or WebSocket would be more efficient. |

### 3.5 Reliability

| Issue | Severity | Detail |
|-------|----------|--------|
| **R1. No health check for dependencies** | Medium | `/api/health` exists but does not verify LLM API connectivity or vector store status. |
| **R2. Fire-and-forget message persistence** | Medium | `onComplete` callback in chat route can fail silently. No retry or dead-letter mechanism. |
| **R3. No graceful degradation for LLM** | Low | If the selected LLM provider is down, the error is caught but no automatic fallback to another provider occurs. |

---

## 4. Architecture Options

### 4.1 Option A: Incremental Hardening (Recommended for Phase 6)

**Philosophy**: Minimal structural change, maximum security/reliability improvement. Wire existing modules and fix critical gaps.

#### Changes

| Area | Action | Effort |
|------|--------|--------|
| Auth | Apply `withAuth()` to all 17 route handlers | 2d |
| xlsx | Replace `xlsx` import in upload route with `exceljs`, remove `xlsx` from package.json | 0.5d |
| Security | Wire `sanitizeChatInput()` into `/api/chat`, `validateUploadedFile()` into `/api/documents/upload` | 1d |
| CSP | Implement nonce-based CSP via `next.config.js` headers + middleware | 1d |
| Persistence | Make conversation store async with write queue (debounced flush) | 1d |
| Rate limit | Add per-user rate limiting alongside IP-based | 0.5d |
| Tests | Jest 80%+ coverage (Phase 6 Sprint 2) | 3d |

#### Architecture (After)
```
Browser -> Next.js Middleware (i18n + CSRF check)
        -> API Routes + withAuth(handler, { permissions })
           -> Rate Limiter (IP + user)
           -> Input Sanitizer
           -> Business Logic
           -> Persistence (file-store with async queue)
```

**Pros**: Lowest risk, fastest to deliver, builds on existing code
**Cons**: Doesn't address structural coupling, still single-process constrained

---

### 4.2 Option B: Service Layer + Repository Pattern

**Philosophy**: Introduce explicit service and repository layers to decouple business logic from API routes and persistence.

#### Changes

```
app/api/
  chat/route.ts        -> thin handler, delegates to ChatService
  documents/upload/     -> thin handler, delegates to DocumentService
  conversations/        -> thin handler, delegates to ConversationService

lib/services/
  chat.service.ts       -> RAG retrieval, LLM selection, streaming
  document.service.ts   -> text extraction, ingestion pipeline
  conversation.service.ts -> CRUD + persistence
  ml.service.ts         -> prediction, caching

lib/repositories/
  conversation.repository.ts  -> interface + FileConversationRepo + BkendConversationRepo
  document.repository.ts      -> interface + InMemoryDocRepo + PgDocRepo
  vector-store.repository.ts  -> (already exists as VectorStore interface)
```

#### Architecture (After)
```
API Route (auth + validation only, <30 LOC each)
  -> Service (business logic, provider selection)
    -> Repository (persistence abstraction)
      -> Concrete store (file / bkend / pgvector / memory)
```

**Pros**: Clean separation of concerns, testable services, easy to swap persistence
**Cons**: Significant refactoring (3-5 days), risk of over-abstraction for current team size

---

### 4.3 Option C: API Gateway + Microservices (Future Consideration)

**Philosophy**: Split into independently deployable services for multi-tenant, high-availability operation.

#### Proposed Services

| Service | Responsibility | Runtime |
|---------|---------------|---------|
| Gateway | Auth, rate limiting, routing | Next.js Edge Middleware |
| Chat Service | LLM orchestration, SSE streaming | Node.js (long-running) |
| RAG Service | Embedding, indexing, retrieval | Node.js + pgvector |
| ML Service | Prediction, A/B testing | Python (optional) or Node.js |
| Tenant Service | Multi-tenant config, billing | Node.js |

```
Client -> API Gateway (Edge)
       -> Chat Service
       -> RAG Service (gRPC internal)
       -> ML Service (gRPC internal)
       -> PostgreSQL (shared, tenant-isolated)
```

**Pros**: Independent scaling, polyglot support (Python ML), strong tenant isolation
**Cons**: Massive infrastructure overhead, 10x complexity increase, premature for current stage

---

## 5. Comparison Matrix

| Criteria | Option A (Hardening) | Option B (Service Layer) | Option C (Microservices) |
|----------|---------------------|-------------------------|-------------------------|
| **Security fix speed** | 3-5 days | 5-8 days | 15+ days |
| **Structural improvement** | Low | High | Very High |
| **Risk** | Low | Medium | High |
| **Team effort** | 1 developer, 1 sprint | 1-2 developers, 2 sprints | 3+ developers, 3+ sprints |
| **Multi-tenant readiness** | Partial (AsyncLocalStorage) | Good (Repository abstraction) | Native |
| **Testability improvement** | Moderate | High | High |
| **Operational complexity** | Same as today | Same as today | Docker/K8s required |

---

## 6. Recommendations

### Phase 6 Sprint 1 (Immediate — 1 week)
**Execute Option A** to close all Critical/High security gaps:

1. **Wire `withAuth()`** to all API routes with appropriate permissions
2. **Replace `xlsx` with `exceljs`** in `extractText()` function and remove `xlsx` from dependencies
3. **Wire `sanitizeChatInput()`** into `/api/chat` before processing
4. **Wire `validateUploadedFile()`** into `/api/documents/upload` before extraction
5. **Implement nonce-based CSP** (replace `unsafe-inline`/`unsafe-eval`)
6. **Add bcryptjs** to production dependencies (remove plaintext fallback)

### Phase 6 Sprint 2-3 (2-4 weeks)
**Begin Option B migration** incrementally:

1. Extract `ChatService` from `chat/route.ts` — the highest-complexity route
2. Extract `ConversationRepository` interface — decouple file-store from route
3. Add Jest tests targeting services (80%+ coverage)
4. Integrate QuestionPanel into page.tsx (already complete, just wiring)

### Phase 7+ (Future)
**Consider Option C** only when:
- Multiple factories (tenants) are using the system simultaneously
- ML models require Python runtime (TensorFlow/PyTorch)
- Chat traffic exceeds single-instance capacity (>100 concurrent streams)

---

## 7. API Endpoint Inventory

| Endpoint | Methods | Auth Status | Rate Limited | Sanitized |
|----------|---------|-------------|-------------|-----------|
| `/api/chat` | POST | None | Yes (IP) | No |
| `/api/conversations` | GET, POST | None | No | No |
| `/api/conversations/[id]` | GET, DELETE | None | No | No |
| `/api/documents` | GET | None | No | N/A |
| `/api/documents/[id]` | DELETE | None | No | N/A |
| `/api/documents/upload` | POST | None | Yes (IP) | No |
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
| `/api/auth/login` | POST | N/A (public) | No | Partial (email) |
| `/api/auth/logout` | POST | None | No | N/A |
| `/api/auth/me` | GET | None | No | N/A |

---

## 8. Dependency Risk Assessment

| Package | Version | Risk | Action |
|---------|---------|------|--------|
| `xlsx` | 0.18.5 | **Critical** (Prototype Pollution) | Remove, use `exceljs` |
| `pdf-parse` | 1.1.1 | **Low** (last update 2019) | Monitor, consider `pdf-lib` |
| `next` | 14.2.5 | **Low** (stable, 14.x EOL TBD) | Update to 14.2.x latest |
| `exceljs` | 4.4.0 | None | Already installed, wire into upload |
| `jose` | 6.1.3 | None | Active, Edge-compatible JWT |
| `pino` | 10.3.1 | None | Active structured logger |
| `@anthropic-ai/sdk` | 0.27.0 | None | Active |
| `recharts` | 3.7.0 | None | Dashboard charts |
| `@sentry/nextjs` | 10.40.0 | None | Error tracking |

---

## 9. Key Architecture Strengths

Despite the gaps identified above, the current architecture has several notable strengths:

1. **Flexible LLM provider system**: Three providers (Claude/OpenAI/Ollama) with environment-based selection
2. **Sophisticated RAG pipeline**: Hybrid search with RRF fusion is production-grade retrieval
3. **5 chunking strategies**: Thoughtful document processing for different file types
4. **Well-designed type system**: Shared `types/index.ts` with discriminated union for SSE events
5. **Provider/Factory pattern**: Embedder, VectorStore, and Predictor all use interface + factory
6. **Progressive enhancement**: pgvector/bkend.ai opt-in, graceful fallback to in-memory/file
7. **Security modules pre-built**: JWT/RBAC/sanitizer/validator exist — just need wiring
8. **i18n support**: next-intl with ko/en, URL prefix routing
9. **Kimchi mascot system**: Event-driven, fully decoupled (CustomEvent pattern)
10. **Structured logging**: pino with module-scoped child loggers

---

## Appendix A: File Count by Layer

```
app/api/          17 route.ts files (21 HTTP handlers)
components/       ~25 .tsx files across 8 directories
hooks/            11 hook files
lib/ai/           5 modules
lib/rag/          7 modules (incl. retriever-pg)
lib/ml/           ~6 modules
lib/auth/         5 modules (NEW, unintegrated)
lib/security/     2 modules (NEW, mostly unintegrated)
lib/middleware/    1 module
lib/db/           3 modules
lib/process/      2 modules
lib/config/       (config files)
lib/utils/        2 modules
types/            1 shared type file
__tests__/        61 test files (Phase 4)
```

## Appendix B: Environment Variable Map

| Variable | Required | Used By | Default |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Conditional | `lib/ai/claude.ts` | None (needs OpenAI fallback) |
| `OPENAI_API_KEY` | Conditional | Embedder, Chat fallback | Mock embedder |
| `OPENAI_CHAT_MODEL` | Optional | `lib/ai/openai-chat.ts` | None (use Claude) |
| `OLLAMA_BASE_URL` | Optional | Ollama provider | None |
| `DATABASE_URL` | Optional | pgvector | In-memory |
| `JWT_SECRET` | For auth | `lib/auth/jwt.ts` | Error if missing |
| `AUTH_USERS` | For auth | `lib/auth/credentials.ts` | Empty array |
| `RATE_LIMIT_MAX` | Optional | Rate limiter | 30 |
| `LOG_LEVEL` | Optional | Pino logger | debug (dev) / info (prod) |
| `SENTRY_DSN` | Optional | Sentry | Disabled |
| `EMBEDDING_PROVIDER` | Optional | Embedder factory | Auto-detect |
| `CLAUDE_MODEL` | Optional | Claude client | claude-sonnet-4-6 |
| `CLAUDE_MAX_TOKENS` | Optional | Claude client | 2048 |

---

*End of Architecture Review*
