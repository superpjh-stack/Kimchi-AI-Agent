# kimchi-agent-phase6 Planning Document

> **Summary**: 보안 강화 (인증/인가, OWASP 대응) + 테스트 강화 (Jest 80%+, Playwright E2E) + 프로덕션 배포 + ML A/B 테스트 + Multi-tenant 기반 구조 + Questions 패널 통합
>
> **Project**: Kimchi-Agent
> **Version**: 6.0.0
> **Author**: CTO Lead
> **Date**: 2026-02-28
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

Phase 5(Production Hardening)에서 달성한 98.2% Match Rate, i18n, WCAG 접근성, pino 로깅, Rate Limiting 기반 위에서 **보안 강화(인증/인가, OWASP Top 10 대응)**, **테스트 커버리지 확대**, **실제 프로덕션 배포 안정화**, **ML A/B 테스트 프레임워크**, **Multi-tenant 기반 구조**를 구현하여 Kimchi-Agent를 엔터프라이즈 수준의 김치공장 AI 에이전트로 완성한다. 아울러 김치군 마스코트(97.0%)의 미커밋 코드를 통합하고, 중단된 Questions 패널 피처를 완성한다.

**보안 감사 결과 (OWASP Top 10)**: Phase 6 착수 전 보안 감사를 수행하여 2 Critical, 5 High, 4 Medium, 2 Low 이슈를 발견했다. 가장 시급한 문제는 **전체 API 인증 부재(A01/A07)**와 **xlsx Prototype Pollution 취약점(A06)**이다. 공장 운영 시스템 특성상 ML 임계값의 무인증 변경은 물리적 안전 위험을 초래할 수 있으므로 Sprint 1에서 최우선 해결한다.

### 1.2 Background

**완료된 Phase 이력**

| Phase | 주요 달성 사항 | Match Rate |
|-------|--------------|-----------|
| Phase 1+2 | 기본 Chat + RAG + 문서 업로드 + bkend.ai 저장소 + 공정 데이터 시스템 | 97.4% / 92.2% |
| Phase 3 | pgvector, LocalEmbedder(Ollama), ML 예측(RuleBasedPredictor), Recharts 대시보드 | 91.0% |
| Phase 4 | Vercel 배포, Jest 61 tests, GitHub Actions CI/CD, ML 캐싱(TTL 30s), Sentry 모니터링 | 93.9% |
| Phase 5 | i18n(ko/en), WCAG 2.1 AA, pino 로깅, Rate Limiting, React.memo 최적화 | 98.2% |
| 마스코트 | 김치군 배추 SVG, 7종 감정 상태, CustomEvent 기반, 47개 추임새 | 97.0% |

**현재 상태 (Phase 6 착수 시점)**

- TypeScript 컴파일 오류: 0건
- Jest 테스트: 61개 PASS (4 test suites)
- 코드베이스: ~10,000 LOC (TypeScript/TSX)
- 김치군 마스코트 코드: 커밋 완료 (`c607a07`, 22파일)
- Questions 패널: `components/questions/QuestionPanel.tsx` 구현 완료, 페이지 통합 미완성
- console.log 잔존: 5개 파일 11건 (pino 미전환)
- ESLint 설정: `.eslintrc.json` 미생성 (next lint 초기 설정 필요)
- **보안 감사**: 2 Critical, 5 High, 4 Medium, 2 Low (OWASP Top 10 기준)
- **npm audit**: 15개 취약점 (1 critical xlsx, 12 high, 2 moderate)
- **인증 시스템**: 전무 -- 17개 API 엔드포인트 모두 미인증

**Phase 5 보고서 권장사항 (11.2절)**

1. MTBF 99.9% -- 자동 복구, 무중단 배포 (Blue-Green/Canary)
2. ML A/B 테스트 프레임워크 (FR-12, 현재 Low priority)
3. Multi-tenant 지원 (다중 공장 아키텍처)
4. 사용자 분석 -- 행동 데이터 수집, 기능 우선순위 재조정
5. 모바일 앱 (React Native 검토)

### 1.3 Related Documents

- Phase 5 Report: `docs/archive/2026-02/kimchi-agent-phase5/kimchi-agent-phase5.report.md`
- Phase 5 Analysis: `docs/archive/2026-02/kimchi-agent-phase5/kimchi-agent-phase5.analysis.md`
- Mascot Report: `docs/archive/2026-02/kimchi-mascot/kimchi-mascot.report.md`
- Phase 4 Report: `docs/archive/2026-02/kimchi-agent-phase4/kimchi-agent-phase4.report.md`

---

## 2. Scope

### 2.1 In Scope

- [ ] **Sprint 1 -- 보안 강화 + 코드 정비**: API 인증/인가, xlsx 대체, CSP 강화, 감사 로깅, ESLint/pino 정비
- [ ] **Sprint 2 -- 테스트 강화 + 프로덕션 배포 + Questions**: Jest 80%+, Playwright E2E, Lighthouse CI, Vercel 배포, Questions 패널 통합
- [ ] **Sprint 3 -- ML A/B 테스트 프레임워크**: 모델 버전별 비교, 실험 구조, 결과 수집
- [ ] **Sprint 4 -- Multi-tenant 기반 구조**: 공장별 데이터 격리, tenant 라우팅, 관리 API

### 2.2 Out of Scope

- 모바일 네이티브 앱 (React Native) -- Phase 7에서 재검토
- AI 모델 교체 (GPT-4o-mini / claude-sonnet-4-6 유지)
- 실시간 공장 설비 직접 제어 자동화
- 유료 결제 시스템 통합
- k6 부하 테스트 (인프라 환경 미확보, Phase 7 검토)

---

## 3. Requirements

### 3.1 Functional Requirements

#### Sprint 1 -- 보안 강화 + 코드 정비

| ID | 요구사항 | 우선순위 | OWASP |
|----|---------|---------|-------|
| FR-01 | API 인증 미들웨어: NextAuth.js 또는 JWT 기반 인증 도입 (17개 API 전체) | Critical | A01/A07 |
| FR-02 | 역할 기반 인가(RBAC): admin (임계값/디버그), operator (채팅/업로드), viewer (조회) | Critical | A01 |
| FR-03 | xlsx 패키지 교체: `exceljs` 또는 `sheetjs-ce`로 대체 (Prototype Pollution 해결) | Critical | A06 |
| FR-04 | RAG 디버그 엔드포인트: 프로덕션 비활성화 또는 admin 전용 | High | A04 |
| FR-05 | ML 임계값 API: admin 역할 제한 + 변경 이력 감사 로깅 | High | A04 |
| FR-06 | CSP 강화: nonce 기반 script-src, unsafe-inline/unsafe-eval 제거 | High | A05 |
| FR-07 | Rate Limiter 개선: x-forwarded-for 검증 강화, IP + 사용자 복합 키 | High | A04 |
| FR-07b | Rate Limiter TTL cleanup: 만료 엔트리 주기적 삭제 (메모리 누수 방지) | High | A04 |
| FR-07c | conversations API rate limiter 적용 (GET/POST/DELETE 전체) | High | A04 |
| FR-07d | alerts/stream SSE rate limiter + 최대 동시 연결 제한 | Medium | A04 |
| FR-08 | 파일 업로드 보강: Magic bytes(MIME) 검증 추가 | Medium | A08 |
| FR-09 | 보안 감사 로깅: 삭제/설정변경/업로드 등 중요 작업 감사 로그 | Medium | A09 |
| FR-10 | npm 의존성 취약점 해결: npm audit fix + 수동 패치 | High | A06 |
| FR-11 | Prompt Injection 완화: 입력 새니타이징, RAG 컨텍스트 격리 마커 | Medium | A03 |
| FR-11b | chat API role 화이트리스트 검증 (system role 주입 차단) | Medium | A03 |
| FR-11c | Edge runtime Sentry PII 필터 추가 (beforeSend 누락) | Medium | A09 |
| FR-12 | ESLint strict 설정 (.eslintrc.json) + CI 연동 | High | -- |
| FR-13 | console.log -> pino 전환 (잔여 5개 파일 11건) | Low | A09 |
| FR-13b | useChat sendMessage deps 최적화: messages useRef로 memo 유효화 | Medium | -- |
| FR-13c | alertStore MAX_ALERTS 크기 제한 추가 (메모리 누수 방지) | Low | -- |

#### Sprint 2 -- 테스트 강화 + 프로덕션 배포 + Questions 통합

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-14 | Jest 단위 테스트 확대: API route handler 테스트 (chat, upload, conversations) | High |
| FR-15 | Jest 단위 테스트: 유틸리티 함수 (markdown, validate-env) | High |
| FR-16 | Jest 단위 테스트: RAG 파이프라인 (pipeline, chunker) | High |
| FR-17 | Jest 단위 테스트: 인증 미들웨어 + RBAC | High |
| FR-18 | Jest 커버리지 리포트 생성 + CI 연동 (--coverage, lcov, >= 80%) | High |
| FR-19 | Playwright E2E 테스트: 메인 채팅 흐름 (메시지 입력 -> 응답 수신) | Medium |
| FR-20 | Playwright E2E 테스트: 언어 전환 (ko <-> en) | Medium |
| FR-21 | Playwright E2E 테스트: 문서 업로드 -> RAG 검색 | Medium |
| FR-22 | Lighthouse CI: Performance >= 80, Accessibility >= 90, Best Practices >= 90 | Medium |
| FR-23 | Vercel 프로덕션 배포 실행 (환경변수 설정, 도메인 연결) | High |
| FR-24 | 배포 후 24시간 모니터링: Sentry 에러 0건 확인 | High |
| FR-25 | Health Check 자동화: Vercel Cron `/api/health` 5분 간격 | Medium |
| FR-26 | Questions 패널 페이지 통합: `app/[locale]/page.tsx`에 QuestionPanel 연결 | High |
| FR-27 | Questions 패널 i18n: `messages/ko.json`, `messages/en.json`에 번역 키 추가 | Medium |
| FR-28 | Questions 패널 접근성: WCAG AA (keyboard nav, aria-label, focus trap) | Medium |
| FR-29 | 김치군 마스코트 + Questions 패널 연동 (question 선택 시 mascot celebrating) | Low |

#### Sprint 3 -- ML A/B 테스트 프레임워크

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-30 | A/B 테스트 구조: `lib/ml/ab-test.ts` (Experiment, Variant, Assignment) | High |
| FR-31 | POST /api/ml/experiments: 실험 생성 API | High |
| FR-32 | GET /api/ml/experiments: 실험 목록 조회 | Medium |
| FR-33 | GET /api/ml/experiments/[id]/results: 실험 결과 조회 | Medium |
| FR-34 | A/B 배분 알고리즘: 해시 기반 일관된 사용자 배분 (% split) | High |
| FR-35 | ML Predictor 팩토리 확장: variant에 따라 다른 predictor 반환 | High |
| FR-36 | 대시보드 위젯: A/B 실험 현황 카드 | Medium |
| FR-37 | 실험 결과 수집: prediction accuracy 비교 메트릭 | Medium |

#### Sprint 4 -- Multi-tenant 기반 구조

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-38 | Tenant 모델: `types/tenant.ts` (TenantId, TenantConfig, TenantContext) | High |
| FR-39 | Tenant 미들웨어: 요청별 tenant 식별 (header `x-tenant-id` 또는 subdomain) | High |
| FR-40 | VectorStore tenant 격리: tenant별 독립 네임스페이스 | High |
| FR-41 | Conversation Store tenant 격리: tenant별 대화 분리 | High |
| FR-42 | GET/POST /api/admin/tenants: tenant 관리 API (인증 필수) | Medium |
| FR-43 | Tenant별 ML 설정 분리: config/ml.config.ts tenant 지원 | Medium |
| FR-44 | Tenant별 시스템 프롬프트: 공장 특화 프롬프트 관리 | Medium |
| FR-45 | Tenant 선택 UI: 관리자용 tenant 전환 드롭다운 | Low |

### 3.2 Non-Functional Requirements

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-01 | 인증/인가 | 모든 API 인증 필수, RBAC 3 역할 (admin/operator/viewer) |
| NFR-02 | 보안 취약점 | npm audit critical/high 0건, OWASP Top 10 대응 완료 |
| NFR-03 | 테스트 커버리지 | Jest >= 80% (statement coverage) |
| NFR-04 | E2E 테스트 | Playwright >= 5 시나리오, CI 통합 |
| NFR-05 | 성능 | Lighthouse Performance >= 80, LCP < 2.5s |
| NFR-06 | 접근성 | Lighthouse Accessibility >= 90 |
| NFR-07 | 가용성 | Health check 99.9% uptime (Vercel) |
| NFR-08 | 코드 품질 | ESLint 0 errors, TypeScript strict 0 errors, console.log 0건 |
| NFR-09 | A/B 테스트 정합성 | 동일 사용자 -> 동일 variant (hash consistency) |
| NFR-10 | Tenant 격리 | 데이터 교차 접근 0건 |
| NFR-11 | 감사 로깅 | 중요 작업(삭제, 설정변경, 업로드) 100% 로깅 |
| NFR-12 | CSP | unsafe-inline/unsafe-eval 제거, nonce 기반 |

---

## 4. Architecture

### 4.1 보안 인프라 (Sprint 1)

```
lib/auth/
  auth-middleware.ts      # API 라우트 인증 미들웨어 (JWT 검증)
  auth-config.ts          # NextAuth.js 설정 또는 직접 JWT 구현
  rbac.ts                 # Role-Based Access Control (admin/operator/viewer)
  audit-logger.ts         # 중요 작업 감사 로깅 (pino child logger)

middleware.ts             # 기존 i18n + 인증 통합 (확장)

app/api/auth/
  [...nextauth]/route.ts  # NextAuth.js 라우트 (또는 직접 JWT)
  login/route.ts          # POST 로그인
  me/route.ts             # GET 현재 사용자

lib/security/
  csp.ts                  # nonce 기반 CSP 생성
  file-validator.ts       # Magic bytes MIME 검증
  input-sanitizer.ts      # Prompt injection 완화
```

### 4.2 테스트 인프라 (Sprint 2)

```
Jest (Unit/Integration)
  |-- __tests__/api/       # API route handler tests
  |-- __tests__/lib/       # 기존 + 추가 유틸리티 테스트
  |-- __tests__/hooks/     # Custom hook 테스트
  |-- jest.config.ts       # coverage threshold 80%

Playwright (E2E)
  |-- e2e/
  |   |-- chat.spec.ts     # 채팅 흐름
  |   |-- i18n.spec.ts     # 언어 전환
  |   |-- upload.spec.ts   # 문서 업로드
  |-- playwright.config.ts

Lighthouse CI
  |-- lighthouserc.json    # 성능/접근성 임계값
  |-- .github/workflows/lighthouse.yml
```

### 4.2 ML A/B 테스트 구조 (Sprint 3)

```
lib/ml/
  ab-test.ts              # Experiment, Variant, Assignment types
  ab-manager.ts           # ExperimentManager (create, assign, track)
  predictor-factory.ts    # variant 기반 predictor 분기 (기존 확장)

app/api/ml/
  experiments/
    route.ts              # POST(생성), GET(목록)
    [id]/
      route.ts            # GET(상세), PATCH(종료)
      results/
        route.ts          # GET(결과 메트릭)
```

### 4.3 Multi-tenant 구조 (Sprint 4)

```
types/tenant.ts           # TenantId, TenantConfig, TenantContext
lib/tenant/
  tenant-context.ts       # AsyncLocalStorage 기반 컨텍스트
  tenant-middleware.ts    # 요청별 tenant 식별 로직
  tenant-store.ts         # 인메모리 tenant 관리

lib/rag/
  retriever.ts            # tenantId별 VectorStore 인스턴스 관리 (기존 확장)

lib/db/
  conversations-store.ts  # tenantId 기반 필터링 (기존 확장)
```

### 4.4 Questions 패널 통합 (Sprint 2)

```
components/questions/
  QuestionPanel.tsx       # 기존 완성 (6 카테고리, 60 질문)

app/[locale]/page.tsx     # QuestionPanel 통합 (우측 사이드 패널)
messages/ko.json          # questions.* 번역 키 추가
messages/en.json          # questions.* 번역 키 추가
```

---

## 5. Architecture Decisions

| 결정 | 이유 | 대안 |
|------|------|------|
| NextAuth.js (또는 직접 JWT) | Next.js 생태계 통합, 다양한 provider 지원 | Passport.js (Express 전용), Clerk (유료) |
| exceljs over xlsx | xlsx에 Critical Prototype Pollution 취약점 | sheetjs-ce (커뮤니티 포크), 직접 파서 |
| nonce 기반 CSP | unsafe-inline/eval 제거로 XSS 방어 극대화 | Hash 기반 CSP (빌드 복잡도 증가) |
| Playwright over Cypress | Next.js App Router 네이티브 지원, 경량 | Cypress (무거움, 느린 실행) |
| Hash 기반 A/B 배분 | 서버 재시작 후에도 일관성 유지, 쿠키 불필요 | Cookie 기반 (GDPR 이슈), Random (비일관) |
| AsyncLocalStorage for Tenant | Node.js 네이티브, 요청 스코프 자동 관리 | Context 파라미터 전파 (코드 침투적) |
| 인메모리 Tenant Store | MVP 단계, pgvector 전환 준비 | DB 기반 (오버엔지니어링) |
| Lighthouse CI | CI 자동화 용이, GitHub Actions 통합 | PageSpeed Insights API (수동적) |

---

## 6. Risks & Mitigation

| 위험 | 영향 | 확률 | 경감 전략 |
|------|------|------|---------|
| 인증 도입 시 기존 기능 회귀 | 서비스 장애 | High | 인증 미들웨어 단위 테스트, 단계적 적용 (신규 -> 기존) |
| xlsx -> exceljs 교체 시 XLSX 파싱 호환성 | 기능 회귀 | Medium | 테스트 XLSX 파일 준비, 파싱 결과 비교 검증 |
| CSP nonce 적용 시 인라인 스크립트 깨짐 | UI 장애 | Medium | 개발 환경에서 Report-Only 모드 우선 테스트 |
| Prompt Injection 완전 차단 불가 | 정보 유출 | Medium | 다층 방어 (입력 검증 + 시스템 프롬프트 분리 + 출력 필터링) |
| Playwright 설치 크기 (브라우저 바이너리) | CI 속도 저하 | Medium | GitHub Actions 캐시 + 필요 브라우저만 설치 |
| Jest 80% 커버리지 미달 | NFR-03 미충족 | Low | 핵심 모듈 우선 테스트, threshold 점진 상향 |
| A/B 테스트 통계적 유의성 | 잘못된 결론 도출 | Medium | 최소 샘플 크기 명시, p-value 검증 |
| Multi-tenant 데이터 유출 | 보안 사고 | High | 단위 테스트 격리 검증, 코드 리뷰 필수 |
| Vercel 배포 환경변수 누락 | 서비스 장애 | Low | validate-env 런타임 검증, 배포 체크리스트 |
| Questions 패널 번역 불일치 | UX 저하 | Low | CI i18n-check 스크립트 |

---

## 7. Success Criteria (DoD)

| 기준 | 현재 상태 | Phase 6 목표 |
|------|----------|------------|
| API 인증 | 0/17 엔드포인트 | 17/17 전체 인증 + RBAC 3 역할 |
| npm audit critical/high | 1 critical + 12 high | 0건 |
| CSP | unsafe-inline/unsafe-eval 포함 | nonce 기반, unsafe 제거 |
| 감사 로깅 | 없음 | 중요 작업 100% 로깅 |
| Jest suites | 4 suites, 61 tests | 15+ suites, 150+ tests |
| Jest 커버리지 | ~30% (추정) | >= 80% (statement) |
| Playwright E2E | 0건 | >= 5 시나리오 PASS |
| Lighthouse Performance | 미측정 | >= 80 |
| Lighthouse Accessibility | 미측정 | >= 90 |
| ESLint | 미설정 | 0 errors (strict) |
| TypeScript strict | 0 errors | 0 errors 유지 |
| console.log 잔존 | 11건 (5 파일) | 0건 (pino 전환) |
| Questions 패널 | UI 완성, 미통합 | 페이지 통합 + i18n + 접근성 + PDCA Check/Act/Archive |
| Vercel 배포 | 미배포 | 성공 + 24h 모니터링 |
| A/B 테스트 | 없음 | 실험 생성/배분/결과 조회 가능 |
| Multi-tenant | 없음 | tenant 격리 + API CRUD |
| Match Rate | -- | >= 95% |

---

## 8. Timeline

| Sprint | 기간 (예상) | 목표 | 산출물 |
|--------|-----------|------|--------|
| **Sprint 1** | Week 1-2 | 보안 강화 + 코드 정비 | 인증/RBAC, xlsx 교체, CSP, 감사 로깅, ESLint, pino |
| **Sprint 2** | Week 3-4 | 테스트 + 배포 + Questions | Jest 80%+, Playwright E2E, Vercel 배포, Questions 통합 |
| **Sprint 3** | Week 5-6 | ML A/B 테스트 | Experiment API, A/B 배분, 대시보드 위젯 |
| **Sprint 4** | Week 7-8 | Multi-tenant | Tenant 모델, 미들웨어, 데이터 격리, 관리 API |
| **QA/Release** | Week 9 | 최종 검증 | Analysis, Act, Report, Archive |

---

## 9. Environment Variables (Phase 6 신규)

| 변수 | Sprint | 설명 | 기본값 |
|------|--------|------|--------|
| `NEXTAUTH_SECRET` | S1 | NextAuth.js JWT 서명 키 | (필수) |
| `NEXTAUTH_URL` | S1 | 인증 콜백 URL | `http://localhost:3000` |
| `AUTH_ADMIN_EMAILS` | S1 | admin 역할 이메일 목록 (콤마 구분) | -- |
| `PLAYWRIGHT_BASE_URL` | S2 | E2E 테스트 대상 URL | `http://localhost:3000` |
| `LIGHTHOUSE_CI_TOKEN` | S2 | Lighthouse CI 서버 토큰 | -- |
| `AB_TEST_ENABLED` | S3 | A/B 테스트 기능 활성화 | `false` |
| `TENANT_MODE` | S4 | Multi-tenant 모드 (`single` / `multi`) | `single` |
| `DEFAULT_TENANT_ID` | S4 | 기본 tenant ID | `default` |

---

## 10. Tech Stack

### 기존 유지

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 14.2.5 | App Router 풀스택 프레임워크 |
| TypeScript | ^5 | 타입 안전성 |
| Tailwind CSS | ^3.4 | 스타일링 |
| React | ^18 | UI 라이브러리 |
| next-intl | ^4.8 | i18n (ko/en) |
| pino | ^10.3 | 구조화 로깅 |
| Recharts | ^3.7 | 차트/대시보드 |
| Jest | ^30.2 | 단위 테스트 |
| Sentry | ^10.40 | 에러 추적 |
| Vercel Analytics | ^1.6 | 사용자 분석 |

### Phase 6 신규 도입

| 기술 | Sprint | 용도 | 대체 대상 |
|------|--------|------|---------|
| NextAuth.js (또는 jose) | S1 | API 인증/세션/JWT | (신규) |
| exceljs | S1 | XLSX 파싱 | xlsx (취약점) |
| @playwright/test | S2 | E2E 테스트 | (신규) |
| @lhci/cli | S2 | Lighthouse CI | (신규) |

---

## 11. Dependencies

| 의존성 | 설명 | 상태 |
|--------|------|------|
| next-auth (또는 jose) | API 인증/세션 관리 | 설치 필요 |
| exceljs | xlsx 대체 (XLSX 파싱) | 설치 필요 |
| Playwright | `@playwright/test` 패키지 | 설치 필요 |
| @lhci/cli | Lighthouse CI CLI | 설치 필요 |
| Phase 5 코드 | 전체 코드베이스 안정 | 완료 (98.2%) |
| 김치군 마스코트 | 코드 커밋 완료 | 완료 (c607a07) |
| Questions 패널 | QuestionPanel.tsx 구현 완료 | 통합 필요 |
| Vercel 계정 | 프로덕션 배포 환경 | 설정 필요 |

---

## 12. Appendix

### 12.1 현재 코드 품질 + 보안 현황

| 지표 | 현재 | Phase 6 목표 |
|------|------|------------|
| TypeScript 오류 | 0건 | 0건 유지 |
| ESLint 오류 | 미설정 | 0건 (strict) |
| Jest 테스트 | 61개 (4 suites) | 100+개 (10+ suites) |
| Jest 커버리지 | ~30% (추정) | >= 80% |
| E2E 테스트 | 0건 | >= 5 시나리오 |
| console.log 잔존 | 11건 (5 파일) | 0건 |
| eval/innerHTML | 0건 | 0건 유지 |
| TODO/FIXME | 0건 | 0건 유지 |
| API 인증 | 0/17 엔드포인트 | 17/17 엔드포인트 |
| npm audit critical | 1건 (xlsx) | 0건 |
| npm audit high | 12건 | 0건 |
| CSP unsafe-inline | 있음 | 제거 (nonce) |
| 감사 로깅 | 없음 | 중요 작업 100% |

### 12.2 보안 감사 상세 (OWASP Top 10)

**감사 수행일**: 2026-02-28
**감사 범위**: 17개 API 라우트, 미들웨어, 보안 헤더, Rate Limiter, DB, RAG, npm 의존성

| 심각도 | 건수 | OWASP | 핵심 이슈 |
|--------|------|-------|---------|
| **CRITICAL** | 2 | A01/A07, A06 | 전체 API 인증 부재, xlsx Prototype Pollution |
| **HIGH** | 5 | A04, A05, A06 | ML 임계값 무인증, RAG 디버그 노출, CSP unsafe, Rate Limiter 우회, npm 12 high |
| **MEDIUM** | 4 | A02, A03, A08, A09 | 평문 저장, Prompt Injection, MIME 미검증, 감사 로그 부재 |
| **LOW** | 2 | A05, A10 | X-XSS-Protection 레거시, SSRF 잠재 위험(환경변수 기반 안전) |

**양호 사항**: Parameterized SQL, 보안 헤더 다수, API키 서버전용, .env gitignore, 에러 메시지 비노출, 입력 길이 제한, 파일 확장자 화이트리스트

### 12.2b 코드 품질 리뷰 결과

**리뷰 수행일**: 2026-02-28
**분석 영역**: 마스코트 코드, 아키텍처 일관성, 보안, 성능, TypeScript 타입 안전성

| 영역 | 평가 | 발견 건수 |
|------|------|----------|
| 마스코트 코드 | A (우수) | 3 Low |
| 아키텍처 일관성 | B+ (양호) | 2 Medium, 2 Low |
| 보안 | B+ (양호) | 2 High, 3 Medium, 1 Low |
| 성능 | B+ (양호) | 2 Medium, 2 Low |
| TypeScript 타입 | A- (우수) | 2 Low |
| **합계** | | **0 Critical, 2 High, 5 Medium, 11 Low = 18건** |

**High 이슈 (Sprint 1 수정):**
- S1: RAG debug 엔드포인트 무인증 (보안 감사 S1과 동일)
- S2: conversations API rate limiter 누락 (신규 발견)

**Medium 이슈 (Sprint 1 수정):**
- A1: useChat sendMessage deps memo 무효화
- S3: alerts SSE 무제한 연결
- S4: RateLimiter TTL cleanup 없음 (메모리 누수)
- S5: Edge Sentry PII 필터 누락
- A2: chatStatus 스테일 클로저

### 12.3 김치군 마스코트 커밋 현황

**커밋**: `c607a07` (2026-02-28) -- 22파일, 2,572 insertions, 45 deletions
**상태**: 커밋 완료, origin/master보다 1 commit ahead (push 대기)

### 12.4 Questions 패널 현황

`components/questions/QuestionPanel.tsx`는 완전히 구현된 상태:
- 6개 카테고리: 공정 상태, 이상 대응, 발효 지식, 품질/HACCP, 문서 검색, 생산 운영
- 카테고리당 10개 질문 (총 60개)
- 모바일 오버레이 + 데스크톱 사이드 패널 반응형 레이아웃
- 접근성: `role="complementary"`, `aria-label`
- `onSelectQuestion` 콜백으로 채팅 연동 준비 완료
- **미완성**: `app/[locale]/page.tsx`에 통합 안 됨, i18n 번역 키 없음

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-28 | Phase 6 initial plan draft | CTO Lead |
| 1.1 | 2026-02-28 | 보안 감사 결과 반영: Sprint 1을 보안 강화로 재구성, OWASP 대응 FR 추가, 마스코트 커밋 완료 반영 | CTO Lead |
| 1.2 | 2026-02-28 | 코드 품질 리뷰 18건 반영: Rate Limiter cleanup/conversations/SSE 제한, role 검증, Edge PII, useChat 최적화, alertStore 제한 추가 | CTO Lead |
| 1.3 | 2026-02-28 | Architect 리뷰 반영: Environment Variables (S9), Tech Stack (S10) 섹션 추가, Success Criteria 현재vs목표 비교 표 확장, 섹션 번호 정리 | CTO Lead |
