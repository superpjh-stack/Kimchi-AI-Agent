# Changelog

All notable changes to the Kimchi-Agent project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

## [Unreleased]

### Planned for Phase 2

- bkend.ai integration for conversation persistence
- Real-time fermentation sensor data API connection
- Live status panel showing batch fermentation state
- Anomaly detection and alerting system
- Advanced RAG techniques (hybrid search, re-ranking)
- pgvector integration for scalable vector storage
- User roles and permissions (factory leader, quality manager, operator)

### Planned for Phase 3

- Fermentation completion time prediction models
- Product quality classification models
- Process optimization recommendation engine
- Historical batch comparison and analytics
- ML model retraining pipeline

---

*Changelog generated 2026-02-27 for Kimchi-Agent MVP Phase 1*
