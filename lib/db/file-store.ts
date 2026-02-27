// 파일 기반 영구 저장소 — .local-db/conversations.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { Conversation, Message } from '@/types';

export type ConversationEntry = { conversation: Conversation; messages: Message[] };

const DB_DIR = join(process.cwd(), '.local-db');
const CONV_FILE = join(DB_DIR, 'conversations.json');

// 디렉토리 초기화 (없으면 생성)
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

export function loadConversations(): Map<string, ConversationEntry> {
  try {
    if (existsSync(CONV_FILE)) {
      const raw = readFileSync(CONV_FILE, 'utf-8');
      const data = JSON.parse(raw) as Record<string, ConversationEntry>;
      return new Map(Object.entries(data));
    }
  } catch {
    // 파싱 오류 시 빈 스토어로 시작
    console.warn('[file-store] conversations.json 로드 실패 — 빈 스토어로 초기화');
  }
  return new Map();
}

export function saveConversations(store: Map<string, ConversationEntry>): void {
  try {
    const data = Object.fromEntries(store.entries());
    writeFileSync(CONV_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[file-store] 저장 실패:', e);
  }
}
