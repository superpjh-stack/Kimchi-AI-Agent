// F1: RAG 임베더 — 제공자 패턴 (OpenAI | Local | Mock)
// EMBEDDING_PROVIDER=openai (기본) | local | mock
// EMBEDDING_MODEL=text-embedding-3-small (기본)

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
// 팩토리 (싱글턴)
// ──────────────────────────────────────────────

let _provider: EmbeddingProvider | null = null;

export function getEmbedder(): EmbeddingProvider {
  if (_provider) return _provider;

  const mode = process.env.EMBEDDING_PROVIDER ?? 'openai';
  const apiKey = process.env.OPENAI_API_KEY;

  if (mode === 'local') {
    // Lazy import to avoid loading Ollama deps when not needed
    const { LocalEmbedder } = require('./embedder-local') as typeof import('./embedder-local');
    _provider = new LocalEmbedder();
  } else if (mode === 'openai' && apiKey) {
    _provider = new OpenAIEmbedder(apiKey);
  } else {
    if (mode === 'openai' && !apiKey) {
      console.warn('[embedder] OPENAI_API_KEY 없음 — mock embedding 사용');
    }
    _provider = new MockEmbedder();
  }

  console.log(`[embedder] provider=${_provider.name}, dimension=${_provider.dimension}`);
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
