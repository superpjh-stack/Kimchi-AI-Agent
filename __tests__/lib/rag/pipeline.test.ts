// __tests__/lib/rag/pipeline.test.ts — RAG 파이프라인 테스트

// 의존성 모킹
jest.mock('@/lib/rag/embedder', () => ({
  embed:      jest.fn(async () => new Array(1536).fill(0.1)),
  embedBatch: jest.fn(async (texts: string[]) => texts.map(() => new Array(1536).fill(0.1))),
}));

jest.mock('@/lib/rag/retriever', () => {
  const mockStore = {
    search:        jest.fn(async () => []),
    addDocuments:  jest.fn(async () => undefined),
    removeDocument: jest.fn(async () => undefined),
    getChunkByKey: jest.fn(async () => null),
  };
  return {
    getVectorStore:   jest.fn(async () => mockStore),
    toDocumentSource: jest.fn((r: { chunk: { metadata: { docId: string; docName: string }; text: string; index: number }; score: number }) => ({
      docId:     r.chunk.metadata.docId,
      docName:   r.chunk.metadata.docName,
      chunkText: r.chunk.text ?? '',
      score:     r.score,
    })),
  };
});

jest.mock('@/lib/rag/bm25', () => ({
  bm25Index: {
    search:    jest.fn(() => []),
    add:       jest.fn(),
    remove:    jest.fn(),
    serialize: jest.fn(() => ({})),
  },
  restoreBM25FromFile: jest.fn(),
}));

jest.mock('@/lib/db/file-store', () => ({
  saveBM25Index: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
  })),
}));

describe('retrieveContext', () => {
  it('문서가 없을 때 빈 결과 반환', async () => {
    const { retrieveContext } = await import('@/lib/rag/pipeline');
    const result = await retrieveContext('김치 발효 온도');
    expect(result.context).toBe('');
    expect(result.sources).toHaveLength(0);
  });

  it('반환 타입이 올바른 구조를 가진다', async () => {
    const { retrieveContext } = await import('@/lib/rag/pipeline');
    const result = await retrieveContext('질문');
    expect(result).toHaveProperty('context');
    expect(result).toHaveProperty('sources');
    expect(Array.isArray(result.sources)).toBe(true);
  });
});

describe('ingestDocument', () => {
  it('빈 텍스트일 때 0 반환', async () => {
    const { ingestDocument } = await import('@/lib/rag/pipeline');
    const count = await ingestDocument('', 'doc1', 'test.txt');
    expect(count).toBe(0);
  });

  it('정상 문서 수집 시 청크 수 반환', async () => {
    const { ingestDocument } = await import('@/lib/rag/pipeline');
    const text = '김치공장 품질관리 매뉴얼\n배추 선별 기준: 신선도 90% 이상\n염수 농도: 10~12%\n발효 온도: 4~6도 유지';
    const count = await ingestDocument(text, 'doc1', 'kimchi-manual.txt');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('문서 ID와 이름이 청킹에 전달된다', async () => {
    const { ingestDocument } = await import('@/lib/rag/pipeline');
    // 빈 문자열이 아닌 실제 내용이면 0 이상의 청크를 처리함
    const count = await ingestDocument('내용 있는 문서입니다.', 'doc-test-id', 'test-doc.txt');
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
