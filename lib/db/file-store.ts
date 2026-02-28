// 파일 기반 영구 저장소 — .local-db/conversations.json + bm25-index.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { createLogger } from '@/lib/logger';
import type { Conversation, Message } from '@/types';

const log = createLogger('db.file-store');

export type ConversationEntry = { conversation: Conversation; messages: Message[] };
export type BM25Snapshot = { docs: [string, string[]][]; df: [string, number][] };

const DB_DIR = join(process.cwd(), '.local-db');
const CONV_FILE = join(DB_DIR, 'conversations.json');
const BM25_FILE = join(DB_DIR, 'bm25-index.json');

// 디렉토리 초기화 (없으면 생성)
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

// ─── Conversations ─────────────────────────────────

export function loadConversations(): Map<string, ConversationEntry> {
  try {
    if (existsSync(CONV_FILE)) {
      const raw = readFileSync(CONV_FILE, 'utf-8');
      const data = JSON.parse(raw) as Record<string, ConversationEntry>;
      return new Map(Object.entries(data));
    }
  } catch {
    log.warn('conversations.json 로드 실패 — 빈 스토어로 초기화');
  }
  return new Map();
}

// P3: debounced async write — 이벤트 루프 블로킹 방지
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingStore: Map<string, ConversationEntry> | null = null;

export function saveConversationsDebounced(store: Map<string, ConversationEntry>): void {
  _pendingStore = store;
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    const s = _pendingStore;
    _pendingStore = null;
    if (!s) return;
    writeFile(CONV_FILE, JSON.stringify(Object.fromEntries(s), null, 2), 'utf-8').catch((e) =>
      log.error({ err: e }, '대화 비동기 저장 실패')
    );
  }, 500);
}

/** 프로세스 종료 시 즉시 flush용 동기 저장 (graceful shutdown) */
export function saveConversations(store: Map<string, ConversationEntry>): void {
  try {
    writeFileSync(CONV_FILE, JSON.stringify(Object.fromEntries(store), null, 2), 'utf-8');
  } catch (e) {
    log.error({ err: e }, '대화 동기 저장 실패');
  }
}

// ─── BM25 Index ────────────────────────────────────

export function loadBM25Index(): BM25Snapshot | null {
  try {
    if (existsSync(BM25_FILE)) {
      const raw = readFileSync(BM25_FILE, 'utf-8');
      return JSON.parse(raw) as BM25Snapshot;
    }
  } catch {
    log.warn('bm25-index.json 로드 실패 — 빈 인덱스로 초기화');
  }
  return null;
}

export function saveBM25Index(snapshot: BM25Snapshot): void {
  writeFile(BM25_FILE, JSON.stringify(snapshot), 'utf-8').catch((e) =>
    log.error({ err: e }, 'BM25 인덱스 저장 실패')
  );
}
