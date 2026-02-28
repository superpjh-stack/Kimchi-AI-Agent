# Archive Index — 2026-02

| Feature | Match Rate | Completed | Archived | Path |
|---------|:----------:|-----------|----------|------|
| kimchi-agent-phase2 | 92.2% | 2026-02-27 | 2026-02-27 | `docs/archive/2026-02/kimchi-agent-phase2/` |
| kimchi-agent-phase3 | 91.0% | 2026-02-28 | 2026-02-28 | `docs/archive/2026-02/kimchi-agent-phase3/` |
| kimchi-agent-phase4 | 93.9% | 2026-02-28 | 2026-02-28 | `docs/archive/2026-02/kimchi-agent-phase4/` |
| kimchi-agent-phase5 | 98.2% | 2026-02-28 | 2026-02-28 | `docs/archive/2026-02/kimchi-agent-phase5/` |
| kimchi-mascot | 92.4% (v2.0) | 2026-02-28 | 2026-02-28 | `docs/archive/2026-02/kimchi-mascot/` |
| kimchi-agent-phase6 | 97.1% | 2026-02-28 | 2026-02-28 | `docs/archive/2026-02/kimchi-agent-phase6/` |

## kimchi-agent-phase2

- **Plan**: `kimchi-agent-phase2.plan.md`
- **Design**: `kimchi-agent-phase2.design.md`
- **Analysis**: `kimchi-agent-phase2.analysis.md`
- **Report**: `kimchi-agent-phase2.report.md`

**Summary**: Kimchi-Agent Phase 2 — bkend.ai 영구 저장소, 공정 데이터 시스템(센서+알림+SSE), UI 패널(ProcessStatusPanel/AlertBadge), Hybrid RAG(BM25+Vector+RRF) 구현. 4 Sprint, 34개 파일, Match Rate 92.2%.

## kimchi-agent-phase3

- **Plan**: `kimchi-agent-phase3.plan.md`
- **Design**: `kimchi-agent-phase3.design.md`
- **Analysis**: `kimchi-agent-phase3.analysis.md`
- **Report**: `kimchi-agent-phase3.report.md`

**Summary**: Kimchi-Agent Phase 3 — pgvector 영속성, LocalEmbedder(Ollama) 3-way 팩토리, ML 예측(RuleBasedPredictor/RemotePredictor), Recharts 실시간 센서 차트 대시보드 구현. 5 Sprint, 35+ 파일, Match Rate 91.0%.

## kimchi-agent-phase4

- **Plan**: `kimchi-agent-phase4.plan.md`
- **Design**: `kimchi-agent-phase4.design.md`
- **Analysis**: `kimchi-agent-phase4.analysis.md`
- **Report**: `kimchi-agent-phase4.report.md`

**Summary**: Kimchi-Agent Phase 4 — Vercel 프로덕션 배포, Jest 61 tests + GitHub Actions CI/CD, 베타 테스트 전략, ML 예측 캐싱(TTL 30s) + Sentry 에러 모니터링 + Vercel Analytics. 4 Sprint, 1회 이터레이션(85.7%→93.9%), Match Rate 93.9%.

## kimchi-agent-phase5

- **Plan**: `kimchi-agent-phase5.plan.md`
- **Design**: `kimchi-agent-phase5.design.md`
- **Analysis**: `kimchi-agent-phase5.analysis.md`
- **Report**: `kimchi-agent-phase5.report.md`

**Summary**: Kimchi-Agent Phase 5 — 베타 피드백 반영(SSE keep-alive/QuickQuestions/DocumentList 페이지네이션/MessageBubble 접기), ML 고도화(MLConfig 외부화/ConfidenceBar/예측 이력/thresholds API), next-intl i18n(KO/EN 79키/LocaleSwitcher), WCAG 접근성, pino 구조화 로깅, Rate Limit(429), 쿼리 임베딩 캐시, next/font 마이그레이션. 4 Sprint + 1회 이터레이션(94.8%→98.2%), Match Rate 98.2%.

## kimchi-mascot

- **Plan**: `kimchi-mascot.plan.md`
- **Design**: `kimchi-mascot.design.md`
- **Analysis**: `kimchi-mascot.analysis.md`
- **Report**: `kimchi-mascot.report.md`

**Summary**: 김치군(김치君) 마스코트 시스템 v2.0 — 배추 SVG 캐릭터 + 7종 CSS 애니메이션 상태(idle/thinking/success/error/celebrating/searching/sleeping) + 47개 한국어 추임새 + CustomEvent 기반 완전 분리 아키텍처 + Framer Motion 자유비행(spring 물리, celebrating 3포인트 순차비행, prefers-reduced-motion 지원). 신규 9파일 + 수정 8파일, 이터레이션 0회, Match Rate v1.0: 97.0% → v2.0: 92.4% (의도적 기능 확장).

## kimchi-agent-phase6

- **Plan**: `kimchi-agent-phase6.plan.md`
- **Design**: `kimchi-agent-phase6.design.md`
- **Analysis**: `kimchi-agent-phase6.analysis.md`
- **Report**: `kimchi-agent-phase6.report.md`

**Summary**: Kimchi-Agent Phase 6 (Security/Quality/Scale) — JWT 인증+RBAC 3역할(admin/operator/viewer), exceljs xlsx 교체, nonce 기반 CSP, 감사 로깅, ESLint strict, pino 전환, Jest 247 tests(24 suites), Playwright E2E 5시나리오, Lighthouse CI, Questions 패널 통합+i18n, ML A/B 테스트 프레임워크(ExperimentManager/hash 배분/variant predictor), Multi-tenant 기반구조(TenantStore/tenant 미들웨어/VectorStore 격리/Conversation 격리/Admin API CRUD/FR-43 ML설정/FR-44 시스템프롬프트/FR-45 TenantSelector UI). 4 Sprint, 41+신규/31수정 파일, Match Rate 97.1%.
