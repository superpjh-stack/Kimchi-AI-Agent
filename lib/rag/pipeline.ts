// F2: RAG 파이프라인 — Hybrid Search (Vector + BM25) + RRF 융합

import { chunkText } from './chunker';
import { embed, embedBatch } from './embedder';
import { addDocuments, search, toDocumentSource, removeDocument, getChunkByKey } from './retriever';
import { bm25Index } from './bm25';
import type { DocumentSource, ChunkingOptions } from '@/types';

export interface RAGResult {
  context: string;
  sources: DocumentSource[];
}

// ──────────────────────────────────────────────
// Reciprocal Rank Fusion
// RRF(d) = Σ 1/(k + rank_i(d)),  k=60 (Cormack et al. 2009)
// ──────────────────────────────────────────────

function reciprocalRankFusion(rankedLists: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((key, rank) => {
      scores.set(key, (scores.get(key) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
}

// ──────────────────────────────────────────────
// Hybrid Search — retrieveContext
// ──────────────────────────────────────────────

/**
 * Retrieve relevant context for a user query using hybrid search.
 *
 * 1. Vector search (semantic, top 10)
 * 2. BM25 keyword search (lexical, top 10)
 * 3. Reciprocal Rank Fusion → top 5
 */
export async function retrieveContext(query: string): Promise<RAGResult> {
  // 1. 벡터 검색 (시맨틱) — threshold 낮춰서 후보 확대 후 RRF가 재정렬
  const queryVector = await embed(query);
  const vectorResults = search(queryVector, { topK: 10, threshold: 0.3 });

  // 2. BM25 키워드 검색 (어휘)
  const bm25Results = bm25Index.search(query, 10);

  // 3. RRF 융합
  const vectorKeys = vectorResults.map(
    (r) => `${r.chunk.metadata.docId}::${r.chunk.index}`
  );
  const bm25Keys = bm25Results.map((r) => r.key);
  const fusedKeys = reciprocalRankFusion([vectorKeys, bm25Keys]);

  // 4. 키 → 청크 조회, 최대 5개 반환
  const topChunks: DocumentSource[] = [];
  for (const key of fusedKeys) {
    if (topChunks.length >= 5) break;

    // 벡터 결과에서 먼저 찾기
    const vectorHit = vectorResults.find(
      (r) => `${r.chunk.metadata.docId}::${r.chunk.index}` === key
    );
    if (vectorHit) {
      topChunks.push(toDocumentSource(vectorHit));
      continue;
    }

    // 벡터 결과에 없으면 스토어에서 직접 조회 (BM25 전용 히트)
    const stored = getChunkByKey(key);
    if (stored) {
      topChunks.push(toDocumentSource({ chunk: stored.chunk, score: 0 }));
    }
  }

  // 벡터/BM25 모두 결과 없을 때 벡터 결과만 폴백 (기존 동작 유지)
  if (topChunks.length === 0 && vectorResults.length > 0) {
    topChunks.push(...vectorResults.slice(0, 5).map(toDocumentSource));
  }

  if (topChunks.length === 0) {
    return { context: '', sources: [] };
  }

  const contextLines = topChunks.map(
    (s, i) => `[출처 ${i + 1}: ${s.docName}]\n${s.chunkText}`
  );

  return {
    context: contextLines.join('\n\n---\n\n'),
    sources: topChunks,
  };
}

// ──────────────────────────────────────────────
// Ingest — 벡터 + BM25 동시 인덱싱
// ──────────────────────────────────────────────

/**
 * Ingest a document into both the vector store and BM25 index.
 * @returns Number of chunks created
 */
export async function ingestDocument(
  text: string,
  docId: string,
  docName: string,
  chunkingOptions?: ChunkingOptions
): Promise<number> {
  const chunks = chunkText(text, docId, docName, chunkingOptions);
  if (chunks.length === 0) return 0;

  // 벡터 임베딩
  const vectors = await embedBatch(chunks.map((c) => c.text));
  addDocuments(chunks, vectors);

  // BM25 인덱싱
  for (const chunk of chunks) {
    const key = `${chunk.metadata.docId}::${chunk.index}`;
    bm25Index.add(key, chunk.text);
  }

  return chunks.length;
}

// ──────────────────────────────────────────────
// 문서 삭제 — 벡터 + BM25 동시 제거
// ──────────────────────────────────────────────

/**
 * Remove a document from both vector store and BM25 index.
 */
export function removeDocumentFull(docId: string): void {
  removeDocument(docId);
  bm25Index.remove(docId);
}
