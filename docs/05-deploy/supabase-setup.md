# Supabase pgvector 설정 가이드

Kimchi-Agent의 벡터 DB로 Supabase PostgreSQL + pgvector 확장을 사용합니다.

---

## 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 접속 및 로그인
2. **New Project** 클릭
3. 프로젝트 설정:
   - **Name**: `kimchi-agent` (자유)
   - **Database Password**: 강력한 비밀번호 설정 (저장해 둘 것)
   - **Region**: 서울 (`ap-northeast-2`) 또는 도쿄 (`ap-northeast-1`) 선택
4. 프로젝트 생성 완료까지 약 2분 대기

---

## 2. pgvector 확장 활성화

Supabase 대시보드에서 **SQL Editor** 접속 후 실행:

```sql
-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;
```

확인:
```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

> Supabase는 pgvector를 기본 지원합니다. 별도 설치 불필요.

---

## 3. 테이블 자동 생성

Kimchi-Agent는 첫 실행 시 `document_chunks` 테이블을 자동 생성합니다 (`PgVectorStore.initialize()`).

수동 생성이 필요한 경우:

```sql
CREATE TABLE IF NOT EXISTS document_chunks (
  key         TEXT PRIMARY KEY,
  doc_id      TEXT NOT NULL,
  doc_name    TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text        TEXT NOT NULL,
  vector      vector(1536) NOT NULL,
  metadata    JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS document_chunks_doc_id_idx
  ON document_chunks (doc_id);
```

> **차원 주의**: OpenAI `text-embedding-3-small`은 1536차원, Ollama `nomic-embed-text`는 768차원입니다. 임베더에 맞는 차원을 사용하세요.

---

## 4. 연결 문자열 (DATABASE_URL)

### 4.1 연결 문자열 확인

Supabase 대시보드 > **Settings** > **Database** > **Connection string** > **URI**

형식:
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### 4.2 연결 모드 선택

| 모드 | 포트 | 용도 |
|------|------|------|
| **Transaction** (Supavisor) | `6543` | 서버리스 환경 권장 (Vercel) |
| **Session** (Supavisor) | `5432` | 장시간 연결이 필요한 경우 |
| **Direct** | `5432` | 마이그레이션, 관리 작업 |

Vercel 서버리스 환경에서는 **Transaction 모드 (포트 6543)**를 사용하세요.

### 4.3 Vercel 환경변수 설정

```
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

---

## 5. 보안 설정

### 5.1 Row Level Security (RLS)

프로덕션 환경에서는 RLS 활성화를 권장합니다:

```sql
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- 서비스 역할만 접근 허용 (서버 사이드)
CREATE POLICY "Server access only"
  ON document_chunks
  FOR ALL
  USING (auth.role() = 'service_role');
```

### 5.2 네트워크 제한

Supabase 대시보드 > **Settings** > **Database** > **Network Restrictions**에서 Vercel의 IP 범위를 허용 목록에 추가할 수 있습니다.

---

## 6. 인덱스 최적화

데이터가 100건 이상 축적되면 IVFFlat 인덱스가 자동 생성됩니다.

대량 데이터 (1000건+) 환경에서 수동 최적화:

```sql
-- HNSW 인덱스 (IVFFlat보다 정확도 높음, 빌드 시간 김)
CREATE INDEX IF NOT EXISTS document_chunks_vector_hnsw_idx
  ON document_chunks
  USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## 7. 데이터 백업

Supabase Pro 플랜에서는 자동 백업이 제공됩니다.

수동 백업:
```bash
pg_dump "DATABASE_URL" --table=document_chunks > backup.sql
```

복원:
```bash
psql "DATABASE_URL" < backup.sql
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `ECONNREFUSED` | 연결 문자열 오류 | DATABASE_URL 확인, 포트 번호 확인 |
| `type "vector" does not exist` | pgvector 미활성화 | `CREATE EXTENSION vector` 실행 |
| `차원 불일치` 경고 | 임베더 변경 | 테이블 DROP 후 문서 재업로드 |
| 연결 풀 소진 | 동시 연결 초과 | Transaction 모드 사용, 풀 크기 조정 |
