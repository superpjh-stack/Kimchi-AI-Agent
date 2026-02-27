// 대화 스토어 — 파일 기반 영구 저장 (.local-db/conversations.json)
import { generateTitle, truncate } from '@/lib/utils/markdown';
import { loadConversations, saveConversations } from '@/lib/db/file-store';
import type { Conversation, Message } from '@/types';

// 서버 시작 시 파일에서 로드
export const conversationStore = loadConversations();

function save() {
  saveConversations(conversationStore);
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
