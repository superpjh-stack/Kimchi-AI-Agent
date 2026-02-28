// B9: RAG 리트리버 — 인메모리 벡터 스토어 + 코사인 유사도 검색

import type { Chunk } from './chunker';
import type { DocumentSource } from '@/types';
import { getEmbedder } from './embedder';
import { createLogger } from '@/lib/logger';

const log = createLogger('rag.retriever');

export interface StoredEntry {
  vector: number[];
  chunk: Chunk;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

// ──────────────────────────────────────────────
// VectorStore 인터페이스 — memory / pgvector 전환용
// ──────────────────────────────────────────────

export interface VectorStore {
  readonly storageType: 'memory' | 'pgvector';
  addDocuments(chunks: Chunk[], vectors: number[][]): void | Promise<void>;
  search(queryVector: number[], options?: { topK?: number; threshold?: number }): SearchResult[] | Promise<SearchResult[]>;
  removeDocument(docId: string): void | Promise<void>;
  getStoreSize(): number | Promise<number>;
  getChunkByKey(key: string): StoredEntry | undefined | Promise<StoredEntry | undefined>;
  getDocumentStats(): DocumentStats | Promise<DocumentStats>;
}

// Module-level in-memory vector store.
// Note: resets on server restart — acceptable for MVP.
const vectorStore = new Map<string, StoredEntry>();

/**
 * Compute cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1]; higher means more similar.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;
  return dot / magnitude;
}

/**
 * Add chunks and their corresponding embedding vectors to the store.
 * Each chunk gets a unique key: `${docId}::${chunkIndex}`.
 */
export function addDocuments(chunks: Chunk[], vectors: number[][]): void {
  if (chunks.length !== vectors.length) {
    throw new Error('chunks and vectors arrays must have the same length');
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const key = `${chunk.metadata.docId}::${chunk.index}`;
    vectorStore.set(key, { vector: vectors[i], chunk });
  }
}

/**
 * Search the vector store for the most similar chunks to a query vector.
 *
 * @param queryVector  Embedding of the user's query
 * @param options.topK        Maximum number of results to return (default 5)
 * @param options.threshold   Minimum cosine similarity score (default 0.7)
 */
export function search(
  queryVector: number[],
  options: { topK?: number; threshold?: number } = {}
): SearchResult[] {
  const topK = options.topK ?? 5;
  const threshold = options.threshold ?? 0.3;

  const scored: SearchResult[] = [];

  for (const entry of vectorStore.values()) {
    const score = cosineSimilarity(queryVector, entry.vector);
    if (score >= threshold) {
      scored.push({ chunk: entry.chunk, score });
    }
  }

  // Sort descending by score, return top K
  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Convert a SearchResult to a DocumentSource for SSE / API responses.
 */
export function toDocumentSource(result: SearchResult): DocumentSource {
  return {
    docId: result.chunk.metadata.docId,
    docName: result.chunk.metadata.docName,
    chunkText: result.chunk.text,
    score: result.score,
  };
}

/**
 * Remove all chunks belonging to a specific document.
 */
export function removeDocument(docId: string): void {
  for (const key of vectorStore.keys()) {
    if (key.startsWith(`${docId}::`)) {
      vectorStore.delete(key);
    }
  }
}

/**
 * Return the total number of stored chunks.
 */
export function getStoreSize(): number {
  return vectorStore.size;
}

/**
 * Look up a stored entry by its key (`${docId}::${chunkIndex}`).
 * Used by hybrid search in pipeline.ts.
 */
export function getChunkByKey(key: string): StoredEntry | undefined {
  return vectorStore.get(key);
}

export interface DocumentStats {
  total: number;
  byType: Record<string, number>;
  totalChunks: number;
  storageType: 'memory' | 'pgvector';
}

/**
 * Aggregate statistics from the in-memory vector store.
 */
export function getDocumentStats(): DocumentStats {
  const docIds = new Set<string>();
  const byType: Record<string, number> = {};

  for (const entry of vectorStore.values()) {
    const { docId, docName } = entry.chunk.metadata;
    if (!docIds.has(docId)) {
      docIds.add(docId);
      const ext = (docName.split('.').pop() ?? 'unknown').toLowerCase();
      byType[ext] = (byType[ext] ?? 0) + 1;
    }
  }

  return {
    total: docIds.size,
    byType,
    totalChunks: vectorStore.size,
    storageType: 'memory',
  };
}

// ──────────────────────────────────────────────
// InMemoryVectorStore — 기존 모듈 레벨 함수 래핑
// ──────────────────────────────────────────────

export class InMemoryVectorStore implements VectorStore {
  readonly storageType = 'memory' as const;
  // S4-8: 최대 청크 수 제한 — 인메모리 누수 방지
  private readonly maxChunks = 10_000;

  addDocuments(chunks: Chunk[], vectors: number[][]): void {
    addDocuments(chunks, vectors);
    // S4-8: 최대 청크 수 초과 시 가장 오래된 항목 제거
    if (vectorStore.size > this.maxChunks) {
      const keysToDelete = [...vectorStore.keys()].slice(0, vectorStore.size - this.maxChunks);
      for (const key of keysToDelete) {
        vectorStore.delete(key);
      }
      log.warn({ removed: keysToDelete.length, remaining: vectorStore.size }, 'VectorStore: 최대 청크 수 초과, 오래된 항목 제거');
    }
  }

  search(queryVector: number[], options?: { topK?: number; threshold?: number }): SearchResult[] {
    return search(queryVector, options);
  }

  removeDocument(docId: string): void {
    removeDocument(docId);
  }

  getStoreSize(): number {
    return getStoreSize();
  }

  getChunkByKey(key: string): StoredEntry | undefined {
    return getChunkByKey(key);
  }

  getDocumentStats(): DocumentStats {
    return getDocumentStats();
  }
}

// ──────────────────────────────────────────────
// getVectorStore() — 환경 변수 기반 싱글톤 팩토리
// DATABASE_URL 설정 시 pgvector, 미설정 시 인메모리
// ──────────────────────────────────────────────

let _storeInstance: VectorStore | null = null;
let _storeInitPromise: Promise<VectorStore> | null = null;

export async function getVectorStore(): Promise<VectorStore> {
  if (_storeInstance) return _storeInstance;
  if (_storeInitPromise) return _storeInitPromise;

  _storeInitPromise = (async (): Promise<VectorStore> => {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        const { PgVectorStore } = await import('./retriever-pg');
        const embedder = getEmbedder();
        const store = new PgVectorStore(dbUrl, embedder.dimension);
        await store.initialize();
        _storeInstance = store;
        log.info({ dimension: embedder.dimension, embedder: embedder.name }, 'VectorStore: pgvector initialized');
      } catch (err) {
        // Docker 미실행 등 연결 실패 시 인메모리로 폴백
        log.warn({ err: err instanceof Error ? err.message : err }, 'VectorStore: pgvector 연결 실패, 인메모리로 폴백');
        _storeInstance = new InMemoryVectorStore();
        log.info('VectorStore: Using in-memory backend (fallback)');
      }
    } else {
      _storeInstance = new InMemoryVectorStore();
      log.info('VectorStore: Using in-memory backend');
    }
    return _storeInstance!;
  })();

  return _storeInitPromise;
}
