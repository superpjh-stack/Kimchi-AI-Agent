# 환경변수 목록 (Phase 1~4)

Kimchi-Agent에서 사용하는 모든 환경변수 참조 목록.

---

## 필수 환경변수

최소 하나의 Chat API 키가 필요합니다.

| 변수명 | 설명 | 예시값 | 도입 Phase |
|--------|------|--------|-----------|
| `ANTHROPIC_API_KEY` | Claude API 키 (Chat) | `sk-ant-api03-...` | Phase 1 |
| `OPENAI_API_KEY` | OpenAI API 키 (임베딩 + Chat 대체) | `sk-proj-...` | Phase 1 |

> `ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY` + `OPENAI_CHAT_MODEL` 중 하나는 반드시 설정해야 합니다.

---

## AI / 임베딩

| 변수명 | 설명 | 기본값 | 필수 | Phase |
|--------|------|--------|------|-------|
| `OPENAI_CHAT_MODEL` | OpenAI Chat 모델명 (Claude 대체) | _(미설정 시 Claude 사용)_ | 선택 | Phase 2 |
| `EMBEDDING_PROVIDER` | 임베딩 제공자 선택 | 자동 감지 (`openai` > `local` > `mock`) | 선택 | Phase 3 |
| `EMBEDDING_MODEL` | OpenAI 임베딩 모델명 | `text-embedding-3-small` | 선택 | Phase 3 |
| `OLLAMA_BASE_URL` | Ollama 서버 URL | `http://localhost:11434` | 선택 | Phase 3 |
| `OLLAMA_URL` | Ollama 서버 URL (별칭) | _(OLLAMA_BASE_URL 우선)_ | 선택 | Phase 3 |
| `OLLAMA_EMBEDDING_MODEL` | Ollama 임베딩 모델명 | `nomic-embed-text` | 선택 | Phase 3 |

### 임베딩 제공자 자동 감지 로직

`EMBEDDING_PROVIDER` 미설정 시:

```
OPENAI_API_KEY 있음?  → openai (1536차원)
OLLAMA_BASE_URL 있음? → local (768차원, 실패 시 mock 폴백)
둘 다 없음?           → mock (1536차원, 시맨틱 검색 품질 낮음)
```

---

## 데이터베이스

| 변수명 | 설명 | 기본값 | 필수 | Phase |
|--------|------|--------|------|-------|
| `DATABASE_URL` | PostgreSQL + pgvector 연결 문자열 | _(미설정 시 인메모리)_ | 선택 | Phase 3 |

> `DATABASE_URL` 미설정 시 InMemoryVectorStore를 사용합니다 (서버 재시작 시 데이터 초기화).

연결 문자열 형식:
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

---

## 센서 / 공정 데이터

| 변수명 | 설명 | 기본값 | 필수 | Phase |
|--------|------|--------|------|-------|
| `PROCESS_DATA_MODE` | 센서 데이터 소스 | `simulator` | 선택 | Phase 3 |
| `PROCESS_DATA_API_URL` | 센서 게이트웨이 URL | _(api 모드 시 필수)_ | 조건부 | Phase 3 |
| `PROCESS_DATA_API_KEY` | 센서 게이트웨이 API 키 | `''` | 선택 | Phase 3 |

### 센서 데이터 모드

| `PROCESS_DATA_MODE` | 동작 |
|---------------------|------|
| `simulator` (기본) | 내장 시뮬레이터로 가상 센서 데이터 생성 |
| `api` | 외부 센서 게이트웨이 HTTP API 연동 (`PROCESS_DATA_API_URL` 필수) |

---

## ML 캐싱 (Phase 4)

| 변수명 | 설명 | 기본값 | 필수 | Phase |
|--------|------|--------|------|-------|
| `ML_CACHE_TTL_MS` | ML 예측 캐시 TTL (밀리초) | `30000` | 선택 | Phase 4 |

---

## 모니터링 (Phase 4)

| 변수명 | 설명 | 기본값 | 필수 | Phase |
|--------|------|--------|------|-------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry 클라이언트 DSN | _(미설정 시 비활성)_ | 선택 | Phase 4 |
| `SENTRY_DSN` | Sentry 서버 DSN | _(미설정 시 비활성)_ | 선택 | Phase 4 |
| `SENTRY_ORG` | Sentry 조직 슬러그 | _(소스맵 업로드 시 필요)_ | 선택 | Phase 4 |
| `SENTRY_PROJECT` | Sentry 프로젝트 슬러그 | _(소스맵 업로드 시 필요)_ | 선택 | Phase 4 |
| `SENTRY_AUTH_TOKEN` | Sentry 인증 토큰 | _(소스맵 업로드 시 필요)_ | 선택 | Phase 4 |

---

## Node.js / 시스템

| 변수명 | 설명 | 기본값 | 비고 |
|--------|------|--------|------|
| `NODE_ENV` | 실행 환경 | `development` | Vercel에서 `production` 자동 설정 |
| `PORT` | 개발 서버 포트 | `3000` | 로컬 개발용 |

---

## Vercel 환경변수 입력 권장 순서

Vercel 대시보드 > Settings > Environment Variables에서 아래 순서로 입력:

```
1. DATABASE_URL              ← 벡터 DB (가장 먼저)
2. ANTHROPIC_API_KEY         ← Chat 기능
3. OPENAI_API_KEY            ← 임베딩
4. OPENAI_CHAT_MODEL         ← (선택) OpenAI Chat 대체
5. EMBEDDING_PROVIDER        ← (선택) 명시적 임베더 선택
6. NEXT_PUBLIC_SENTRY_DSN    ← (선택) 클라이언트 에러 추적
7. SENTRY_DSN                ← (선택) 서버 에러 추적
8. SENTRY_AUTH_TOKEN         ← (선택) 소스맵 업로드
9. ML_CACHE_TTL_MS           ← (선택) 캐시 TTL 커스터마이징
```

> **`NEXT_PUBLIC_` 접두사**: 클라이언트 번들에 포함되는 변수에만 사용. 민감한 키에는 사용하지 마세요.

---

## .env.local 예시 (로컬 개발용)

```bash
# 필수 (하나 이상)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...

# Chat 모델 (Claude 대신 OpenAI 사용 시)
# OPENAI_CHAT_MODEL=gpt-4o-mini

# 임베딩
# EMBEDDING_PROVIDER=openai
# EMBEDDING_MODEL=text-embedding-3-small

# 벡터 DB (pgvector 사용 시)
# DATABASE_URL=postgresql://postgres:password@localhost:5432/kimchi

# 센서 데이터
# PROCESS_DATA_MODE=simulator

# Ollama (로컬 임베딩)
# OLLAMA_BASE_URL=http://localhost:11434

# Sentry (프로덕션 전용)
# NEXT_PUBLIC_SENTRY_DSN=https://xxx@o000.ingest.sentry.io/000
# SENTRY_DSN=https://xxx@o000.ingest.sentry.io/000
```
