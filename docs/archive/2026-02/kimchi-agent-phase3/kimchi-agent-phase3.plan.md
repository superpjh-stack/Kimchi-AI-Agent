# Plan: Kimchi-Agent Phase 3 — ML 통합 + 영속성 + 배포

**Feature ID**: kimchi-agent-phase3
**Created**: 2026-02-27
**Level**: Dynamic
**Priority**: High
**Status**: Planning

---

## 1. Overview (개요)

Phase 2 완료(Match Rate 92.2%) 기준으로, Phase 3는 세 가지 축을 동시에 진행한다:

1. **영속성 인프라** — 인메모리 한계 극복 (pgvector + bkend.ai 완전 연동)
2. **로컬 AI 임베딩** — OpenAI 의존 제거 (LocalEmbedder / Ollama)
3. **ML 예측 모델** — 발효 완성도·품질 예측, 대시보드+챗 통합 뷰

---

## 2. Problem Statement (문제 정의)

| 분류 | 문제 | 우선순위 |
|------|------|---------|
| 영속성 | VectorStore·ConversationStore 재시작 시 소멸 | HIGH |
| 임베딩 | OPENAI_API_KEY 없으면 RAG 품질 급락 | HIGH |
| ML 부재 | 발효 예측·품질 추천 기능 없음 | HIGH |
| UX 갭 | Alert.acknowledged 없어 알림 재표시 | MEDIUM |
| API 부재 | /api/documents/stats 엔드포인트 없음 | MEDIUM |
| 운영 | 공장 현장 배포·베타 테스트 미완 | MEDIUM |

---

## 3. Goals (목표)

### Sprint 1 — 영속성 인프라 (1주)
- [ ] pgvector 마이그레이션 (벡터 데이터 영속화)
- [ ] bkend.ai CRUD 완전 구현 (placeholder → 실동작)
- [ ] `/api/documents/stats` GET 엔드포인트 추가
- [ ] Alert.acknowledged 필드 추가 및 UI 연동

### Sprint 2 — 로컬 임베딩 (1주)
- [ ] LocalEmbedder 인터페이스 구현 (Ollama text-embedding 모델)
- [ ] EmbeddingProvider 패턴 확장 (openai / local / mock 전략)
- [ ] 환경변수 `EMBEDDING_PROVIDER=local|openai|mock` 설정

### Sprint 3 — ML 예측 모델 (1주)
- [ ] 발효 완성도 예측 모델 (시계열 센서 데이터 기반)
- [ ] 품질 등급 예측 (온도·염도·pH 입력 → A/B/C 등급)
- [ ] `/api/ml/predict` 엔드포인트
- [ ] 예측 결과를 Claude 시스템 프롬프트에 주입

### Sprint 4 — 대시보드+챗 통합 뷰 + 배포 (1주)
- [ ] MLPredictionPanel 컴포넌트 (예측 결과 카드)
- [ ] 대시보드 + 챗 탭 전환 UI
- [ ] Vercel 프로덕션 배포 설정
- [ ] 공장 운영자 베타 테스트 진행

---

## 4. User Stories (사용자 스토리)

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-P3-01 | 운영자 | 앱 재시작 후에도 이전 대화를 볼 수 있다 | 맥락을 잃지 않는다 |
| US-P3-02 | IT 관리자 | OpenAI 없이도 RAG가 동작한다 | 비용·의존성을 줄인다 |
| US-P3-03 | 품질관리자 | "이 배치 발효 완성도 예측해줘" 라고 묻는다 | ML 기반 답변을 받는다 |
| US-P3-04 | 공장장 | 대시보드에서 예측 그래프를 본다 | 시각적 의사결정이 가능하다 |
| US-P3-05 | 운영자 | 알림을 확인하면 사라진다 | 알림이 중복 표시되지 않는다 |

---

## 5. Functional Requirements

### 5.1 영속성
- FR-P3-01: pgvector Docker Compose 구성 (로컬 개발)
- FR-P3-02: VectorStore → pgvector 마이그레이션
- FR-P3-03: bkend.ai conversations/messages/documents CRUD 실구현
- FR-P3-04: GET /api/documents 목록 + GET /api/documents/stats

### 5.2 로컬 임베딩
- FR-P3-05: `EMBEDDING_PROVIDER` 환경변수로 전략 선택
- FR-P3-06: LocalEmbedder: Ollama `nomic-embed-text` 모델 연동
- FR-P3-07: 임베딩 차원 불일치 처리 (openai 1536 vs local 768)

### 5.3 ML 예측
- FR-P3-08: FermentationPredictor (시계열 회귀) 구현
- FR-P3-09: QualityClassifier (분류 모델) 구현
- FR-P3-10: POST /api/ml/predict — 입력: batchId, POST /api/ml/quality
- FR-P3-11: 예측 결과 → system-prompt.ts 주입

### 5.4 대시보드 통합
- FR-P3-12: MLPredictionPanel 컴포넌트
- FR-P3-13: 대시보드(탭1) + 챗(탭2) 레이아웃
- FR-P3-14: Alert.acknowledged PATCH /api/alerts/:id

### 5.5 배포
- FR-P3-15: Vercel 환경변수 설정 가이드
- FR-P3-16: Docker Compose (pgvector + Ollama) 로컬 스택

---

## 6. Non-Functional Requirements

- NFR-P3-01: ML 예측 응답 < 500ms (사전 계산 캐시)
- NFR-P3-02: pgvector 쿼리 < 100ms (인덱스 최적화)
- NFR-P3-03: LocalEmbedder 임베딩 < 2초 / 청크
- NFR-P3-04: Zero downtime 배포 (Vercel)

---

## 7. Tech Stack 추가/변경

| 계층 | Phase 2 | Phase 3 |
|------|---------|---------|
| Vector DB | In-memory | pgvector (PostgreSQL 확장) |
| 임베딩 | OpenAI / mock | Ollama nomic-embed-text (로컬) |
| ML | 없음 | Python FastAPI ML 서버 OR JS 경량 모델 |
| 배포 | 없음 | Vercel + Docker Compose |

---

## 8. Phase 3 Team 역할 분담

| 역할 | 담당 | 산출물 |
|------|------|-------|
| 기획자 (PM) | product-manager | 요구사항 구체화, 우선순위 조정 |
| 설계자 (Architect) | frontend-architect | 설계문서, 컴포넌트 명세 |
| 개발자 | developer | pgvector 마이그레이션, LocalEmbedder, ML API |
| QA | qa-strategist | 테스트 전략, 시나리오, 품질 게이트 |

---

## 9. Success Metrics

- pgvector 마이그레이션: 재시작 후 문서/대화 복구율 100%
- LocalEmbedder: RAG 검색 품질 ≥ OpenAI mock 대비 30% 향상
- ML 예측 정확도: 발효 완성도 예측 오차 < 10%
- 베타 테스트: 공장 운영자 5명 1주 사용, 만족도 ≥ 4/5

---

---

## 10. Environment Variables (환경변수)

Phase 3에서 필요한 전체 환경변수 목록. `.env.local`에 설정한다.

### 기존 변수 (Phase 1/2에서 이월)

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `ANTHROPIC_API_KEY` | 필수 | — | Claude API 키 (`sk-ant-...`) |
| `OPENAI_API_KEY` | 선택 | — | OpenAI 임베딩용. 없으면 mock 또는 LocalEmbedder 사용 |

### Phase 3 신규 변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `EMBEDDING_PROVIDER` | 선택 | `mock` | 임베딩 전략: `openai` \| `local` \| `mock` |
| `DATABASE_URL` | Sprint 1 필수 | — | pgvector PostgreSQL 연결 문자열. 예: `postgresql://kimchi:password@localhost:5432/kimchi_db` |
| `OLLAMA_URL` | Sprint 2 필수 (local 사용 시) | `http://localhost:11434` | Ollama API 엔드포인트 (LocalEmbedder용) |
| `ML_SERVER_URL` | Sprint 3 필수 | `http://localhost:8000` | FastAPI ML 예측 서버 엔드포인트 |

### .env.local 전체 예시

```dotenv
# === Phase 1/2 ===
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...          # 선택 — EMBEDDING_PROVIDER=openai 시 필수

# === Phase 3: 영속성 ===
DATABASE_URL=postgresql://kimchi:password@localhost:5432/kimchi_db

# === Phase 3: 로컬 임베딩 ===
EMBEDDING_PROVIDER=local        # openai | local | mock
OLLAMA_URL=http://localhost:11434

# === Phase 3: ML 예측 ===
ML_SERVER_URL=http://localhost:8000
```

> **주의**: `EMBEDDING_PROVIDER=local`이면 `OLLAMA_URL`이 필수. `openai`이면 `OPENAI_API_KEY`가 필수. 둘 다 없으면 자동으로 `mock`으로 폴백.

---

## 11. Sprint 의존성 순서 (블로킹 관계)

```
Sprint 1 (영속성)
  └─ blocks ─▶ Sprint 2 (로컬 임베딩)
               └─ blocks ─▶ Sprint 3 (ML 예측)
                            └─ blocks ─▶ Sprint 4 (대시보드+배포)
```

### 블로킹 근거

| 블로킹 | 이유 |
|--------|------|
| Sprint 1 → Sprint 2 | LocalEmbedder가 생성한 벡터를 pgvector에 저장해야 함. 인메모리 스토어에 768차원 벡터를 저장하면 재시작 시 소멸 — 영속성 레이어 없이 LocalEmbedder를 실환경에 투입할 수 없음 |
| Sprint 2 → Sprint 3 | ML 예측 결과를 RAG 컨텍스트와 함께 Claude 프롬프트에 주입하는데, 임베딩 전략이 확정되지 않으면 벡터 차원 불일치로 retriever가 오동작 |
| Sprint 3 → Sprint 4 | MLPredictionPanel은 `/api/ml/predict` 응답 스키마에 의존. API가 없으면 UI 컴포넌트를 확정할 수 없음 |

### 병렬 가능 작업

- Sprint 1 진행 중 → Docker Compose 구성(`docker-compose.yml`)과 Ollama 모델 다운로드는 병렬 가능
- Sprint 3 진행 중 → MLPredictionPanel 목업 UI(더미 데이터)는 Sprint 3와 병렬 개발 가능

---

## 12. 기술 리스크 목록

| ID | 리스크 | 영향도 | 발생 가능성 | 완화 전략 |
|----|--------|--------|------------|-----------|
| R-01 | **pgvector 차원 불일치** — OpenAI 1536차원 vs Ollama 768차원. 기존 인덱스와 혼용 시 쿼리 오류 | HIGH | HIGH | `EMBEDDING_PROVIDER` 전환 시 벡터 테이블 재생성 + 문서 재인덱싱 스크립트 제공. 차원을 컬럼에 메타데이터로 저장 |
| R-02 | **Ollama 로컬 환경 요구** — `nomic-embed-text` 모델 최소 4GB RAM + GPU 없으면 느림 | HIGH | MEDIUM | CPU 전용 벤치마크 측정 후 NFR-P3-03(< 2초) 달성 불가 시 `gte-small` 등 경량 모델로 교체 |
| R-03 | **bkend.ai API 변경** — placeholder 기반 구현이므로 실제 API 스펙 확인 필요 | MEDIUM | MEDIUM | bkend.ai SDK 문서 재검토, 없으면 REST 직접 구현으로 대체 |
| R-04 | **ML 서버 콜드 스타트** — FastAPI 서버 첫 요청 시 모델 로딩 2~5초 | MEDIUM | HIGH | 헬스체크 엔드포인트 + 서버 기동 시 워밍업 요청 자동 발행 |
| R-05 | **pgvector Docker 로컬 포트 충돌** — 5432 포트 기존 PostgreSQL 사용 시 | LOW | MEDIUM | `docker-compose.yml`에 포트를 `5433:5432`로 매핑, `.env.local`에 포트 명시 |
| R-06 | **Vercel 배포 — pgvector 연결** — Vercel은 stateless. 외부 PostgreSQL 필요 | HIGH | HIGH | Supabase 또는 Neon (pgvector 지원 관리형 서비스) 사용 권장. `DATABASE_URL`을 Vercel 환경변수로 주입 |
| R-07 | **ML 예측 정확도 — 훈련 데이터 부족** — 실제 발효 데이터 없으면 simulator 데이터만으로 학습 | HIGH | MEDIUM | Phase 3에서는 simulator 데이터로 개념 검증. 실데이터 수집은 베타 테스트 이후 Phase 4로 이연 |

---

## 13. Definition of Done (완료 기준)

### Sprint 1 — 영속성 인프라

- [ ] `docker-compose.yml`에 pgvector 서비스 정의, `docker compose up`으로 단독 기동 가능
- [ ] `DATABASE_URL` 환경변수로 연결. 연결 실패 시 명확한 오류 메시지 출력 (silent fallback 금지)
- [ ] `VectorStore` 클래스가 pgvector 백엔드로 완전 교체 (기존 in-memory 코드 제거)
- [ ] 서버 재시작 후 업로드된 문서가 `/api/documents` 목록에 유지됨 (E2E 검증)
- [ ] `GET /api/documents/stats` — 총 문서 수, 총 청크 수, 마지막 업로드 시각 반환
- [ ] `Alert.acknowledged` 필드 추가 + `PATCH /api/alerts/:id` 동작 확인
- [ ] bkend.ai CRUD 실구현 — conversations/messages/documents 각 1개 이상 통합 테스트 통과

### Sprint 2 — 로컬 임베딩

- [ ] `EMBEDDING_PROVIDER=local` 설정 시 Ollama `nomic-embed-text` 호출 확인 (curl 테스트)
- [ ] `EMBEDDING_PROVIDER=openai` 설정 시 기존 OpenAI 임베딩 동작 유지
- [ ] `EMBEDDING_PROVIDER=mock` (또는 미설정) 시 mock 폴백 동작
- [ ] 임베딩 차원 메타데이터를 pgvector 테이블에 저장 (공급자 전환 시 불일치 탐지)
- [ ] LocalEmbedder 평균 임베딩 시간 < 2초/청크 (NFR-P3-03) — 실측값을 README에 기록
- [ ] 단위 테스트: EmbeddingProvider 팩토리가 환경변수에 따라 올바른 구현체를 반환하는지 검증

### Sprint 3 — ML 예측

- [ ] `POST /api/ml/predict` — `batchId` 입력 시 발효 완성도(%) + 신뢰구간 반환
- [ ] `POST /api/ml/quality` — 온도·염도·pH 입력 시 품질 등급(A/B/C) 반환
- [ ] ML API 응답 시간 < 500ms (캐시 히트 기준, NFR-P3-01)
- [ ] 예측 결과가 `system-prompt.ts`에 주입되어 Claude 응답에 반영됨 (대화 로그로 검증)
- [ ] `ML_SERVER_URL` 미설정 또는 서버 다운 시 graceful degradation (예측 없이 일반 RAG 응답)
- [ ] simulator 데이터 기반 모델 발효 완성도 예측 오차 < 10% (NFR 달성 여부 테스트 결과 기록)

### Sprint 4 — 대시보드+챗 통합 뷰 + 배포

- [ ] `MLPredictionPanel` 컴포넌트 — 발효 완성도 + 품질 등급 카드 표시
- [ ] 대시보드(탭1) ↔ 챗(탭2) 탭 전환 시 상태 유지 (재렌더링 없이 탭 전환)
- [ ] Vercel 프로덕션 URL에서 챗 + RAG + ML 예측 E2E 동작 확인
- [ ] Vercel 환경변수 설정 가이드 문서 작성 (`docs/05-deploy/vercel-setup.md`)
- [ ] 공장 운영자 5명 대상 베타 테스트 완료, 만족도 설문 결과 ≥ 4/5 (Success Metrics)
- [ ] Phase 3 PDCA 분석 보고서 작성 (`docs/03-analysis/kimchi-agent-phase3.analysis.md`)

---

*Plan created by CTO Team — 2026-02-27*
*Section 10–13 added by Product Manager — 2026-02-27*
