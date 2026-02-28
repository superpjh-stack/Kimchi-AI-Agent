// __tests__/lib/rag/chunker.test.ts — 청킹 전략 테스트

import { chunkText, CHUNKING_STRATEGIES } from '@/lib/rag/chunker';

const DOC_ID   = 'test-doc';
const DOC_NAME = 'test.txt';

describe('chunkText — recursive (기본)', () => {
  it('빈 텍스트는 빈 배열 반환', () => {
    const chunks = chunkText('', DOC_ID, DOC_NAME);
    expect(chunks).toHaveLength(0);
  });

  it('짧은 텍스트는 단일 청크로 반환', () => {
    const text = '짧은 내용입니다.';
    const chunks = chunkText(text, DOC_ID, DOC_NAME);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('짧은 내용');
  });

  it('청크에 docId와 docName 메타데이터가 포함된다', () => {
    const chunks = chunkText('테스트 내용', DOC_ID, DOC_NAME);
    expect(chunks[0].metadata.docId).toBe(DOC_ID);
    expect(chunks[0].metadata.docName).toBe(DOC_NAME);
  });

  it('chunkSize 옵션이 반영된다', () => {
    const text = 'a'.repeat(500);
    const chunks = chunkText(text, DOC_ID, DOC_NAME, { method: 'fixed', chunkSize: 100, chunkOverlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(100);
    }
  });
});

describe('chunkText — fixed', () => {
  it('고정 크기로 분할한다', () => {
    const text = 'X'.repeat(250);
    const chunks = chunkText(text, DOC_ID, DOC_NAME, { method: 'fixed', chunkSize: 100, chunkOverlap: 0 });
    expect(chunks.length).toBe(3);
  });
});

describe('chunkText — paragraph', () => {
  it('빈 줄을 기준으로 분할한다', () => {
    const text = '문단 1\n\n문단 2\n\n문단 3';
    const chunks = chunkText(text, DOC_ID, DOC_NAME, { method: 'paragraph' });
    expect(chunks.length).toBe(3);
  });
});

describe('chunkText — row', () => {
  it('CSV 형식을 행 단위로 분할하고 헤더를 보존한다', () => {
    const rows = ['col1,col2,col3'];
    for (let i = 1; i <= 60; i++) rows.push(`val${i}a,val${i}b,val${i}c`);
    const text = rows.join('\n');
    const chunks = chunkText(text, DOC_ID, DOC_NAME, { method: 'row', rowsPerChunk: 50 });
    expect(chunks.length).toBe(2);
    expect(chunks[0].text).toContain('col1,col2,col3');
    expect(chunks[1].text).toContain('col1,col2,col3');
  });
});

describe('chunkText — sentence', () => {
  it('문장 단위로 분할한다', () => {
    const text = '첫 번째 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다. 네 번째 문장입니다.';
    const chunks = chunkText(text, DOC_ID, DOC_NAME, { method: 'sentence', sentencesPerChunk: 2, sentenceOverlap: 0 });
    expect(chunks.length).toBeGreaterThan(0);
  });
});

describe('CHUNKING_STRATEGIES', () => {
  it('5가지 전략이 존재한다', () => {
    expect(CHUNKING_STRATEGIES).toHaveLength(5);
  });

  it('각 전략에 method, name, description이 있다', () => {
    for (const strategy of CHUNKING_STRATEGIES) {
      expect(strategy.method).toBeDefined();
      expect(strategy.name).toBeDefined();
      expect(strategy.description).toBeDefined();
    }
  });
});
