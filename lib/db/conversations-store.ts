// 인메모리 대화 스토어 — 별도 모듈로 분리 (route 파일에서 non-HTTP export 방지)
import { generateTitle, truncate } from '@/lib/utils/markdown';
import type { Conversation, Message } from '@/types';

export const conversationStore = new Map<
  string,
  { conversation: Conversation; messages: Message[] }
>();

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

  return msg;
}
