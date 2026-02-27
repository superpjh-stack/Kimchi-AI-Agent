// B7: RAG 청커 — 5가지 청킹 전략 지원

import type { ChunkingMethod, ChunkingOptions, ChunkingStrategyInfo } from '@/types';

export interface Chunk {
  text: string;
  index: number;
  metadata: {
    docId: string;
    docName: string;
  };
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 200;
const DEFAULT_SEPARATORS = ['\n\n', '\n', ' ', ''];

// --- 전략 메타데이터 ---

export const CHUNKING_STRATEGIES: ChunkingStrategyInfo[] = [
  {
    method: 'recursive',
    name: '재귀 분할 (기본)',
    description: '문단 → 줄 → 공백 순서로 재귀적 분할. 범용 문서에 최적.',
    recommendedFor: ['.txt', '.pdf'],
    defaults: { chunkSize: 1000, chunkOverlap: 200 },
  },
  {
    method: 'fixed',
    name: '고정 크기 분할',
    description: '지정된 글자 수로 균등 분할. 로그, 짧은 문서에 적합.',
    recommendedFor: [],
    defaults: { chunkSize: 1000, chunkOverlap: 100 },
  },
  {
    method: 'paragraph',
    name: '문단 단위 분할',
    description: '빈 줄(문단 경계) 기준 분할. 매뉴얼, 보고서에 적합.',
    recommendedFor: [],
    defaults: { maxChunkSize: 2000 },
  },
  {
    method: 'row',
    name: '행 단위 분할 (테이블)',
    description: '헤더를 보존하며 행 단위 분할. CSV/XLSX 데이터에 최적.',
    recommendedFor: ['.csv', '.xlsx'],
    defaults: { rowsPerChunk: 50 },
  },
  {
    method: 'sentence',
    name: '문장 단위 분할',
    description: '마침표/물음표 기준 문장 분할. FAQ, Q&A 문서에 적합.',
    recommendedFor: [],
    defaults: { sentencesPerChunk: 10, sentenceOverlap: 2 },
  },
];

// --- 메인 엔트리 ---

/**
 * Chunk a document text using the specified strategy.
 * Falls back to recursive if no options provided (backward compatible).
 */
export function chunkText(
  text: string,
  docId: string,
  docName: string,
  options?: ChunkingOptions
): Chunk[] {
  const method: ChunkingMethod = options?.method ?? 'recursive';

  let rawChunks: string[];
  switch (method) {
    case 'fixed':
      rawChunks = chunkFixed(text, options);
      break;
    case 'paragraph':
      rawChunks = chunkByParagraph(text, options);
      break;
    case 'row':
      rawChunks = chunkByRow(text, options);
      break;
    case 'sentence':
      rawChunks = chunkBySentence(text, options);
      break;
    case 'recursive':
    default:
      rawChunks = chunkRecursive(text, options);
      break;
  }

  return rawChunks
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw, index) => ({
      text: raw,
      index,
      metadata: { docId, docName },
    }));
}

// --- CS-01: Recursive (기존 로직) ---

function chunkRecursive(text: string, options?: ChunkingOptions): string[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options?.chunkOverlap ?? DEFAULT_OVERLAP;
  return splitTextRecursive(text, DEFAULT_SEPARATORS, chunkSize, chunkOverlap);
}

function splitTextRecursive(
  text: string,
  separators: string[],
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const goodSplits: string[] = [];
  const finalChunks: string[] = [];

  let separator = separators[separators.length - 1];
  let newSeparators: string[] = [];

  for (let i = 0; i < separators.length; i++) {
    const s = separators[i];
    if (s === '' || text.includes(s)) {
      separator = s;
      newSeparators = separators.slice(i + 1);
      break;
    }
  }

  const splits = separator ? text.split(separator) : text.split('');

  for (const split of splits) {
    if (split.length < chunkSize) {
      goodSplits.push(split);
    } else {
      if (goodSplits.length > 0) {
        const merged = mergeChunks(goodSplits, separator, chunkSize, chunkOverlap);
        finalChunks.push(...merged);
        goodSplits.length = 0;
      }
      if (newSeparators.length === 0) {
        finalChunks.push(split);
      } else {
        const subChunks = splitTextRecursive(split, newSeparators, chunkSize, chunkOverlap);
        finalChunks.push(...subChunks);
      }
    }
  }

  if (goodSplits.length > 0) {
    const merged = mergeChunks(goodSplits, separator, chunkSize, chunkOverlap);
    finalChunks.push(...merged);
  }

  return finalChunks;
}

function mergeChunks(
  splits: string[],
  separator: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const chunks: string[] = [];
  const currentSplits: string[] = [];
  let currentLen = 0;

  for (const split of splits) {
    const splitLen = split.length;

    if (currentLen + splitLen + (currentSplits.length > 0 ? separator.length : 0) > chunkSize) {
      if (currentSplits.length > 0) {
        chunks.push(currentSplits.join(separator));

        while (
          currentLen > chunkOverlap &&
          currentSplits.length > 0
        ) {
          const removed = currentSplits.shift()!;
          currentLen -= removed.length + (currentSplits.length > 0 ? separator.length : 0);
        }
      }
    }

    currentSplits.push(split);
    currentLen += splitLen + (currentSplits.length > 1 ? separator.length : 0);
  }

  if (currentSplits.length > 0) {
    chunks.push(currentSplits.join(separator));
  }

  return chunks;
}

// --- CS-02: Fixed Size ---

function chunkFixed(text: string, options?: ChunkingOptions): string[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.chunkOverlap ?? 100;
  const chunks: string[] = [];
  const step = Math.max(chunkSize - overlap, 1);

  for (let i = 0; i < text.length; i += step) {
    chunks.push(text.slice(i, i + chunkSize));
    if (i + chunkSize >= text.length) break;
  }

  return chunks;
}

// --- CS-03: By Paragraph ---

function chunkByParagraph(text: string, options?: ChunkingOptions): string[] {
  const maxChunkSize = options?.maxChunkSize ?? 2000;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxChunkSize) {
      chunks.push(para);
    } else {
      // Paragraph too large: fall back to recursive split within it
      const subChunks = splitTextRecursive(
        para,
        ['\n', ' ', ''],
        maxChunkSize,
        Math.min(200, Math.floor(maxChunkSize * 0.1))
      );
      chunks.push(...subChunks);
    }
  }

  return chunks;
}

// --- CS-04: By Row (CSV/Table) ---

function chunkByRow(text: string, options?: ChunkingOptions): string[] {
  const rowsPerChunk = options?.rowsPerChunk ?? 50;
  const lines = text.split('\n');
  if (lines.length === 0) return [];

  const header = lines[0];
  const dataLines = lines.slice(1).filter((line) => line.trim().length > 0);
  const chunks: string[] = [];

  for (let i = 0; i < dataLines.length; i += rowsPerChunk) {
    const batch = dataLines.slice(i, i + rowsPerChunk);
    chunks.push(header + '\n' + batch.join('\n'));
  }

  // If there are no data lines, return just the header if it exists
  if (chunks.length === 0 && header.trim().length > 0) {
    chunks.push(header);
  }

  return chunks;
}

// --- CS-05: By Sentence ---

function chunkBySentence(text: string, options?: ChunkingOptions): string[] {
  const sentencesPerChunk = options?.sentencesPerChunk ?? 10;
  const sentenceOverlap = options?.sentenceOverlap ?? 2;

  // Split on sentence boundaries (Korean and English punctuation)
  const sentences = text
    .split(/(?<=[.!?。])\s+/)
    .filter((s) => s.trim().length > 0);

  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  const step = Math.max(sentencesPerChunk - sentenceOverlap, 1);

  for (let i = 0; i < sentences.length; i += step) {
    const batch = sentences.slice(i, i + sentencesPerChunk);
    chunks.push(batch.join(' '));
    if (i + sentencesPerChunk >= sentences.length) break;
  }

  return chunks;
}
