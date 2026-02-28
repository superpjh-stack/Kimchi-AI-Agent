// F1: RAG 임베더 — 제공자 패턴 (OpenAI | Local | Mock)
// EMBEDDING_PROVIDER=openai (기본) | local | mock
// EMBEDDING_MODEL=text-embedding-3-small (기본)

import { createLogger } from '@/lib/logger';

const log = createLogger('rag.embedder');

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_DIMENSION = 1536;

// ──────────────────────────────────────────────
// 제공자 인터페이스
// ──────────────────────────────────────────────

export interface EmbeddingProvider {
  readonly dimension: number;
  readonly name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

// ──────────────────────────────────────────────
// Mock 임베더 (OPENAI_API_KEY 없을 때 폴백)
// ──────────────────────────────────────────────

function mockEmbed(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSION).fill(0);
  for (let i = 0; i < text.length; i++) {
    vector[i % EMBEDDING_DIMENSION] += text.charCodeAt(i);
  }
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / magnitude);
}

class MockEmbedder implements EmbeddingProvider {
  readonly dimension = EMBEDDING_DIMENSION;
  readonly name = 'mock';

  embed(text: string): Promise<number[]> {
    return Promise.resolve(mockEmbed(text));
  }

  embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(mockEmbed));
  }
}

// ──────────────────────────────────────────────
// OpenAI 임베더
// ──────────────────────────────────────────────

class OpenAIEmbedder implements EmbeddingProvider {
  readonly dimension = EMBEDDING_DIMENSION;
  readonly name = 'openai';
  private readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.callApi([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const BATCH_SIZE = 100;
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = await this.callApi(texts.slice(i, i + BATCH_SIZE));
      results.push(...batch);
    }
    return results;
  }

  private async callApi(texts: string[]): Promise<number[][]> {
    const res = await fetch(OPENAI_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI embedding API ${res.status}: ${body}`);
    }

    const data = (await res.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
    };
    return [...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

// ──────────────────────────────────────────────
// OllamaWithFallback — 인메모리 전용 (pgvector 사용 시 비활성)
// Ollama 호출 실패 시 MockEmbedder로 자동 폴백
// ──────────────────────────────────────────────

class OllamaWithFallback implements EmbeddingProvider {
  private readonly primary: EmbeddingProvider;
  private readonly fallback: MockEmbedder;
  private useFallback = false;

  get dimension(): number {
    return this.useFallback ? this.fallback.dimension : this.primary.dimension;
  }
  get name(): string {
    return this.useFallback ? 'mock (ollama-fallback)' : 'local';
  }

  constructor() {
    const { LocalEmbedder } = require('./embedder-local') as typeof import('./embedder-local');
    this.primary = new LocalEmbedder();
    this.fallback = new MockEmbedder();
  }

  async embed(text: string): Promise<number[]> {
    if (this.useFallback) return this.fallback.embed(text);
    try {
      return await this.primary.embed(text);
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err }, 'Ollama 연결 실패, mock 폴백');
      this.useFallback = true;
      return this.fallback.embed(text);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.useFallback) return this.fallback.embedBatch(texts);
    try {
      return await this.primary.embedBatch(texts);
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err }, 'Ollama 연결 실패, mock 폴백');
      this.useFallback = true;
      return this.fallback.embedBatch(texts);
    }
  }
}

// ──────────────────────────────────────────────
// 팩토리 (싱글턴) — 우선순위: OpenAI → Ollama → Mock
// EMBEDDING_PROVIDER 미설정 시 자동 감지
// ──────────────────────────────────────────────

let _provider: EmbeddingProvider | null = null;

/** OLLAMA_BASE_URL 또는 OLLAMA_URL이 설정되어 있는지 확인 */
function isOllamaConfigured(): boolean {
  return !!(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL);
}

export function getEmbedder(): EmbeddingProvider {
  if (_provider) return _provider;

  const mode = process.env.EMBEDDING_PROVIDER; // undefined = 자동 감지
  const apiKey = process.env.OPENAI_API_KEY;
  const usePgvector = !!process.env.DATABASE_URL;

  // ── 명시적 선택 ──
  if (mode === 'local') {
    // pgvector 사용 시: Ollama 실패 → 에러 throw (차원 정합성 보장)
    // 인메모리 사용 시: Ollama 실패 → Mock 폴백 허용
    const { LocalEmbedder } = require('./embedder-local') as typeof import('./embedder-local');
    _provider = usePgvector ? new LocalEmbedder() : new OllamaWithFallback();
  } else if (mode === 'openai' && apiKey) {
    _provider = new OpenAIEmbedder(apiKey);
  } else if (mode === 'mock') {
    _provider = new MockEmbedder();
  }
  // ── 자동 감지 (EMBEDDING_PROVIDER 미설정 또는 openai인데 키 없음) ──
  else if (apiKey) {
    _provider = new OpenAIEmbedder(apiKey);
  } else if (isOllamaConfigured()) {
    log.info('OPENAI_API_KEY 없음 → Ollama 임베더 시도');
    const { LocalEmbedder } = require('./embedder-local') as typeof import('./embedder-local');
    _provider = usePgvector ? new LocalEmbedder() : new OllamaWithFallback();
  } else {
    if (mode === 'openai') {
      log.warn('OPENAI_API_KEY 없음, Ollama 미설정 → mock embedding 사용');
    }
    _provider = new MockEmbedder();
  }

  log.info({ provider: _provider.name, dimension: _provider.dimension }, 'Embedder initialized');
  return _provider;
}

// ──────────────────────────────────────────────
// 하위 호환 exports (pipeline.ts 등 기존 코드 수정 없음)
// ──────────────────────────────────────────────

export async function embed(text: string): Promise<number[]> {
  return getEmbedder().embed(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return getEmbedder().embedBatch(texts);
}
