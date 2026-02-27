# Design: Kimchi-Agent Phase 2 — 공정 데이터 연동 + 영구 저장소

**Feature ID**: kimchi-agent-phase2
**Created**: 2026-02-27
**Phase**: Phase 2
**Level**: Dynamic
**Status**: Design
**Reference**: kimchi-agent-phase2.plan.md, kimchi-agent.design.md (Phase 1)

---

## 1. 시스템 아키텍처 (Phase 2 전체)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           클라이언트 (Browser)                             │
│                                                                          │
│  ┌──────────┐  ┌────────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ChatWindow│  │ProcessStatus   │  │ DocumentMgr │  │  AlertBadge    │  │
│  │(기존)    │  │Panel (신규)    │  │ (신규)      │  │  (신규)        │  │
│  └────┬─────┘  └───────┬────────┘  └──────┬──────┘  └───────┬────────┘  │
│       │                │                  │                 │           │
│  ┌────┴────────────────┴──────────────────┴─────────────────┴────────┐  │
│  │                    Sidebar + Header (기존 + 알림 배지 추가)          │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │ HTTP / SSE
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Next.js 14 App Router (서버)                         │
│                                                                          │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │POST /api/chat │  │GET/DELETE    │  │GET           │  │GET         │  │
│  │(기존+센서     │  │/api/documents│  │/api/process  │  │/api/alerts │  │
│  │ 데이터 주입)  │  │(신규)        │  │-data (신규)  │  │/stream(신규│  │
│  └──────┬────────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                  │                │         │
│  ┌──────┴─────────────────┴──────────────────┴────────────────┴───────┐  │
│  │                     공유 레이어                                       │  │
│  │  RAG Pipeline (고급)   Alert Rules Engine   ApiResponse<T> 래퍼      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────┬─────────────────────┬──────────────────┬───────────────────────────┘
       │                     │                  │
       ▼                     ▼                  ▼
┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐
│  Claude API  │   │  영구 저장소       │   │  공정 데이터 소스     │
│  (Anthropic) │   │  bkend.ai 또는   │   │  Simulator (개발)    │
│  Streaming   │   │  PostgreSQL +    │   │  실제 센서 API (운영) │
└──────────────┘   │  pgvector        │   └─────────────────────┘
                   └──────────────────┘
```

### Phase 2 주요 변경 요약

| 영역 | Phase 1 | Phase 2 |
|------|---------|---------|
| 대화 저장 | 인메모리 Map | bkend.ai 또는 PostgreSQL |
| 벡터 저장 | 인메모리 Map | pgvector 또는 Pinecone |
| 문서 API | POST only | GET + DELETE + stats |
| 공정 데이터 | 없음 | Simulator → 실제 센서 |
| 알림 | 없음 | SSE + 채팅 Push |
| AI 컨텍스트 | RAG only | RAG + 실시간 센서 수치 |
| 응답 형식 | 개별 | ApiResponse<T> 통일 |
| ID 생성 | Date.now()+random | crypto.randomUUID() |

---

## 2. 프로젝트 구조 (Phase 2 추가/변경)

```
kimchi-agent/
├── .env.example                         ← 신규: 온보딩용 환경변수 템플릿
│
├── app/
│   └── api/
│       ├── chat/
│       │   └── route.ts                 ← 수정: 센서 데이터 주입, conversationId 수정
│       ├── conversations/
│       │   ├── route.ts                 ← 수정: 인메모리 → DB, UUID 교체
│       │   └── [id]/route.ts            ← 수정: DB 연동
│       ├── documents/
│       │   ├── upload/route.ts          ← 수정: DB 연동, ApiResponse 래퍼
│       │   ├── route.ts                 ← 신규: GET (목록), 통계
│       │   ├── [id]/route.ts            ← 신규: DELETE
│       │   └── stats/route.ts           ← 신규: 통계 (선택적)
│       ├── process-data/
│       │   ├── route.ts                 ← 신규: 현재 센서 수치 GET
│       │   └── history/route.ts         ← 신규: 이력 GET
│       ├── rag/
│       │   └── debug/route.ts           ← 신규: RAG 검색 디버그
│       └── alerts/
│           └── stream/route.ts          ← 신규: 알림 SSE 스트림
│
├── components/
│   ├── chat/
│   │   └── (기존 파일 유지)
│   ├── layout/
│   │   └── Sidebar.tsx                  ← 수정: 알림 배지 추가
│   ├── documents/
│   │   ├── DocumentUpload.tsx           ← 유지
│   │   └── DocumentList.tsx             ← 신규: 문서 목록 + 삭제 UI
│   └── process/
│       ├── ProcessStatusPanel.tsx       ← 신규: 센서 현황 패널
│       ├── SensorCard.tsx               ← 신규: 개별 센서 수치 카드
│       └── AlertBadge.tsx               ← 신규: 이상 알림 배지
│
├── hooks/
│   ├── useChat.ts                       ← 유지
│   ├── useConversations.ts              ← 수정: DB 연동 완성
│   ├── useProcessData.ts                ← 신규: 센서 데이터 폴링
│   └── useAlerts.ts                     ← 신규: 알림 SSE 수신
│
├── lib/
│   ├── ai/
│   │   ├── claude.ts                    ← 수정: 모델/토큰 환경변수화
│   │   ├── streaming.ts                 ← 수정: conversationId 버그 수정
│   │   └── system-prompt.ts             ← 수정: 가드레일 + 센서 데이터 주입
│   ├── rag/
│   │   ├── chunker.ts                   ← 유지
│   │   ├── embedder.ts                  ← 수정: 제공자 환경변수화
│   │   ├── retriever.ts                 ← 수정: 인메모리 → pgvector
│   │   └── pipeline.ts                  ← 수정: Hybrid Search 추가
│   ├── db/
│   │   ├── bkend.ts                     ← 수정: 실제 구현 (CRUD)
│   │   └── schema.sql                   ← 신규: DB 스키마 (PostgreSQL)
│   ├── process/
│   │   ├── simulator.ts                 ← 신규: 센서 시뮬레이터
│   │   ├── sensor-client.ts             ← 신규: 실제 센서 클라이언트
│   │   └── alert-rules.ts               ← 신규: 임계값 규칙 엔진
│   └── utils/
│       ├── markdown.ts                  ← 유지
│       └── api-response.ts              ← 신규: ApiResponse<T> 유틸
│
└── types/
    └── index.ts                         ← 수정: SensorData, Alert, ApiResponse 추가
```

---

## 3. 환경변수 설계 (.env.example)

```bash
# ===== AI (필수) =====
ANTHROPIC_API_KEY=sk-ant-...          # Claude API 키

# ===== AI 설정 (선택 — 기본값 있음) =====
CLAUDE_MODEL=claude-sonnet-4-6        # 기본: claude-sonnet-4-6
CLAUDE_MAX_TOKENS=2048                # 기본: 2048

# ===== 임베딩 (선택) =====
OPENAI_API_KEY=sk-...                 # 없으면 mock embedding 사용
EMBEDDING_PROVIDER=openai             # openai | local (기본: openai)
EMBEDDING_MODEL=text-embedding-3-small

# ===== 저장소 (Phase 2 필수) =====
# 옵션 A: bkend.ai
BKEND_API_URL=https://api.bkend.ai
BKEND_API_KEY=bkend_...

# 옵션 B: PostgreSQL + pgvector
DATABASE_URL=postgresql://user:pass@localhost:5432/kimchi_agent

# ===== 공정 데이터 =====
PROCESS_DATA_MODE=simulator           # simulator | api (기본: simulator)
PROCESS_DATA_API_URL=http://sensor-gateway:8080
PROCESS_DATA_API_KEY=sensor_...
SENSOR_POLL_INTERVAL=30000            # ms, 기본: 30000 (30초)

# ===== 알림 임계값 =====
ALERT_TEMP_MIN=15                     # 섭씨, 기본: 15
ALERT_TEMP_MAX=25                     # 섭씨, 기본: 25
ALERT_HUMIDITY_MIN=70                 # %, 기본: 70
ALERT_HUMIDITY_MAX=90                 # %, 기본: 90
ALERT_SALINITY_MIN=1.5               # %, 기본: 1.5
ALERT_SALINITY_MAX=3.0               # %, 기본: 3.0
ALERT_PH_MIN=4.0                      # 기본: 4.0
ALERT_PH_MAX=5.5                      # 기본: 5.5
```

---

## 4. 타입 정의 (Phase 2 추가)

```typescript
// types/index.ts — Phase 2 추가 타입

// === 공정 데이터 ===
interface SensorData {
  batchId: string;
  temperature: number;      // 섭씨
  humidity: number;          // %
  salinity: number;          // %
  ph: number;
  fermentationHours: number; // 경과 시간
  estimatedCompletion: number; // 완료까지 남은 시간 (hours)
  timestamp: string;         // ISO 8601
}

interface SensorHistory {
  batchId: string;
  readings: SensorReading[];
}

interface SensorReading {
  temperature: number;
  humidity: number;
  salinity: number;
  ph: number;
  timestamp: string;
}

// === 알림 ===
type AlertType = 'temperature' | 'humidity' | 'salinity' | 'ph' | 'fermentation';
type AlertSeverity = 'warning' | 'critical';

interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: { min: number; max: number };
  batchId: string;
  createdAt: string;
  acknowledged: boolean;
}

// === API 응답 래퍼 ===
interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// === 문서 (확장) ===
interface Document {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunks: number;
  status: 'processing' | 'processed' | 'error';
  createdAt: string;
}

interface DocumentStats {
  totalDocuments: number;
  totalChunks: number;
  vectorStoreSize: number;
  byType: Record<string, number>;
}
```

---

## 5. 영구 저장소 설계 (P2-01)

### 5.1 DB 스키마 (PostgreSQL + pgvector)

```sql
-- lib/db/schema.sql

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 벡터 확장
CREATE EXTENSION IF NOT EXISTS vector;

-- 대화 테이블
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(200) NOT NULL DEFAULT '새 대화',
  last_message TEXT,
  message_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 메시지 테이블
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  sources         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- 문서 테이블
CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(500) NOT NULL,
  file_name   VARCHAR(500) NOT NULL,
  file_type   VARCHAR(20) NOT NULL,
  file_size   INTEGER NOT NULL,
  chunks      INTEGER DEFAULT 0,
  status      VARCHAR(20) DEFAULT 'processing',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 벡터 청크 테이블 (pgvector)
CREATE TABLE document_chunks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1536),          -- OpenAI text-embedding-3-small 차원
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- 벡터 유사도 검색 인덱스 (IVFFlat)
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);

-- 알림 테이블
CREATE TABLE alerts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type           VARCHAR(50) NOT NULL,
  severity       VARCHAR(20) NOT NULL,
  message        TEXT NOT NULL,
  value          DECIMAL,
  threshold_min  DECIMAL,
  threshold_max  DECIMAL,
  batch_id       VARCHAR(100),
  acknowledged   BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 bkend.ai 클라이언트 구현

```typescript
// lib/db/bkend.ts

const BKEND_URL = process.env.BKEND_API_URL;
const BKEND_KEY = process.env.BKEND_API_KEY;

async function bkendFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': BKEND_KEY!,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `bkend error: ${res.status}`);
  }
  return res.json();
}

// 대화 CRUD
export async function createConversation(data: Partial<Conversation>): Promise<Conversation>
export async function getConversations(limit: number, offset: number): Promise<{ conversations: Conversation[]; total: number }>
export async function getConversation(id: string): Promise<Conversation & { messages: Message[] }>
export async function updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation>
export async function deleteConversation(id: string): Promise<void>

// 메시지 CRUD
export async function addMessage(conversationId: string, msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message>

// 문서 CRUD
export async function saveDocument(doc: Omit<Document, 'id' | 'createdAt'>): Promise<Document>
export async function getDocuments(limit?: number): Promise<Document[]>
export async function deleteDocument(id: string): Promise<void>
export async function updateDocumentStatus(id: string, status: string, chunks: number): Promise<void>
```

### 5.3 retriever.ts 마이그레이션 (인메모리 → pgvector)

```typescript
// lib/rag/retriever.ts — 인터페이스 유지, 구현체만 교체

// Phase 1 (인메모리) — 교체 전
const vectorStore = new Map<string, StoredEntry>();

// Phase 2 (pgvector) — 교체 후
// addDocuments(): INSERT INTO document_chunks (embedding, content, ...)
// search(): SELECT ... ORDER BY embedding <-> $1 LIMIT $2
// removeDocument(): DELETE FROM document_chunks WHERE document_id = $1
// getStoreSize(): SELECT COUNT(*) FROM document_chunks
```

**마이그레이션 전략**: `retriever.ts`의 public API (`addDocuments`, `search`, `removeDocument`, `getStoreSize`)는 변경 없이 유지. 내부 저장소만 Map → pgvector로 교체. 이로써 `pipeline.ts`, `upload/route.ts` 등 기존 코드를 수정하지 않아도 됨.

---

## 6. 버그 수정 설계 (P2-02~18)

### 6.1 conversationId SSE 버그 (P2-02)

```typescript
// lib/ai/streaming.ts:64 — 현재 버그
// done 이벤트에서 conversationId 항상 ""

// 수정 전
const done = { type: 'done', messageId: msgId, conversationId: '' };

// 수정 후: chat/route.ts에서 conversationId를 streaming에 전달
// chat/route.ts
const conversationId = body.conversationId || crypto.randomUUID();
// ... streamToSSE(stream, { conversationId }) 로 전달

// streaming.ts
export function streamToSSE(stream: ReadableStream, ctx: { conversationId: string }): ReadableStream {
  // ...
  const done = { type: 'done', messageId: msgId, conversationId: ctx.conversationId };
}
```

### 6.2 UUID 교체 (P2-14)

```typescript
// 수정 전 (모든 파일)
const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 수정 후
const id = crypto.randomUUID();  // Node.js 19+ 내장, polyfill 불필요
```

### 6.3 모델/토큰 환경변수화 (P2-13)

```typescript
// lib/ai/claude.ts
const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';
const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS ?? '2048');
```

### 6.4 ApiResponse<T> 래퍼 (P2-18)

```typescript
// lib/utils/api-response.ts
export function ok<T>(data: T, meta?: ApiResponse<T>['meta']): Response {
  return Response.json({ data, meta } satisfies ApiResponse<T>);
}

export function err(code: string, message: string, status = 400): Response {
  return Response.json({ error: { code, message } } satisfies ApiResponse<never>, { status });
}

// 사용 예 (app/api/conversations/route.ts)
// 수정 전: return Response.json({ conversations, total })
// 수정 후: return ok({ conversations, total }, { total })
```

### 6.5 AI 가드레일 (P2-17)

```typescript
// lib/ai/system-prompt.ts — 추가
const GUARDRAILS = `
## 금지 사항 (반드시 준수)
- 의료 진단 또는 처방 조언 금지
- 법률 조언 금지
- 식품 안전 기준 임의 완화 금지 (HACCP 기준 준수)
- 개인 식별 정보(연락처, 주소 등) 수집/요청 금지
- 공장 외부 시스템(타사 ERP, 금융 시스템 등) 접근 시도 금지
- 위 상황에서는 반드시 "해당 사안은 전문가 또는 담당 부서에 문의하세요"라고 안내하세요.
`;
```

---

## 7. 문서 관리 API 설계 (P2-05)

### GET /api/documents — 문서 목록

```typescript
// Request: GET /api/documents?limit=20&offset=0
// Response: ApiResponse<{ documents: Document[]; total: number }>

{
  "data": {
    "documents": [
      {
        "id": "uuid",
        "name": "발효 공정 가이드",
        "fileName": "fermentation-guide.pdf",
        "fileType": "pdf",
        "fileSize": 1048576,
        "chunks": 42,
        "status": "processed",
        "createdAt": "2026-02-27T09:00:00Z"
      }
    ],
    "total": 5
  },
  "meta": { "total": 5, "limit": 20, "page": 1 }
}
```

### GET /api/documents/stats — 통계

```typescript
// Response: ApiResponse<DocumentStats>

{
  "data": {
    "totalDocuments": 5,
    "totalChunks": 210,
    "vectorStoreSize": 210,
    "byType": { "pdf": 3, "xlsx": 1, "txt": 1 }
  }
}
```

### DELETE /api/documents/[id] — 삭제

```typescript
// Response: ApiResponse<{ deleted: boolean }>

// 처리:
// 1. documents 테이블에서 삭제
// 2. document_chunks 테이블 CASCADE 삭제 (자동)
// 3. { data: { deleted: true } }
```

### GET /api/rag/debug?q=검색어 — RAG 디버그

```typescript
// Response: ApiResponse<{ query: string; topK: RagDebugResult[] }>

{
  "data": {
    "query": "발효 온도 기준",
    "topK": [
      {
        "rank": 1,
        "score": 0.923,
        "docName": "fermentation-guide.pdf",
        "chunkIndex": 7,
        "content": "발효 최적 온도는 18~22°C이며..."
      }
    ]
  }
}
```

---

## 8. 공정 데이터 API 설계 (P2-03)

### 8.1 데이터 소스 전환 구조

```typescript
// lib/process/sensor-client.ts — 인터페이스

interface SensorClient {
  getCurrentData(): Promise<SensorData>;
  getHistory(hours: number): Promise<SensorReading[]>;
}

// 환경변수로 전환
// PROCESS_DATA_MODE=simulator → SimulatorClient
// PROCESS_DATA_MODE=api      → HttpSensorClient

export function createSensorClient(): SensorClient {
  if (process.env.PROCESS_DATA_MODE === 'api') {
    return new HttpSensorClient(
      process.env.PROCESS_DATA_API_URL!,
      process.env.PROCESS_DATA_API_KEY!
    );
  }
  return new SimulatorClient();
}
```

### 8.2 시뮬레이터 설계

```typescript
// lib/process/simulator.ts

export class SimulatorClient implements SensorClient {
  // 현실적인 랜덤 변동을 가진 센서 수치 생성
  // 기본 정상 범위:
  //   온도: 18~22°C (가끔 ±3°C 이탈)
  //   습도: 75~85%
  //   염도: 2.0~2.5%
  //   pH: 4.2~4.8
  //   발효 경과: 배치 시작 시각 기준 자동 계산

  private batchId = `BATCH-${new Date().toISOString().slice(0,10)}`;
  private batchStartTime = Date.now() - (Math.random() * 48 * 3600000); // 0~48시간 전 시작

  async getCurrentData(): Promise<SensorData> {
    return {
      batchId: this.batchId,
      temperature: this.randomInRange(18, 22, 0.1),
      humidity: this.randomInRange(75, 85, 1),
      salinity: this.randomInRange(2.0, 2.5, 0.05),
      ph: this.randomInRange(4.2, 4.8, 0.05),
      fermentationHours: (Date.now() - this.batchStartTime) / 3600000,
      estimatedCompletion: Math.max(0, 72 - (Date.now() - this.batchStartTime) / 3600000),
      timestamp: new Date().toISOString(),
    };
  }

  private randomInRange(min: number, max: number, variance: number): number {
    const base = min + (max - min) * Math.random();
    return Math.round((base + (Math.random() - 0.5) * variance) * 100) / 100;
  }
}
```

### 8.3 API 라우트

```typescript
// app/api/process-data/route.ts

// GET /api/process-data
// Response: ApiResponse<SensorData>

{
  "data": {
    "batchId": "BATCH-2026-02-27",
    "temperature": 20.3,
    "humidity": 79.5,
    "salinity": 2.2,
    "ph": 4.5,
    "fermentationHours": 36.5,
    "estimatedCompletion": 35.5,
    "timestamp": "2026-02-27T09:30:00Z"
  }
}

// GET /api/process-data/history?hours=24
// Response: ApiResponse<SensorHistory>
```

### 8.4 시스템 프롬프트에 센서 데이터 주입

```typescript
// lib/ai/system-prompt.ts

export function buildSystemPrompt(ragContext: string, sensorData?: SensorData): string {
  const sensorSection = sensorData ? `
## 현재 공정 상태 (실시간)
- 배치 ID: ${sensorData.batchId}
- 온도: ${sensorData.temperature}°C
- 습도: ${sensorData.humidity}%
- 염도: ${sensorData.salinity}%
- pH: ${sensorData.ph}
- 발효 경과: ${Math.round(sensorData.fermentationHours)}시간
- 완료까지: 약 ${Math.round(sensorData.estimatedCompletion)}시간
- 데이터 기준 시각: ${sensorData.timestamp}
` : '## 현재 공정 상태: 센서 연동 미설정 (시뮬레이터 모드)';

  return `${KIMCHI_BASE_PROMPT}

${sensorSection}

## 참고 문서 컨텍스트
${ragContext || '관련 문서가 없습니다. 일반 지식을 기반으로 답변합니다.'}

${GUARDRAILS}`;
}
```

---

## 9. 알림 시스템 설계 (P2-08)

### 9.1 임계값 규칙 엔진

```typescript
// lib/process/alert-rules.ts

interface AlertRule {
  type: AlertType;
  field: keyof SensorData;
  min: number;
  max: number;
  warningBuffer: number;  // 임계값 접근 시 warning 발생
  label: string;
  unit: string;
}

const DEFAULT_RULES: AlertRule[] = [
  {
    type: 'temperature',
    field: 'temperature',
    min: parseFloat(process.env.ALERT_TEMP_MIN ?? '15'),
    max: parseFloat(process.env.ALERT_TEMP_MAX ?? '25'),
    warningBuffer: 2,
    label: '온도',
    unit: '°C',
  },
  // humidity, salinity, ph 규칙 동일 패턴
];

export function checkAlerts(data: SensorData): Alert[] {
  const alerts: Alert[] = [];
  for (const rule of DEFAULT_RULES) {
    const value = data[rule.field] as number;
    if (value < rule.min || value > rule.max) {
      alerts.push(createAlert('critical', rule, value, data.batchId));
    } else if (value < rule.min + rule.warningBuffer || value > rule.max - rule.warningBuffer) {
      alerts.push(createAlert('warning', rule, value, data.batchId));
    }
  }
  return alerts;
}
```

### 9.2 알림 SSE 스트림

```typescript
// app/api/alerts/stream/route.ts

export async function GET() {
  const client = createSensorClient();

  const stream = new ReadableStream({
    async start(controller) {
      const interval = setInterval(async () => {
        try {
          const data = await client.getCurrentData();
          const alerts = checkAlerts(data);
          if (alerts.length > 0) {
            const payload = JSON.stringify({ type: 'alerts', alerts });
            controller.enqueue(`data: ${payload}\n\n`);
          } else {
            // heartbeat (연결 유지)
            controller.enqueue(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
          }
        } catch (e) {
          controller.enqueue(`data: ${JSON.stringify({ type: 'error', message: 'sensor error' })}\n\n`);
        }
      }, parseInt(process.env.SENSOR_POLL_INTERVAL ?? '30000'));

      // 연결 종료 시 정리
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## 10. UI 컴포넌트 설계 (Phase 2 신규)

### 10.1 ProcessStatusPanel

```typescript
// components/process/ProcessStatusPanel.tsx

interface ProcessStatusPanelProps {
  collapsed?: boolean;
}

// 레이아웃:
// ┌────────────────────────────────┐
// │ 공정 현황  BATCH-2026-02-27    │
// │ ─────────────────────────────  │
// │ 🌡️ 온도    20.3°C    ✅ 정상  │
// │ 💧 습도    79.5%     ✅ 정상  │
// │ 🧂 염도    2.2%      ✅ 정상  │
// │ 🧪 pH     4.5       ✅ 정상  │
// │ ─────────────────────────────  │
// │ 발효 36h 경과 / 완료까지 ~35h  │
// │ [████████████░░░░░░] 51%     │
// └────────────────────────────────┘

// 상태에 따른 색상:
// 정상: green (kimchi-green)
// 경고: yellow
// 위험: red (kimchi-red) + 애니메이션 맥박
```

### 10.2 AlertBadge

```typescript
// components/process/AlertBadge.tsx

// Sidebar 헤더에 표시
// 알림 없음: 아무것도 표시 안 함
// warning: 노란 배지 (경고 수)
// critical: 빨간 배지 + 맥박 애니메이션

// useAlerts() 훅으로 /api/alerts/stream SSE 수신
```

### 10.3 DocumentList

```typescript
// components/documents/DocumentList.tsx

// GET /api/documents로 목록 조회
// 각 문서 행: 이름 | 타입 | 청크 수 | 업로드 일시 | [삭제] 버튼
// 삭제 클릭 → 확인 다이얼로그 → DELETE /api/documents/[id]
// 통계 상단 표시: 총 N개 문서, M개 청크
```

---

## 11. 훅 설계 (Phase 2 신규)

### useProcessData

```typescript
// hooks/useProcessData.ts

export function useProcessData(pollInterval = 30000) {
  const [data, setData] = useState<SensorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/process-data');
      const json: ApiResponse<SensorData> = await res.json();
      if (json.data) setData(json.data);
      else setError(json.error?.message ?? 'unknown error');
    };

    fetchData(); // 즉시 1회
    const id = setInterval(fetchData, pollInterval);
    return () => clearInterval(id);
  }, [pollInterval]);

  return { data, error };
}
```

### useAlerts

```typescript
// hooks/useAlerts.ts

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const es = new EventSource('/api/alerts/stream');
    es.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      if (payload.type === 'alerts') {
        setAlerts(payload.alerts);
      }
    };
    return () => es.close();
  }, []);

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return { alerts, criticalCount, warningCount };
}
```

---

## 12. 고급 RAG 설계 (P2-06)

### 임베딩 제공자 추상화

```typescript
// lib/rag/embedder.ts — 제공자 패턴

interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimension: number;
}

class OpenAIEmbedder implements EmbeddingProvider {
  dimension = 1536;
  model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
  // ...
}

class LocalEmbedder implements EmbeddingProvider {
  // Ollama 또는 로컬 모델 (multilingual-e5-base)
  dimension = 768;
  // ...
}

export function createEmbedder(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER ?? 'openai';
  if (provider === 'local') return new LocalEmbedder();
  return new OpenAIEmbedder();
}
```

### Hybrid Search (BM25 + Vector)

```typescript
// lib/rag/pipeline.ts — Hybrid Search

export async function retrieveContext(query: string): Promise<RAGResult> {
  // 1. 벡터 검색 (시맨틱)
  const embedding = await embedder.embed([query]);
  const vectorResults = await retriever.search(embedding[0], { topK: 10, threshold: 0.7 });

  // 2. 키워드 검색 (BM25 — 인메모리 BM25 라이브러리 사용)
  const keywordResults = bm25Index.search(query, 10);

  // 3. Reciprocal Rank Fusion (RRF) 결합
  const merged = reciprocalRankFusion([vectorResults, keywordResults], { k: 60 });

  // 4. 상위 5개 반환
  const top5 = merged.slice(0, 5);
  return formatRAGResult(top5);
}
```

---

## 13. 구현 순서 (병렬 작업 분리)

### Sprint 1: 기반 인프라 (Week 1-2)

```
Task A (즉시 실행 — 의존성 없음, ~1일):
  A1: .env.example 생성
  A2: crypto.randomUUID() 교체 (conversations/route.ts)
  A3: conversationId SSE 버그 수정 (streaming.ts, chat/route.ts)
  A4: Claude 모델/토큰 환경변수화 (claude.ts)
  A5: AI 가드레일 추가 (system-prompt.ts)
  A6: ApiResponse<T> 래퍼 도입 (utils/api-response.ts + 모든 라우트)

Task B (저장소 마이그레이션, ~3-5일):
  B1: schema.sql 작성 + DB 프로비저닝
  B2: bkend.ts 실제 CRUD 구현
  B3: retriever.ts → pgvector 마이그레이션
  B4: conversations/route.ts → DB CRUD
  B5: documents/upload/route.ts → DB 저장

Task C (문서 API 확장, B5 완료 후, ~2일):
  C1: GET /api/documents (목록)
  C2: DELETE /api/documents/[id]
  C3: GET /api/rag/debug
```

### Sprint 2: 공정 데이터 (Week 3-4)

```
Task D (공정 데이터, C 완료 후):
  D1: lib/process/simulator.ts
  D2: lib/process/sensor-client.ts (인터페이스 + HttpSensorClient 스텁)
  D3: lib/process/alert-rules.ts
  D4: app/api/process-data/route.ts
  D5: app/api/process-data/history/route.ts
  D6: app/api/alerts/stream/route.ts
  D7: system-prompt.ts 센서 데이터 주입 (buildSystemPrompt)
  D8: chat/route.ts에서 센서 데이터 fetch + 주입
```

### Sprint 3: UI 컴포넌트 (Week 5-6, D 완료 후)

```
Task E:
  E1: hooks/useProcessData.ts
  E2: hooks/useAlerts.ts
  E3: components/process/SensorCard.tsx
  E4: components/process/ProcessStatusPanel.tsx
  E5: components/process/AlertBadge.tsx
  E6: components/documents/DocumentList.tsx
  E7: Sidebar.tsx 알림 배지 통합
  E8: page.tsx ProcessStatusPanel 통합
```

### Sprint 4: RAG 고도화 + 피드백 (Week 7-8)

```
Task F:
  F1: embedder.ts 제공자 패턴 리팩토링
  F2: Hybrid Search (BM25 + Vector) 구현
  F3: 한국어 임베딩 모델 A/B 테스트
  F4: 베타 배포 (공장 운영자 2-3명)
  F5: 피드백 수집 + Quick Questions 업데이트
```

---

## 14. 주요 기술 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 저장소 1순위 | bkend.ai (검토 후 결정) | Phase 1 설계 기준, BaaS로 인프라 최소화 |
| 저장소 대안 | PostgreSQL + pgvector | 벡터 검색 통합, Supabase 호스팅 가능 |
| 공정 데이터 초기 | Simulator | 센서 API 스펙 확보 전 개발 가능 |
| 알림 채널 | SSE (EventSource) | 기존 SSE 패턴 재사용, WebSocket 불필요 |
| ID 생성 | crypto.randomUUID() | Node.js 내장, 충돌 없음 |
| BM25 라이브러리 | `wink-bm25-text-search` | 경량, TypeScript 지원 |
| pgvector 인덱스 | IVFFlat (lists=100) | 5,000개 청크 규모에 적합 |
| 임베딩 차원 | 1536 (OpenAI) / 768 (Local) | 환경변수로 전환 가능하도록 추상화 |

---

## 15. 성공 지표 및 검증 방법

| 기능 | 검증 시나리오 | 기대 결과 |
|------|-------------|---------|
| 영구 저장 | 서버 재시작 후 GET /api/conversations | 이전 대화 유지 |
| conversationId | POST /api/chat SSE done 이벤트 | non-empty UUID |
| 센서 데이터 | GET /api/process-data (시뮬레이터) | SensorData JSON |
| 알림 | 온도를 임계값 초과로 설정 | GET /api/alerts/stream에서 alert 이벤트 |
| 문서 DELETE | DELETE /api/documents/[id] | 목록에서 제거 + 벡터 삭제 |
| RAG 디버그 | GET /api/rag/debug?q=발효온도 | top-5 결과 + 유사도 점수 |
| 가드레일 | "의료 진단해줘" 질문 | 거절 + 전문가 안내 |

---

*Design document created — 2026-02-27*
*Reference: kimchi-agent-phase2.plan.md + CTO Phase 2 Analysis*
