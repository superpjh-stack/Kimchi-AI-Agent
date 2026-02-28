# kimchi-agent-phase5 Planning Document

> **Summary**: 베타 테스트 피드백 반영 + 실 운영 안정화 + ML 고도화 + 다국어/접근성 + 운영 최적화
>
> **Project**: Kimchi-Agent
> **Version**: 5.0.0
> **Author**: Product Manager
> **Date**: 2026-02-28
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

Phase 4에서 완료된 Vercel 배포, CI/CD, Sentry 모니터링 기반 위에서 베타 테스트(2026-03-07 ~ 2026-03-14) 결과를 반영하여 실 운영 환경의 안정성과 사용자 만족도를 높인다. 아울러 ML 모델 정확도 고도화, 다국어 지원, 접근성 개선, 운영 효율 최적화를 달성하여 Kimchi-Agent를 공장 현장에서 신뢰할 수 있는 운영 도구로 완성한다.

### 1.2 Background

**완료된 Phase 이력**

| Phase | 주요 달성 사항 | Match Rate |
|-------|--------------|-----------|
| Phase 1+2 | 기본 Chat + RAG + 문서 업로드 + bkend.ai 저장소 + 공정 데이터 시스템 | 97.4% / 92.2% |
| Phase 3 | pgvector, LocalEmbedder(Ollama), ML 예측(RuleBasedPredictor), Recharts 대시보드 | 91.0% |
| Phase 4 | Vercel 배포, Jest 61 tests, GitHub Actions CI/CD, ML 캐싱(TTL 30s), Sentry 모니터링 | 93.9% |

**Phase 4 미완료 이관 항목**

- `/api/health` 엔드포인트에 `services.chat` 필드 미포함
- `troubleshooting.md` 독립 파일 미생성
- Sentry 성능 최적화(베타 이후 시점으로 연기)

**베타 테스트 컨텍스트**

- 대상: 공장 운영자 5명
- 기간: 2026-03-07 ~ 2026-03-14 (7일)
- 검증 시나리오: TC-01~05
- 만족도: 5점 척도 조사

Phase 5는 베타 결과 수령 직후(2026-03-15 예정)부터 4개 Sprint로 진행한다.

### 1.3 Related Documents

- Phase 1+2 Plan: `docs/01-plan/features/kimchi-agent.plan.md`
- Phase 3+4 Design: `docs/02-design/features/kimchi-agent-phase2.design.md`
- Phase 4 Analysis: `docs/03-analysis/kimchi-agent-phase2.analysis.md` (Match Rate: 92.2%)
- Chunking Options Plan: `docs/01-plan/features/chunking-options.plan.md`

---

## 2. Scope

### 2.1 In Scope

- [ ] **Sprint 1 — 베타 피드백 반영**: 베타 테스트 결과 분석, 버그 수정, UX 개선
- [ ] **Sprint 1 — Phase 4 이관 항목**: `/api/health` services.chat 필드, `troubleshooting.md` 생성
- [ ] **Sprint 2 — ML 고도화**: 실 발효 데이터 기반 ML 파라미터 재조정, 이상 감지 강화
- [ ] **Sprint 3 — 다국어/접근성**: 영어(en) 지원, WCAG 2.1 AA 접근성 개선
- [ ] **Sprint 4 — 운영 최적화**: 응답 속도 개선, 메모리 최적화, 구조화 로깅
- [ ] Sentry 성능 최적화 (Phase 4 이관)
- [ ] 테스트 커버리지 유지 (Jest >= 80%)

### 2.2 Out of Scope

- 신규 AI 모델 교체 (GPT-4o-mini / claude-sonnet-4-6 유지)
- 모바일 네이티브 앱 (React Native 등)
- 실시간 공장 설비 직접 제어 자동화
- B2B SaaS 다테넌트 아키텍처 전환
- 유료 결제 시스템 통합

---

## 3. Requirements

### 3.1 Functional Requirements

#### Sprint 1 — 베타 피드백 반영

| ID | Requirement | Priority | MoSCoW | Status |
|----|-------------|----------|--------|--------|
| FR-01 | 베타 테스트 TC-01~05 결과 분석 보고서 작성 | High | Must | Pending |
| FR-02 | 베타 기간 발생 버그 전수 수정 | High | Must | Pending |
| FR-03 | UX 개선: 사용자 피드백 기반 Quick Questions 항목 조정 | High | Must | Pending |
| FR-04 | `/api/health` 엔드포인트에 `services.chat` 필드 추가 | High | Must | Pending |
| FR-05 | `docs/troubleshooting.md` 독립 파일 생성 (FAQ, 오류 코드, 해결법) | Medium | Should | Pending |
| FR-06 | 베타 만족도 5점 척도 결과 대시보드 반영 | Medium | Should | Pending |

#### Sprint 2 — ML 고도화

| ID | Requirement | Priority | MoSCoW | Status |
|----|-------------|----------|--------|--------|
| FR-07 | 실 발효 데이터(베타 7일치)로 RuleBasedPredictor 파라미터 재조정 | High | Must | Pending |
| FR-08 | 이상 감지(Anomaly Detection) 임계값 정밀화 | High | Must | Pending |
| FR-09 | ML 예측 신뢰도 점수(confidence score) UI 표시 | Medium | Should | Pending |
| FR-10 | 예측 결과 이력(history) 저장 및 트렌드 차트 | Medium | Should | Pending |
| FR-11 | Sentry 성능 트레이싱 — ML 추론 레이턴시 측정 | Medium | Should | Pending |
| FR-12 | ML 모델 A/B 테스트 프레임워크 기초 설계 | Low | Could | Pending |

#### Sprint 3 — 다국어/접근성

| ID | Requirement | Priority | MoSCoW | Status |
|----|-------------|----------|--------|--------|
| FR-13 | i18n 프레임워크 도입 (next-intl 또는 react-i18next) | High | Must | Pending |
| FR-14 | 한국어(ko) / 영어(en) 언어 파일 분리 및 번역 적용 | High | Must | Pending |
| FR-15 | 언어 전환 UI (Header 또는 설정 패널) | High | Must | Pending |
| FR-16 | WCAG 2.1 AA 기준 접근성 감사(audit) 수행 | High | Must | Pending |
| FR-17 | 키보드 내비게이션 전체 지원 | Medium | Should | Pending |
| FR-18 | 스크린리더(ARIA) 속성 완성 | Medium | Should | Pending |
| FR-19 | 고대비(High Contrast) 모드 지원 | Low | Could | Pending |

#### Sprint 4 — 운영 최적화

| ID | Requirement | Priority | MoSCoW | Status |
|----|-------------|----------|--------|--------|
| FR-20 | 첫 토큰 응답 시간 < 2초 목표 달성 (현재 < 3초) | High | Must | Pending |
| FR-21 | 구조화 로깅 (JSON 포맷, 레벨 분리: info/warn/error) | High | Must | Pending |
| FR-22 | 메모리 사용량 프로파일링 및 누수 제거 | High | Must | Pending |
| FR-23 | RAG 파이프라인 캐싱 고도화 (TTL 설정 세분화) | Medium | Should | Pending |
| FR-24 | API Rate Limiting 강화 (per-IP, per-user) | Medium | Should | Pending |
| FR-25 | CDN 최적화 (정적 자산 캐시, Next.js Image 최적화) | Low | Could | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method | MoSCoW |
|----------|----------|--------------------|--------|
| Performance | 첫 토큰 응답 < 2초 (p95) | Sentry Performance / k6 부하 테스트 | Must |
| Performance | 페이지 로드 LCP < 2.5초 | Lighthouse CI (GitHub Actions) | Must |
| Reliability | 가동률 >= 99.5% (월 기준) | Vercel Analytics + Sentry Uptime | Must |
| Test Coverage | Jest 커버리지 >= 80% | `npm run test -- --coverage` | Must |
| Accessibility | WCAG 2.1 AA 준수 | axe-core / Lighthouse Accessibility >= 90 | Must |
| Security | OWASP Top 10 점검 | 수동 감사 + Snyk | Should |
| Localization | 한국어/영어 전환 오류 0건 | E2E 테스트 (Playwright) | Must |
| Maintainability | TypeScript strict 모드 오류 0건 | `tsc --strict` CI 검사 | Should |
| Observability | 구조화 로그 100% 적용 | 로그 샘플 감사 | Should |
| ML Accuracy | 발효 완성도 예측 정확도 >= 85% | 베타 데이터 백테스트 | Should |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 베타 TC-01~05 전 시나리오 Pass (버그 0건 잔존)
- [ ] 베타 만족도 평균 >= 4.0 / 5.0 점
- [ ] `/api/health` `services.chat` 필드 응답 확인
- [ ] `docs/troubleshooting.md` 파일 존재 및 최소 10개 FAQ 포함
- [ ] ML 예측 신뢰도 점수 UI 표시 완료
- [ ] 한국어/영어 전환 E2E 테스트 통과
- [ ] Lighthouse Accessibility 점수 >= 90
- [ ] 첫 토큰 응답 p95 < 2초 측정 완료
- [ ] Jest 커버리지 >= 80% 유지
- [ ] Sentry 성능 트레이싱 ML 레이턴시 데이터 수집 확인
- [ ] 구조화 로깅 JSON 포맷 모든 API 라우트 적용

### 4.2 Quality Criteria

- [ ] TypeScript 컴파일 오류 0건
- [ ] ESLint 오류 0건
- [ ] GitHub Actions CI 전체 통과 (lint + test + build)
- [ ] Sentry 에러 신규 발생 0건 (배포 후 24시간 기준)
- [ ] Vercel Preview 배포 → Production 배포 순서 준수

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 베타 피드백 범위 초과 — 재설계 수준의 UX 변경 요구 | High | Medium | Sprint 1 착수 전 피드백 우선순위 MoSCoW 재분류, 범위 협의 |
| 실 발효 데이터 수량 부족으로 ML 재학습 효과 미미 | High | Medium | 데이터 증강(data augmentation) 또는 규칙 기반 보완 유지 |
| next-intl 도입 시 기존 컴포넌트 대규모 수정 | Medium | Medium | 점진적 마이그레이션: 신규 문자열부터 적용, 레거시 래핑 |
| WCAG AA 감사 결과 대규모 리팩토링 필요 | Medium | Low | Sprint 3 전 axe-core 사전 스캔, 범위 예측 후 Sprint 계획 조정 |
| 응답속도 목표(< 2초) 미달 — 외부 API 레이턴시 의존 | Medium | Medium | 스트리밍 최적화 우선 적용, 캐싱 계층 강화로 보완 |
| Sentry 성능 트레이싱 샘플링 비용 초과 | Low | Low | 샘플링 레이트 10% 제한, 월 예산 알림 설정 |
| 베타 테스트 일정 지연으로 Sprint 1 데이터 부재 | High | Low | 지연 시 Phase 4 이관 항목(FR-04, FR-05) 선행 처리 |

---

## 6. Architecture Considerations

### 6.1 Project Level

**Selected: Dynamic**

Phase 1~4와 동일한 Dynamic 레벨 유지. 기존 구조(`app/`, `components/`, `lib/`, `hooks/`, `types/`) 그대로 확장.

### 6.2 Key Architectural Decisions

| Decision | Current | Phase 5 변경 | Rationale |
|----------|---------|-------------|-----------|
| AI 모델 | GPT-4o-mini (fallback) / claude-sonnet-4-6 | 유지 | 안정성 우선 |
| i18n | 없음 | next-intl 도입 | App Router 네이티브 지원 |
| 로깅 | console.log | 구조화 JSON 로거 (pino) | 프로덕션 관찰성 확보 |
| 접근성 | 미감사 | axe-core + Lighthouse CI | WCAG 2.1 AA 달성 |
| ML 파이프라인 | RuleBasedPredictor (TTL 30s) | 파라미터 재조정 + 신뢰도 점수 | 실 데이터 반영 |
| Rate Limiting | 기본 Next.js | upstash/ratelimit 또는 커스텀 미들웨어 | 운영 보안 강화 |

### 6.3 Sprint 구조

```
Sprint 1 (Week 1-2): 베타 피드백 반영
  - TC-01~05 결과 분석 → 버그 수정 → UX 조정
  - FR-04 (/api/health services.chat)
  - FR-05 (troubleshooting.md)

Sprint 2 (Week 3-4): ML 고도화
  - 베타 발효 데이터 수집 → 파라미터 재조정
  - 이상 감지 임계값 정밀화
  - 신뢰도 점수 UI
  - Sentry 성능 트레이싱

Sprint 3 (Week 5-6): 다국어/접근성
  - next-intl 설치 → ko/en 번역 파일
  - 언어 전환 UI
  - WCAG 2.1 AA 감사 + 수정
  - ARIA, 키보드 내비게이션

Sprint 4 (Week 7-8): 운영 최적화
  - pino 구조화 로깅
  - 응답속도 최적화 (스트리밍 튜닝, 캐싱)
  - 메모리 프로파일링
  - Rate Limiting
  - Lighthouse CI 통합
```

---

## 7. Convention Prerequisites

### 7.1 Existing Conventions (Phase 4 기준)

- [x] `CLAUDE.md` 코딩 컨벤션 섹션 존재
- [x] ESLint 설정 (`.eslintrc.*`)
- [x] TypeScript 설정 (`tsconfig.json`)
- [x] Prettier 설정 (`.prettierrc`)
- [x] GitHub Actions CI/CD (`/.github/workflows/`)

### 7.2 Phase 5에서 추가/변경할 컨벤션

| Category | 현재 상태 | Phase 5 정의 | Priority |
|----------|-----------|-------------|:--------:|
| 로깅 | console.log 혼용 | pino 구조화 로거 단일화 | High |
| i18n 문자열 키 | 미정의 | `namespace.component.key` 패턴 | High |
| 접근성 체크리스트 | 미존재 | PR 머지 전 axe-core 스캔 필수 | High |
| ML 파라미터 변경 | 코드 직접 수정 | `config/ml.config.ts` 분리 | Medium |

### 7.3 Environment Variables (Phase 5 추가)

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `NEXT_PUBLIC_DEFAULT_LOCALE` | 기본 언어 설정 | Client | [x] |
| `LOG_LEVEL` | 로그 레벨 (info/warn/error) | Server | [x] |
| `RATE_LIMIT_MAX` | API 요청 한도 (per 분) | Server | [x] |
| `ML_CONFIDENCE_THRESHOLD` | ML 신뢰도 경고 임계값 | Server | [x] |
| `SENTRY_TRACES_SAMPLE_RATE` | Sentry 성능 샘플링 비율 | Server | [x] |

---

## 8. User Stories

| ID | As a... | I want to... | So that... | Sprint |
|----|---------|--------------|------------|--------|
| US-06 | 공장 운영자 | 베타 기간 발견된 버그가 모두 수정되길 원한다 | 안심하고 시스템을 사용할 수 있다 | S1 |
| US-07 | IT 관리자 | `/api/health` 에서 chat 서비스 상태를 확인하고 싶다 | 운영 모니터링 대시보드에 통합할 수 있다 | S1 |
| US-08 | IT 관리자 | `troubleshooting.md`를 참고해 문제를 자체 해결하고 싶다 | 지원 요청 없이 빠르게 복구할 수 있다 | S1 |
| US-09 | 품질 관리자 | ML 예측 신뢰도 점수를 함께 보고 싶다 | 낮은 신뢰도의 예측을 걸러낼 수 있다 | S2 |
| US-10 | 공장장 | 이상 감지 임계값이 실제 공정에 맞게 조정되길 원한다 | 오경보 없이 실제 이상만 알림받을 수 있다 | S2 |
| US-11 | 외국인 직원 | 영어로 시스템을 사용하고 싶다 | 언어 장벽 없이 공장 정보에 접근할 수 있다 | S3 |
| US-12 | 시각 장애 직원 | 스크린리더로 모든 기능을 사용하고 싶다 | 동등한 수준으로 시스템을 활용할 수 있다 | S3 |
| US-13 | 공장 운영자 | 답변이 더 빠르게 시작되길 원한다 | 대기 시간 없이 공정 판단을 내릴 수 있다 | S4 |
| US-14 | IT 관리자 | 구조화된 로그로 오류 원인을 추적하고 싶다 | 장애 대응 시간을 단축할 수 있다 | S4 |

---

## 9. Success Metrics (성공 지표)

| Metric | Phase 4 기준 | Phase 5 목표 | 측정 방법 |
|--------|------------|------------|---------|
| 베타 버그 잔존 건수 | N/A | 0건 | GitHub Issues 추적 |
| 베타 만족도 | N/A | >= 4.0 / 5.0 | 설문 결과 |
| 첫 토큰 응답 p95 | < 3초 | < 2초 | Sentry Performance |
| Jest 커버리지 | 61 tests | >= 80% | `npm test -- --coverage` |
| Lighthouse Accessibility | 미측정 | >= 90 | Lighthouse CI |
| ML 예측 정확도 | 규칙 기반 | >= 85% (백테스트) | 베타 데이터 검증 |
| `/api/health` chat 필드 | 미포함 | 포함 | API 응답 확인 |
| 다국어 전환 오류 | N/A | 0건 | E2E (Playwright) |
| 구조화 로깅 적용률 | 0% | 100% (API 라우트) | 로그 샘플 감사 |

---

## 10. Timeline

| Sprint | 기간 | 주요 산출물 |
|--------|------|-----------|
| Sprint 1 | 2026-03-15 ~ 2026-03-28 | 베타 버그 수정, `/api/health` 업데이트, `troubleshooting.md` |
| Sprint 2 | 2026-03-29 ~ 2026-04-11 | ML 파라미터 재조정, 이상 감지 강화, 신뢰도 점수 UI |
| Sprint 3 | 2026-04-12 ~ 2026-04-25 | i18n(ko/en), WCAG AA 개선, ARIA 완성 |
| Sprint 4 | 2026-04-26 ~ 2026-05-09 | 구조화 로깅, 응답속도 최적화, Rate Limiting, CDN |
| QA/Release | 2026-05-10 ~ 2026-05-16 | 최종 Gap Analysis, 보고서, Phase 5 완료 태깅 |

**전제 조건**: 베타 테스트 결과가 2026-03-15까지 수령되어야 Sprint 1 정상 착수 가능. 지연 시 Phase 4 이관 항목(FR-04, FR-05) 선행 처리.

---

## 11. Next Steps

1. [ ] CTO(팀 리드) Plan 문서 검토 및 승인
2. [ ] 베타 테스트 결과 수령 (2026-03-15 예정)
3. [ ] Sprint 1 킥오프 — 버그 트래킹 시트 작성
4. [ ] Design 문서 작성 (`kimchi-agent-phase5.design.md`)
5. [ ] ML 데이터 수집 파이프라인 준비 (베타 기간 로그 보존 확인)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-28 | Initial draft — Phase 5 Plan 작성 | Product Manager |

---

*Plan created by Product Manager — 2026-02-28*
