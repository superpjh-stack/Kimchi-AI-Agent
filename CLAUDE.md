# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kimchi-Agent** — 김치공장 전용 AI Agent. Chat 중심 UI에서 음성/텍스트로 질문하고 RAG 기반 답변을 받는 Next.js 14 풀스택 앱.

## Commands

```bash
# 개발 서버
npm run dev        # http://localhost:3000

# 빌드 / 프로덕션
npm run build
npm run start

# 린트
npm run lint
```

의존성 설치 (최초 1회):
```bash
npm install
```

## Environment Variables

`.env.local` 필수 설정:
```
ANTHROPIC_API_KEY=sk-ant-...   # 필수 — Claude API
OPENAI_API_KEY=sk-...          # 선택 — 실제 임베딩 (없으면 mock embedding 사용)
```

## Architecture

```
Browser ──SSE──▶ Next.js API Routes ──▶ Claude API (claude-sonnet-4-6)
                       │
                  RAG Pipeline ──▶ In-memory Vector Store
                       │
                  bkend.ai (Phase 2)
```

### Key Data Flow
1. **Chat**: `useChat` hook → `POST /api/chat` → RAG 검색 → Claude 스트리밍 → SSE tokens
2. **Upload**: `DocumentUpload` → `POST /api/documents/upload` → 청킹 → 임베딩 → Vector Store
3. **History**: `useConversations` ↔ `GET/POST /api/conversations`

## Code Structure

```
app/
  page.tsx                    # 메인 페이지 (Sidebar + Header + ChatWindow)
  layout.tsx                  # 루트 레이아웃 (Noto Sans KR)
  api/
    chat/route.ts             # POST — Claude 스트리밍 + RAG
    conversations/route.ts    # GET/POST — 대화 관리
    conversations/[id]/route.ts
    documents/upload/route.ts # POST — 문서 업로드 (TXT/CSV/PDF/XLSX)

components/
  chat/
    ChatWindow.tsx            # 메시지 목록 + 입력 통합 (messages/onSend props)
    MessageBubble.tsx         # Markdown 렌더링, RAG 출처 표시
    ChatInput.tsx             # 자동 높이 textarea, Enter=전송
    VoiceInput.tsx            # Web Speech API (ko-KR)
    QuickQuestions.tsx        # 6개 Predefined 카드
  layout/
    Sidebar.tsx               # 대화 목록 (날짜 그룹), 모바일 오버레이
    Header.tsx                # 제목 + 모바일 햄버거
  documents/
    DocumentUpload.tsx        # 드래그앤드롭 업로드

hooks/
  useChat.ts                  # SSE 스트리밍 파서, 메시지 상태
  useConversations.ts         # 대화 목록 CRUD

lib/
  ai/
    claude.ts                 # Anthropic 클라이언트 (claude-sonnet-4-6)
    system-prompt.ts          # 김치공장 전문 프롬프트 + RAG 주입
    streaming.ts              # ReadableStream → SSE 변환
  rag/
    chunker.ts                # RecursiveCharacterTextSplitter (1000자/200 overlap)
    embedder.ts               # OpenAI text-embedding-3-small (mock fallback)
    retriever.ts              # 인메모리 벡터 스토어 + 코사인 유사도
    pipeline.ts               # retrieveContext() + ingestDocument()
  db/
    bkend.ts                  # bkend.ai 클라이언트 (Phase 2)
  utils/
    markdown.ts               # stripMarkdown, generateTitle

types/index.ts                # Message, Conversation, DocumentSource, SSEEvent
```

## SSE Event Format

`POST /api/chat`가 반환하는 Server-Sent Events:
```
data: {"type":"token","content":"안"}
data: {"type":"sources","documents":["doc.pdf"],"sources":[...]}
data: {"type":"done","messageId":"msg_xxx","conversationId":""}
data: {"type":"error","message":"..."}
```

## Important Notes

- **인메모리 스토어**: Vector Store와 대화 기록은 서버 재시작 시 초기화 (MVP 허용, Phase 2에서 bkend.ai로 전환)
- **OPENAI_API_KEY 없을 때**: mock embedding 사용 — RAG 파이프라인은 동작하나 시맨틱 검색 품질 낮음
- **ChatWindow props**: `messages`, `isStreaming`, `onSend`를 부모(page.tsx)에서 주입 — useChat 훅을 직접 import하지 않음
- **문서 지원 형식**: TXT, CSV, XLSX (xlsx 패키지), PDF (pdf-parse 패키지)

## PDCA Status

- Plan: `docs/01-plan/features/kimchi-agent.plan.md`
- Design: `docs/02-design/features/kimchi-agent.design.md`
- Analysis: `docs/03-analysis/kimchi-agent.analysis.md` (Match Rate: 97.4%)
- Phase 2 Design: `docs/02-design/features/kimchi-agent-phase2.design.md`
- Phase 2 Analysis: `docs/03-analysis/kimchi-agent-phase2.analysis.md` (Match Rate: 92.2%)
- Phase 3 Plan: `docs/01-plan/features/kimchi-agent-phase3.plan.md`
- Phase 3 Design: `docs/02-design/features/kimchi-agent-phase3.design.md`
- Phase 3 Analysis: `docs/03-analysis/kimchi-agent-phase3.analysis.md` (Match Rate: 91.0%)
