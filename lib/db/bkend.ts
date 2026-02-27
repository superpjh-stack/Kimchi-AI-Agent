// lib/db/bkend.ts — bkend.ai Phase 2 완전 구현
// Base URL: https://api-client.bkend.ai
// Docs: X-API-Key (Publishable Key) 헤더 필수

// ──────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────

const BKEND_BASE_URL =
  process.env.BKEND_API_URL ?? 'https://api-client.bkend.ai';
const BKEND_PUBLISHABLE_KEY = process.env.BKEND_PUBLISHABLE_KEY ?? '';

/** bkend.ai가 설정되어 있는지 여부 */
export function isBkendConfigured(): boolean {
  return !!BKEND_PUBLISHABLE_KEY;
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface BkendPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface BkendListResponse<T> {
  items: T[];
  pagination: BkendPagination;
}

export interface ConversationRecord {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: unknown; // JSON — RAG 출처 배열
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunks: number;
  status: string;
  createdAt: string;
}

export interface ListOptions {
  page?: number;           // 기본 1
  limit?: number;          // 기본 20, 최대 100
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  andFilters?: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Core fetch helper
// ──────────────────────────────────────────────

async function bkendFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!BKEND_PUBLISHABLE_KEY) {
    throw new Error(
      'bkend.ai가 설정되지 않았습니다. BKEND_PUBLISHABLE_KEY 환경변수를 설정하세요.'
    );
  }

  const res = await fetch(`${BKEND_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': BKEND_PUBLISHABLE_KEY,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`bkend.ai ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ──────────────────────────────────────────────
// Query string builder
// ──────────────────────────────────────────────

function buildQuery(opts: ListOptions): string {
  const params = new URLSearchParams();

  if (opts.page)          params.set('page', String(opts.page));
  if (opts.limit)         params.set('limit', String(opts.limit));
  if (opts.sortBy)        params.set('sortBy', opts.sortBy);
  if (opts.sortDirection) params.set('sortDirection', opts.sortDirection);

  if (opts.andFilters && Object.keys(opts.andFilters).length > 0) {
    params.set('andFilters', JSON.stringify(opts.andFilters));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ──────────────────────────────────────────────
// conversations 테이블 CRUD
// ──────────────────────────────────────────────

export const conversationsDb = {
  list(opts: ListOptions = {}): Promise<BkendListResponse<ConversationRecord>> {
    const query = buildQuery({
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      limit: 20,
      ...opts,
    });
    return bkendFetch(`/v1/data/conversations${query}`);
  },

  get(id: string): Promise<ConversationRecord> {
    return bkendFetch(`/v1/data/conversations/${id}`);
  },

  create(data: {
    title: string;
    lastMessage?: string;
    messageCount?: number;
  }): Promise<ConversationRecord> {
    return bkendFetch('/v1/data/conversations', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        lastMessage: data.lastMessage ?? '',
        messageCount: data.messageCount ?? 0,
      }),
    });
  },

  update(
    id: string,
    data: Partial<Pick<ConversationRecord, 'title' | 'lastMessage' | 'messageCount'>>
  ): Promise<ConversationRecord> {
    return bkendFetch(`/v1/data/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<void> {
    return bkendFetch(`/v1/data/conversations/${id}`, { method: 'DELETE' });
  },
};

// ──────────────────────────────────────────────
// messages 테이블 CRUD
// ──────────────────────────────────────────────

export const messagesDb = {
  listByConversation(
    conversationId: string,
    opts: ListOptions = {}
  ): Promise<BkendListResponse<MessageRecord>> {
    const query = buildQuery({
      sortBy: 'createdAt',
      sortDirection: 'asc',
      limit: 100,
      ...opts,
      andFilters: { ...(opts.andFilters ?? {}), conversationId },
    });
    return bkendFetch(`/v1/data/messages${query}`);
  },

  create(data: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: unknown;
  }): Promise<MessageRecord> {
    return bkendFetch('/v1/data/messages', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        sources: data.sources ?? [],
      }),
    });
  },

  delete(id: string): Promise<void> {
    return bkendFetch(`/v1/data/messages/${id}`, { method: 'DELETE' });
  },
};

// ──────────────────────────────────────────────
// documents 테이블 CRUD
// ──────────────────────────────────────────────

export const documentsDb = {
  list(opts: ListOptions = {}): Promise<BkendListResponse<DocumentRecord>> {
    const query = buildQuery({
      sortBy: 'createdAt',
      sortDirection: 'desc',
      limit: 50,
      ...opts,
    });
    return bkendFetch(`/v1/data/documents${query}`);
  },

  create(data: {
    id?: string;
    name: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    chunks: number;
    status: string;
  }): Promise<DocumentRecord> {
    return bkendFetch('/v1/data/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateStatus(
    id: string,
    status: string,
    chunks?: number
  ): Promise<DocumentRecord> {
    return bkendFetch(`/v1/data/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(chunks !== undefined ? { chunks } : {}) }),
    });
  },

  delete(id: string): Promise<void> {
    return bkendFetch(`/v1/data/documents/${id}`, { method: 'DELETE' });
  },
};
