// 대화 스토어 — 파일 기반 영구 저장 (.local-db/conversations.json)
import { generateTitle, truncate } from '@/lib/utils/markdown';
import { loadConversations, saveConversationsDebounced } from '@/lib/db/file-store';
import type { Conversation, Message } from '@/types';

// S4-8: 최대 대화 수 제한 — 메모리 누수 방지
const MAX_CONVERSATIONS = 500;

// 서버 시작 시 파일에서 로드
export const conversationStore = loadConversations();

function save() {
  saveConversationsDebounced(conversationStore);
}

export function createConversationEntry(firstUserMessage: string): Conversation {
  const now = new Date().toISOString();
  return {
    id: `conv_${crypto.randomUUID()}`,
    title: generateTitle(firstUserMessage),
    lastMessage: truncate(firstUserMessage, 50),
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** 대화 추가 + 파일 저장 */
export function setConversationEntry(
  id: string,
  entry: { conversation: Conversation; messages: Message[] }
): void {
  conversationStore.set(id, entry);
  // S4-8: 최대 대화 수 초과 시 가장 오래된 항목 제거
  if (conversationStore.size > MAX_CONVERSATIONS) {
    const oldestKey = conversationStore.keys().next().value;
    if (oldestKey) conversationStore.delete(oldestKey);
  }
  save();
}

/** 대화 삭제 + 파일 저장 */
export function deleteConversationEntry(id: string): boolean {
  const existed = conversationStore.delete(id);
  if (existed) save();
  return existed;
}

export function addMessageToConversation(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  sources?: import('@/types').DocumentSource[]
): Message | null {
  const entry = conversationStore.get(conversationId);
  if (!entry) return null;

  const msg: Message = {
    id: `msg_${crypto.randomUUID()}`,
    role,
    content,
    sources,
    createdAt: new Date().toISOString(),
  };

  entry.messages.push(msg);
  entry.conversation.messageCount = entry.messages.length;
  entry.conversation.lastMessage = truncate(content, 50);
  entry.conversation.updatedAt = new Date().toISOString();

  save();
  return msg;
}
