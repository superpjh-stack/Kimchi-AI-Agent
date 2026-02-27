# Design: Kimchi-Agent Phase 3 — ML 통합 + 영속성 + 배포

**Feature ID**: kimchi-agent-phase3
**Created**: 2026-02-27
**Author**: Architect Agent
**Status**: Draft
**Plan Reference**: `docs/01-plan/features/kimchi-agent-phase3.plan.md`

---

## 목차

1. [시스템 아키텍처 개요](#1-시스템-아키텍처-개요)
2. [pgvector 마이그레이션 설계](#2-pgvector-마이그레이션-설계)
3. [EmbeddingProvider 확장 설계](#3-embeddingprovider-확장-설계)
4. [ML API 설계](#4-ml-api-설계)
5. [MLPredictionPanel 컴포넌트 설계](#5-mlpredictionpanel-컴포넌트-설계)
6. [대시보드+챗 탭 레이아웃 설계](#6-대시보드챗-탭-레이아웃-설계)
7. [환경변수 설계](#7-환경변수-설계)
8. [API 엔드포인트 추가 사양](#8-api-엔드포인트-추가-사양)
9. [데이터베이스 스키마](#9-데이터베이스-스키마)
10. [배포 아키텍처](#10-배포-아키텍처)
11. [파일 구조 변경사항](#11-파일-구조-변경사항)
12. [Sprint 구현 순서](#12-sprint-구현-순서)
13. [비기능 요구사항 충족 전략](#13-비기능-요구사항-충족-전략)

---

## 1. 시스템 아키텍처 개요

### 1.1 Phase 2 → Phase 3 변경점 요약

```
Phase 2                              Phase 3
────────────────────────────         ──────────────────────────────────────
In-memory VectorStore          →     PostgreSQL + pgvector
OpenAI / mock Embedder         →     Ollama local + OpenAI + mock (3-way)
No ML prediction               →     FermentationPredictor + QualityClassifier
Single-view (chat)             →     탭 레이아웃 (Dashboard | Chat)
No persistent conversations    →     bkend.ai 실구현 + pgvector 연동
```

### 1.2 전체 아키텍처 다이어그램

```
Browser
  │
  ├─ Tab1: Dashboard ─── ProcessStatusPanel ─── SensorCard (x4)
  │                   └── MLPredictionPanel ─── FermentationBar
  │                                          └── QualityBadge
  │
  └─ Tab2: Chat ──────── ChatWindow ─── MessageBubble (RAG 출처 포함)
                      └── ChatInput / VoiceInput / QuickQuestions

         │
         │ SSE / REST
         ▼
Next.js API Routes (App Router)
  ├── POST /api/chat          ← RAG + Claude 스트리밍
  ├── GET/POST /api/conversations
  ├── POST /api/documents/upload
  ├── GET /api/documents/stats
  ├── POST /api/ml/predict    ← 발효 완성도 예측 (NEW)
  ├── POST /api/ml/quality    ← 품질 등급 예측 (NEW)
  ├── GET /api/process/stream ← 센서 SSE (Phase 2)
  └── PATCH /api/alerts/:id   ← 알림 확인 (NEW)

         │
         ├── Claude API (claude-sonnet-4-6)     ← AI 스트리밍
         ├── PostgreSQL + pgvector              ← 벡터 + 메타데이터 영속화 (NEW)
         ├── Ollama (nomic-embed-text)          ← 로컬 임베딩 (NEW)
         ├── bkend.ai                           ← CRUD 영속화 (완전 구현)
         └── ML Server (FastAPI / JS)           ← 예측 모델 (NEW)
```

### 1.3 의존성 그래프

```
pgvector
  └── retriever-pg.ts (VectorStore 구현)
        └── pipeline.ts (hybrid search 유지)

Ollama
  └── LocalEmbedder
        └── embedder.ts getEmbedder() 팩토리 (확장)

ML Server
  └── predictor.ts (IPredictor 인터페이스)
        └── /api/ml/predict, /api/ml/quality
              └── MLPredictionPanel 컴포넌트
```

---

## 2. pgvector 마이그레이션 설계

### 2.1 배경 및 문제

현재 `lib/rag/retriever.ts`는 Node.js 프로세스 메모리(`Map<string, StoredEntry>`)에 벡터를 저장한다. 서버 재시작 시 모든 벡터 데이터가 소멸되고, 수평 확장(multiple instances)이 불가능하다.

```typescript
// 현재 (retriever.ts:18) — 재시작 시 소멸
const vectorStore = new Map<string, StoredEntry>();
```

### 2.2 목표 상태

PostgreSQL의 `pgvector` 확장을 사용해 벡터를 영속화한다. 기존 `addDocuments`, `search`, `removeDocument` 함수 시그니처를 **VectorStore 인터페이스**로 추상화하여 in-memory / pgvector를 교체 가능하게 한다.

### 2.3 VectorStore 인터페이스 정의

**파일**: `lib/rag/vector-store.ts` (신규)

```typescript
import type { Chunk } from './chunker';
import type { SearchResult } from './retriever';

/**
 * VectorStore — 벡터 스토어 추상 인터페이스
 *
 * 구현체:
 *   - InMemoryVectorStore  (lib/rag/retriever.ts — Phase 2 호환)
 *   - PgVectorStore        (lib/rag/retriever-pg.ts — Phase 3)
 */
export interface VectorStore {
  /**
   * 청크와 임베딩 벡터를 스토어에 추가한다.
   * chunks[i] 와 vectors[i] 는 1:1 대응해야 한다.
   */
  addDocuments(chunks: Chunk[], vectors: number[][]): Promise<void>;

  /**
   * 쿼리 벡터에 가장 유사한 청크를 검색한다.
   */
  search(
    queryVector: number[],
    options?: { topK?: number; threshold?: number }
  ): Promise<SearchResult[]>;

  /**
   * 특정 docId의 모든 청크를 제거한다.
   */
  removeDocument(docId: string): Promise<void>;

  /**
   * 저장된 총 청크 수를 반환한다.
   */
  getStoreSize(): Promise<number>;

  /**
   * `${docId}::${chunkIndex}` 키로 특정 청크를 조회한다.
   * Hybrid search pipeline에서 BM25 전용 히트 처리에 사용.
   */
  getChunkByKey(key: string): Promise<{ vector: number[]; chunk: Chunk } | undefined>;
}
```

### 2.4 PgVectorStore 클래스 설계

**파일**: `lib/rag/retriever-pg.ts` (신규)

#### 2.4.1 클래스 구조

```typescript
import { Pool } from 'pg';
import type { Chunk } from './chunker';
import type { SearchResult } from './retriever';
import type { VectorStore } from './vector-store';

/**
 * PgVectorStore — PostgreSQL + pgvector 기반 영속 벡터 스토어
 *
 * 테이블: kimchi_chunks
 * 인덱스: IVFFlat (ivfflat) — 빠른 근사 최근접 이웃 검색
 */
export class PgVectorStore implements VectorStore {
  private readonly pool: Pool;
  private readonly dimension: number;

  constructor(connectionString: string, dimension: number) {
    this.pool = new Pool({ connectionString, max: 10 });
    this.dimension = dimension;
  }

  /**
   * 스키마 초기화 — 앱 시작 시 1회 호출
   * pgvector 확장 + 테이블 + 인덱스 생성
   */
  async initialize(): Promise<void> { ... }

  async addDocuments(chunks: Chunk[], vectors: number[][]): Promise<void> { ... }

  async search(
    queryVector: number[],
    options?: { topK?: number; threshold?: number }
  ): Promise<SearchResult[]> { ... }

  async removeDocument(docId: string): Promise<void> { ... }

  async getStoreSize(): Promise<number> { ... }

  async getChunkByKey(key: string): Promise<{ vector: number[]; chunk: Chunk } | undefined> { ... }
}
```

#### 2.4.2 핵심 메서드 상세 설계

**`initialize()` — 스키마 초기화**

```sql
-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 청크 테이블
CREATE TABLE IF NOT EXISTS kimchi_chunks (
  id          TEXT PRIMARY KEY,          -- "${docId}::${chunkIndex}"
  doc_id      TEXT NOT NULL,
  doc_name    TEXT NOT NULL,
  chunk_text  TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding   vector(1536),              -- 차원은 EmbeddingProvider에 맞게 조정
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- cosine 거리 인덱스 (IVFFlat, 100 클러스터)
CREATE INDEX IF NOT EXISTS kimchi_chunks_embedding_idx
  ON kimchi_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- docId 기반 조회 인덱스
CREATE INDEX IF NOT EXISTS kimchi_chunks_doc_id_idx
  ON kimchi_chunks (doc_id);
```

**`addDocuments()` — 벡터 삽입**

```typescript
async addDocuments(chunks: Chunk[], vectors: number[][]): Promise<void> {
  if (chunks.length !== vectors.length) {
    throw new Error('chunks and vectors arrays must have the same length');
  }

  const client = await this.pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const key = `${chunk.metadata.docId}::${chunk.index}`;
      // pgvector는 배열을 '[x,y,z,...]' 형식 문자열로 받음
      const vec = `[${vectors[i].join(',')}]`;
      await client.query(
        `INSERT INTO kimchi_chunks (id, doc_id, doc_name, chunk_text, chunk_index, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)
         ON CONFLICT (id) DO UPDATE
           SET embedding = EXCLUDED.embedding,
               chunk_text = EXCLUDED.chunk_text`,
        [key, chunk.metadata.docId, chunk.metadata.docName, chunk.text, chunk.index, vec]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

**`search()` — 코사인 유사도 검색**

```typescript
async search(
  queryVector: number[],
  options: { topK?: number; threshold?: number } = {}
): Promise<SearchResult[]> {
  const topK = options.topK ?? 5;
  const threshold = options.threshold ?? 0.3;
  const vec = `[${queryVector.join(',')}]`;

  // pgvector: <=> 는 cosine distance (0=동일, 2=반대)
  // similarity = 1 - distance
  const result = await this.pool.query(
    `SELECT id, doc_id, doc_name, chunk_text, chunk_index,
            1 - (embedding <=> $1::vector) AS score
     FROM kimchi_chunks
     WHERE 1 - (embedding <=> $1::vector) >= $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vec, threshold, topK]
  );

  return result.rows.map((row) => ({
    chunk: {
      text: row.chunk_text,
      index: row.chunk_index,
      metadata: { docId: row.doc_id, docName: row.doc_name },
    },
    score: parseFloat(row.score),
  }));
}
```

**`removeDocument()` — 문서 삭제**

```typescript
async removeDocument(docId: string): Promise<void> {
  await this.pool.query(
    'DELETE FROM kimchi_chunks WHERE doc_id = $1',
    [docId]
  );
}
```

### 2.5 VectorStore 팩토리

**파일**: `lib/rag/vector-store-factory.ts` (신규)

```typescript
import type { VectorStore } from './vector-store';

let _store: VectorStore | null = null;

export async function getVectorStore(): Promise<VectorStore> {
  if (_store) return _store;

  if (process.env.DATABASE_URL) {
    const { PgVectorStore } = await import('./retriever-pg');
    const dimension = getExpectedDimension(); // 환경변수 기반
    const store = new PgVectorStore(process.env.DATABASE_URL, dimension);
    await store.initialize();
    _store = store;
    console.log('[vector-store] provider=pgvector');
  } else {
    // In-memory 폴백 (개발/테스트)
    const { InMemoryVectorStore } = await import('./retriever-memory');
    _store = new InMemoryVectorStore();
    console.warn('[vector-store] provider=in-memory (DATABASE_URL 없음)');
  }

  return _store;
}

function getExpectedDimension(): number {
  const provider = process.env.EMBEDDING_PROVIDER ?? 'openai';
  if (provider === 'local') return 768;  // nomic-embed-text
  return 1536;                           // openai text-embedding-3-small
}
```

### 2.6 파이프라인 통합

`lib/rag/pipeline.ts`는 `VectorStore` 인터페이스를 통해 추상화된 스토어를 사용하도록 수정한다. 기존 `search()`, `addDocuments()` 함수 호출을 비동기로 변환.

```typescript
// pipeline.ts 수정 요점
import { getVectorStore } from './vector-store-factory';

export async function retrieveContext(query: string): Promise<RAGResult> {
  const store = await getVectorStore();
  const queryVector = await embed(query);
  const vectorResults = await store.search(queryVector, { topK: 10, threshold: 0.3 });
  // ... BM25 + RRF 로직 유지
}

export async function ingestDocument(...): Promise<number> {
  const store = await getVectorStore();
  // ...
  await store.addDocuments(chunks, vectors);
  // ... BM25 인덱싱 유지
}
```

### 2.7 차원 불일치 처리 (pgvector)

pgvector 컬럼 차원은 테이블 생성 시 고정된다. `EMBEDDING_PROVIDER` 변경 시 기존 데이터와 차원이 달라지므로:

- **전략**: `initialize()` 시 현재 설정 차원과 DB 컬럼 차원을 비교
- 불일치 감지 시: `kimchi_chunks` 테이블 DROP → 재생성 후 경고 로그
- 프로덕션: 마이그레이션 스크립트로 제어 (수동)

```typescript
// initialize() 내 차원 검사
const result = await client.query(`
  SELECT atttypmod FROM pg_attribute
  WHERE attrelid = 'kimchi_chunks'::regclass AND attname = 'embedding'
`);
if (result.rows.length > 0) {
  const storedDim = result.rows[0].atttypmod;
  if (storedDim !== -1 && storedDim !== this.dimension) {
    console.warn(`[pgvector] 차원 불일치: stored=${storedDim}, current=${this.dimension}`);
    console.warn('[pgvector] 기존 데이터 삭제 후 재생성합니다.');
    await client.query('DROP TABLE IF EXISTS kimchi_chunks');
  }
}
```

### 2.8 Docker Compose — pgvector 로컬 스택

**파일**: `docker-compose.yml` (신규)

```yaml
version: '3.9'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: kimchi_agent
      POSTGRES_USER: kimchi
      POSTGRES_PASSWORD: kimchi_secret
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kimchi -d kimchi_agent"]
      interval: 10s
      timeout: 5s
      retries: 5

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

volumes:
  pgdata:
  ollama_data:
```

---

## 3. EmbeddingProvider 확장 설계

### 3.1 현재 구조 분석

`lib/rag/embedder.ts`는 이미 `EmbeddingProvider` 인터페이스와 팩토리 패턴을 갖추고 있다:

```typescript
// 현재 지원: openai | mock
export function getEmbedder(): EmbeddingProvider {
  const mode = process.env.EMBEDDING_PROVIDER ?? 'openai';
  // openai → OpenAIEmbedder
  // 그 외   → MockEmbedder
}
```

### 3.2 LocalEmbedder (Ollama) 추가

**파일**: `lib/rag/embedder.ts` — `LocalEmbedder` 클래스 추가

#### 3.2.1 LocalEmbedder 클래스 설계

```typescript
// Ollama nomic-embed-text: 768차원 임베딩
const LOCAL_EMBEDDING_DIMENSION = 768;
const LOCAL_EMBEDDING_MODEL = 'nomic-embed-text';

class LocalEmbedder implements EmbeddingProvider {
  readonly dimension = LOCAL_EMBEDDING_DIMENSION;
  readonly name = 'local';

  private readonly baseUrl: string;

  constructor(ollamaUrl: string) {
    // 예: http://localhost:11434
    this.baseUrl = ollamaUrl.replace(/\/$/, '');
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.callOllama([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ollama는 배치를 지원하지 않으므로 순차 처리
    // 성능: 평균 500ms/청크 × N청크 → ingestDocument는 백그라운드 허용
    const results: number[][] = [];
    for (const text of texts) {
      const [vec] = await this.callOllama([text]);
      results.push(vec);
    }
    return results;
  }

  private async callOllama(texts: string[]): Promise<number[][]> {
    // Ollama /api/embeddings 엔드포인트 (단일 텍스트만 지원)
    const embeddings: number[][] = [];
    for (const text of texts) {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: LOCAL_EMBEDDING_MODEL, prompt: text }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Ollama embedding ${res.status}: ${body}`);
      }
      const data = (await res.json()) as { embedding: number[] };
      embeddings.push(data.embedding);
    }
    return embeddings;
  }
}
```

#### 3.2.2 팩토리 확장

```typescript
// embedder.ts getEmbedder() 확장
export function getEmbedder(): EmbeddingProvider {
  if (_provider) return _provider;

  const mode = process.env.EMBEDDING_PROVIDER ?? 'openai';

  if (mode === 'local') {
    const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
    _provider = new LocalEmbedder(ollamaUrl);
    console.log(`[embedder] provider=local (Ollama @ ${ollamaUrl})`);
  } else if (mode === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      _provider = new OpenAIEmbedder(apiKey);
    } else {
      console.warn('[embedder] OPENAI_API_KEY 없음 — mock embedding 사용');
      _provider = new MockEmbedder();
    }
  } else {
    _provider = new MockEmbedder();
  }

  console.log(`[embedder] provider=${_provider.name}, dimension=${_provider.dimension}`);
  return _provider;
}
```

### 3.3 차원 불일치 처리 전략

| Provider | 차원 | 비고 |
|----------|------|------|
| `openai` (text-embedding-3-small) | 1536 | 기본값 |
| `local` (nomic-embed-text via Ollama) | 768 | 로컬 추론 |
| `mock` | 1536 | 테스트용 deterministic |

**문제**: 같은 pgvector 테이블에 두 차원이 혼재할 수 없다.

**해결 전략**:
1. `DATABASE_URL` + `EMBEDDING_PROVIDER` 조합으로 `VectorStore` 초기화 시 차원 검사 (§2.7 참조)
2. Provider 변경 시 기존 문서 재색인(re-index) 필요 → UI에 경고 배너 표시
3. Mock은 항상 1536차원으로 통일 (OpenAI 폴백 호환)

### 3.4 Ollama 헬스체크

```typescript
// lib/rag/embedder.ts — LocalEmbedder에 추가
async healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json() as { models: Array<{ name: string }> };
    return data.models.some((m) => m.name.startsWith(LOCAL_EMBEDDING_MODEL));
  } catch {
    return false;
  }
}
```

`app/api/health/route.ts` (신규) — 헬스 엔드포인트에서 Ollama 가용성 확인:

```
GET /api/health
→ { "status": "ok", "embedder": "local|openai|mock", "vectorStore": "pgvector|memory", "ollamaReachable": true|false }
```

---

## 4. ML API 설계

### 4.1 도메인 모델

김치 발효는 다음 핵심 파라미터로 상태를 표현한다:

| 파라미터 | 범위 | 의미 |
|----------|------|------|
| `temperature` | 15–25°C | 발효 속도 결정 |
| `salinity` | 1.5–3.0% | 보존성 + 발효균 환경 |
| `ph` | 3.8–5.5 | 산도 (발효 진행 지표) |
| `fermentationHours` | 0–120h | 경과 시간 |
| `humidity` | 65–90% | 저장 환경 |

### 4.2 IPredictor 인터페이스

**파일**: `lib/ml/predictor.ts` (신규)

```typescript
import type { SensorData } from '@/lib/process/sensor-client';

// ──────────────────────────────────────────────────────────
// 예측 입출력 타입
// ──────────────────────────────────────────────────────────

export interface FermentationPrediction {
  /** 발효 완성도 0.0–1.0 */
  fermentationPct: number;
  /** 예상 완료 시각 (ISO 8601) */
  eta: string;
  /** 예측 신뢰도 0.0–1.0 (모델 확신도) */
  confidence: number;
  /** 현재 발효 단계 */
  stage: 'early' | 'mid' | 'late' | 'complete';
  /** 센서 이상 여부 */
  anomaly: boolean;
  /** 이상 감지 시 원인 설명 */
  anomalyReason?: string;
}

export interface QualityPrediction {
  /** 품질 등급 */
  grade: 'A' | 'B' | 'C';
  /** 등급 예측 확신도 0.0–1.0 */
  confidence: number;
  /** 등급 결정 근거 */
  rationale: string;
  /** 개선 권고사항 */
  recommendations: string[];
}

export interface QualityInput {
  temperature: number;
  salinity: number;
  ph: number;
}

// ──────────────────────────────────────────────────────────
// 예측기 인터페이스
// ──────────────────────────────────────────────────────────

export interface IPredictor {
  /**
   * 현재 센서 데이터로 발효 완성도 + ETA 예측
   */
  predictFermentation(sensors: SensorData): Promise<FermentationPrediction>;

  /**
   * 온도·염도·pH 기반 품질 등급 예측
   */
  predictQuality(input: QualityInput): Promise<QualityPrediction>;
}
```

### 4.3 RuleBasedPredictor — JS 경량 구현

외부 ML 서버 없이 규칙 기반으로 동작하는 기본 구현체. Phase 3 초기 및 폴백으로 사용.

**파일**: `lib/ml/rule-based-predictor.ts` (신규)

```typescript
import type { IPredictor, FermentationPrediction, QualityPrediction, QualityInput } from './predictor';
import type { SensorData } from '@/lib/process/sensor-client';

/**
 * RuleBasedPredictor
 *
 * 규칙:
 * - 발효 완성도 = clamp(fermentationHours / OPTIMAL_HOURS, 0, 1)
 *   OPTIMAL_HOURS는 온도 보정 (20°C 기준 72h)
 * - 품질 등급:
 *   A: 2.0 ≤ salinity ≤ 2.5 AND 4.0 ≤ pH ≤ 4.5 AND 18 ≤ temp ≤ 22
 *   B: 위 범위 ±10% 이내
 *   C: 그 외
 */
export class RuleBasedPredictor implements IPredictor {
  private readonly OPTIMAL_HOURS_AT_20C = 72;

  async predictFermentation(sensors: SensorData): Promise<FermentationPrediction> {
    // 온도 보정 계수 (Q10 법칙 근사: 10°C마다 속도 2배)
    const tempFactor = Math.pow(2, (sensors.temperature - 20) / 10);
    const effectiveHours = sensors.fermentationHours * tempFactor;
    const optimalHours = this.OPTIMAL_HOURS_AT_20C;

    const fermentationPct = Math.min(effectiveHours / optimalHours, 1.0);

    // ETA 계산
    const remainingEffective = Math.max(optimalHours - effectiveHours, 0);
    const remainingReal = remainingEffective / tempFactor;
    const etaMs = Date.now() + remainingReal * 3_600_000;
    const eta = new Date(etaMs).toISOString();

    // 발효 단계
    let stage: FermentationPrediction['stage'];
    if (fermentationPct < 0.25) stage = 'early';
    else if (fermentationPct < 0.6) stage = 'mid';
    else if (fermentationPct < 1.0) stage = 'late';
    else stage = 'complete';

    // 이상 감지: 센서값이 정상 범위 이탈
    const anomaly =
      sensors.temperature < 10 || sensors.temperature > 28 ||
      sensors.salinity < 1.0 || sensors.salinity > 3.5 ||
      sensors.ph < 3.5 || sensors.ph > 6.0;

    let anomalyReason: string | undefined;
    if (anomaly) {
      const reasons: string[] = [];
      if (sensors.temperature < 10 || sensors.temperature > 28)
        reasons.push(`온도 이상: ${sensors.temperature}°C`);
      if (sensors.salinity < 1.0 || sensors.salinity > 3.5)
        reasons.push(`염도 이상: ${sensors.salinity}%`);
      if (sensors.ph < 3.5 || sensors.ph > 6.0)
        reasons.push(`pH 이상: ${sensors.ph}`);
      anomalyReason = reasons.join(', ');
    }

    return {
      fermentationPct: Math.round(fermentationPct * 1000) / 1000,
      eta,
      confidence: anomaly ? 0.4 : 0.75,
      stage,
      anomaly,
      anomalyReason,
    };
  }

  async predictQuality(input: QualityInput): Promise<QualityPrediction> {
    const { temperature, salinity, ph } = input;

    const inRangeA =
      salinity >= 2.0 && salinity <= 2.5 &&
      ph >= 4.0 && ph <= 4.5 &&
      temperature >= 18 && temperature <= 22;

    const inRangeB =
      salinity >= 1.8 && salinity <= 2.75 &&
      ph >= 3.8 && ph <= 4.8 &&
      temperature >= 16 && temperature <= 24;

    const grade = inRangeA ? 'A' : inRangeB ? 'B' : 'C';
    const confidence = inRangeA ? 0.85 : inRangeB ? 0.70 : 0.65;

    const rationale = grade === 'A'
      ? '온도·염도·pH 모두 최적 범위. 최상급 품질 예상.'
      : grade === 'B'
      ? '주요 지표가 허용 범위 내. 양호한 품질 예상.'
      : '하나 이상의 지표가 권장 범위 이탈. 품질 저하 위험.';

    const recommendations: string[] = [];
    if (temperature < 18) recommendations.push('온도를 18°C 이상으로 높여주세요.');
    if (temperature > 22) recommendations.push('온도를 22°C 이하로 낮춰주세요.');
    if (salinity < 2.0) recommendations.push('염도가 낮습니다. 소금 추가를 검토하세요.');
    if (salinity > 2.5) recommendations.push('염도가 높습니다. 다음 배치에 반영하세요.');
    if (ph > 4.5) recommendations.push('pH가 높습니다. 발효가 덜 진행됐습니다.');
    if (ph < 4.0) recommendations.push('pH가 낮습니다. 산도 조절이 필요합니다.');

    return { grade, confidence, rationale, recommendations };
  }
}
```

### 4.4 RemoteMLPredictor — FastAPI 서버 연동 (선택)

**파일**: `lib/ml/remote-predictor.ts` (신규)

```typescript
import type { IPredictor, FermentationPrediction, QualityPrediction, QualityInput } from './predictor';
import type { SensorData } from '@/lib/process/sensor-client';

/**
 * RemoteMLPredictor — ML_SERVER_URL의 FastAPI 서버에 HTTP 요청
 * 서버 미응답 시 RuleBasedPredictor로 자동 폴백
 */
export class RemoteMLPredictor implements IPredictor {
  constructor(
    private readonly serverUrl: string,
    private readonly fallback: IPredictor
  ) {}

  async predictFermentation(sensors: SensorData): Promise<FermentationPrediction> {
    try {
      const res = await fetch(`${this.serverUrl}/predict/fermentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sensors),
        signal: AbortSignal.timeout(3000), // 3초 타임아웃
      });
      if (!res.ok) throw new Error(`ML server ${res.status}`);
      return res.json() as Promise<FermentationPrediction>;
    } catch (err) {
      console.warn('[ml] Remote predictor 실패, 규칙 기반으로 폴백:', err);
      return this.fallback.predictFermentation(sensors);
    }
  }

  async predictQuality(input: QualityInput): Promise<QualityPrediction> {
    try {
      const res = await fetch(`${this.serverUrl}/predict/quality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`ML server ${res.status}`);
      return res.json() as Promise<QualityPrediction>;
    } catch (err) {
      console.warn('[ml] Remote predictor 실패, 규칙 기반으로 폴백:', err);
      return this.fallback.predictQuality(input);
    }
  }
}
```

### 4.5 Predictor 팩토리

**파일**: `lib/ml/predictor-factory.ts` (신규)

```typescript
import type { IPredictor } from './predictor';
import { RuleBasedPredictor } from './rule-based-predictor';

let _predictor: IPredictor | null = null;

export function getPredictor(): IPredictor {
  if (_predictor) return _predictor;

  const ruleBased = new RuleBasedPredictor();

  if (process.env.ML_SERVER_URL) {
    const { RemoteMLPredictor } = require('./remote-predictor') as {
      RemoteMLPredictor: new (url: string, fallback: IPredictor) => IPredictor;
    };
    _predictor = new RemoteMLPredictor(process.env.ML_SERVER_URL, ruleBased);
    console.log(`[ml] provider=remote (${process.env.ML_SERVER_URL})`);
  } else {
    _predictor = ruleBased;
    console.log('[ml] provider=rule-based');
  }

  return _predictor;
}
```

### 4.6 POST /api/ml/predict 엔드포인트

**파일**: `app/api/ml/predict/route.ts` (신규)

**요청**:
```json
POST /api/ml/predict
Content-Type: application/json

{
  "batchId": "BATCH-2026-02-27",
  "sensors": {
    "temperature": 20.5,
    "humidity": 80.0,
    "salinity": 2.2,
    "ph": 4.3,
    "fermentationHours": 36.5,
    "estimatedCompletion": 35.5,
    "timestamp": "2026-02-27T12:00:00Z"
  }
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "batchId": "BATCH-2026-02-27",
    "fermentationPct": 0.512,
    "eta": "2026-02-29T00:00:00Z",
    "confidence": 0.75,
    "stage": "mid",
    "anomaly": false
  }
}
```

**에러 응답**:
```json
{
  "ok": false,
  "error": "INVALID_INPUT",
  "message": "sensors 필드가 필요합니다."
}
```

### 4.7 POST /api/ml/quality 엔드포인트

**파일**: `app/api/ml/quality/route.ts` (신규)

**요청**:
```json
POST /api/ml/quality
Content-Type: application/json

{
  "temperature": 20.5,
  "salinity": 2.2,
  "ph": 4.3
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "grade": "A",
    "confidence": 0.85,
    "rationale": "온도·염도·pH 모두 최적 범위. 최상급 품질 예상.",
    "recommendations": []
  }
}
```

### 4.8 ML 예측 결과 → system-prompt.ts 주입

`lib/ai/system-prompt.ts`에 `buildSystemPrompt()` 함수 확장:

```typescript
// system-prompt.ts 수정 — ML 예측 컨텍스트 주입
export function buildSystemPrompt(options: {
  ragContext?: string;
  fermentationPrediction?: FermentationPrediction;
  qualityPrediction?: QualityPrediction;
  sensorData?: SensorData;
}): string {
  let prompt = BASE_KIMCHI_SYSTEM_PROMPT;

  if (options.sensorData) {
    prompt += `\n\n## 현재 센서 데이터\n`;
    prompt += `배치 ID: ${options.sensorData.batchId}\n`;
    prompt += `온도: ${options.sensorData.temperature}°C, 습도: ${options.sensorData.humidity}%, `;
    prompt += `염도: ${options.sensorData.salinity}%, pH: ${options.sensorData.ph}\n`;
    prompt += `발효 경과: ${options.sensorData.fermentationHours}시간\n`;
  }

  if (options.fermentationPrediction) {
    const p = options.fermentationPrediction;
    prompt += `\n## ML 발효 예측\n`;
    prompt += `완성도: ${(p.fermentationPct * 100).toFixed(1)}% (${p.stage} 단계)\n`;
    prompt += `ETA: ${p.eta}\n`;
    prompt += `신뢰도: ${(p.confidence * 100).toFixed(0)}%\n`;
    if (p.anomaly) prompt += `⚠️ 이상 감지: ${p.anomalyReason}\n`;
  }

  if (options.qualityPrediction) {
    const q = options.qualityPrediction;
    prompt += `\n## ML 품질 예측\n`;
    prompt += `등급: ${q.grade} (신뢰도: ${(q.confidence * 100).toFixed(0)}%)\n`;
    prompt += `근거: ${q.rationale}\n`;
    if (q.recommendations.length > 0) {
      prompt += `권고사항: ${q.recommendations.join('; ')}\n`;
    }
  }

  if (options.ragContext) {
    prompt += `\n## 관련 문서\n${options.ragContext}`;
  }

  return prompt;
}
```

---

## 5. MLPredictionPanel 컴포넌트 설계

### 5.1 컴포넌트 Props

**파일**: `components/ml/MLPredictionPanel.tsx` (신규)

```typescript
import type { SensorData } from '@/lib/process/sensor-client';
import type { FermentationPrediction, QualityPrediction } from '@/lib/ml/predictor';

export interface MLPredictionPanelProps {
  /** 현재 배치 ID */
  batchId: string;
  /** 현재 센서 데이터 (발효 예측 입력) */
  sensors: SensorData;
  /** 새로고침 간격 ms (기본 30000) */
  refreshInterval?: number;
}
```

### 5.2 내부 상태 및 데이터 흐름

```
MLPredictionPanel
  │
  ├── useMlPrediction(sensors) hook
  │     ├── fetchFermentation(sensors) → POST /api/ml/predict
  │     └── fetchQuality(sensors)      → POST /api/ml/quality
  │
  ├── FermentationProgressBar
  │     ├── props: fermentationPct, stage, confidence
  │     └── [██████░░░░] 60% - Mid Stage
  │
  ├── ETADisplay
  │     └── "예상 완료: 2026-02-29 12:00 (35.5시간 후)"
  │
  ├── QualityGradeBadge
  │     ├── props: grade, confidence
  │     └── [A등급] 85% 신뢰도
  │
  ├── AnomalyAlert (조건부 표시)
  │     └── "⚠️ 온도 이상: 28.5°C"
  │
  └── RecommendationList
        └── recommendations[]
```

### 5.3 useMlPrediction 훅

**파일**: `hooks/useMlPrediction.ts` (신규)

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { SensorData } from '@/lib/process/sensor-client';
import type { FermentationPrediction, QualityPrediction } from '@/lib/ml/predictor';

interface MlPredictionState {
  fermentation: FermentationPrediction | null;
  quality: QualityPrediction | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useMlPrediction(
  sensors: SensorData | null,
  refreshInterval = 30_000
): MlPredictionState & { refresh: () => void } {
  const [state, setState] = useState<MlPredictionState>({
    fermentation: null,
    quality: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
  });

  const fetchPredictions = useCallback(async () => {
    if (!sensors) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const [ferRes, qualRes] = await Promise.all([
        fetch('/api/ml/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId: sensors.batchId, sensors }),
        }),
        fetch('/api/ml/quality', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            temperature: sensors.temperature,
            salinity: sensors.salinity,
            ph: sensors.ph,
          }),
        }),
      ]);
      const ferData = await ferRes.json();
      const qualData = await qualRes.json();
      setState({
        fermentation: ferData.data,
        quality: qualData.data,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : '예측 실패',
      }));
    }
  }, [sensors]);

  useEffect(() => {
    fetchPredictions();
    const timer = setInterval(fetchPredictions, refreshInterval);
    return () => clearInterval(timer);
  }, [fetchPredictions, refreshInterval]);

  return { ...state, refresh: fetchPredictions };
}
```

### 5.4 MLPredictionPanel UI 설계

```
┌─────────────────────────────────────────┐
│  ML 예측                    [새로고침 ↺] │
│  마지막 업데이트: 12:34:56               │
├─────────────────────────────────────────┤
│  발효 완성도                             │
│  ████████████░░░░░░░░  60.3%           │
│  단계: Mid | 신뢰도: 75%               │
│  예상 완료: 2026-02-29 12:00            │
│           (약 35시간 30분 후)            │
├─────────────────────────────────────────┤
│  품질 예측                               │
│  ┌───┐                                  │
│  │ A │  85% 신뢰도                      │
│  └───┘                                  │
│  온도·염도·pH 모두 최적 범위            │
├─────────────────────────────────────────┤
│  ⚠️ 이상 감지 (조건부 표시)              │
│  온도 이상: 28.5°C (정상 범위: 15-25°C) │
├─────────────────────────────────────────┤
│  권고사항                                │
│  • 온도를 22°C 이하로 낮춰주세요.       │
└─────────────────────────────────────────┘
```

### 5.5 FermentationProgressBar 서브컴포넌트

```typescript
// components/ml/FermentationProgressBar.tsx
interface Props {
  pct: number;        // 0.0–1.0
  stage: 'early' | 'mid' | 'late' | 'complete';
  confidence: number; // 0.0–1.0
}

const STAGE_COLORS = {
  early:    'bg-blue-400',
  mid:      'bg-yellow-400',
  late:     'bg-orange-400',
  complete: 'bg-green-500',
};

const STAGE_LABELS = {
  early: '초기',
  mid: '중기',
  late: '후기',
  complete: '완료',
};
```

### 5.6 QualityGradeBadge 서브컴포넌트

```typescript
// components/ml/QualityGradeBadge.tsx
interface Props {
  grade: 'A' | 'B' | 'C';
  confidence: number;
}

const GRADE_STYLES = {
  A: 'bg-green-100 text-green-800 border-green-300',
  B: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  C: 'bg-red-100 text-red-800 border-red-300',
};
```

---

## 6. 대시보드+챗 탭 레이아웃 설계

### 6.1 탭 구조

```
app/page.tsx (수정)
├── Sidebar (좌측, 기존 유지)
└── Main Content
      ├── Header (탭 스위처 포함)
      └── Tab Panel
            ├── Tab 1: Dashboard
            │     ├── ProcessStatusPanel (Phase 2 기존)
            │     │     └── SensorCard × 4 (temp/humid/salt/ph)
            │     └── MLPredictionPanel (Phase 3 신규)
            │           ├── FermentationProgressBar
            │           ├── QualityGradeBadge
            │           └── AnomalyAlert (조건부)
            └── Tab 2: Chat
                  └── ChatWindow (기존 유지)
```

### 6.2 TabLayout 컴포넌트

**파일**: `components/layout/TabLayout.tsx` (신규)

```typescript
export type TabId = 'dashboard' | 'chat';

export interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

export interface TabLayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: React.ReactNode;
}
```

### 6.3 탭 전환 상태 관리 (page.tsx)

```typescript
// app/page.tsx 수정 요점

const [activeTab, setActiveTab] = useState<TabId>('dashboard');

// URL 해시로 탭 상태 동기화 (딥링크 지원)
useEffect(() => {
  const hash = window.location.hash.replace('#', '') as TabId;
  if (hash === 'chat' || hash === 'dashboard') setActiveTab(hash);
}, []);

const handleTabChange = (tab: TabId) => {
  setActiveTab(tab);
  window.history.replaceState(null, '', `#${tab}`);
};
```

### 6.4 모바일 탭 스위처 설계

```
모바일 레이아웃 (< lg)
┌──────────────────────────┐
│  Header                  │
│  ┌──────────┬──────────┐ │
│  │ 대시보드  │   챗     │ │  ← 고정 탭 바
│  └──────────┴──────────┘ │
│                          │
│  [활성 탭 컨텐츠]        │
└──────────────────────────┘

데스크톱 레이아웃 (≥ lg)
┌──────┬──────────────────────────────┐
│      │  Header  [대시보드] [챗]      │
│      ├──────────────────────────────┤
│ Side │                              │
│ bar  │  [활성 탭 컨텐츠]            │
│      │                              │
└──────┴──────────────────────────────┘
```

### 6.5 Dashboard 탭 상세 레이아웃

```
Desktop (lg+): 2컬럼 그리드
┌─────────────────────┬─────────────────────┐
│ ProcessStatusPanel  │ MLPredictionPanel   │
│                     │                     │
│ ┌─────┐ ┌─────┐    │ [발효 진행도 바]    │
│ │Temp │ │Humid│    │ [품질 등급 뱃지]    │
│ └─────┘ └─────┘    │ [권고사항]          │
│ ┌─────┐ ┌─────┐    │                     │
│ │Salt │ │ pH  │    │                     │
│ └─────┘ └─────┘    │                     │
└─────────────────────┴─────────────────────┘
[AlertBadge 알림 목록]

Mobile: 단일 컬럼, 스크롤
┌─────────────────────┐
│ ProcessStatusPanel  │
│ MLPredictionPanel   │
│ Alerts              │
└─────────────────────┘
```

### 6.6 Alert.acknowledged 처리

Phase 2에서 미구현된 알림 확인 기능을 추가한다.

**타입 확장**:
```typescript
// lib/process/alert-rules.ts 수정
export interface Alert {
  id: string;
  type: 'temperature' | 'salinity' | 'ph' | 'humidity';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;  // Phase 3 추가
}
```

**PATCH /api/alerts/:id 엔드포인트**:

**파일**: `app/api/alerts/[id]/route.ts` (신규)

```
PATCH /api/alerts/:id
Body: { "acknowledged": true }
Response: { "ok": true, "data": { "id": "...", "acknowledged": true } }
```

**useAlerts 훅 확장**:
```typescript
// hooks/useAlerts.ts 수정
const acknowledgeAlert = useCallback(async (alertId: string) => {
  await fetch(`/api/alerts/${alertId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledged: true }),
  });
  // 로컬 상태 즉시 업데이트 (optimistic update)
  setAlerts((prev) =>
    prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
  );
}, []);
```

---

## 7. 환경변수 설계

### 7.1 전체 환경변수 목록

**파일**: `.env.local.example` (업데이트)

```bash
# ── AI ─────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...          # 필수 — Claude API

# ── 임베딩 ──────────────────────────────────────────
EMBEDDING_PROVIDER=local              # openai | local | mock
OPENAI_API_KEY=sk-...                 # EMBEDDING_PROVIDER=openai 시 필요
EMBEDDING_MODEL=text-embedding-3-small # OpenAI 모델명 (기본값)
OLLAMA_URL=http://localhost:11434     # EMBEDDING_PROVIDER=local 시 필요

# ── 데이터베이스 ─────────────────────────────────────
DATABASE_URL=postgresql://kimchi:kimchi_secret@localhost:5432/kimchi_agent
# DATABASE_URL 미설정 시 in-memory 폴백

# ── ML 예측 ──────────────────────────────────────────
ML_SERVER_URL=http://localhost:8000   # 선택 — FastAPI ML 서버 (미설정 시 rule-based)

# ── 센서 데이터 ──────────────────────────────────────
PROCESS_DATA_MODE=simulator           # simulator | api
PROCESS_DATA_API_URL=http://factory-sensor.local:8080
PROCESS_DATA_API_KEY=sensor_api_key

# ── bkend.ai ─────────────────────────────────────────
BKEND_PROJECT_ID=kimchi-agent-prod
BKEND_API_KEY=bkend_...
```

### 7.2 환경변수 유효성 검사

**파일**: `lib/config/validate-env.ts` (신규)

```typescript
/**
 * 앱 시작 시 환경변수 유효성을 검사하고 경고를 출력한다.
 * 필수 변수 누락 시 에러, 선택 변수 누락 시 경고.
 */
export function validateEnv(): void {
  const required = ['ANTHROPIC_API_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`필수 환경변수 누락: ${missing.join(', ')}`);
  }

  const provider = process.env.EMBEDDING_PROVIDER ?? 'openai';
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    console.warn('[config] EMBEDDING_PROVIDER=openai이지만 OPENAI_API_KEY 없음 → mock 폴백');
  }
  if (provider === 'local' && !process.env.OLLAMA_URL) {
    console.warn('[config] EMBEDDING_PROVIDER=local이지만 OLLAMA_URL 미설정 → localhost:11434 사용');
  }
  if (!process.env.DATABASE_URL) {
    console.warn('[config] DATABASE_URL 미설정 → in-memory 벡터 스토어 사용 (재시작 시 소멸)');
  }
}
```

---

## 8. API 엔드포인트 추가 사양

### 8.1 GET /api/documents/stats

**파일**: `app/api/documents/stats/route.ts` (신규)

**응답**:
```json
{
  "ok": true,
  "data": {
    "totalDocuments": 12,
    "totalChunks": 347,
    "totalSizeBytes": 2048000,
    "byType": {
      "pdf": 5,
      "xlsx": 3,
      "txt": 3,
      "csv": 1
    },
    "vectorStoreProvider": "pgvector",
    "embeddingProvider": "local"
  }
}
```

### 8.2 GET /api/documents

**파일**: `app/api/documents/route.ts` (신규)

**쿼리 파라미터**: `?limit=20&offset=0&type=pdf`

**응답**:
```json
{
  "ok": true,
  "data": {
    "documents": [
      {
        "id": "doc_123",
        "name": "kimchi-recipe.pdf",
        "type": "pdf",
        "fileSize": 102400,
        "chunks": 28,
        "status": "processed",
        "createdAt": "2026-02-27T10:00:00Z"
      }
    ],
    "total": 12,
    "limit": 20,
    "offset": 0
  }
}
```

### 8.3 GET /api/health

**파일**: `app/api/health/route.ts` (신규)

```json
{
  "status": "ok",
  "timestamp": "2026-02-27T12:00:00Z",
  "services": {
    "claude": "ok",
    "embedder": { "provider": "local", "reachable": true },
    "vectorStore": { "provider": "pgvector", "size": 347 },
    "mlPredictor": { "provider": "rule-based" },
    "ollama": { "reachable": true, "model": "nomic-embed-text" }
  }
}
```

---

## 9. 데이터베이스 스키마

### 9.1 kimchi_chunks (pgvector)

```sql
CREATE TABLE kimchi_chunks (
  id           TEXT PRIMARY KEY,          -- "${docId}::${chunkIndex}"
  doc_id       TEXT NOT NULL,
  doc_name     TEXT NOT NULL,
  chunk_text   TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  embedding    vector(1536),              -- 차원: EMBEDDING_PROVIDER에 따라 1536 or 768
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX kimchi_chunks_embedding_cosine_idx
  ON kimchi_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX kimchi_chunks_doc_id_idx ON kimchi_chunks (doc_id);
```

### 9.2 차원별 테이블 전략

Phase 3는 단일 테이블로 설계한다. `EMBEDDING_PROVIDER` 환경변수 변경 시:

1. `validate-env.ts`가 시작 시 경고 출력
2. `PgVectorStore.initialize()`가 차원 불일치 감지 → 테이블 재생성 (개발)
3. 프로덕션 환경: 수동 마이그레이션 스크립트 실행 필요

### 9.3 bkend.ai 스키마 (완전 구현)

`lib/db/bkend.ts`의 placeholder 메서드를 실구현으로 교체한다.

| 컬렉션 | 필드 |
|--------|------|
| `conversations` | `id`, `title`, `lastMessage`, `messageCount`, `createdAt`, `updatedAt` |
| `messages` | `id`, `conversationId`, `role`, `content`, `sources`, `createdAt` |
| `documents` | `id`, `name`, `fileName`, `fileType`, `fileSize`, `chunks`, `status`, `createdAt` |
| `alerts` | `id`, `type`, `severity`, `message`, `timestamp`, `acknowledged` |

---

## 10. 배포 아키텍처

### 10.1 Vercel 배포 구성

```
Vercel Project: kimchi-agent
  ├── Framework: Next.js 14 (App Router)
  ├── Node.js: 20.x
  └── Build: npm run build

환경변수 (Vercel Dashboard):
  ANTHROPIC_API_KEY
  EMBEDDING_PROVIDER=openai          # Vercel은 Ollama 불가 → OpenAI 사용
  OPENAI_API_KEY
  DATABASE_URL                       # Vercel Postgres 또는 Neon.tech
  BKEND_PROJECT_ID
  BKEND_API_KEY
```

### 10.2 로컬 개발 스택 (Docker Compose)

```yaml
# docker-compose.yml 전체 구성
services:
  postgres:     # pgvector/pgvector:pg16 — 포트 5432
  ollama:       # ollama/ollama:latest — 포트 11434
  # Next.js는 로컬 npm run dev로 실행

로컬 .env.local:
  DATABASE_URL=postgresql://kimchi:kimchi_secret@localhost:5432/kimchi_agent
  EMBEDDING_PROVIDER=local
  OLLAMA_URL=http://localhost:11434
```

### 10.3 Ollama 초기 설정

```bash
# Docker Compose 실행 후
docker compose up -d

# nomic-embed-text 모델 다운로드 (최초 1회, ~274MB)
docker compose exec ollama ollama pull nomic-embed-text

# 정상 동작 확인
curl http://localhost:11434/api/embeddings \
  -d '{"model":"nomic-embed-text","prompt":"테스트"}'
```

### 10.4 Vercel + Neon.tech pgvector

```bash
# Neon.tech 무료 플랜: PostgreSQL + pgvector 지원
# 1. neon.tech에서 프로젝트 생성
# 2. Connection string 복사 → Vercel 환경변수 DATABASE_URL 설정
# 3. pgvector 확장은 PgVectorStore.initialize()가 자동 생성
```

---

## 11. 파일 구조 변경사항

### 11.1 신규 파일 목록 (Phase 3)

```
app/
  api/
    ml/
      predict/route.ts        ← 발효 완성도 예측
      quality/route.ts        ← 품질 등급 예측
    documents/
      route.ts                ← 문서 목록 (GET)
      stats/route.ts          ← 문서 통계 (GET)
    alerts/
      [id]/route.ts           ← 알림 확인 (PATCH)
    health/route.ts           ← 헬스체크

components/
  ml/
    MLPredictionPanel.tsx     ← 예측 결과 패널
    FermentationProgressBar.tsx
    QualityGradeBadge.tsx
    AnomalyAlert.tsx
    RecommendationList.tsx
  layout/
    TabLayout.tsx             ← 탭 레이아웃 컨테이너

hooks/
  useMlPrediction.ts          ← ML 예측 데이터 훅

lib/
  rag/
    vector-store.ts           ← VectorStore 인터페이스
    vector-store-factory.ts   ← pgvector / in-memory 팩토리
    retriever-pg.ts           ← PgVectorStore 구현체
    retriever-memory.ts       ← InMemoryVectorStore (기존 retriever.ts 리팩터)
  ml/
    predictor.ts              ← IPredictor 인터페이스 + 타입
    rule-based-predictor.ts   ← 규칙 기반 예측기
    remote-predictor.ts       ← FastAPI 서버 연동 예측기
    predictor-factory.ts      ← 팩토리
  config/
    validate-env.ts           ← 환경변수 검사

docker-compose.yml            ← pgvector + Ollama 로컬 스택
```

### 11.2 수정 파일 목록

```
lib/rag/embedder.ts           ← LocalEmbedder 클래스 추가 + 팩토리 확장
lib/rag/pipeline.ts           ← VectorStore 인터페이스 사용으로 전환 (async)
lib/rag/retriever.ts          ← InMemoryVectorStore로 래핑 (기존 함수 유지)
lib/ai/system-prompt.ts       ← ML 예측 컨텍스트 주입 지원
lib/process/alert-rules.ts    ← Alert.acknowledged 필드 추가
hooks/useAlerts.ts            ← acknowledgeAlert() 함수 추가
app/page.tsx                  ← 탭 상태 + MLPredictionPanel 통합
components/layout/Header.tsx  ← 탭 스위처 UI 추가
types/index.ts                ← 새 타입 추가 (FermentationPrediction 등)
.env.local.example            ← 환경변수 문서화
```

---

## 12. Sprint 구현 순서

### Sprint 1 — 영속성 인프라 (1주)

**목표**: 서버 재시작 후에도 데이터 유지

1. `docker-compose.yml` 작성 (pgvector + Ollama)
2. `lib/rag/vector-store.ts` — 인터페이스 정의
3. `lib/rag/retriever-memory.ts` — 기존 retriever.ts 리팩터
4. `lib/rag/retriever-pg.ts` — PgVectorStore 구현
5. `lib/rag/vector-store-factory.ts` — 팩토리
6. `lib/rag/pipeline.ts` 수정 — 비동기 VectorStore 사용
7. `GET /api/documents/stats`, `GET /api/documents` 엔드포인트
8. `PATCH /api/alerts/[id]` 엔드포인트
9. `lib/db/bkend.ts` 완전 구현

**검증**: 서버 재시작 후 `/api/documents/stats` 청크 수 유지 확인

### Sprint 2 — 로컬 임베딩 (1주)

**목표**: OPENAI_API_KEY 없이 RAG 동작

1. Ollama Docker 컨테이너 + `nomic-embed-text` 모델 풀
2. `lib/rag/embedder.ts` — `LocalEmbedder` 클래스 추가
3. `getEmbedder()` 팩토리 확장 (`EMBEDDING_PROVIDER=local` 지원)
4. `lib/config/validate-env.ts` 작성
5. `GET /api/health` 엔드포인트 (Ollama 가용성 포함)
6. 차원 불일치 처리 검증 (pgvector ↔ 768dim)

**검증**: `EMBEDDING_PROVIDER=local` 환경에서 문서 업로드 + RAG 검색 동작 확인

### Sprint 3 — ML 예측 (1주)

**목표**: 발효 완성도·품질 등급 예측 API

1. `lib/ml/predictor.ts` — 인터페이스 + 타입 정의
2. `lib/ml/rule-based-predictor.ts` — 규칙 기반 구현
3. `lib/ml/remote-predictor.ts` — FastAPI 폴백
4. `lib/ml/predictor-factory.ts` — 팩토리
5. `POST /api/ml/predict`, `POST /api/ml/quality` 엔드포인트
6. `lib/ai/system-prompt.ts` 수정 — ML 컨텍스트 주입
7. `hooks/useMlPrediction.ts` 훅

**검증**: POST /api/ml/predict 응답 500ms 이내, 발효 완성도 오차 < 10%

### Sprint 4 — 대시보드 통합 + 배포 (1주)

**목표**: 탭 UI + 공장 베타 배포

1. `components/ml/MLPredictionPanel.tsx` + 서브컴포넌트
2. `components/layout/TabLayout.tsx`
3. `app/page.tsx` 수정 — 탭 통합
4. `components/layout/Header.tsx` 탭 스위처
5. Alert.acknowledged UI 연동 (AlertBadge 수정)
6. Vercel 환경변수 설정 + 배포
7. 공장 운영자 베타 테스트 시작

**검증**: 모바일/데스크톱 탭 전환 UX, 베타 만족도 ≥ 4/5

---

## 13. 비기능 요구사항 충족 전략

### NFR-P3-01: ML 예측 응답 < 500ms

- `RuleBasedPredictor`: 순수 JS 계산 → ~1ms
- `RemoteMLPredictor`: AbortSignal.timeout(3000) + 폴백
- 결과 캐싱: 동일 배치ID + 센서 데이터 변화 < 1% 시 캐시 재사용 (30초 TTL)

### NFR-P3-02: pgvector 쿼리 < 100ms

- IVFFlat 인덱스 (lists=100): 100만 벡터에서 ~10ms
- Connection Pool (max=10): 커넥션 오버헤드 최소화
- 쿼리 캐싱: retrieveContext() 동일 쿼리 30초 TTL (Redis 없을 시 Node.js LRU)

### NFR-P3-03: LocalEmbedder 임베딩 < 2초/청크

- Ollama GPU 가속 시: ~50ms/청크
- CPU only: ~500ms/청크 (nomic-embed-text 기준)
- 문서 업로드 시 백그라운드 인제스트: `ingestDocument()`를 응답 반환 후 실행

### NFR-P3-04: Zero downtime 배포 (Vercel)

- Vercel Serverless: 자동 롤링 배포
- pgvector 마이그레이션: `initialize()` 멱등성 보장 (`CREATE IF NOT EXISTS`)
- 환경변수 변경 시 재배포 → 새 함수 인스턴스 자동 적용

---

## 참조 문서

- Plan: `docs/01-plan/features/kimchi-agent-phase3.plan.md`
- Phase 2 Design: `docs/02-design/features/kimchi-agent.design.md`
- Phase 2 Analysis: `docs/03-analysis/kimchi-agent-phase2.analysis.md`
- pgvector 공식 문서: https://github.com/pgvector/pgvector
- Ollama API: https://github.com/ollama/ollama/blob/main/docs/api.md
- nomic-embed-text 모델: https://ollama.com/library/nomic-embed-text

---

*Design document created by Architect Agent — 2026-02-27*
*Phase 3 Sprint 기간: 4주 (Sprint 1~4 각 1주)*
