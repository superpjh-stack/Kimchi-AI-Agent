# Kimchi-Agent Phase 5 — QA 테스트 전략

**작성일**: 2026-02-28
**버전**: 1.0
**대상 Phase**: Phase 5 (베타 피드백 반영 + ML 고도화 + 다국어/접근성 + 운영 최적화)
**작성자**: QA Strategist

---

## 목차

1. [베타 피드백 검증 (Sprint 1)](#1-베타-피드백-검증-sprint-1)
2. [ML 정확도 테스트 (Sprint 2)](#2-ml-정확도-테스트-sprint-2)
3. [접근성 감사 (Sprint 3)](#3-접근성-감사-sprint-3)
4. [성능 벤치마크 (Sprint 4)](#4-성능-벤치마크-sprint-4)
5. [다국어 QA (Sprint 3)](#5-다국어-qa-sprint-3)
6. [회귀 테스트 체크리스트](#6-회귀-테스트-체크리스트)
7. [Jest 커버리지 80% 달성 계획](#7-jest-커버리지-80-달성-계획)
8. [버그 수명주기 관리](#8-버그-수명주기-관리)
9. [QA 게이팅 기준 (Gate Criteria)](#9-qa-게이팅-기준-gate-criteria)

---

## 1. 베타 피드백 검증 (Sprint 1)

### 1.1 가상 버그 시나리오 (BUG-2026-001 ~ BUG-2026-003)

베타 테스트(2026-03-07 ~ 2026-03-14) 에서 발생 가능한 대표 버그 3건을 가정하여 검증 시나리오를 설계한다.

| 버그 ID       | 심각도 | 연관 TC | 가상 증상                                              |
|--------------|--------|---------|-------------------------------------------------------|
| BUG-2026-001 | Major  | TC-01   | ML 신뢰도 점수(confidence %) UI에 "NaN%" 표시           |
| BUG-2026-002 | Minor  | TC-02   | PDF 업로드 후 RAG 출처 섹션이 빈 문자열로 반환됨         |
| BUG-2026-003 | Minor  | TC-04   | 알림 Acknowledge 후 배지 숫자가 즉시 감소하지 않음       |

---

### 1.2 TC-06: ML 신뢰도 점수 NaN 수정 검증 (BUG-2026-001)

**연관 요구사항**: FR-09
**전제 조건**: ML API(`/api/ml/predict`) 정상 응답 중, 신뢰도 점수 UI 표시 컴포넌트 수정 완료

**테스트 단계**:
1. 채팅창에 "3번 탱크 발효 상태 예측해줘" 입력
2. MLPredictionPanel 컴포넌트에서 신뢰도 % 수치 확인
3. 센서값 극단값(온도 0°C, pH 3.0) 입력 후 재예측
4. 신뢰도 점수가 0~100 범위의 숫자로 표시되는지 확인
5. 브라우저 콘솔에 NaN 관련 경고 없음 확인

**Pass 기준**:
- 신뢰도 값이 `0% ~ 100%` 범위 내 정수 또는 소수점 1자리로 표시
- 콘솔에 `NaN`, `undefined`, `null` 경고 0건
- 극단값 입력 시에도 fallback(예: "0%" 또는 "산출 불가") 정상 표시

---

### 1.3 TC-07: RAG 출처 섹션 공백 수정 검증 (BUG-2026-002)

**연관 요구사항**: FR-02, FR-03
**전제 조건**: 발효공정_표준절차서.pdf 사전 업로드 완료

**테스트 단계**:
1. "HACCP 기준 온도 범위가 어떻게 돼요?" 질문 전송
2. MessageBubble 하단 RAG 출처(Sources) 섹션 표시 확인
3. 문서명(`발효공정_표준절차서.pdf`) 및 섹션 텍스트 비어 있지 않음 확인
4. 출처 링크 클릭 시 해당 문서 정보 표시 확인
5. 문서가 없는 주제("날씨 어때요?")로 질문 → 출처 섹션 미표시(정상) 확인

**Pass 기준**:
- 업로드 문서 관련 질문 시 출처 섹션 반드시 표시
- 출처 문자열이 빈 문자열("")이 아닌 실제 문서명·섹션 포함
- 무관 질문 시 출처 섹션 숨김 처리 정상 동작

---

### 1.4 TC-08: 알림 배지 즉시 감소 수정 검증 (BUG-2026-003)

**연관 요구사항**: FR-02 (베타 버그 전수 수정)
**전제 조건**: 알림 시스템 활성화, 미확인 알림 3건 이상 존재

**테스트 단계**:
1. 알림 패널 열기 → 미확인 알림 배지 숫자 확인(예: "3")
2. 첫 번째 알림 "확인(Acknowledge)" 클릭
3. 1초 이내 배지 숫자가 "2"로 감소하는지 확인
4. 나머지 알림 모두 확인
5. 배지가 완전히 사라지거나 "0"으로 변환되는지 확인

**Pass 기준**:
- Acknowledge 클릭 후 1초 이내 배지 숫자 즉시 반영
- 전체 확인 시 배지 요소 DOM에서 숨김 처리 (`display: none` 또는 요소 제거)
- 페이지 새로고침 후에도 확인 상태 유지

---

### 1.5 TC-09: `/api/health` services.chat 필드 검증 (FR-04)

**연관 요구사항**: FR-04, US-07
**전제 조건**: `/api/health` 엔드포인트 수정 배포 완료

**테스트 단계**:
1. `curl -s http://localhost:3000/api/health | jq .` 실행
2. 응답 JSON에 `services.chat` 필드 존재 확인
3. `services.chat.status` 값이 `"ok"` / `"degraded"` / `"error"` 중 하나인지 확인
4. 채팅 API 강제 에러 주입 후 `services.chat.status`가 `"error"` 또는 `"degraded"` 반환 확인

**Pass 기준**:
- `services.chat` 필드 반드시 포함 (400, 500 응답 시에도)
- 상태값이 enum(`ok` / `degraded` / `error`) 범위 내
- 응답 스키마 하위 호환성 유지 (기존 `services.rag`, `services.db` 필드 그대로 존재)

---

### 1.6 TC-10: troubleshooting.md 문서 완결성 검증 (FR-05)

**연관 요구사항**: FR-05, US-08

**테스트 단계**:
1. `docs/troubleshooting.md` 파일 존재 확인
2. FAQ 항목 수 >= 10개 확인
3. 각 FAQ 항목에 "오류 코드" 또는 "증상", "해결 방법" 섹션 포함 확인
4. Phase 4 이관 버그 3건(BUG-2026-001 ~ 003) 관련 해결법 기술 확인
5. 마크다운 렌더링 오류 없음 확인(`markdownlint` 또는 미리보기)

**Pass 기준**:
- 파일 존재 (`ls docs/troubleshooting.md` 성공)
- FAQ >= 10개 (섹션 헤더 `### FAQ-` 또는 `#### ` 기준 카운트)
- 각 FAQ에 증상/원인/해결법 3개 소항목 존재
- 마크다운 lint 오류 0건

---

### 1.7 회귀 테스트 — Sprint 1 수정 후 전체 기능 체크리스트

| 항목 | 검증 방법 | 담당 |
|------|-----------|------|
| TC-01 (ML 예측 채팅) 재실행 | 수동 | QA |
| TC-02 (RAG 문서 검색) 재실행 | 수동 | QA |
| TC-03 (대시보드 차트) 재실행 | 수동 | QA |
| TC-04 (알림 흐름) 재실행 | 수동 | QA |
| TC-05 (모바일 채팅) 재실행 | 수동 | QA |
| Jest 전체 테스트 통과 | `npm test` | CI |
| TypeScript 컴파일 오류 0건 | `npx tsc --noEmit` | CI |
| ESLint 오류 0건 | `npm run lint` | CI |

---

## 2. ML 정확도 테스트 (Sprint 2)

### 2.1 파라미터 재조정 전/후 비교 테스트

#### 테스트 데이터셋

베타 테스트 기간(2026-03-07 ~ 2026-03-14) 수집된 실 발효 데이터를 사용한다.

| 구분 | 설명 | 행 수 기준 |
|------|------|-----------|
| Training Set | 베타 7일치 데이터 70% | >= 500행 |
| Validation Set | 베타 7일치 데이터 15% | >= 100행 |
| Test Set (Hold-out) | 베타 7일치 데이터 15% | >= 100행 |

데이터 부족 시 Data Augmentation 적용:
- Gaussian noise (±0.5°C, ±0.05 pH) 추가
- 시간 축 슬라이딩 윈도우 확장 (스텝 5분)

---

#### ML-TC-01: 발효 완성도 예측 정확도 비교

| 지표 | 재조정 전 (RuleBasedPredictor v1) | 재조정 목표 |
|------|--------------------------------|------------|
| 정확도 (Accuracy) | 기준치 미측정 | >= 85% |
| F1-Score (가중 평균) | 기준치 미측정 | >= 0.80 |
| False Positive Rate (오경보) | 미측정 | <= 10% |
| False Negative Rate (미감지) | 미측정 | <= 5% |

**측정 방법**:
```bash
# 백테스트 스크립트 실행
npx ts-node scripts/ml-backtest.ts \
  --data data/fermentation/beta-2026-03.csv \
  --model v1  # 재조정 전

npx ts-node scripts/ml-backtest.ts \
  --data data/fermentation/beta-2026-03.csv \
  --model v2  # 재조정 후
```

출력 형식:
```json
{
  "accuracy": 0.87,
  "f1_weighted": 0.85,
  "false_positive_rate": 0.08,
  "false_negative_rate": 0.04,
  "confusion_matrix": [[tp, fp], [fn, tn]]
}
```

---

#### ML-TC-02: 이상 감지 임계값 검증

**목표**: 오경보(False Positive) 감소 + 실제 이상 감지율(Recall) 유지

**임계값 파라미터** (`config/ml.config.ts` 기준):

| 파라미터 | 현재값 | 재조정 후 목표 |
|---------|--------|--------------|
| `temperature.warningMin` | 15.0°C | 베타 데이터 기반 조정 |
| `temperature.warningMax` | 22.0°C | 베타 데이터 기반 조정 |
| `ph.criticalMin` | 3.5 | 베타 데이터 기반 조정 |
| `anomalyScoreThreshold` | 0.7 | 0.75 ~ 0.85 범위 탐색 |

**검증 절차**:
1. 임계값 후보 5세트를 그리드 서치로 탐색
2. 각 후보로 Test Set 이상 감지율 측정
3. Recall >= 95%, FPR <= 10% 조건을 동시 만족하는 최적 임계값 선택
4. 선택된 임계값을 `ML_ANOMALY_THRESHOLD` 환경변수에 반영

**Pass 기준**:
- 재조정 후 정확도 >= 85% (베타 Test Set 기준)
- 재조정 후 FPR <= 10% (이상 감지 오경보 감소)
- 재조정 후 FNR <= 5% (실제 이상 놓치지 않음)

---

#### ML-TC-03: 신뢰도 점수 UI 검증

**연관 요구사항**: FR-09

| 시나리오 | 입력 조건 | 예상 신뢰도 범위 | UI 표시 |
|---------|----------|----------------|---------|
| 정상 범위 센서값 | T=18°C, pH=4.2, 염도=2.1% | 80% ~ 100% | 초록 배지 |
| 경계값 센서값 | T=22°C, pH=4.0, 염도=3.0% | 50% ~ 79% | 노란 배지 |
| 이상 범위 센서값 | T=28°C, pH=3.2, 염도=4.5% | 0% ~ 49% | 빨간 배지 |
| 센서 데이터 누락 | 빈 입력 | 0% | "산출 불가" 표시 |

**Pass 기준**:
- 신뢰도 수치가 실제 ML 출력값과 ±1% 오차 내에서 일치
- 색상 배지가 임계값에 따라 올바르게 변경
- "산출 불가" fallback이 NaN 대신 표시

---

### 2.2 ML A/B 테스트 프레임워크 기초 검증 (FR-12, Low Priority)

| 검증 항목 | 방법 |
|---------|------|
| 트래픽 분배 50:50 동작 | 헤더 `X-ML-Version` 확인 (A: v1, B: v2) |
| 각 버전 메트릭 독립 수집 | Sentry 커스텀 태그 `ml_version` 분리 확인 |
| 실험 종료 후 롤백 동작 | 환경변수 `ML_AB_ENABLED=false` 후 단일 버전 응답 확인 |

---

## 3. 접근성 감사 (Sprint 3)

### 3.1 axe-core 자동화 스캔 계획

#### 설치 및 설정

```bash
npm install --save-dev @axe-core/playwright axe-core
```

#### Playwright + axe-core 연동 스크립트

`tests/accessibility/axe-scan.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = [
  { name: 'Home (Chat)', path: '/' },
  { name: 'Dashboard', path: '/?tab=dashboard' },
  { name: 'Documents', path: '/?tab=documents' },
];

for (const page of PAGES) {
  test(`axe-core: ${page.name}`, async ({ page: playwright }) => {
    await playwright.goto(`http://localhost:3000${page.path}`);
    await playwright.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page: playwright })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
}
```

#### 실행 명령

```bash
# 개발 서버 실행 후
npx playwright test tests/accessibility/ --reporter=html
```

#### 자동화 스캔 대상 페이지

| 페이지 | URL | 핵심 검사 요소 |
|--------|-----|--------------|
| 메인 Chat | `/` | ChatInput, MessageBubble, Sidebar, Header |
| Dashboard | `/?tab=dashboard` | SensorChart (SVG ARIA), MLPredictionPanel |
| Documents | `/?tab=documents` | DocumentUpload, ChunkingOptions, 파일 목록 |
| 언어 전환 후 | `/?lang=en` | 영문 레이블, aria-label 영문 전환 확인 |

---

### 3.2 수동 키보드 네비게이션 체크리스트

| # | 항목 | 테스트 방법 | Pass 기준 |
|---|------|-----------|----------|
| KN-01 | 탭 순서 논리적 흐름 | Tab 키로 전체 페이지 순회 | 왼쪽→오른쪽, 위→아래 순서 일치 |
| KN-02 | 포커스 링 시각적 표시 | Tab 키 이동 시 포커스 링 확인 | `outline` 또는 `ring` CSS 스타일 표시 |
| KN-03 | Sidebar 대화 목록 탐색 | Tab/화살표 키 이동 | 각 대화 항목 포커스 가능 |
| KN-04 | ChatInput 접근 및 입력 | Tab → ChatInput 포커스 → 입력 | Enter로 전송 가능 |
| KN-05 | 모달/드롭다운 Escape 닫기 | 모달 열기 → Escape | 모달 닫히고 트리거 버튼으로 포커스 복귀 |
| KN-06 | 버튼/링크 Space/Enter 활성화 | Space 또는 Enter 키 | 클릭과 동일한 동작 실행 |
| KN-07 | VoiceInput 버튼 접근 | Tab → VoiceInput → Space | 음성 입력 시작/중지 |
| KN-08 | 문서 업로드 드롭존 키보드 | Tab → 드롭존 → Space/Enter | 파일 선택 다이얼로그 열림 |
| KN-09 | 알림 패널 열기/닫기 | Tab → 알림 버튼 → Enter | 패널 열리고 내부 탭 순서 유지 |
| KN-10 | 언어 전환 UI | Tab → 언어 선택기 → Enter | 언어 변경 후 포커스 유지 |
| KN-11 | 트랩 포커스 (모달) | 모달 내 마지막 요소에서 Tab | 모달 내 첫 요소로 포커스 순환 |
| KN-12 | 건너뛰기 링크 (Skip to main) | 페이지 첫 Tab | "메인 콘텐츠로 건너뛰기" 링크 표시 |

---

### 3.3 WCAG 2.1 AA 기준 항목별 점검표

#### 원칙 1: 인식 가능 (Perceivable)

| 기준 | ID | 항목 | 검사 도구 | Pass 기준 |
|------|----|------|---------|----------|
| 1.1.1 | A | 비텍스트 콘텐츠 대체 텍스트 | axe-core | 이미지·아이콘에 `alt` 또는 `aria-label` |
| 1.3.1 | A | 정보와 관계 (시맨틱 HTML) | axe-core | `<nav>`, `<main>`, `<button>`, `<h1~h6>` 적절히 사용 |
| 1.3.2 | A | 의미 있는 순서 | 수동 확인 | 시각 순서와 DOM 순서 일치 |
| 1.3.3 | A | 감각적 특성에만 의존 금지 | 코드 리뷰 | "빨간 버튼 클릭" 등 색상만 의존하는 안내 없음 |
| 1.4.1 | A | 색상 단독 사용 금지 | axe-core | 알림 심각도 배지에 텍스트 레이블 병행 |
| 1.4.3 | AA | 명도 대비 (텍스트) | axe-core | 일반 텍스트 4.5:1 이상 |
| 1.4.4 | AA | 텍스트 크기 조정 200% | 브라우저 줌 | 200% 확대 시 레이아웃 깨짐 없음 |
| 1.4.10 | AA | 리플로우 (반응형) | 320px 뷰포트 | 가로 스크롤 없이 콘텐츠 표시 |
| 1.4.11 | AA | 비텍스트 명도 대비 3:1 | axe-core | 버튼 테두리, 입력 필드 경계선 |
| 1.4.12 | AA | 텍스트 간격 | CSS 오버라이드 | 줄 간격 1.5배, 글자 간격 0.12em 적용 시 내용 손실 없음 |

#### 원칙 2: 운용 가능 (Operable)

| 기준 | ID | 항목 | 검사 도구 | Pass 기준 |
|------|----|------|---------|----------|
| 2.1.1 | A | 키보드 접근 | 수동 KN 체크 | 모든 기능 키보드로 접근 가능 |
| 2.1.2 | A | 키보드 함정 없음 | 수동 KN 체크 | 모달 외 탭 트랩 없음, Escape로 해제 가능 |
| 2.4.1 | A | 블록 건너뛰기 (Skip Link) | 수동 | 페이지 첫 Tab에서 Skip to main 표시 |
| 2.4.2 | A | 페이지 제목 | DOM 검사 | `<title>` 태그 의미 있는 내용 |
| 2.4.3 | A | 포커스 순서 논리적 | 수동 KN 체크 | KN-01 기준 |
| 2.4.4 | A | 링크 목적 명확 | axe-core | "여기 클릭" 등 모호한 링크 텍스트 없음 |
| 2.4.6 | AA | 제목과 레이블 설명적 | 코드 리뷰 | 섹션 `<h2>`, `<h3>` 컨텍스트 명확 |
| 2.4.7 | AA | 포커스 시각적 표시 | 수동 KN 체크 | KN-02 기준 |

#### 원칙 3: 이해 가능 (Understandable)

| 기준 | ID | 항목 | 검사 도구 | Pass 기준 |
|------|----|------|---------|----------|
| 3.1.1 | A | 페이지 언어 명시 | DOM 검사 | `<html lang="ko">` (영어 전환 시 `lang="en"`) |
| 3.1.2 | AA | 콘텐츠 언어 명시 | 코드 리뷰 | 언어 혼용 구간에 `lang` 속성 |
| 3.2.1 | A | 포커스 시 컨텍스트 변경 없음 | 수동 | 탭 이동 시 자동 이동/팝업 없음 |
| 3.2.2 | A | 입력 시 컨텍스트 변경 없음 | 수동 | 입력 중 자동 제출 없음 |
| 3.3.1 | A | 오류 식별 | axe-core | 폼 오류 시 텍스트 설명 표시 |
| 3.3.2 | A | 레이블 또는 지시사항 | axe-core | 입력 필드에 `<label>` 또는 `aria-label` |

#### 원칙 4: 견고성 (Robust)

| 기준 | ID | 항목 | 검사 도구 | Pass 기준 |
|------|----|------|---------|----------|
| 4.1.1 | A | 파싱 (HTML 유효성) | W3C Validator | 중복 id, 잘못된 중첩 없음 |
| 4.1.2 | A | 이름, 역할, 값 | axe-core | 커스텀 컴포넌트에 ARIA role/state/property |
| 4.1.3 | AA | 상태 메시지 | axe-core | 로딩·성공·오류 메시지 `aria-live` 영역 |

---

### 3.4 스크린리더 ARIA 검증 항목

| 컴포넌트 | 필요 ARIA 속성 | 검증 방법 |
|---------|--------------|---------|
| ChatWindow | `role="log"`, `aria-live="polite"` | NVDA/VoiceOver 읽기 확인 |
| MessageBubble (AI) | `aria-label="AI 답변"` | NVDA 포커스 시 레이블 읽힘 |
| VoiceInput 버튼 | `aria-pressed`, `aria-label="음성 입력"` | 토글 상태 안내 |
| 알림 배지 | `aria-label="미확인 알림 N건"` | 숫자 변경 시 업데이트 |
| 로딩 스피너 | `role="status"`, `aria-live="polite"` | 스트리밍 중 안내 |
| SensorChart (SVG) | `role="img"`, `aria-label="센서 차트"` | 그래프 대체 텍스트 |
| 언어 전환 | `aria-label="언어 선택"`, `aria-current` | 현재 언어 상태 안내 |

---

## 4. 성능 벤치마크 (Sprint 4)

### 4.1 Lighthouse CI — GitHub Actions 연동

#### 패키지 설치

```bash
npm install --save-dev @lhci/cli
```

#### `.lighthouserc.json` 설정

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000"],
      "numberOfRuns": 3,
      "startServerCommand": "npm run start",
      "startServerReadyPattern": "ready on"
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.8 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:best-practices": ["warn", { "minScore": 0.85 }],
        "categories:seo": ["warn", { "minScore": 0.8 }],
        "first-contentful-paint": ["warn", { "maxNumericValue": 2000 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "total-blocking-time": ["warn", { "maxNumericValue": 300 }],
        "cumulative-layout-shift": ["warn", { "maxNumericValue": 0.1 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

#### GitHub Actions 연동 (`.github/workflows/ci.yml` 추가)

```yaml
- name: Build Production
  run: npm run build

- name: Run Lighthouse CI
  run: npx lhci autorun
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

---

### 4.2 p95 응답속도 측정 방법론

#### 측정 대상 지표

| 지표 | 현재 목표 | Phase 5 목표 | 측정 도구 |
|------|---------|------------|---------|
| 첫 토큰 응답 시간 (TTFT) | < 3초 | < 2초 (p95) | Sentry Performance |
| LCP (Largest Contentful Paint) | 미측정 | < 2.5초 | Lighthouse CI |
| SSE 스트림 완료 시간 | 미측정 | < 10초 (일반 질문) | 클라이언트 타임스탬프 |
| RAG 검색 레이턴시 | 미측정 | < 500ms | Sentry 트레이싱 |
| ML 추론 레이턴시 | 미측정 | < 200ms | Sentry 트레이싱 |

#### Sentry Performance 설정

```typescript
// lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';

// ML 추론 레이턴시 측정
export function measureMLLatency<T>(fn: () => Promise<T>): Promise<T> {
  return Sentry.startSpan(
    { name: 'ml.inference', op: 'ml' },
    fn
  );
}

// RAG 검색 레이턴시 측정
export function measureRAGLatency<T>(fn: () => Promise<T>): Promise<T> {
  return Sentry.startSpan(
    { name: 'rag.retrieve', op: 'rag' },
    fn
  );
}
```

#### k6 부하 테스트 스크립트 (`scripts/load-test.js`)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const ttftTrend = new Trend('time_to_first_token');

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // 워밍업
    { duration: '2m',  target: 10 },  // 일반 부하
    { duration: '30s', target: 0 },   // 감소
  ],
  thresholds: {
    'time_to_first_token': ['p(95)<2000'],  // p95 < 2초
    'http_req_duration': ['p(95)<5000'],
  },
};

export default function () {
  const startTime = Date.now();
  const response = http.post('http://localhost:3000/api/chat', JSON.stringify({
    messages: [{ role: 'user', content: '현재 발효 상태 알려줘' }],
    conversationId: null,
  }), { headers: { 'Content-Type': 'application/json' } });

  check(response, { 'status 200': (r) => r.status === 200 });

  const ttft = Date.now() - startTime;
  ttftTrend.add(ttft);
  sleep(1);
}
```

#### 측정 실행

```bash
# Sentry 트레이싱 활성화 후 개발 서버 실행
SENTRY_TRACES_SAMPLE_RATE=1.0 npm run dev

# k6 부하 테스트
k6 run scripts/load-test.js
```

---

### 4.3 성능 벤치마크 Pass 기준

| 지표 | 측정 기준 | Pass |
|------|---------|------|
| TTFT p95 | 10회 연속 채팅 요청 | < 2,000ms |
| LCP | Lighthouse CI 3회 평균 | < 2,500ms |
| Lighthouse Performance 점수 | CI 자동 측정 | >= 80 |
| Lighthouse Accessibility 점수 | CI 자동 측정 | >= 90 |
| ML 추론 레이턴시 p95 | Sentry 100샘플 | < 200ms |
| RAG 검색 레이턴시 p95 | Sentry 100샘플 | < 500ms |

---

## 5. 다국어 QA (Sprint 3)

### 5.1 ko/en 번역 누락 감지 자동화

#### 번역 커버리지 검사 스크립트

`scripts/i18n-check.ts`:

```typescript
import fs from 'fs';
import path from 'path';

const LOCALE_DIR = path.join(process.cwd(), 'messages');

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, val]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof val === 'object' && val !== null
      ? flattenKeys(val as Record<string, unknown>, fullKey)
      : [fullKey];
  });
}

function checkTranslations() {
  const koKeys = flattenKeys(JSON.parse(fs.readFileSync(`${LOCALE_DIR}/ko.json`, 'utf-8')));
  const enKeys = flattenKeys(JSON.parse(fs.readFileSync(`${LOCALE_DIR}/en.json`, 'utf-8')));

  const missingInEn = koKeys.filter(k => !enKeys.includes(k));
  const missingInKo = enKeys.filter(k => !koKeys.includes(k));

  if (missingInEn.length > 0) {
    console.error(`[i18n] 영어 번역 누락 ${missingInEn.length}건:`);
    missingInEn.forEach(k => console.error(`  - ${k}`));
  }
  if (missingInKo.length > 0) {
    console.error(`[i18n] 한국어 번역 누락 ${missingInKo.length}건:`);
    missingInKo.forEach(k => console.error(`  - ${k}`));
  }

  const totalMissing = missingInEn.length + missingInKo.length;
  if (totalMissing > 0) process.exit(1);
  else console.log('[i18n] 번역 커버리지 100% — 누락 없음');
}

checkTranslations();
```

#### CI 통합 (`.github/workflows/ci.yml`)

```yaml
- name: Check i18n Translation Coverage
  run: npx ts-node scripts/i18n-check.ts
```

---

### 5.2 다국어 E2E 테스트 시나리오

#### i18n-TC-01: 언어 전환 UI 동작

| 단계 | 기대 결과 |
|------|---------|
| 1. 페이지 접속 (기본 한국어) | UI 전체 한국어 표시 |
| 2. 헤더의 언어 전환 버튼 클릭 → "English" 선택 | URL 또는 상태 변경 (`?lang=en`) |
| 3. 페이지 내 텍스트 확인 | Sidebar, Header, ChatInput placeholder, QuickQuestions 전부 영문 표시 |
| 4. 채팅 전송 → AI 응답 수신 | 응답 내용은 영문 프롬프트 기반으로 생성 |
| 5. 다시 "한국어" 전환 | 한국어로 복귀, 이전 대화 내용 유지 |

**Pass 기준**:
- 전환 시 페이지 새로고침 없이 즉시 전환 (CSR 기준) 또는 300ms 이내
- 번역 누락 키 화면에 노출되지 않음 (예: `chat.input.placeholder` 등 raw key 표시 금지)

#### i18n-TC-02: 번역 누락 키 노출 검사 (자동화)

```typescript
// tests/e2e/i18n-coverage.spec.ts (Playwright)
test('번역 키 raw 노출 없음 — 영문 전환 후', async ({ page }) => {
  await page.goto('http://localhost:3000/?lang=en');
  await page.waitForLoadState('networkidle');

  const bodyText = await page.locator('body').innerText();

  // next-intl에서 번역 누락 시 "{namespace.key}" 형태로 표시됨
  const rawKeyPattern = /\{[\w.]+\}/g;
  const rawKeys = bodyText.match(rawKeyPattern) ?? [];

  expect(rawKeys).toEqual([]); // raw key 노출 0건
});
```

---

### 5.3 RTL 대응 여부

**해당 없음**: Phase 5 범위에 RTL(Right-to-Left) 언어(아랍어, 히브리어 등) 지원은 포함되지 않는다. 지원 언어는 `ko`(한국어)와 `en`(영어)으로 한정되며, 두 언어 모두 LTR(Left-to-Right) 방향이다.

추후 RTL 지원이 필요할 경우:
- CSS `direction: rtl` 및 `text-align: right` 전역 적용
- `<html dir="rtl">` 속성 동적 전환
- Tailwind CSS `rtl:` 변형자 활용

현재 Phase에서는 검토하지 않는다.

---

## 6. 회귀 테스트 체크리스트

### Sprint 완료 시 전체 실행 항목

Sprint 종료 시마다 아래 항목을 순서대로 실행하여 기존 기능 회귀 여부를 확인한다.

#### 자동화 (CI 파이프라인)

```bash
# 1. TypeScript 타입 검사
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Jest 단위/통합 테스트
npm test -- --coverage --passWithNoTests

# 4. 번역 커버리지
npx ts-node scripts/i18n-check.ts

# 5. Lighthouse CI
npx lhci autorun

# 6. axe-core 접근성 스캔
npx playwright test tests/accessibility/
```

#### 수동 회귀 시나리오 (스프린트별 핵심)

| Sprint 완료 시점 | 필수 수동 확인 항목 |
|---------------|----------------|
| Sprint 1 완료 | TC-06, TC-07, TC-08, TC-09, TC-10 + 기존 TC-01~05 재실행 |
| Sprint 2 완료 | ML-TC-01, ML-TC-02, ML-TC-03 + 기존 TC-01 재실행 |
| Sprint 3 완료 | i18n-TC-01, i18n-TC-02 + WCAG 키보드 KN-01~12 전체 |
| Sprint 4 완료 | 성능 벤치마크 전체 + 구조화 로그 샘플 확인 |
| QA/Release 주 | 모든 TC 전체 통합 실행 + Gap Analysis |

---

## 7. Jest 커버리지 80% 달성 계획

### 현재 상태

| 지표 | Phase 4 기준 | Phase 5 목표 |
|------|------------|------------|
| 테스트 수 | 61개 PASS | >= 80개 |
| 커버리지 (lines) | 미측정 | >= 80% |
| 커버리지 (branches) | 미측정 | >= 75% |
| 커버리지 (functions) | 미측정 | >= 80% |

### 신규 테스트 대상 (Sprint별)

#### Sprint 1 — 버그 수정 검증 테스트

| 파일 | 테스트 시나리오 |
|------|--------------|
| `__tests__/api/health.test.ts` | `services.chat` 필드 존재 확인, 상태값 enum 검증 |
| `__tests__/components/MessageBubble.test.tsx` | RAG 출처 섹션 공백 미표시, 출처 정상 표시 |
| `__tests__/components/AlertBadge.test.tsx` | Acknowledge 후 즉시 배지 숫자 감소 |

#### Sprint 2 — ML 테스트

| 파일 | 테스트 시나리오 |
|------|--------------|
| `__tests__/lib/ml/predictor.test.ts` | RuleBasedPredictor 정확도 >= 85% (고정 테스트 데이터셋) |
| `__tests__/lib/ml/anomaly.test.ts` | 임계값 범위 내 정상값 통과, 범위 초과값 이상 감지 |
| `__tests__/components/MLPredictionPanel.test.tsx` | 신뢰도 NaN 방어, 색상 배지 조건부 렌더링 |

#### Sprint 3 — i18n / 접근성

| 파일 | 테스트 시나리오 |
|------|--------------|
| `__tests__/lib/i18n/coverage.test.ts` | ko.json vs en.json 키 일치 검증 |
| `__tests__/components/LanguageSwitcher.test.tsx` | 언어 전환 클릭 → locale 변경 |

#### Sprint 4 — 성능/로깅

| 파일 | 테스트 시나리오 |
|------|--------------|
| `__tests__/lib/logger.test.ts` | JSON 구조화 로그 포맷, 레벨 분리 (info/warn/error) |
| `__tests__/api/rate-limit.test.ts` | 한도 초과 시 429 응답, 한도 내 정상 통과 |

### Jest 설정 (`jest.config.ts` 추가)

```typescript
// jest.config.ts (기존에 없다면 추가)
const config = {
  // ... 기존 설정
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
  collectCoverageFrom: [
    'app/api/**/*.ts',
    'lib/**/*.ts',
    'components/**/*.tsx',
    'hooks/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
};
```

### CI 커버리지 게이팅

```yaml
# .github/workflows/ci.yml
- name: Jest with Coverage
  run: npm test -- --coverage --coverageThreshold='{"global":{"lines":80}}'
```

---

## 8. 버그 수명주기 관리

### 심각도별 SLA (Service Level Agreement)

| 심각도 | 정의 | 수정 목표 시간 | 검증 완료 목표 |
|--------|------|-------------|--------------|
| Critical | 서비스 중단, 데이터 손실 | 4시간 이내 | 수정 후 1시간 |
| Major | 핵심 기능 동작 불가 | 24시간 이내 | 수정 후 4시간 |
| Minor | UX 불편, 비기능 오류 | 스프린트 내 | 다음 빌드 배포 후 |
| Trivial | 미관상 문제 | 다음 스프린트 | 스프린트 리뷰 시 |

### 버그 워크플로

```
발견 → GitHub Issue 생성 (BUG-YYYY-###)
     → 심각도 레이블 태깅 (critical/major/minor/trivial)
     → 담당자 할당
     → 수정 브랜치 생성 (fix/BUG-2026-XXX)
     → PR 생성 → CI 통과
     → QA 검증 TC 실행
     → Issue Close → Release Note 반영
```

---

## 9. QA 게이팅 기준 (Gate Criteria)

### Phase 5 최종 릴리즈 게이트

| 게이트 항목 | 기준 | 측정 방법 | 상태 |
|-----------|------|---------|------|
| 베타 TC-01~05 전체 Pass | 0건 잔존 버그 | 수동 TC 실행 기록 | Pending |
| Phase 5 신규 TC-06~10 Pass | 5/5 Pass | 수동 TC 실행 기록 | Pending |
| Jest 커버리지 | >= 80% (lines) | `npm test -- --coverage` | Pending |
| TypeScript strict 모드 | 오류 0건 | `npx tsc --noEmit` | Pending |
| ESLint | 오류 0건 | `npm run lint` | Pending |
| Lighthouse Accessibility | >= 90 | Lighthouse CI | Pending |
| Lighthouse Performance | >= 80 | Lighthouse CI | Pending |
| LCP | < 2,500ms | Lighthouse CI | Pending |
| 첫 토큰 응답 p95 | < 2,000ms | Sentry + k6 | Pending |
| 다국어 번역 누락 | 0건 | `i18n-check.ts` | Pending |
| 다국어 E2E | 오류 0건 | Playwright | Pending |
| ML 예측 정확도 | >= 85% | 백테스트 스크립트 | Pending |
| WCAG AA (axe-core) | violations 0건 | Playwright axe | Pending |
| 구조화 로깅 적용률 | 100% (API 라우트) | 코드 리뷰 | Pending |
| Sentry 신규 에러 | 0건 (배포 후 24h) | Sentry 대시보드 | Pending |

**전체 게이트 통과 조건**: 위 15개 항목 전부 통과 시 Phase 5 릴리즈 승인.

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|---------|--------|
| 1.0 | 2026-02-28 | 최초 작성 — Phase 5 QA 전략 전체 | QA Strategist |

---

*QA Strategy created by QA Strategist — 2026-02-28*
