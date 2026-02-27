# Plan: Kimchi-Agent Phase 2 — 공정 데이터 연동 + 영구 저장소

**Feature ID**: kimchi-agent-phase2
**Created**: 2026-02-27
**Level**: Dynamic
**Priority**: High
**Status**: Planning

---

## 1. Overview (개요)

Phase 1 MVP 완료 (Match Rate 97.4%, 29 files) 후 Phase 2로 진입.

핵심 목표: **인메모리 임시 저장 → 영구 저장소 전환** + **실시간 공정 데이터 연동** + **문서 관리 고도화**

Phase 2가 완료되면 실제 공장 운영 환경에서 배포 가능한 수준의 안정성과 기능성을 갖춘다.

---

## 2. Problem Statement (문제 정의)

### Phase 1에서 확인된 문제점

| 우선순위 | 문제 | 영향 |
|---------|------|------|
| HIGH | 대화/벡터 스토어가 인메모리 — 서버 재시작 시 모든 데이터 손실 | 운영 불가 |
| HIGH | `bkend.ts`가 플레이스홀더 — 실제 영구 저장소 없음 | 운영 불가 |
| HIGH | OPENAI_API_KEY 없을 때 mock embedding — 시맨틱 RAG 불가 | 품질 저하 |
| MEDIUM | SSE `conversationId` 항상 빈 문자열 (streaming.ts:64) | 버그 |
| MEDIUM | 문서 DELETE/LIST API 없음 | 기능 부재 |
| MEDIUM | PDF 대체 추출 품질 낮음 | 품질 저하 |
| LOW | 모델/토큰 하드코딩 | 유지보수 어려움 |
| LOW | `Date.now() + Math.random()` ID 생성 — 충돌 가능 | 안정성 |

### 비즈니스 갭

- 공장 운영자들이 원하는 실시간 센서 데이터(발효실 온도, 습도, 염도) 연동 없음
- AI가 현재 공정 상태를 모르고 답변하는 한계
- 이상 발생 시 즉각 알림 없음

---

## 3. Goals (목표)

### Sprint 1 (Week 1-2): 기반 인프라 안정화
- [ ] 영구 저장소 전환 (대화/문서 메타/벡터)
- [ ] 알려진 버그 6개 수정 (conversationId, UUID, 모델 하드코딩 등)
- [ ] 문서 관리 API 확장 (LIST, DELETE, 통계)

### Sprint 2 (Week 3-4): 공정 데이터 연동
- [ ] 실시간 센서 데이터 API (`/api/process-data`)
- [ ] 시뮬레이터 구축 (실제 센서 전 개발용)
- [ ] AI 컨텍스트에 센서 데이터 주입

### Sprint 3 (Week 5-6): UI + 알림
- [ ] 실시간 상태 패널 (Sidebar 또는 별도 뷰)
- [ ] 이상 감지 알림 시스템 (임계값 기반)
- [ ] 대화 검색/필터

### Sprint 4 (Week 7-8): RAG 고도화 + 사용자 피드백
- [ ] 고급 RAG (한국어 특화 임베딩, Hybrid Search)
- [ ] 베타 테스터 배포 (공장 운영자 2-3명)
- [ ] 피드백 수집 및 반영

---

## 4. User Stories (사용자 스토리)

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-P2-01 | 공장 운영자 | "현재 발효실 온도가 몇도야?" 라고 물으면 실시간 데이터로 답변받고 싶다 | 직접 계기판 확인 없이 빠르게 파악할 수 있다 |
| US-P2-02 | 품질관리자 | 온도가 임계값 벗어날 때 AI 채팅으로 즉시 알림받고 싶다 | 빠르게 대응할 수 있다 |
| US-P2-03 | 공장장 | 업로드한 문서 목록을 보고 개별 삭제하고 싶다 | RAG 소스를 관리할 수 있다 |
| US-P2-04 | 운영자 | 서버가 재시작돼도 이전 대화가 남아있으면 좋겠다 | 대화 연속성이 유지된다 |
| US-P2-05 | 공장장 | 지난 대화에서 특정 키워드로 검색하고 싶다 | 과거 판단 근거를 찾을 수 있다 |
| US-P2-06 | IT 관리자 | 개발자 없이도 AI 모델을 교체하거나 토큰 설정을 바꾸고 싶다 | 환경변수로 간단히 조정할 수 있다 |

---

## 5. Functional Requirements (기능 요구사항)

### 5.1 영구 저장소 (P2-01) — HIGH

- FR-P2-01: 대화/메시지를 bkend.ai 또는 PostgreSQL에 영구 저장
- FR-P2-02: 벡터 임베딩을 pgvector 또는 Pinecone에 영구 저장
- FR-P2-03: 서버 재시작 후 데이터 복원 보장

### 5.2 버그 수정 (P2-02~18) — HIGH/MEDIUM

- FR-P2-04: SSE `done` 이벤트에 올바른 `conversationId` 포함
- FR-P2-05: `crypto.randomUUID()` 사용 (Node.js 내장)
- FR-P2-06: 환경변수 `CLAUDE_MODEL`, `CLAUDE_MAX_TOKENS` 지원
- FR-P2-07: 일관된 `ApiResponse<T>` 래퍼 (`{ data, error, meta }`)
- FR-P2-08: `.env.example` 파일로 온보딩 단순화
- FR-P2-09: 시스템 프롬프트에 AI 가드레일 (의료/법률 조언 거부 등) 명시

### 5.3 문서 관리 API (P2-05) — MEDIUM

- FR-P2-10: `GET /api/documents` — 목록 (페이지네이션 지원)
- FR-P2-11: `GET /api/documents/stats` — 총 문서 수, 총 청크 수, 벡터 스토어 크기
- FR-P2-12: `DELETE /api/documents/[id]` — 개별 문서 삭제 (청크 포함)
- FR-P2-13: `GET /api/rag/debug?q=...` — 검색 디버깅 (top-5 결과)

### 5.4 공정 데이터 API (P2-03) — HIGH

- FR-P2-14: `GET /api/process-data` — 현재 센서 수치 (온도, 습도, 염도, pH, 배치ID)
- FR-P2-15: `GET /api/process-data/history?hours=24` — 이력 데이터
- FR-P2-16: 시뮬레이터 모드 (`PROCESS_DATA_MODE=simulator`) 지원
- FR-P2-17: 실제 센서 클라이언트 인터페이스 (`lib/process/sensor-client.ts`)

### 5.5 알림 시스템 (P2-08) — MEDIUM

- FR-P2-18: 임계값 규칙 엔진 (`lib/process/alert-rules.ts`)
- FR-P2-19: 이상 감지 시 채팅 메시지로 Push
- FR-P2-20: `GET /api/alerts/stream` — SSE 기반 실시간 알림 스트림

### 5.6 실시간 상태 패널 (P2-07) — MEDIUM

- FR-P2-21: Sidebar 상단 또는 별도 탭에 현재 배치 상태 표시
- FR-P2-22: 센서 수치 (온도/습도/염도/pH) 카드 형태 표시
- FR-P2-23: 이상 알림 배지 표시

### 5.7 RAG 고도화 (P2-06) — MEDIUM

- FR-P2-24: 한국어 특화 임베딩 모델 지원 (`multilingual-e5-base` 등)
- FR-P2-25: Hybrid Search (BM25 키워드 + 벡터 시맨틱)
- FR-P2-26: 임베딩 제공자 환경변수 전환 (`EMBEDDING_PROVIDER=openai|local`)

### 5.8 UX 개선 (P2-15, P2-16) — LOW

- FR-P2-27: 대화 목록 키워드 검색
- FR-P2-28: 날짜 범위 필터
- FR-P2-29: 문서 업로드 전 내용 미리보기 모달

---

## 6. Non-Functional Requirements (비기능 요구사항)

- NFR-P2-01: 영구 저장 후 대화 복원 지연 < 500ms
- NFR-P2-02: 센서 데이터 폴링 주기 30초 이하
- NFR-P2-03: 알림 지연 < 1분 (임계값 초과 → 채팅 알림)
- NFR-P2-04: Vector DB 5,000개 문서까지 검색 응답 < 500ms
- NFR-P2-05: Phase 1 기능 모두 회귀 없이 유지

---

## 7. Tech Stack (기술 스택)

| 계층 | Phase 1 | Phase 2 결정 |
|------|---------|-------------|
| 대화 저장 | 인메모리 Map | bkend.ai (검토) 또는 PostgreSQL |
| 벡터 저장 | 인메모리 Map | pgvector (Supabase) 또는 Pinecone |
| 임베딩 | OpenAI / mock | OpenAI + 한국어 모델 A/B 테스트 |
| 공정 데이터 | 없음 | 시뮬레이터 → 실제 센서 API |
| 알림 | 없음 | SSE (`/api/alerts/stream`) |

### 핵심 결정 사항 (구현 전 확인 필요)

1. **저장소**: bkend.ai 벡터 검색 지원 여부 → 미지원 시 pgvector
2. **센서 인터페이스**: 공장 센서 시스템 API 스펙 확보 → 없으면 시뮬레이터 우선
3. **임베딩 모델**: 한국어 벤치마크 기준 정의 필요

---

## 8. Implementation Order (구현 순서)

```
Day 1-2: S 크기 버그픽스 (의존성 없음)
  P2-11 .env.example
  P2-14 crypto.randomUUID()
  P2-02 conversationId SSE 수정
  P2-13 모델/토큰 환경변수
  P2-17 AI 가드레일
  P2-18 ApiResponse<T> 래퍼

Week 1-2: 영구 저장소 (P2-01) ← 핵심
  bkend.ts 실제 구현 OR PostgreSQL 스키마
  retriever.ts 벡터 DB 마이그레이션
  conversations/route.ts DB CRUD

Week 2-3: 문서 관리 API (P2-05)
  GET /api/documents
  DELETE /api/documents/[id]
  GET /api/rag/debug

Week 3-5: 공정 데이터 API (P2-03)
  lib/process/simulator.ts
  lib/process/sensor-client.ts
  lib/process/alert-rules.ts
  app/api/process-data/route.ts
  system-prompt.ts 센서 데이터 주입

Week 5-6: 실시간 UI (P2-07, P2-08)
  ProcessStatusPanel 컴포넌트
  /api/alerts/stream SSE
  알림 채팅 메시지 Push

Week 7-8: RAG 고도화 + 피드백 (P2-06, P2-04)
  임베딩 모델 A/B 테스트
  Hybrid Search 구현
  베타 배포 + 피드백 수집
```

---

## 9. New Files (신규 파일 목록)

```
.env.example                              ← 온보딩
lib/
  process/
    simulator.ts                          ← 센서 시뮬레이터
    sensor-client.ts                      ← 실제 센서 클라이언트
    alert-rules.ts                        ← 임계값 규칙 엔진
  db/
    schema.sql (또는 bkend-schema.ts)     ← DB 스키마
app/
  api/
    process-data/route.ts                 ← 공정 데이터 GET
    process-data/history/route.ts         ← 이력 GET
    documents/route.ts                    ← 문서 LIST
    documents/[id]/route.ts               ← 문서 DELETE
    documents/stats/route.ts              ← 통계 GET
    rag/debug/route.ts                    ← RAG 디버그
    alerts/stream/route.ts                ← 알림 SSE
components/
  process/
    ProcessStatusPanel.tsx                ← 센서 상태 패널
    SensorCard.tsx                        ← 센서 수치 카드
    AlertBadge.tsx                        ← 이상 알림 배지
```

---

## 10. Success Metrics (성공 지표)

| 지표 | 목표 | 측정 방법 |
|------|------|---------|
| 데이터 영속성 | 서버 재시작 후 0건 손실 | 재시작 전후 대화 수 비교 |
| 센서 연동 | 폴링 주기 ≤ 30초 | API 응답 타임스탬프 |
| 알림 지연 | 임계값 초과 후 ≤ 1분 | 이벤트 로그 |
| RAG 품질 | 한국어 시맨틱 검색 정확도 > 85% | 10개 샘플 질문 테스트 |
| 베타 사용률 | 공장 운영자 일 1회 이상 > 80% | 로그 분석 |

---

## 11. Risks (리스크)

| ID | 리스크 | 확률 | 대응 |
|----|--------|:----:|------|
| R1 | bkend.ai 벡터 검색 미지원 | 중 | pgvector 병행 계획 |
| R2 | 센서 시스템 접근 불가 | 높 | 시뮬레이터 우선 개발 |
| R3 | 한국어 임베딩 품질 저하 | 중 | A/B 테스트, OpenAI 폴백 유지 |
| R4 | 인메모리→DB 마이그레이션 데이터 손실 | 낮 | 듀얼 라이트 전환 기간 운영 |

---

## Stakeholders

- **공장장**: 영구 대화 기록, 공정 현황 실시간 파악
- **운영자**: 이상 알림, 센서 기반 AI 답변
- **품질관리자**: 문서 관리, RAG 품질 확인
- **IT 관리자**: 환경변수 설정, DB 관리

---

*Plan created — 2026-02-27*
*Reference: kimchi-agent Phase 1 Plan + CTO Phase 2 Analysis*
