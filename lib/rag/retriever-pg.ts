// lib/rag/retriever-pg.ts — pgvector 백엔드 VectorStore 구현
import { Pool } from 'pg';
import { createLogger } from '@/lib/logger';
import type { Chunk } from './chunker';
import type { StoredEntry, SearchResult, VectorStore, DocumentStats } from './retriever';

const log = createLogger('rag.pg');

export class PgVectorStore implements VectorStore {
  readonly storageType = 'pgvector' as const;
  private readonly pool: Pool;
  private readonly dimension: number;
  private _initPromise: Promise<void> | null = null;

  constructor(connectionString: string, dimension = 1536) {
    this.pool = new Pool({ connectionString });
    this.dimension = dimension;
  }

  async initialize(): Promise<void> {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._setup();
    return this._initPromise;
  }

  private async _setup(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');

      // 기존 테이블의 vector 컬럼 차원 확인 — 불일치 시 DROP 후 재생성
      const dimCheck = await client.query(`
        SELECT atttypmod FROM pg_attribute
        WHERE attrelid = 'document_chunks'::regclass
          AND attname = 'vector'
      `);

      if (dimCheck.rows.length > 0) {
        const storedDim = dimCheck.rows[0].atttypmod;
        if (storedDim !== -1 && storedDim !== this.dimension) {
          const countResult = await client.query('SELECT COUNT(*) FROM document_chunks');
          const lostChunks = parseInt(countResult.rows[0].count, 10);
          log.warn({ storedDim, embedderDim: this.dimension }, '[pgvector] 차원 불일치 감지 — 테이블 재생성');
          if (lostChunks > 0) {
            log.warn({ lostChunks }, '[pgvector] 청크 삭제됨 — 문서 재업로드 필요');
          }
          await client.query('DROP TABLE document_chunks');
        }
      }

      // 테이블 생성 (없거나 방금 DROP한 경우)
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          key         TEXT PRIMARY KEY,
          doc_id      TEXT NOT NULL,
          doc_name    TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          text        TEXT NOT NULL,
          vector      vector(${this.dimension}) NOT NULL,
          metadata    JSONB DEFAULT '{}'
        )
      `);
      await client.query(
        'CREATE INDEX IF NOT EXISTS document_chunks_doc_id_idx ON document_chunks (doc_id)'
      );

      // IVFFlat 인덱스 — 100건 이상일 때만 효과적
      const countResult = await client.query('SELECT COUNT(*) FROM document_chunks');
      const count = parseInt(countResult.rows[0].count, 10);
      if (count >= 100) {
        try {
          await client.query(`
            CREATE INDEX IF NOT EXISTS document_chunks_vector_idx
            ON document_chunks USING ivfflat (vector vector_cosine_ops)
            WITH (lists = 100)
          `);
        } catch {
          log.warn('[pgvector] IVFFlat 인덱스 생성 스킵 (데이터 부족)');
        }
      }

      log.info({ dimension: this.dimension, chunks: count }, '[pgvector] 초기화 완료');
    } finally {
      client.release();
    }
  }

  async addDocuments(chunks: Chunk[], vectors: number[][]): Promise<void> {
    await this.initialize();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const key = `${chunk.metadata.docId}::${chunk.index}`;
        const vectorStr = `[${vectors[i].join(',')}]`;
        await client.query(
          `INSERT INTO document_chunks (key, doc_id, doc_name, chunk_index, text, vector)
           VALUES ($1, $2, $3, $4, $5, $6::vector)
           ON CONFLICT (key) DO UPDATE SET text = EXCLUDED.text, vector = EXCLUDED.vector`,
          [key, chunk.metadata.docId, chunk.metadata.docName, chunk.index, chunk.text, vectorStr]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async search(
    queryVector: number[],
    options: { topK?: number; threshold?: number } = {}
  ): Promise<SearchResult[]> {
    await this.initialize();
    const topK = options.topK ?? 5;
    const threshold = options.threshold ?? 0.3;
    const vectorStr = `[${queryVector.join(',')}]`;
    const { rows } = await this.pool.query(
      `SELECT key, doc_id, doc_name, chunk_index, text,
              1 - (vector <=> $1::vector) AS score
       FROM document_chunks
       WHERE 1 - (vector <=> $1::vector) >= $2
       ORDER BY vector <=> $1::vector
       LIMIT $3`,
      [vectorStr, threshold, topK]
    );
    return rows.map((row) => ({
      chunk: {
        text: row.text,
        index: row.chunk_index,
        metadata: { docId: row.doc_id, docName: row.doc_name },
      },
      score: parseFloat(row.score),
    }));
  }

  async removeDocument(docId: string): Promise<void> {
    await this.initialize();
    await this.pool.query('DELETE FROM document_chunks WHERE doc_id = $1', [docId]);
  }

  async getStoreSize(): Promise<number> {
    await this.initialize();
    const { rows } = await this.pool.query('SELECT COUNT(*) AS cnt FROM document_chunks');
    return parseInt(rows[0].cnt, 10);
  }

  async getChunkByKey(key: string): Promise<StoredEntry | undefined> {
    await this.initialize();
    const { rows } = await this.pool.query(
      'SELECT text, chunk_index, doc_id, doc_name FROM document_chunks WHERE key = $1',
      [key]
    );
    if (rows.length === 0) return undefined;
    const row = rows[0];
    return {
      vector: [],
      chunk: {
        text: row.text,
        index: row.chunk_index,
        metadata: { docId: row.doc_id, docName: row.doc_name },
      },
    };
  }

  async getDocumentStats(): Promise<DocumentStats> {
    await this.initialize();
    const { rows } = await this.pool.query(`
      SELECT doc_name, COUNT(*) AS chunk_count
      FROM document_chunks
      GROUP BY doc_id, doc_name
    `);
    const byType: Record<string, number> = {};
    for (const row of rows) {
      const ext = (row.doc_name.split('.').pop() ?? 'unknown').toLowerCase();
      byType[ext] = (byType[ext] ?? 0) + 1;
    }
    return {
      total: rows.length,
      byType,
      totalChunks: rows.reduce((acc, r) => acc + parseInt(r.chunk_count, 10), 0),
      storageType: 'pgvector',
    };
  }
}
