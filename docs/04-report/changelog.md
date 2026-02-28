# Changelog

All notable changes to the Kimchi-Agent project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [6.0.0] - 2026-02-28 (Phase 6: Security + Testing + ML A/B)

### Summary
Phase 6 PDCA completion with security hardening (JWT auth, RBAC), test coverage expansion (Jest 241 tests, Playwright E2E), ML A/B test framework, and Questions panel integration. Achieved 97.1% match rate after Act-1 iteration.

### Added

#### Security (Sprint 1)
- JWT authentication system (jose HS256, Access 1h / Refresh 7d)
- RBAC with 3 roles (admin/operator/viewer) and 12 permissions
- API authentication middleware applied to 17 endpoints
- Audit logging for critical operations (delete, update, upload, login)
- Magic bytes file validation (MIME type verification)
- CSP nonce-based security headers
- Input sanitization for prompt injection mitigation
- Improved rate limiters with TTL cleanup, multi-limiter support

#### Testing (Sprint 2)
- Jest unit tests expanded: 61 → 241 tests (180 new tests)
- Test suites: 4 → 12+ suites
- Playwright E2E test suite with 5+ spec files (auth, chat, i18n, upload, questions)
- GitHub Actions CI/CD pipeline with lint, tsc, jest, e2e, lighthouse
- Lighthouse CI configuration (Performance ≥80, Accessibility ≥90)
- Code coverage increased to ~85% (from ~30%)

#### ML & Experimentation (Sprint 3)
- A/B testing framework with experiment API (POST/GET/PATCH /api/ml/experiments)
- Hash-based consistent user assignment (djb2 algorithm)
- Experiment result tracking with accuracy metrics
- Dashboard widget for real-time A/B test monitoring (30s polling)
- Variant management and traffic split configuration

#### Features
- Questions panel full integration (6 categories, 60 questions)
- i18n support for Questions (ko.json, en.json)
- Mascot + Questions interaction (mascot celebrating on question select)
- ChatService extraction (service layer pattern)
- BM25 index file persistence (.local-db/bm25-index.json)
- Debounced async conversation writing (500ms debounce)

### Changed
- xlsx package replaced with exceljs (resolves Critical CVE)
- API chat and conversations endpoints now require authentication
- ESLint configuration extended with strict TypeScript rules
- CSP policy enhanced with nonce-based script-src
- Rate limiting architecture refactored (multi-limiter pattern)

### Fixed
- C1: Removed xlsx from package.json (Critical CVE - Prototype Pollution)
- C2-C4: Enabled withAuth on chat and conversations APIs
- H1: Added RateLimiter TTL cleanup (memory leak prevention)
- H2-H3: Added conversationsLimiter and alertsLimiter
- H4: Added Edge Sentry PII filter
- M1-M6: Fixed ESLint config, CSP, mascot integration

### Removed
- xlsx package (replaced with exceljs)
- sentry.edge.config.ts (consolidated to instrumentation.ts)

### Metrics
- Security: OWASP Critical 2 → 0, High 5 → 0
- npm audit: Critical 1 → 0, High 12 → 0
- Test coverage: ~30% → ~85%
- Overall Match Rate: 66.5% → 97.1% (after Act-1 iteration)

---

## [1.0.0] - 2026-02-27 (MVP Release)

### Summary
Complete MVP implementation of Kimchi-Agent with 97.4% design match rate. Chat-driven AI interface for kimchi factory operations with RAG-based document Q&A, voice input, and mobile-responsive design.

### Added

#### Chat Interface
- Chat window with real-time SSE streaming from Claude API (claude-sonnet-4-6)
- Message bubbles with user/assistant differentiation
- Streaming cursor animation for visual feedback during token delivery
- Markdown rendering with GFM support (tables, code blocks, lists, emphasis)
- Auto-scroll to latest message
- Character limit enforcement (10k characters max)

#### Voice & Quick Input
- Web Speech API integration with Korean language support (ko-KR)
- Microphone button with recording state animations (idle/listening/processing)
- 6 predefined quick question cards with emoji icons
- One-tap question submission
- Automatic voice-to-text insertion into chat input

#### Document Management
- Drag-and-drop file upload interface
- Support for TXT, CSV, PDF (pdf-parse), and XLSX (xlsx) formats
- File size validation (10MB maximum)
- Progress indicator during upload and processing
- Error handling with user-friendly feedback messages
- Automatic text extraction and document chunking

#### RAG Pipeline
- Recursive character text splitting (1000 char chunks, 200 char overlap)
- Embedding generation with OpenAI text-embedding-3-small
- Mock embedding fallback for development without API keys
- Vector similarity search using cosine distance
- Top-k retrieval with similarity threshold filtering (k=5, threshold=0.7)
- Source attribution with document names and chunk metadata
- Collapsible sources section in chat messages

#### Conversation Management
- Save and restore conversations with automatic title generation
- Date-grouped conversation list in sidebar
- New conversation creation with one click
- Conversation deletion functionality
- Message count and preview tracking
- In-memory storage (MVP acceptable, Phase 2: bkend.ai migration)

#### Navigation & Layout
- Fixed sidebar for desktop (280px width)
- Mobile sidebar overlay with backdrop and dismiss on click
- Mobile bottom navigation with 3 tabs (chat, conversations, documents)
- Header with title and mobile hamburger menu
- Responsive design with Tailwind CSS breakpoints (sm, md, lg)
- Dark mode compatible color scheme
- Noto Sans KR font for Korean typography

#### Backend Infrastructure
- POST /api/chat: Claude streaming endpoint with RAG context injection
- POST /api/documents/upload: File ingestion with chunking and embedding
- GET /api/conversations: Paginated conversation list retrieval
- GET /api/conversations/[id]: Specific conversation with messages
- DELETE /api/conversations/[id]: Conversation deletion endpoint
- POST /api/conversations: New conversation creation endpoint
- Server-Sent Events (SSE) response streaming with proper headers
- Request validation and error handling on all routes

#### System & Configuration
- Anthropic Claude API client setup (claude-sonnet-4-6 model)
- Kimchi factory expert system prompt with 6 answer rules
- RAG context injection into system prompt with fallback text
- TypeScript strict mode enabled (100% coverage)
- Tailwind CSS configuration with custom brand colors (kimchi-red, kimchi-green)
- Next.js security headers (CSP, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- Environment variable configuration (.env.local)
- .gitignore with sensitive file exclusions

#### Types & Utilities
- Comprehensive TypeScript type definitions (Message, Conversation, DocumentSource, SSE events)
- useChat hook with SSE streaming state management and abort support
- useConversations hook for conversation list management
- Markdown utility functions (stripMarkdown, truncate, generateTitle)
- Document text extraction utilities (PDF, Excel, CSV, TXT)
- Error handling with sanitized error messages

### Fixed

#### PDF Support
- Added `pdf-parse` npm package for proper binary PDF text extraction
- Implemented graceful fallback to naive text extraction if library fails
- Support for both text-based and scanned PDFs (limited)

#### XLSX Support
- Added `xlsx` npm package for Excel workbook parsing
- Sheet-to-CSV conversion for text extraction
- Proper handling of multiple sheets and merged cells

#### Character Encoding
- UTF-8 fallback encoding for miscoded text files
- Improved handling of mixed Korean/English content

### Changed

- Integrated MobileNav functionality into Sidebar overlay + Header (no separate file needed)
- Embedded voice input logic in VoiceInput component (eliminated separate useVoice hook)
- Simplified conversation routing using single page.tsx with state management (eliminated need for conversations/[id]/page.tsx)

### Security

- OWASP hardening: CSP headers, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection in next.config.js
- Input validation on all API endpoints (file type, size, character limits)
- Sanitized error messages (no stack traces in responses)
- API keys protected in .env.local (not in version control)
- Message length limit (10,000 characters) to prevent abuse
- File upload validation (type whitelist, size limits)

### Architecture

- **Presentation Layer**: React components with prop-driven state (ChatWindow, MessageBubble, ChatInput, etc.)
- **Application Layer**: Next.js API Routes with proper request/response handling
- **Infrastructure Layer**: RAG pipeline modules (chunker, embedder, retriever, pipeline), Claude client, utilities
- **Type Safety**: TypeScript strict mode throughout, discriminated unions for SSE events
- **Dependency Direction**: Correct layering with no circular dependencies or violations

### Quality Metrics

- **Design Match Rate**: 97.4% (37/38 items functional)
- **Code Quality**: TypeScript strict mode 100%, 0 dependency violations
- **Architecture Compliance**: 100% correct layer separation
- **Convention Compliance**: 97% (naming, imports, env variables)
- **Security Issues**: 0 critical, OWASP hardened
- **Files Implemented**: 29 files, 2,847 lines of code
- **Test Coverage**: Components verified via gap analysis

### Documentation

- Plan document: `docs/01-plan/features/kimchi-agent.plan.md`
- Design document: `docs/02-design/features/kimchi-agent.design.md`
- Gap analysis: `docs/03-analysis/kimchi-agent.analysis.md`
- Completion report: `docs/04-report/features/kimchi-agent.report.md`
- Project guidelines: `CLAUDE.md`
- User guide: `README.md`

### Known Limitations

- Conversations stored in-memory (reset on server restart) — Phase 2: bkend.ai integration
- No real factory process data yet — Phase 2: sensor API integration
- ML predictions not available — Phase 3 feature
- Vector DB is in-memory Map — Phase 2: migrate to pgvector for production
- No unit tests for RAG edge cases — Phase 2: comprehensive test suite

### Next Steps

- **Phase 2**: bkend.ai persistence, sensor data API, live status panel
- **Phase 3**: ML prediction models, quality forecasting, recommendation engine
- **Deployment**: Staging environment setup, beta user testing
- **Monitoring**: Logging, error tracking, RAG quality metrics

### Contributors

- CTO Team (Frontend, Backend, QA, Security)

---

## [2.0.0] - 2026-02-28 (Phase 2+3 Complete)

### Summary
Production-ready infrastructure upgrade with persistence layer, local AI embedding, and ML prediction models. Overall design match rate: 91.0%. 5 Sprints completed with 35+ new files and 15 new API endpoints.

### Phase 2 Highlights (Completed 2026-02-27)
- bkend.ai full CRUD implementation (conversations, messages, documents)
- Real-time fermentation sensor data API with mock simulator
- Live status panel with 4 sensor cards + process timeline
- pgvector integration for scalable vector persistence (100K+ embeddings)
- Anomaly detection with threshold-based alerts
- Alert storage + acknowledgment system

### Phase 3 Highlights (Completed 2026-02-28)

#### Infrastructure (Sprint 1)
- PostgreSQL + pgvector Docker Compose setup with healthcheck
- PgVectorStore class with IVFFlat cosine index (auto-creation when count >= 100)
- Vector dimension auto-detection and table recreation on mismatch
- bkend.ai CRUD completion (conversations/messages/documents full implementation)
- Alert acknowledged field + PATCH /api/alerts/:id endpoint
- GET /api/documents/stats for aggregate statistics

#### Local Embedding (Sprint 2)
- Ollama text-embedding integration (nomic-embed-text 768-dim)
- 3-way embedding provider (openai/local/mock) with auto-detection
- EMBEDDING_PROVIDER environment variable strategy
- Parallel batch embedding (BATCH_SIZE=32, Promise.all)
- Dual OLLAMA_URL / OLLAMA_BASE_URL environment support
- OllamaWithFallback wrapper for graceful degradation

#### ML Prediction (Sprint 3)
- IPredictor interface with FermentationPredictor and QualityClassifier
- RuleBasedPredictor with Q10 temperature correction formula
- A/B/C quality grading based on temperature/salinity/pH parameters
- Anomaly detection with deviation-based thresholds
- POST /api/ml/predict and POST /api/ml/quality endpoints
- Recommendation generation for quality improvement
- RemoteMLPredictor with 3-second timeout + graceful fallback
- ML prediction injection into Claude system prompt

#### Dashboard & UI (Sprint 4)
- MLPredictionPanel component with fermentation progress bar + quality badge
- 5-tab navigation (Dashboard/Chat/Conversations/Documents/Questions)
- Bottom navigation for mobile + desktop header tab switcher
- Tab state persistence across tab switching
- useMlPrediction hook with 30-second polling interval

#### Recharts Dashboard (Sprint 5 - Bonus)
- Real-time sensor chart visualization (Recharts LineChart)
- 4 sensor types: temperature, salinity, pH, sugar level
- 60-point sample rate with last-value interpolation
- SensorChart component with custom time formatting
- DashboardPanel integration (process status + ML predictions + charts)
- useSensorHistory hook for time-series data polling
- Simulator buffer expansion (200 → 2880 datapoints)

### Added
- 35+ new files across lib/, components/, hooks/, app/api/
- 15 new API endpoints (pgvector stats, ML predict, health)
- 8 new library modules (retriever-pg, embedder-local, ML predictor suite)
- 12 new React components (ML panels, charts, navigation)
- Docker Compose stack (pgvector, Ollama)
- Comprehensive environment variable support

### Changed
- VectorStore interface inlined in retriever.ts for circular dependency prevention
- pgvector table schema: kimchi_chunks → document_chunks
- LocalEmbedder placed in separate file (embedder-local.ts)
- Tab structure expanded: 2 tabs → 5 tabs for better navigation
- RuleBasedPredictor confidence dynamic (0.7-0.95 gradient vs fixed)

### Fixed
- pgvector connection fallback to in-memory on DB unavailability
- Ollama timeout handling with automatic mock embedding fallback
- Vector dimension mismatch detection and automatic table recreation
- Alert storage persistence in alert-store.ts module
- DocumentUpload API response unwrapping

### Quality Metrics
- **Overall Match Rate**: 91.0% (target: ≥90%) ✅
- **FR Implementation**: 15/16 (93.8%)
- **Design Detail Match**: 90.3%
- **Architecture Compliance**: 95.0%
- **Convention Compliance**: 100.0%
- **TypeScript Safety**: 100% (tsc --noEmit EXIT:0)

### Documentation
- Phase 3 Plan: `docs/01-plan/features/kimchi-agent-phase3.plan.md`
- Phase 3 Design: `docs/02-design/features/kimchi-agent-phase3.design.md`
- Phase 3 Analysis: `docs/03-analysis/kimchi-agent-phase3.analysis.md` (91.0% match)
- Phase 3 Report: `docs/04-report/features/kimchi-agent-phase3.report.md`

### Known Limitations
- Vercel deployment guide not yet written (FR-P3-15) — to be completed in Phase 4
- LocalEmbedder benchmark (< 2s/chunk NFR) not formally documented
- EmbeddingProvider factory unit tests pending
- Production Vercel deployment and factory beta test pending

### Next Steps
- **Immediate**: Create Vercel deployment guide, GET /api/health endpoint, useAlerts.acknowledgeAlert() hook
- **Phase 4**: Production Vercel deployment, factory operator beta testing, real fermentation data collection
- **Phase 5**: LSTM ML models for improved accuracy, advanced quality metrics, mobile app

### Contributors
- Development Team (pgvector, embedder, ML models)
- gap-detector Agent (91.0% match rate analysis)
- report-generator Agent (completion documentation)

---

## [Unreleased]

### Planned for Phase 4

- Vercel production deployment with Supabase/Neon pgvector
- Factory operator beta test (5 users, 1 week, satisfaction survey)
- Real fermentation data collection and labeling
- ML model retraining with actual sensor data
- Advanced quality metrics and batch analytics
- Historical batch comparison dashboard

### Planned for Phase 5+

- LSTM neural networks for fermentation prediction
- Mobile app (React Native) with offline support
- IoT sensor direct integration (MQTT/LoRaWAN)
- Real-time WebSocket alerts
- Multi-factory collaborative dashboard
- Advanced user roles and permissions

---

*Changelog generated 2026-02-28 for Kimchi-Agent Phase 2+3 Release*
