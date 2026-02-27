# Kimchi-Agent Phase 3 — QA 전략 (Zero-Script)

> **문서 유형**: QA Strategy
>
> **Project**: Kimchi-Agent
> **Phase**: 3 — ML 통합 + 영속성 + 배포
> **작성자**: qa-strategist
> **날짜**: 2026-02-27
> **근거 문서**: `docs/01-plan/features/kimchi-agent-phase3.plan.md`

---

## 1. 품질 게이트 기준

### 1.1 Phase 3 전체 목표

| 지표 | 목표 |
|------|------|
| Gap Analysis Match Rate | **≥ 90%** |
| ML 예측 응답 시간 | < 500ms (캐시 히트) |
| pgvector 쿼리 시간 | < 100ms |
| LocalEmbedder 임베딩 시간 | < 2s / 청크 |
| 재시작 후 문서·대화 복구율 | **100%** |
| 베타 테스트 만족도 | ≥ 4 / 5 |

### 1.2 Sprint별 Definition of Done (DoD)

#### Sprint 1 — 영속성 인프라
- [ ] `docker compose up` 으로 pgvector 단독 기동, 헬스체크 `\dt` 통과
- [ ] 서버 재시작 후 업로드 문서가 `/api/documents` 목록에 유지
- [ ] `GET /api/documents/stats` → `{ totalDocuments, totalChunks, lastUploadedAt }` 반환
- [ ] `PATCH /api/alerts/:id` → `acknowledged: true` 반영, UI 배지 즉시 감소
- [ ] bkend.ai CRUD 통합 테스트 1개 이상 통과 (conversation 생성·조회·삭제 왕복)
- [ ] `DATABASE_URL` 미설정 시 silent fallback 금지 — 명확한 오류 로그 출력

#### Sprint 2 — 로컬 임베딩
- [ ] `EMBEDDING_PROVIDER=local` → Ollama `nomic-embed-text` 호출 로그 확인
- [ ] `EMBEDDING_PROVIDER=openai` → 기존 OpenAI 임베딩 동작 유지
- [ ] `EMBEDDING_PROVIDER=mock` (미설정) → mock fallback 경고 없이 동작
- [ ] 임베딩 차원이 pgvector 메타데이터 컬럼에 저장 (1536 vs 768 불일치 탐지)
- [ ] LocalEmbedder 평균 임베딩 시간 < 2s 실측 → README 기록

#### Sprint 3 — ML 예측
- [ ] `POST /api/ml/predict` `{ batchId }` → `{ completeness, confidence }` 반환
- [ ] `POST /api/ml/quality` `{ temperature, salinity, ph }` → `{ grade: "A"|"B"|"C" }` 반환
- [ ] ML 예측 결과가 Claude 시스템 프롬프트에 주입 (대화 로그에서 확인)
- [ ] `ML_SERVER_URL` 미설정 또는 서버 다운 → graceful degradation (일반 RAG 응답)
- [ ] 발효 완성도 예측 오차 < 10% (simulator 데이터 기반)

#### Sprint 4 — 대시보드 + 배포
- [ ] `MLPredictionPanel` 발효 완성도 + 품질 등급 카드 렌더링 확인
- [ ] 대시보드(탭1) ↔ 챗(탭2) 전환 시 상태 유지 (DOM 재생성 없음)
- [ ] Vercel 프로덕션 URL에서 챗 + RAG + ML 예측 E2E 동작
- [ ] `docs/05-deploy/vercel-setup.md` 문서 존재 및 환경변수 목록 포함
- [ ] 베타 테스트 만족도 설문 결과 ≥ 4/5

---

## 2. Zero-Script QA 시나리오 (총 25개)

> **Zero-Script**: 자동화 테스트 코드 없이 `curl`, 브라우저 DevTools, `docker logs`만으로 검증.
> 각 시나리오는 독립적으로 실행 가능하며, Sprint DoD와 1:1 대응.

### 형식 안내

```
ID  | 시나리오명           | 방법                     | 기대값              | 합격 기준
```

---

### 2.1 영속성 테스트 (5개)

| ID | 시나리오명 | 방법 | 기대값 | 합격 기준 |
|----|-----------|------|--------|-----------|
| P-01 | **pgvector 재시작 후 벡터 유지** | 1) TXT 문서 업로드 → 2) `docker compose restart app` → 3) `GET /api/documents` | 업로드한 문서가 목록에 존재 | HTTP 200, `documents` 배열에 파일명 포함 |
| P-02 | **대화 기록 복구** | 1) 채팅 3턴 진행 → 2) 앱 재시작 → 3) `GET /api/conversations` | 재시작 전 대화 ID 목록 유지 | `conversations` 배열 길이 ≥ 1, ID 일치 |
| P-03 | **RAG 검색 영속성** | 1) CSV 업로드 → 2) 재시작 → 3) `POST /api/chat` 관련 질문 | RAG 출처에 CSV 파일명 표시 | SSE `sources` 이벤트에 파일명 포함 |
| P-04 | **DATABASE_URL 오류 명시성** | `.env.local`에서 `DATABASE_URL` 제거 후 앱 재시작 | 앱 시작 로그에 명확한 오류 메시지 | `docker logs` 또는 터미널에 "DATABASE_URL required" 류 메시지 출력, silent fallback 없음 |
| P-05 | **문서 재인덱싱 후 통계 변화** | 1) `GET /api/documents/stats` 기록 → 2) 새 문서 업로드 → 3) 재조회 | `totalDocuments` +1, `totalChunks` 증가 | 두 응답의 숫자 차이가 예상과 일치 |

---

### 2.2 임베딩 전략 테스트 (5개)

| ID | 시나리오명 | 방법 | 기대값 | 합격 기준 |
|----|-----------|------|--------|-----------|
| E-01 | **EMBEDDING_PROVIDER=mock 폴백** | `.env.local`에 `EMBEDDING_PROVIDER` 미설정 → 문서 업로드 → `POST /api/chat` | RAG 동작, 경고 없음 (mock embedding 사용) | SSE `sources` 이벤트 존재, 500 에러 없음 |
| E-02 | **EMBEDDING_PROVIDER=openai 동작** | `EMBEDDING_PROVIDER=openai`, `OPENAI_API_KEY` 유효 설정 → 문서 업로드 → 질문 | OpenAI 임베딩 사용, 시맨틱 검색 품질 향상 | `docker logs`에 "openai embedding" 로그 또는 환경변수 기반 분기 확인 |
| E-03 | **EMBEDDING_PROVIDER=local Ollama 연동** | Ollama 기동(`ollama serve`) + `EMBEDDING_PROVIDER=local` + `OLLAMA_URL=http://localhost:11434` → 문서 업로드 | Ollama `nomic-embed-text` 호출 | Ollama 로그에 embed 요청 수신 확인 (`docker logs ollama` 또는 `ollama serve` 터미널) |
| E-04 | **EMBEDDING_PROVIDER=local 타이밍 측정** | 1) 1000자 TXT 청크 업로드 → 2) 서버 로그에서 임베딩 시간 확인 | 평균 < 2000ms / 청크 | `docker logs` 타임스탬프 차이 또는 응답 헤더 `X-Embedding-Time` < 2000 |
| E-05 | **임베딩 공급자 전환 시 차원 불일치 탐지** | 1) `PROVIDER=openai` 문서 업로드(1536차원) → 2) `PROVIDER=local`로 변경 → 3) 새 문서 업로드 | 불일치 경고 또는 자동 재인덱싱 메시지 | `docker logs`에 "dimension mismatch" 또는 "re-indexing" 류 메시지. 500 에러 없이 graceful 처리 |

---

### 2.3 ML API 테스트 (5개)

| ID | 시나리오명 | 방법 | 기대값 | 합격 기준 |
|----|-----------|------|--------|-----------|
| M-01 | **발효 완성도 예측 기본** | `curl -X POST http://localhost:3000/api/ml/predict -H "Content-Type: application/json" -d '{"batchId":"batch-001"}'` | `{ "completeness": <0-100>, "confidence": <0-1> }` | HTTP 200, `completeness` 숫자, `confidence` 0~1 범위 |
| M-02 | **품질 등급 예측 기본** | `curl -X POST http://localhost:3000/api/ml/quality -d '{"temperature":18,"salinity":2.5,"ph":4.5}'` | `{ "grade": "A" \| "B" \| "C" }` | HTTP 200, `grade` 값이 세 등급 중 하나 |
| M-03 | **ML 서버 다운 graceful degradation** | `ML_SERVER_URL` 을 잘못된 주소로 설정 → `POST /api/chat` | Claude가 ML 없이 일반 RAG 응답 반환 | HTTP 200, SSE `done` 이벤트 정상 수신, 500 에러 없음 |
| M-04 | **ML 예측 결과 Claude 프롬프트 주입 확인** | `POST /api/ml/predict` 후 같은 batchId로 챗 질문 → DevTools Network → `/api/chat` 요청 | 응답 토큰에 예측값 언급 | SSE 스트림 내 "발효 완성도", "%" 또는 예측 숫자 포함 |
| M-05 | **ML 예측 응답 시간 측정** | `curl -w "\nTime: %{time_total}s\n" -X POST .../api/ml/predict -d '{"batchId":"batch-001"}'` (캐시 히트 기준) | 응답 시간 < 0.5초 | `Time: 0.XXXs` 출력에서 0.5 미만 확인 |

---

### 2.4 Alert 시스템 테스트 (5개)

| ID | 시나리오명 | 방법 | 기대값 | 합격 기준 |
|----|-----------|------|--------|-----------|
| A-01 | **Alert acknowledged PATCH** | `curl -X PATCH http://localhost:3000/api/alerts/<id> -d '{"acknowledged":true}'` | `{ "ok": true }` | HTTP 200, `ok: true` |
| A-02 | **acknowledged 후 UI 배지 감소** | 브라우저에서 알림 배지 카운트 확인 → A-01 실행 → 새로고침 없이 배지 변화 관찰 | 배지 숫자 -1 또는 배지 사라짐 | AlertBadge 컴포넌트가 재조회 없이 또는 SSE push로 즉시 업데이트 |
| A-03 | **SSE 실시간 알림 수신** | DevTools → Network → EventStream 탭 열기 → 센서 임계값 초과 시뮬레이션 | `data: {"type":"alert",...}` 이벤트 스트림 수신 | EventStream 탭에 alert 이벤트 실시간 표시 |
| A-04 | **acknowledged 알림 목록 필터링** | `GET /api/alerts?acknowledged=false` | 미확인 알림만 반환 | 응답 배열에 `acknowledged: true` 항목 없음 |
| A-05 | **다중 알림 일괄 acknowledged** | 알림 3개 순차 PATCH → `GET /api/alerts?acknowledged=false` | 0개 반환 | 응답 배열 `[]` |

---

### 2.5 문서 API 테스트 (5개)

| ID | 시나리오명 | 방법 | 기대값 | 합격 기준 |
|----|-----------|------|--------|-----------|
| D-01 | **문서 통계 기본 응답** | `curl http://localhost:3000/api/documents/stats` | `{ totalDocuments, totalChunks, lastUploadedAt }` | HTTP 200, 세 필드 모두 존재, 숫자 형식 |
| D-02 | **문서 업로드 후 통계 변화** | 1) D-01 기록 → 2) TXT 업로드 → 3) D-01 재호출 | `totalDocuments` +1, `totalChunks` ≥ 이전값+1 | 숫자 증가 확인 |
| D-03 | **문서 목록 조회** | `curl http://localhost:3000/api/documents` | 업로드한 문서 목록 배열 | HTTP 200, `documents[]` 배열에 파일명·업로드시각 포함 |
| D-04 | **문서 삭제 후 통계 감소** | 1) D-01 기록 → 2) `DELETE /api/documents/<id>` → 3) D-01 재호출 | `totalDocuments` -1 | 숫자 감소 확인 |
| D-05 | **타입별 통계 분류** | TXT 1개, CSV 1개, PDF 1개 업로드 → `GET /api/documents/stats` | `byType: { txt: 1, csv: 1, pdf: 1 }` (또는 동등 구조) | 각 타입 카운트 정확 |

---

## 3. 환경변수 조합 테스트 매트릭스

| EMBEDDING_PROVIDER | DATABASE_URL | OPENAI_API_KEY | OLLAMA_URL | ML_SERVER_URL | 기대 동작 | 합격 기준 |
|---|---|---|---|---|---|---|
| `mock` (미설정) | 없음 | 없음 | 없음 | 없음 | Mock RAG, in-memory, ML 없음 | 앱 정상 기동, 경고 없음, 채팅 동작 |
| `mock` | 설정 | 없음 | 없음 | 없음 | Mock RAG, pgvector 영속, ML 없음 | 재시작 후 문서 유지 |
| `openai` | 설정 | 유효 | 없음 | 없음 | OpenAI RAG, pgvector 영속 | 시맨틱 검색 동작, 1536차원 벡터 저장 |
| `openai` | 설정 | **없음** | 없음 | 없음 | 오류 또는 mock 폴백 | 명확한 오류 메시지 (silent 금지) |
| `local` | 설정 | 없음 | 유효 | 없음 | Ollama RAG, pgvector 영속 | 768차원 벡터, Ollama 호출 확인 |
| `local` | 설정 | 없음 | **없음** | 없음 | 오류 또는 mock 폴백 | "OLLAMA_URL required" 류 메시지 |
| `local` | 설정 | 없음 | 유효 | 유효 | Ollama RAG + ML 예측 완전 통합 | ML 예측 결과 프롬프트 주입 확인 |
| `mock` | 설정 | 없음 | 없음 | **잘못된 URL** | ML graceful degradation | 일반 RAG 응답, 500 없음 |

---

## 4. 리스크 기반 테스트 우선순위

### Critical (Sprint 완료 차단 — 반드시 통과)

| 우선순위 | 리스크 | 관련 시나리오 | 근거 |
|---------|--------|--------------|------|
| 1 | **pgvector 영속성** — 재시작 후 벡터 소멸 | P-01, P-02, P-03 | 핵심 MVP 요구사항. 실패 시 Phase 3 가치 없음 |
| 2 | **DATABASE_URL 미설정 명시성** | P-04 | Silent fallback은 운영 장애 원인. DoD 명시 |
| 3 | **임베딩 전략 전환** — 차원 불일치 | E-05 | pgvector 인덱스 손상 위험 (R-01) |
| 4 | **ML graceful degradation** | M-03 | ML 서버 다운 시 전체 채팅 불능 방지 |

### High (Sprint 검토 전 완료 권장)

| 우선순위 | 리스크 | 관련 시나리오 | 근거 |
|---------|--------|--------------|------|
| 5 | **ML API 응답 형식** | M-01, M-02 | MLPredictionPanel이 스키마에 의존 (Sprint 4 블로킹) |
| 6 | **Alert acknowledged** | A-01, A-02 | Phase 2 Known Issue. UX 회귀 위험 |
| 7 | **EMBEDDING_PROVIDER=local 성능** | E-04 | NFR-P3-03 < 2s 미달 시 LocalEmbedder 채택 불가 |
| 8 | **ML 예측 응답 시간** | M-05 | NFR-P3-01 < 500ms. 공장 운영자 UX 직접 영향 |

### Medium (베타 테스트 전 완료)

| 우선순위 | 리스크 | 관련 시나리오 | 근거 |
|---------|--------|--------------|------|
| 9 | **문서 통계 정확성** | D-01, D-02, D-05 | 운영자 문서 관리 신뢰성 |
| 10 | **대시보드 탭 전환 상태 유지** | Sprint 4 DoD | 탭 전환 시 메시지 입력 내용 소멸 방지 |
| 11 | **Alert SSE 실시간** | A-03 | 지연 알림은 공정 이상 대응 늦춤 |
| 12 | **문서 삭제 후 통계** | D-04 | 통계 부정확 시 운영자 혼란 |

### Low (Phase 4 이연 가능)

| 우선순위 | 리스크 | 관련 시나리오 |
|---------|--------|--------------|
| 13 | 다중 알림 일괄 acknowledged | A-05 |
| 14 | ML 예측 정확도 < 10% 오차 | M-05 관련 |
| 15 | Vercel 환경변수 가이드 완결성 | Sprint 4 DoD |

---

## 5. 베타 테스트 계획 (공장 운영자 5명)

### 5.1 기간 및 대상

| 항목 | 내용 |
|------|------|
| 기간 | Sprint 4 완료 후 **1주** |
| 참가자 | 공장 운영자 5명 (현장 경험 1년 이상) |
| 환경 | Vercel 프로덕션 URL (실 배포) |
| 지원 | Slack/카카오톡 채널 — 문제 즉시 보고 |

### 5.2 핵심 워크플로우 시나리오 (5가지)

| # | 시나리오 | 목적 | 성공 기준 |
|---|---------|------|---------|
| BT-01 | **문서 업로드 + 질문** | RAG 유용성 검증 | 운영자가 "도움이 됐다" 응답 (4/5 이상) |
| BT-02 | **발효 완성도 예측 조회** | ML 직관성 검증 | "이 숫자를 이해할 수 있다" 응답 |
| BT-03 | **알림 확인 후 사라짐** | Alert UX 검증 | 알림 누른 후 1초 이내 배지 감소 확인 |
| BT-04 | **대시보드 ↔ 챗 전환** | 탭 UX 검증 | 전환 후 입력 내용 유지, 혼란 없음 |
| BT-05 | **앱 재접속 후 이전 대화 조회** | 영속성 UX 검증 | 어제 대화를 오늘 이어서 볼 수 있음 |

### 5.3 수집 지표

| 지표 | 측정 방법 | 목표 |
|------|---------|------|
| 응답 시간 체감 | 설문 (1~5점) | ≥ 4 / 5 |
| 답변 정확도 체감 | 설문 (1~5점) | ≥ 4 / 5 |
| 전반 만족도 | 설문 (1~5점) | ≥ 4 / 5 |
| 버그 보고 수 | Slack 채널 집계 | ≤ 3건 (Critical 0건) |
| 일일 활성 사용자 | 서버 로그 | 5명 중 ≥ 4명 매일 접속 |

### 5.4 베타 종료 기준

- 만족도 ≥ 4/5 AND Critical 버그 0건 → **Phase 3 완료 선언**
- 만족도 < 4/5 또는 Critical 버그 ≥ 1건 → 해당 스프린트 재작업 후 재테스트

---

## 6. 테스트 실행 순서 권장

```
Sprint 1 완료 후:
  P-01 → P-02 → P-03 → P-04 → P-05
  D-01 → D-02 → D-03 → D-05
  A-01 → A-02 → A-04

Sprint 2 완료 후:
  E-01 → E-02 → E-03 → E-04 → E-05
  환경변수 매트릭스 (8개 조합 순차 검증)

Sprint 3 완료 후:
  M-01 → M-02 → M-05 (성능)
  M-03 (degradation) → M-04 (프롬프트 주입)
  A-03 → A-05

Sprint 4 완료 후:
  D-04
  베타 테스트 BT-01 ~ BT-05
```

---

## 7. 참고 문서

| 문서 | 위치 |
|------|------|
| Phase 3 Plan | `docs/01-plan/features/kimchi-agent-phase3.plan.md` |
| Phase 2 Analysis | `docs/archive/2026-02/kimchi-agent-phase2/kimchi-agent-phase2.analysis.md` |
| Phase 2 Report | `docs/archive/2026-02/kimchi-agent-phase2/kimchi-agent-phase2.report.md` |
| Phase 3 Design (예정) | `docs/02-design/features/kimchi-agent-phase3.design.md` |

---

*QA Strategy 작성: qa-strategist — 2026-02-27*
*Phase 3 Gap Analysis 목표 Match Rate: ≥ 90%*
