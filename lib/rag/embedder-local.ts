// Phase 3: LocalEmbedder — Ollama REST API (nomic-embed-text, 768차원)

import type { EmbeddingProvider } from './embedder';

const LOCAL_EMBEDDING_DIMENSION = 768;
const DEFAULT_MODEL = 'nomic-embed-text';
const BATCH_SIZE = 32;

export class LocalEmbedder implements EmbeddingProvider {
  readonly dimension = LOCAL_EMBEDDING_DIMENSION;
  readonly name = 'local';
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.baseUrl = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/+$/, '');
    this.model = process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULT_MODEL;
  }

  async embed(text: string): Promise<number[]> {
    return this.callOllama(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((t) => this.callOllama(t)));
      results.push(...batchResults);
    }
    return results;
  }

  private async callOllama(text: string): Promise<number[]> {
    const url = `${this.baseUrl}/api/embeddings`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama embedding API ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { embedding: number[] };

    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
      throw new Error('Ollama returned empty embedding');
    }

    return data.embedding;
  }
}
