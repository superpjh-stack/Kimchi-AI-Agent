// __tests__/lib/rag/retriever.test.ts
// InMemoryVectorStore: addDocuments, search, removeDocument, stats

import {
  addDocuments,
  search,
  removeDocument,
  getStoreSize,
  getDocumentStats,
  InMemoryVectorStore,
} from '@/lib/rag/retriever';
import type { Chunk } from '@/lib/rag/chunker';

function makeChunk(docId: string, index: number, text = `청크 ${index}`): Chunk {
  return {
    text,
    index,
    metadata: {
      docId,
      docName: `${docId}.txt`,
    },
  };
}

// ──────────────────────────────────────────────
// addDocuments / getStoreSize
// ──────────────────────────────────────────────

describe('addDocuments & getStoreSize', () => {
  const DOC = 'retriever-add-test';

  afterEach(() => removeDocument(DOC));

  it('청크 3개 추가 후 storeSize 증가', () => {
    const before = getStoreSize();
    const chunks = [0, 1, 2].map((i) => makeChunk(DOC, i));
    const vectors = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];
    addDocuments(chunks, vectors);
    expect(getStoreSize()).toBe(before + 3);
  });

  it('chunks/vectors 길이 불일치 → 에러', () => {
    const chunks = [makeChunk(DOC, 0)];
    expect(() => addDocuments(chunks, [])).toThrow();
  });
});

// ──────────────────────────────────────────────
// search — 코사인 유사도
// ──────────────────────────────────────────────

describe('search', () => {
  const DOC = 'retriever-search-test';

  const v0: number[] = [1, 0, 0, 0];
  const v1: number[] = [0, 1, 0, 0];
  const v2: number[] = [0, 0, 1, 0];

  beforeEach(() => {
    addDocuments(
      [0, 1, 2].map((i) => makeChunk(DOC, i, `텍스트 ${i}`)),
      [v0, v1, v2],
    );
  });

  afterEach(() => removeDocument(DOC));

  it('쿼리 벡터와 완전 일치 → score=1.0', () => {
    const results = search(v0, { threshold: 0.9 });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].score).toBeCloseTo(1.0, 5);
    expect(results[0].chunk.index).toBe(0);
  });

  it('topK=1 → 결과 최대 1개 반환', () => {
    const results = search(v0, { topK: 1, threshold: 0 });
    expect(results.length).toBe(1);
  });

  it('결과는 score 내림차순 정렬', () => {
    const query = [0.9, 0.1, 0, 0];
    const mag = Math.sqrt(query.reduce((s, x) => s + x * x, 0));
    const qNorm = query.map((x) => x / mag);
    const results = search(qNorm, { topK: 3, threshold: 0 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});

// ──────────────────────────────────────────────
// removeDocument
// ──────────────────────────────────────────────

describe('removeDocument', () => {
  const DOC_A = 'retriever-remove-a';
  const DOC_B = 'retriever-remove-b';

  afterEach(() => {
    removeDocument(DOC_A);
    removeDocument(DOC_B);
  });

  it('문서 제거 후 storeSize 감소', () => {
    addDocuments([makeChunk(DOC_A, 0)], [[1, 0, 0, 0]]);
    const before = getStoreSize();
    removeDocument(DOC_A);
    expect(getStoreSize()).toBe(before - 1);
  });

  it('다른 문서 청크는 영향 없음', () => {
    addDocuments([makeChunk(DOC_A, 0)], [[1, 0, 0, 0]]);
    addDocuments([makeChunk(DOC_B, 0)], [[0, 1, 0, 0]]);
    const before = getStoreSize();
    removeDocument(DOC_A);
    expect(getStoreSize()).toBe(before - 1);
    const results = search([0, 1, 0, 0], { threshold: 0.9 });
    expect(results.some((r) => r.chunk.metadata.docId === DOC_B)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// getDocumentStats
// ──────────────────────────────────────────────

describe('getDocumentStats', () => {
  const DOC = 'retriever-stats-test';

  afterEach(() => removeDocument(DOC));

  it('추가된 청크 수 반영', () => {
    const before = getDocumentStats();
    addDocuments(
      [0, 1].map((i) => makeChunk(DOC, i)),
      [[1, 0], [0, 1]],
    );
    const stats = getDocumentStats();
    expect(stats.totalChunks).toBe(before.totalChunks + 2);
  });

  it('storageType = "memory"', () => {
    expect(getDocumentStats().storageType).toBe('memory');
  });

  it('byType 파일 확장자 카운트', () => {
    addDocuments([makeChunk(DOC, 0)], [[1, 0]]);
    expect(getDocumentStats().byType['txt']).toBeGreaterThanOrEqual(1);
  });
});

// ──────────────────────────────────────────────
// InMemoryVectorStore class
// ──────────────────────────────────────────────

describe('InMemoryVectorStore (class wrapper)', () => {
  const DOC = 'retriever-class-test';
  const store = new InMemoryVectorStore();

  afterEach(() => store.removeDocument(DOC));

  it('storageType = "memory"', () => {
    expect(store.storageType).toBe('memory');
  });

  it('addDocuments → search → removeDocument 통합 흐름', () => {
    store.addDocuments([makeChunk(DOC, 0, '발효 완성도')], [[1, 0, 0, 0]]);
    const results = store.search([1, 0, 0, 0], { topK: 1, threshold: 0.9 });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].chunk.metadata.docId).toBe(DOC);
    store.removeDocument(DOC);
    const after = store.search([1, 0, 0, 0], { topK: 1, threshold: 0.9 });
    expect(after.every((r) => r.chunk.metadata.docId !== DOC)).toBe(true);
  });
});
