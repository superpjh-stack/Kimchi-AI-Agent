# Plan: Kimchi-Agent Phase 4 — 배포 · 베타 · 품질 고도화

**Feature ID**: kimchi-agent-phase4
**Created**: 2026-02-28
**Level**: Dynamic
**Priority**: High
**Status**: Planning

---

## 1. Overview (개요)

Phase 3 완료(Match Rate 91.0%) 기준으로, Phase 4는 세 가지 축을 진행한다:

1. **프로덕션 배포** — Vercel + 관리형 pgvector(Supabase/Neon) 클라우드 스택
2. **베타 테스트** — 공장 운영자 5명 1주 실사용, 품질 피드백 수집
3. **품질 고도화** — 단위 테스트 스위트, 실 발효 데이터 기반 ML 정확도 향상

---

## 2. Problem Statement (문제 정의)

| 분류 | 문제 | 우선순위 |
|------|------|---------|
| 배포 | Vercel 배포 미완 — 로컬 개발 환경에서만 동작 | HIGH |
| 영속성 | Vercel은 stateless → pgvector 클라우드 연결 필요 | HIGH |
| 테스트 | EmbeddingProvider·ML predictor 단위 테스트 없음 | HIGH |
| 실데이터 | ML 모델이 simulator 데이터로만 학습됨 | MEDIUM |
| 모니터링 | 에러 추적·성능 모니터링 미구성 | MEDIUM |
| 문서화 | Vercel 환경변수 설정 가이드 미작성 (FR-P3-15 이월) | MEDIUM |
| UX 정제 | 베타 테스트 미완, 운영자 피드백 수집 필요 | MEDIUM |

---

## 3. Goals (목표)

### Sprint 1 — 프로덕션 배포 (1주)
- [ ] Supabase 또는 Neon pgvector 인스턴스 설정
- [ ] Vercel 프로젝트 생성 + 환경변수 설정
- [ ] `docs/05-deploy/vercel-setup.md` 배포 가이드 작성
- [ ] 프로덕션 URL에서 Chat + RAG + ML E2E 동작 확인

### Sprint 2 — 테스트 인프라 (1주)
- [ ] Jest + `@testing-library/react` 설정
- [ ] EmbeddingProvider 팩토리 단위 테스트 (환경변수별 구현체 반환)
- [ ] ML predictor 단위 테스트 (Q10 공식, A/B/C 등급 경계값)
- [ ] VectorStore 팩토리 단위 테스트 (pgvector/인메모리 분기)
- [ ] CI: GitHub Actions 워크플로 추가 (lint + tsc + jest)

### Sprint 3 — 베타 테스트 (1주)
- [ ] 공장 운영자 5명 대상 1주 실사용 진행
- [ ] 피드백 설문 폼 작성 + 수집 (만족도 ≥ 4/5 목표)
- [ ] 실 발효 배치 데이터 5건 이상 수집 → `data/fermentation/` 저장
- [ ] 버그 리포트 트리아지 + 우선순위 수정

### Sprint 4 — ML 고도화 + 모니터링 (1주)
- [ ] 실 발효 데이터로 RuleBasedPredictor 파라미터 보정
- [ ] ML 예측 결과 캐싱 (동일 sensors 입력 → 500ms 이내 응답)
- [ ] Vercel Analytics 연동 (응답 시간 추적)
- [ ] Sentry 에러 추적 연동 (클라이언트 + 서버)
- [ ] NFR 벤치마크 기록: LocalEmbedder < 2초/청크 실측값

---

## 4. User Stories (사용자 스토리)

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-P4-01 | IT 관리자 | Vercel URL로 앱에 접근한다 | 로컬 서버 없이 사용 가능 |
| US-P4-02 | 공장 운영자 | 클라우드 배포된 앱을 스마트폰에서 사용한다 | 현장에서 즉시 질문 가능 |
| US-P4-03 | 품질관리자 | ML 예측 신뢰도가 실 데이터 기반으로 높아진다 | 더 정확한 의사결정 |
| US-P4-04 | 개발자 | `npm test`로 회귀 테스트를 실행한다 | 코드 변경 시 안전성 확인 |
| US-P4-05 | 운영자 | 에러 발생 시 Sentry 알림을 받는다 | 신속한 장애 대응 |

---

## 5. Functional Requirements

### 5.1 배포
- FR-P4-01: Vercel 프로덕션 배포 완료 — `kimchi-agent.vercel.app` 또는 커스텀 도메인
- FR-P4-02: Supabase/Neon pgvector 연결 — `DATABASE_URL` Vercel 환경변수로 주입
- FR-P4-03: `docs/05-deploy/vercel-setup.md` 배포 가이드 (환경변수 목록, 순서)
- FR-P4-04: Vercel 배포 후 `GET /api/health` 응답 `status: "ok"` 확인

### 5.2 테스트
- FR-P4-05: Jest 설정 (`jest.config.ts` + `jest.setup.ts`)
- FR-P4-06: `lib/rag/embedder.test.ts` — EmbeddingProvider 팩토리 3가지 분기 테스트
- FR-P4-07: `lib/ml/rule-based-predictor.test.ts` — Q10, 등급 경계값 10개 이상 케이스
- FR-P4-08: `lib/rag/retriever.test.ts` — getVectorStore() 팩토리 분기 테스트
- FR-P4-09: GitHub Actions CI — push/PR 시 `lint + tsc + jest` 자동 실행

### 5.3 베타 테스트
- FR-P4-10: 운영자 피드백 설문 (5점 척도 + 자유 의견)
- FR-P4-11: 실 발효 데이터 수집 (`data/fermentation/*.csv` 형식)
- FR-P4-12: 베타 기간 버그 리포트 수집 + GitHub Issue 등록

### 5.4 ML 고도화
- FR-P4-13: 실 데이터 기반 Q10 온도 보정 파라미터 재조정
- FR-P4-14: ML 예측 결과 30초 캐싱 (동일 sensors 입력 → 캐시 히트)
- FR-P4-15: NFR-P3-01 실측: 캐시 히트 < 500ms, 미스 < 2초

### 5.5 모니터링
- FR-P4-16: Vercel Analytics 대시보드 — API 응답 시간 추적
- FR-P4-17: Sentry DSN 설정 — 클라이언트 + Next.js 서버 에러 캡처

---

## 6. Non-Functional Requirements

- NFR-P4-01: Vercel 배포 — Cold Start < 3초
- NFR-P4-02: ML 예측 캐시 히트율 ≥ 80% (30초 갱신 주기)
- NFR-P4-03: 단위 테스트 커버리지 ≥ 70% (lib/rag/, lib/ml/ 대상)
- NFR-P4-04: 베타 테스트 만족도 ≥ 4/5

---

## 7. Tech Stack 추가/변경

| 계층 | Phase 3 | Phase 4 |
|------|---------|---------|
| 배포 | 없음 (로컬) | Vercel (Next.js) |
| Vector DB | Docker pgvector (로컬) | Supabase pgvector or Neon (관리형) |
| 테스트 | 없음 | Jest + Testing Library |
| CI/CD | 없음 | GitHub Actions |
| 모니터링 | 없음 | Vercel Analytics + Sentry |

---

## 8. Phase 4 Team 역할 분담

| 역할 | 담당 | 산출물 |
|------|------|-------|
| 팀리드 | team-lead | Phase 4 플랜, 배포 조율 |
| 설계자 | architect | 테스트 아키텍처, CI 설계 |
| 개발자 | developer | Jest 설정, 단위 테스트, ML 캐싱, Sentry 연동 |
| QA | qa-strategist | 베타 테스트 시나리오, 피드백 분석 |

---

## 9. Success Metrics

- Vercel 배포: 프로덕션 URL에서 E2E 동작 100%
- 단위 테스트: `npm test` 전체 PASS, 커버리지 ≥ 70%
- 베타 테스트: 운영자 5명 만족도 평균 ≥ 4/5
- ML 캐시: 히트율 ≥ 80%, 응답 < 500ms
- CI: PR 머지 전 자동 테스트 통과

---

## 10. Phase 3 이월 항목

| 항목 | Phase 3 FR | 상태 |
|------|-----------|------|
| Vercel 환경변수 설정 가이드 | FR-P3-15 | → FR-P4-03으로 이월 |
| LocalEmbedder 임베딩 시간 실측 | NFR-P3-03 | → FR-P4-15로 이월 |
| 단위 테스트 (EmbeddingProvider) | Phase 3 DoD | → FR-P4-06으로 이월 |
| 공장 운영자 베타 테스트 | Phase 3 DoD | → Sprint 3로 이월 |

---

## 11. Sprint 의존성 순서

```
Sprint 1 (배포)
  └─ blocks ─▶ Sprint 2 (테스트) — 배포 환경 확정 후 E2E 테스트 가능
               └─ parallel ─▶ Sprint 3 (베타) — 배포 완료 후 운영자 테스트
                              └─ blocks ─▶ Sprint 4 (ML 고도화) — 실 데이터 수집 후 모델 보정
```

---

## 12. 기술 리스크 목록

| ID | 리스크 | 영향도 | 완화 전략 |
|----|--------|--------|-----------|
| R-01 | Supabase/Neon 무료 플랜 연결 제한 | MEDIUM | 개발용 Free, 프로덕션 Pro 플랜 분리 |
| R-02 | 실 발효 데이터 수집 거부 (현장 보안) | HIGH | 익명화 + 로컬 집계만 수집 |
| R-03 | Vercel Cold Start > 3초 | MEDIUM | Edge Runtime 활용 또는 워밍업 크론 |
| R-04 | Jest + Next.js App Router 호환 | MEDIUM | `jest.config.ts`에 `moduleNameMapper` 설정 |

---

## 13. Definition of Done (완료 기준)

### Sprint 1 — 프로덕션 배포
- [ ] `https://kimchi-agent.vercel.app` (또는 동등 URL) 접근 가능
- [ ] `GET /api/health` → `{ status: "ok", services: { vectorStore: "pgvector", ... } }`
- [ ] 채팅 → RAG 검색 → Claude 응답 E2E 확인 (스크린샷 첨부)
- [ ] `docs/05-deploy/vercel-setup.md` 작성 완료

### Sprint 2 — 테스트 인프라
- [ ] `npm test` → 전체 PASS (0 failures)
- [ ] 커버리지 리포트 생성 — `lib/rag/embedder`, `lib/ml/rule-based-predictor` ≥ 70%
- [ ] GitHub Actions 워크플로 — `main` push 시 자동 실행 확인

### Sprint 3 — 베타 테스트
- [ ] 운영자 5명 피드백 수집 완료 + 평균 만족도 ≥ 4/5
- [ ] 실 발효 데이터 파일 5건 이상 `data/fermentation/` 저장
- [ ] 베타 버그 리포트 전체 트리아지 완료

### Sprint 4 — ML 고도화 + 모니터링
- [ ] ML 캐시 캐시 히트 시 응답 < 500ms (실측 로그)
- [ ] Sentry 에러 캡처 확인 (테스트 에러 발생 → Sentry 대시보드 확인)
- [ ] NFR-P3-03 실측: LocalEmbedder 평균 임베딩 시간 README 기록
- [ ] Phase 4 PDCA 분석 보고서 작성

---

*Plan created by Team Lead — 2026-02-28*
