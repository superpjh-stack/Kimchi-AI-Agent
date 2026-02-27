# Design: Kimchi-Agent Phase 4 — 배포 · 테스트 · ML 고도화

**Feature ID**: kimchi-agent-phase4
**Created**: 2026-02-28
**Author**: Architect Agent
**Status**: Draft
**Plan Reference**: `docs/01-plan/features/kimchi-agent-phase4.plan.md`

---

## 목차

1. [시스템 아키텍처 개요](#1-시스템-아키텍처-개요)
2. [Sprint 1: Vercel 배포 아키텍처](#2-sprint-1-vercel-배포-아키텍처)
3. [Sprint 2: Jest 테스트 아키텍처](#3-sprint-2-jest-테스트-아키텍처)
4. [Sprint 4: ML 캐싱 + 모니터링 아키텍처](#4-sprint-4-ml-캐싱--모니터링-아키텍처)
5. [파일 구조 변경사항](#5-파일-구조-변경사항)
6. [환경변수 설계](#6-환경변수-설계)
7. [비기능 요구사항 충족 전략](#7-비기능-요구사항-충족-전략)

---

## 1. 시스템 아키텍처 개요

### 1.1 Phase 3 → Phase 4 변경점 요약

```
Phase 3                              Phase 4
────────────────────────────         ──────────────────────────────────────
로컬 개발 환경만 동작           →    Vercel 프로덕션 배포
Docker pgvector (로컬)          →    Supabase pgvector (관리형 클라우드)
단위 테스트 없음                →    Jest + @testing-library/react
CI/CD 없음                      →    GitHub Actions (lint + tsc + jest)
에러 추적 없음                  →    Sentry (클라이언트 + 서버)
성능 모니터링 없음              →    Vercel Analytics
ML 예측 캐싱 없음               →    Map 기반 TTL 캐시 (30초)
```

### 1.2 전체 아키텍처 다이어그램

```
Internet
  │
  ▼
Vercel Edge Network (CDN)
  │
  ├─ Next.js App Router (서버리스 함수)
  │     │
  │     ├── GET/POST /api/chat          ← RAG + Claude 스트리밍
  │     ├── GET/POST /api/conversations
  │     ├── POST /api/documents/upload
  │     ├── GET  /api/documents/stats
  │     ├── POST /api/ml/predict        ← 예측 (캐시 적용)
  │     ├── POST /api/ml/quality
  │     ├── GET  /api/process/stream    ← 센서 SSE
  │     └── GET  /api/health            ← 헬스체크 (NEW)
  │
  ├─── Supabase pgvector ────────────── 벡터 DB (관리형)
  │     └── DATABASE_URL (환경변수)
  │
  ├─── Anthropic / OpenAI API ───────── AI 스트리밍 + 임베딩
  │
  ├─── Sentry ────────────────────────── 에러 캡처 (클라이언트 + 서버)
  │
  └─── Vercel Analytics ──────────────── 응답시간 추적

GitHub Actions CI
  └── push/PR → lint → tsc → jest → 커버리지 리포트
```

### 1.3 Cold Start 최적화 전략

Vercel 서버리스는 함수가 오래 미사용 시 Cold Start 발생 (NFR-P4-01: < 3초 목표).

```
Cold Start 위험 함수:
  /api/chat           — Claude 클라이언트 초기화
  /api/ml/predict     — ML predictor 초기화

완화 전략:
  1. Dynamic Import 최소화 → 최상위 import 우선
  2. /api/health 엔드포인트 → Vercel Cron으로 3분 간격 워밍업
  3. PgVectorStore 연결 풀 → 전역 싱글턴 유지 (재사용)
  4. Edge Runtime 후보: /api/health → runtime = 'edge' 선언
```

---

## 2. Sprint 1: Vercel 배포 아키텍처

### 2.1 Vercel + Supabase 연결 다이어그램

```
┌─────────────────────────────────────────────────┐
│                  Vercel Project                 │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │  Next.js App Router  (서버리스 런타임)   │   │
│  │                                          │   │
│  │  getVectorStore()                        │   │
│  │    ├── DATABASE_URL 있음?               │   │
│  │    │     └── PgVectorStore(Supabase)     │   │
│  │    └── 없음 → InMemoryVectorStore        │   │
│  └──────────────────────────────────────────┘   │
│                     │                           │
│             DATABASE_URL (환경변수)             │
└─────────────────────┼───────────────────────────┘
                      │ SSL/TLS
                      ▼
┌─────────────────────────────────────────────────┐
│              Supabase (관리형 PostgreSQL)        │
│                                                 │
│  CREATE EXTENSION IF NOT EXISTS vector;         │
│                                                 │
│  TABLE: document_chunks                         │
│    id        SERIAL PRIMARY KEY                 │
│    doc_id    TEXT NOT NULL                      │
│    doc_name  TEXT NOT NULL                      │
│    chunk_idx INTEGER NOT NULL                   │
│    text      TEXT NOT NULL                      │
│    embedding vector(1536)                       │
│    metadata  JSONB                              │
│    created_at TIMESTAMPTZ DEFAULT now()         │
│                                                 │
│  INDEX: HNSW (embedding vector_cosine_ops)      │
└─────────────────────────────────────────────────┘
```

### 2.2 /api/health 엔드포인트 설계

```typescript
// app/api/health/route.ts
export async function GET() {
  const store = await getVectorStore();
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      vectorStore: store.storageType,   // 'pgvector' | 'memory'
      embedding: getEmbedder().name,    // 'openai' | 'local' | 'mock'
      chat: process.env.OPENAI_CHAT_MODEL ?? 'claude-sonnet-4-6',
    },
  });
}
```

### 2.3 docs/05-deploy/ 디렉터리 구조

```
docs/
  05-deploy/
    vercel-setup.md          ← 메인 배포 가이드 (FR-P4-03)
    supabase-setup.md        ← Supabase pgvector 설정
    env-variables.md         ← 환경변수 전체 참조 목록
    troubleshooting.md       ← 자주 발생하는 문제 해결
```

**vercel-setup.md 구조**:
1. 사전 준비 (GitHub 연동, Vercel 계정)
2. Supabase 프로젝트 생성 + pgvector 활성화
3. Vercel 프로젝트 생성 + 환경변수 입력 (순서 명시)
4. 배포 후 `/api/health` 확인 절차
5. 커스텀 도메인 설정 (선택)

### 2.4 Vercel Cron 워밍업 설정

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/health",
      "schedule": "*/3 * * * *"
    }
  ]
}
```

---

## 3. Sprint 2: Jest 테스트 아키텍처

### 3.1 jest.config.ts 설계

```typescript
// jest.config.ts
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',

  // Next.js App Router 호환 — 경로 별칭 해결
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // 커버리지 대상 디렉터리 (NFR-P4-03: ≥ 70%)
  collectCoverageFrom: [
    'lib/rag/embedder.ts',
    'lib/rag/retriever.ts',
    'lib/ml/rule-based-predictor.ts',
    'lib/ml/predictor-factory.ts',
    'lib/ml/prediction-cache.ts',
  ],

  // 테스트 파일 패턴
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],

  // 전역 설정
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],

  // 변환 제외 (Next.js 기본 설정 활용)
  transformIgnorePatterns: [
    '/node_modules/(?!(some-esm-module)/)',
  ],
};

export default createJestConfig(config);
```

### 3.2 jest.setup.ts 설계

```typescript
// jest.setup.ts
// 글로벌 fetch 모킹 (Node.js 환경)
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// 환경변수 기본값 설정 (테스트 격리)
process.env.EMBEDDING_PROVIDER = 'mock';
process.env.DATABASE_URL = '';  // 인메모리 강제
process.env.NODE_ENV = 'test';
```

### 3.3 테스트 파일 구조

```
__tests__/
  lib/
    rag/
      embedder.test.ts          ← FR-P4-06: EmbeddingProvider 팩토리 분기
      retriever.test.ts         ← FR-P4-08: VectorStore 팩토리 분기
    ml/
      rule-based-predictor.test.ts  ← FR-P4-07: Q10 공식, 등급 경계값
      prediction-cache.test.ts      ← 캐시 TTL, 히트율
```

**파일 인접 방식** 대신 `__tests__/` 중앙화 방식 채택 이유:
- `lib/` 디렉터리는 런타임 코드만 포함 (빌드 산출물 명확화)
- CI에서 `--testPathPattern=__tests__` 로 범위 제한 가능
- 커버리지 리포트 경로 일관성 유지

### 3.4 모킹 전략

#### 3.4.1 EmbeddingProvider 모킹

```typescript
// __tests__/lib/rag/embedder.test.ts
describe('getEmbedder() factory', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.EMBEDDING_PROVIDER;
  });

  it('EMBEDDING_PROVIDER=mock → MockEmbedder', async () => {
    process.env.EMBEDDING_PROVIDER = 'mock';
    const { getEmbedder } = await import('@/lib/rag/embedder');
    expect(getEmbedder().name).toBe('mock');
  });

  it('OPENAI_API_KEY 있음 → OpenAIEmbedder', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const { getEmbedder } = await import('@/lib/rag/embedder');
    expect(getEmbedder().name).toBe('openai');
  });

  it('EMBEDDING_PROVIDER=local, DATABASE_URL 없음 → OllamaWithFallback', async () => {
    process.env.EMBEDDING_PROVIDER = 'local';
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    jest.mock('@/lib/rag/embedder-local', () => ({
      LocalEmbedder: jest.fn().mockImplementation(() => ({
        dimension: 768, name: 'local',
        embed: jest.fn(), embedBatch: jest.fn(),
      })),
    }));
    const { getEmbedder } = await import('@/lib/rag/embedder');
    expect(getEmbedder().name).toBe('local');
  });
});
```

#### 3.4.2 VectorStore 팩토리 모킹

```typescript
// __tests__/lib/rag/retriever.test.ts
describe('getVectorStore() factory', () => {
  it('DATABASE_URL 없음 → InMemoryVectorStore', async () => {
    delete process.env.DATABASE_URL;
    const { getVectorStore } = await import('@/lib/rag/retriever');
    const store = await getVectorStore();
    expect(store.storageType).toBe('memory');
  });

  it('DATABASE_URL 있음 → PgVectorStore (연결 실패 시 인메모리 폴백)', async () => {
    process.env.DATABASE_URL = 'postgresql://invalid:5432/test';
    jest.mock('@/lib/rag/retriever-pg', () => ({
      PgVectorStore: jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        storageType: 'pgvector',
      })),
    }));
    const { getVectorStore } = await import('@/lib/rag/retriever');
    const store = await getVectorStore();
    expect(store.storageType).toBe('memory'); // 폴백 확인
  });
});
```

#### 3.4.3 RuleBasedPredictor 경계값 테스트

```typescript
// __tests__/lib/ml/rule-based-predictor.test.ts
describe('RuleBasedPredictor', () => {
  const predictor = new RuleBasedPredictor();

  // Q10 공식 검증
  describe('predictFermentation — Q10 온도 보정', () => {
    it('30°C (기준+10) → tempFactor=2, 발효 속도 2배', async () => {
      const result = await predictor.predictFermentation({
        temperature: 30, fermentationHours: 36, salinity: 2.2, ph: 4.2
      });
      // 36h * 2 = 72h effective → 100%
      expect(result.fermentationPct).toBeCloseTo(1.0, 2);
      expect(result.stage).toBe('complete');
    });

    it('20°C, 18h → mid stage (25% ~ 60%)', async () => {
      const result = await predictor.predictFermentation({
        temperature: 20, fermentationHours: 18, salinity: 2.2, ph: 4.2
      });
      expect(result.fermentationPct).toBeCloseTo(0.25, 2);
      expect(result.stage).toBe('mid');
    });
  });

  // 등급 경계값 테스트 (A/B/C)
  describe('predictQuality — 등급 경계값', () => {
    it('최적값 → 등급 A', async () => {
      const result = await predictor.predictQuality({
        temperature: 20, salinity: 2.2, ph: 4.2
      });
      expect(result.grade).toBe('A');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('온도 경계 (Grade A 최소: 18°C 미만) → 등급 B 이하', async () => {
      const result = await predictor.predictQuality({
        temperature: 17, salinity: 2.2, ph: 4.2
      });
      expect(['B', 'C']).toContain(result.grade);
    });

    it('모든 지표 범위 이탈 → 등급 C', async () => {
      const result = await predictor.predictQuality({
        temperature: 30, salinity: 3.0, ph: 5.5
      });
      expect(result.grade).toBe('C');
    });
  });

  // 이상 감지
  describe('anomaly detection', () => {
    it('온도 9°C (하한 이탈) → anomaly=true', async () => {
      const result = await predictor.predictFermentation({
        temperature: 9, fermentationHours: 10, salinity: 2.0, ph: 4.2
      });
      expect(result.anomaly).toBe(true);
      expect(result.anomalyReason).toMatch(/온도 이상/);
    });
  });
});
```

### 3.5 GitHub Actions CI 워크플로 설계

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests with coverage
        run: npm test -- --coverage --ci
        env:
          EMBEDDING_PROVIDER: mock
          NODE_ENV: test

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
```

**CI 파이프라인 흐름**:
```
git push / PR open
     │
     ▼
GitHub Actions 트리거
     │
     ├─ lint        (npm run lint)    → ESLint 오류 검출
     ├─ type check  (tsc --noEmit)    → TypeScript 타입 오류
     └─ jest        (npm test --ci)   → 단위 테스트 + 커버리지 ≥ 70%
          │
          └─ coverage artifact 저장 → PR 코멘트 (선택)
```

---

## 4. Sprint 4: ML 캐싱 + 모니터링 아키텍처

### 4.1 prediction-cache.ts 설계

**캐시 전략**: Map 기반 TTL 캐시 (서버리스 warm 인스턴스 내 유효)

```typescript
// lib/ml/prediction-cache.ts

interface CacheEntry<T> {
  value: T;
  expiresAt: number;      // Date.now() + TTL_MS
}

export class PredictionCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs = 30_000) {  // 기본 30초
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /** 만료된 항목 수동 정리 (메모리 관리) */
  evictExpired(): number {
    let evicted = 0;
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  get size(): number {
    return this.store.size;
  }
}
```

### 4.2 캐시 키 전략 (sensors 해시)

ML 예측은 `SensorData` 객체를 입력으로 받는다. 캐시 키는 입력값의 결정론적 해시로 생성한다.

```typescript
// lib/ml/prediction-cache.ts (캐시 키 유틸)
export function buildCacheKey(sensors: {
  temperature: number;
  fermentationHours: number;
  salinity: number;
  ph: number;
}): string {
  // 소수점 1자리로 정규화 → 미세 센서 노이즈 흡수
  const t = sensors.temperature.toFixed(1);
  const h = sensors.fermentationHours.toFixed(0);
  const s = sensors.salinity.toFixed(2);
  const p = sensors.ph.toFixed(2);
  return `pred:${t}:${h}:${s}:${p}`;
}

export function buildQualityCacheKey(input: {
  temperature: number;
  salinity: number;
  ph: number;
}): string {
  const t = input.temperature.toFixed(1);
  const s = input.salinity.toFixed(2);
  const p = input.ph.toFixed(2);
  return `qual:${t}:${s}:${p}`;
}
```

**캐시 적용 위치** — `app/api/ml/predict/route.ts`:

```
요청 → buildCacheKey(sensors)
         │
         ├─ 캐시 히트? → 즉시 반환 (< 10ms 목표)
         │
         └─ 캐시 미스 → RuleBasedPredictor.predictFermentation()
                          └─ 결과 캐시 저장 (TTL 30초)
                          └─ 응답 반환 (< 2초 목표)
```

**서버리스 캐시 수명**:
- Vercel 서버리스: 함수 인스턴스 warm 유지 시 캐시 유효 (보통 수분~수십분)
- Cold Start 후 캐시 리셋 → 허용 (NFR-P4-02: 80% 히트율은 warm 상태 기준)

### 4.3 Sentry SDK 설정

#### 4.3.1 클라이언트 설정

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // 프로덕션에서만 에러 전송 (개발 콘솔 노이즈 방지)
  enabled: process.env.NODE_ENV === 'production',

  // 샘플링 — 트랜잭션 10%, 에러 100%
  tracesSampleRate: 0.1,
  sampleRate: 1.0,

  // 사용자 PII 최소화
  beforeSend(event) {
    delete event.user?.email;
    delete event.user?.ip_address;
    return event;
  },
});
```

#### 4.3.2 서버 설정

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',

  // API 라우트 트랜잭션 추적
  tracesSampleRate: 0.2,

  // 민감 헤더 필터링
  beforeSendTransaction(event) {
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});
```

#### 4.3.3 Sentry Next.js 통합 (next.config.js 래핑)

```javascript
// next.config.js
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  // 기존 Next.js 설정
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,              // 빌드 로그 최소화
  widenClientFileUpload: true,
  hideSourceMaps: true,      // 소스맵 클라이언트 노출 방지
  disableLogger: true,
});
```

### 4.4 Vercel Analytics 연동

```typescript
// app/layout.tsx 추가
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />           {/* 페이지 뷰 + 이벤트 추적 */}
        <SpeedInsights />       {/* Core Web Vitals 추적 */}
      </body>
    </html>
  );
}
```

**추적 메트릭**:
- `/api/chat` 응답 시간 (P50, P95)
- `/api/ml/predict` 캐시 히트/미스 비율
- 페이지 로드 LCP, FID, CLS

---

## 5. 파일 구조 변경사항

### 5.1 신규 추가 파일

```
kimchi-agent/
├── .github/
│   └── workflows/
│       └── ci.yml                          ← GitHub Actions CI (FR-P4-09)
│
├── __tests__/
│   └── lib/
│       ├── rag/
│       │   ├── embedder.test.ts            ← FR-P4-06
│       │   └── retriever.test.ts           ← FR-P4-08
│       └── ml/
│           ├── rule-based-predictor.test.ts ← FR-P4-07
│           └── prediction-cache.test.ts    ← 캐시 단위 테스트
│
├── app/
│   └── api/
│       └── health/
│           └── route.ts                    ← FR-P4-04 헬스체크 (NEW)
│
├── lib/
│   └── ml/
│       └── prediction-cache.ts             ← FR-P4-14 캐시 (NEW)
│
├── sentry.client.config.ts                 ← FR-P4-17 Sentry 클라이언트
├── sentry.server.config.ts                 ← FR-P4-17 Sentry 서버
├── sentry.edge.config.ts                   ← FR-P4-17 Sentry Edge
├── jest.config.ts                          ← FR-P4-05
├── jest.setup.ts                           ← FR-P4-05
├── vercel.json                             ← Cron 워밍업 설정
│
└── docs/
    └── 05-deploy/                          ← 신규 디렉터리
        ├── vercel-setup.md                 ← FR-P4-03 메인 가이드
        ├── supabase-setup.md
        ├── env-variables.md
        └── troubleshooting.md
```

### 5.2 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/layout.tsx` | Vercel Analytics + SpeedInsights 추가 |
| `app/api/ml/predict/route.ts` | PredictionCache 적용 |
| `app/api/ml/quality/route.ts` | PredictionCache 적용 |
| `next.config.js` | withSentryConfig 래핑 |
| `package.json` | jest, @sentry/nextjs, @vercel/analytics 의존성 추가 |

---

## 6. 환경변수 설계

### 6.1 필수 환경변수

| 변수명 | 설명 | 예시값 |
|--------|------|--------|
| `ANTHROPIC_API_KEY` | Claude API 키 | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI API 키 (임베딩) | `sk-...` |
| `DATABASE_URL` | Supabase pgvector 연결 문자열 | `postgresql://user:pass@db.supabase.co:5432/postgres` |

### 6.2 선택 환경변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `EMBEDDING_PROVIDER` | 임베딩 제공자 | 자동 감지 |
| `EMBEDDING_MODEL` | OpenAI 임베딩 모델 | `text-embedding-3-small` |
| `OPENAI_CHAT_MODEL` | Chat 모델 (OpenAI 대체) | Claude 사용 |
| `OLLAMA_BASE_URL` | Ollama 서버 URL | — |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (클라이언트) | — |
| `SENTRY_DSN` | Sentry DSN (서버) | — |
| `SENTRY_ORG` | Sentry 조직 슬러그 | — |
| `SENTRY_PROJECT` | Sentry 프로젝트 슬러그 | — |
| `SENTRY_AUTH_TOKEN` | Sentry 소스맵 업로드 토큰 | — |
| `ML_CACHE_TTL_MS` | ML 캐시 TTL (밀리초) | `30000` |

### 6.3 Vercel 환경변수 입력 순서 (FR-P4-03)

```
1. DATABASE_URL         ← 가장 먼저 (pgvector 초기화 의존)
2. ANTHROPIC_API_KEY    ← Chat 기능 의존
3. OPENAI_API_KEY       ← 임베딩 의존
4. NEXT_PUBLIC_SENTRY_DSN  ← 클라이언트 Sentry (PUBLIC 접두사 필수)
5. SENTRY_DSN           ← 서버 Sentry
6. SENTRY_AUTH_TOKEN    ← 빌드 시 소스맵 업로드
```

---

## 7. 비기능 요구사항 충족 전략

### 7.1 NFR-P4-01: Cold Start < 3초

| 전략 | 구현 |
|------|------|
| Vercel Cron 워밍업 | `vercel.json` cron 3분 간격 `/api/health` 호출 |
| PgVectorStore 연결 풀 재사용 | 모듈 레벨 싱글턴 (`_storeInstance`) — 이미 구현됨 |
| Dynamic Import 최소화 | `retriever-pg.ts` 동적 임포트 → 정적 임포트 검토 |
| Edge Runtime (헬스체크) | `/api/health` → `export const runtime = 'edge'` |

### 7.2 NFR-P4-02: ML 캐시 히트율 ≥ 80%

- 센서 데이터 30초 갱신 주기 (Phase 3 simulator)
- `buildCacheKey()` 소수점 정규화 → 미세 노이즈 흡수 → 히트율 향상
- TTL 30초 = 센서 갱신 주기와 일치 → warm 인스턴스에서 80%+ 기대

### 7.3 NFR-P4-03: 단위 테스트 커버리지 ≥ 70%

| 대상 파일 | 목표 커버리지 | 테스트 케이스 수 |
|---------|-------------|--------------|
| `lib/rag/embedder.ts` | ≥ 80% | 5개 (팩토리 분기 3 + embed 2) |
| `lib/rag/retriever.ts` | ≥ 75% | 4개 (팩토리 분기 2 + 검색 2) |
| `lib/ml/rule-based-predictor.ts` | ≥ 90% | 10개+ (Q10, 등급, 이상감지) |
| `lib/ml/prediction-cache.ts` | ≥ 85% | 5개 (히트, 미스, TTL, 정리) |

### 7.4 NFR-P4-04: 베타 테스트 만족도 ≥ 4/5

Sprint 3 전담 (architect 설계 범위 외). 피드백 수집 → `data/fermentation/` 저장 → Sprint 4 ML 파라미터 보정으로 연결.

---

## 부록: 기술 리스크 완화 상세

### R-04: Jest + Next.js App Router 호환

**문제**: Next.js App Router는 ESM 전용 모듈이 다수. Jest는 기본 CommonJS.

**완화**:
```typescript
// jest.config.ts에서 next/jest 래퍼 사용
const createJestConfig = nextJest({ dir: './' });
// → next/jest가 자동으로 transformIgnorePatterns, moduleNameMapper 처리
```

**주의사항**:
- `server-only` 패키지 → `jest.setup.ts`에서 모킹 필요
- `next/headers`, `next/cookies` → 테스트 환경에서 `jest.mock()` 필요
- 실제 DB 연결 테스트는 `DATABASE_URL=''` 설정으로 인메모리 강제

---

*Design created by Architect Agent — 2026-02-28*
