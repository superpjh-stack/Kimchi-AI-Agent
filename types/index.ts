// Kimchi-Agent shared type definitions
// Used by both frontend and backend

/** 청킹 전략 식별자 */
export type ChunkingMethod =
  | 'recursive'
  | 'fixed'
  | 'paragraph'
  | 'row'
  | 'sentence';

/** 청킹 옵션 파라미터 */
export interface ChunkingOptions {
  method: ChunkingMethod;
  chunkSize?: number;
  chunkOverlap?: number;
  rowsPerChunk?: number;
  maxChunkSize?: number;
  sentencesPerChunk?: number;
  sentenceOverlap?: number;
}

/** 청킹 전략 메타데이터 (UI 표시용) */
export interface ChunkingStrategyInfo {
  method: ChunkingMethod;
  name: string;
  description: string;
  recommendedFor: string[];
  defaults: Partial<ChunkingOptions>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: DocumentSource[];
  isStreaming?: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSource {
  docId: string;
  docName: string;
  chunkText: string;
  score: number;
}

export interface KimchiDocument {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  /** fileType 편의 별칭 (UI 표시용) */
  type: string;
  fileSize: number;
  chunks: number;
  status: 'processing' | 'processed' | 'error';
  createdAt: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  history?: Message[];
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
}

export interface UploadResponse {
  id: string;
  name: string;
  type: string;
  chunks: number;
  chunkingMethod: ChunkingMethod;
  status: 'processed';
  createdAt: string;
}

// SSE event types
/** AI 처리 상태 — RAG 검색 → LLM 생성 → 완료 */
export type ChatStatus = 'idle' | 'rag-searching' | 'llm-generating' | 'done' | 'error';

export type SSEEventType = 'token' | 'sources' | 'done' | 'error';

export interface SSETokenEvent {
  type: 'token';
  content: string;
}

export interface SSESourcesEvent {
  type: 'sources';
  documents: string[];
  sources: DocumentSource[];
}

export interface SSEDoneEvent {
  type: 'done';
  messageId: string;
  conversationId: string;
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

export type SSEEvent = SSETokenEvent | SSESourcesEvent | SSEDoneEvent | SSEErrorEvent;
