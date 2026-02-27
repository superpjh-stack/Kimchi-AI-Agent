// Phase 3: pgvector 기반 VectorStore 구현
// DATABASE_URL 환경변수 필요 — docker-compose.yml의 postgres 서비스 참조

import type { Chunk } from './chunker';
import type { SearchResult, DocumentStats, VectorStore } from './retriever';

/**
 * pgvector VectorStore — PostgreSQL + pgvector 확장 사용.
 *
 * 테이블 스키마 (최초 실행 시 자동 생성):
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *   CREATE TABLE IF NOT EXISTS embeddings (
 *     key        TEXT PRIMARY KEY,
 *     doc_id     TEXT NOT NULL,
 *     doc_name   TEXT NOT NULL,
 *     chunk_text TEXT NOT NULL,
 *     chunk_idx  INTEGER NOT NULL,
 *     vector     vector(N),              -- dimension은 embedder에 따라 다름
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   CREATE INDEX ON embeddings USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
 */
export class PgVectorStore implements VectorStore {
  readonly storageType = 'pgvector' as const;
  private readonly databaseUrl: string;
  private readonly dimension: number;
  private initialized = false;

  constructor(dimension: number) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is required for pgvector store');
    }
    this.databaseUrl = url;
    this.dimension = dimension;
  }

  /**
   * Initialize the database schema.
   * Uses parameterized queries only — no string interpolation for SQL.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Dynamic import to avoid bundling pg when not used
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: this.databaseUrl });

    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS embeddings (
          key        TEXT PRIMARY KEY,
          doc_id     TEXT NOT NULL,
          doc_name   TEXT NOT NULL,
          chunk_text TEXT NOT NULL,
          chunk_idx  INTEGER NOT NULL,
          vector     vector($1),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `, [this.dimension]);

      // Index for cosine similarity search
      // Note: ivfflat requires data to exist; create after first ingest in production
      this.initialized = true;
      console.log(`[retriever-pg] initialized (dimension=${this.dimension})`);
    } finally {
      await pool.end();
    }
  }

  private async getPool() {
    const { Pool } = await import('pg');
    return new Pool({ connectionString: this.databaseUrl });
  }

  async addDocuments(chunks: Chunk[], vectors: number[][]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new Error('chunks and vectors arrays must have the same length');
    }

    await this.init();
    const pool = await this.getPool();

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const key = `${chunk.metadata.docId}::${chunk.index}`;
        const vecStr = `[${vectors[i].join(',')}]`;

        await pool.query(
          `INSERT INTO embeddings (key, doc_id, doc_name, chunk_text, chunk_idx, vector)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (key) DO UPDATE SET
             chunk_text = EXCLUDED.chunk_text,
             vector = EXCLUDED.vector`,
          [key, chunk.metadata.docId, chunk.metadata.docName, chunk.text, chunk.index, vecStr]
        );
      }
    } finally {
      await pool.end();
    }
  }

  async search(
    queryVector: number[],
    options: { topK?: number; threshold?: number } = {}
  ): Promise<SearchResult[]> {
    const topK = options.topK ?? 5;
    const threshold = options.threshold ?? 0.3;

    await this.init();
    const pool = await this.getPool();

    try {
      const vecStr = `[${queryVector.join(',')}]`;

      // pgvector cosine distance: 1 - cosine_similarity
      // So we want distance < (1 - threshold)
      const maxDistance = 1 - threshold;

      const result = await pool.query(
        `SELECT key, doc_id, doc_name, chunk_text, chunk_idx,
                1 - (vector <=> $1::vector) AS score
         FROM embeddings
         WHERE 1 - (vector <=> $1::vector) >= $2
         ORDER BY vector <=> $1::vector
         LIMIT $3`,
        [vecStr, threshold, topK]
      );

      return result.rows.map((row: { doc_id: string; doc_name: string; chunk_text: string; chunk_idx: number; score: number }) => ({
        chunk: {
          text: row.chunk_text,
          index: row.chunk_idx,
          metadata: { docId: row.doc_id, docName: row.doc_name },
        },
        score: parseFloat(String(row.score)),
      }));
    } finally {
      await pool.end();
    }
  }

  async removeDocument(docId: string): Promise<void> {
    await this.init();
    const pool = await this.getPool();

    try {
      await pool.query('DELETE FROM embeddings WHERE doc_id = $1', [docId]);
    } finally {
      await pool.end();
    }
  }

  async getStoreSize(): Promise<number> {
    await this.init();
    const pool = await this.getPool();

    try {
      const result = await pool.query('SELECT COUNT(*)::int AS count FROM embeddings');
      return result.rows[0].count;
    } finally {
      await pool.end();
    }
  }

  async getChunkByKey(key: string): Promise<{ vector: number[]; chunk: Chunk } | undefined> {
    await this.init();
    const pool = await this.getPool();

    try {
      const result = await pool.query(
        'SELECT doc_id, doc_name, chunk_text, chunk_idx FROM embeddings WHERE key = $1',
        [key]
      );

      if (result.rows.length === 0) return undefined;

      const row = result.rows[0] as { doc_id: string; doc_name: string; chunk_text: string; chunk_idx: number };
      return {
        vector: [], // Vector not returned for key lookup to save memory
        chunk: {
          text: row.chunk_text,
          index: row.chunk_idx,
          metadata: { docId: row.doc_id, docName: row.doc_name },
        },
      };
    } finally {
      await pool.end();
    }
  }

  async getDocumentStats(): Promise<DocumentStats> {
    await this.init();
    const pool = await this.getPool();

    try {
      const totalResult = await pool.query(
        'SELECT COUNT(DISTINCT doc_id)::int AS total FROM embeddings'
      );
      const chunksResult = await pool.query(
        'SELECT COUNT(*)::int AS count FROM embeddings'
      );
      const typeResult = await pool.query(
        `SELECT
           LOWER(SUBSTRING(doc_name FROM '\\.([^.]+)$')) AS ext,
           COUNT(DISTINCT doc_id)::int AS count
         FROM embeddings
         GROUP BY ext`
      );

      const byType: Record<string, number> = {};
      for (const row of typeResult.rows as Array<{ ext: string; count: number }>) {
        byType[row.ext ?? 'unknown'] = row.count;
      }

      return {
        total: totalResult.rows[0].total,
        byType,
        totalChunks: chunksResult.rows[0].count,
        storageType: 'pgvector',
      };
    } finally {
      await pool.end();
    }
  }
}
