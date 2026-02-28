'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Conversation } from '@/types';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) return;
      const json = await res.json();
      // API는 { data: { conversations: [...] }, meta: {...} } 형식 반환
      const list = json.data?.conversations ?? json.conversations ?? [];
      setConversations(list);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  const createConversation = useCallback(async (): Promise<string> => {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '새 대화' }),
    });
    const json = await res.json();
    // API는 { data: Conversation } 형식 반환
    const data = (json.data ?? json) as { id: string; title: string };
    const newConv: Conversation = {
      id: data.id,
      title: data.title,
      lastMessage: '',
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
    return newConv.id;
  }, []);

  return {
    conversations,
    loading,
    activeId,
    setActiveId,
    createConversation,
    deleteConversation,
    refresh: fetchConversations,
  };
}
