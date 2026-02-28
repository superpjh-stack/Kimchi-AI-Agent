# Design: Kimchi-Agent Phase 5 — 베타 피드백 반영 + 실 운영 안정화

**Feature ID**: kimchi-agent-phase5
**Created**: 2026-02-28
**Phase**: Phase 5 (Production Hardening)
**Status**: Design
**Plan**: `docs/01-plan/features/kimchi-agent-phase5.plan.md`

---

## 1. 전체 아키텍처 (Phase 5 확장)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     클라이언트 (Browser)                                   │
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────────────┐  │
│  │ ChatWindow │  │ Dashboard  │  │ MLPrediction│  │ ConfidenceBar     │  │
│  │            │  │ Panel      │  │ Panel       │  │ (Phase 5 신규)    │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────────┬──────────┘  │
│        │               │               │                   │             │
│  ┌─────┴───────────────┴───────────────┴───────────────────┴──────────┐  │
│  │          next-intl i18n Provider (Phase 5)                         │  │
│  │          LocaleSwitcher (Header)                                   │  │
│  └───────────────────────────┬────────────────────────────────────────┘  │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │ HTTP / SSE
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              Next.js 14 App Router + middleware.ts (Rate Limit)          │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ /api/chat    │  │ /api/health  │  │ /api/ml/     │  │ /api/ml/   │  │
│  │              │  │ +chat field  │  │ predict      │  │ thresholds │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                  │                │          │
│  ┌──────┴─────────────────┴──────────────────┴────────────────┴───────┐  │
│  │                 pino Logger (JSON 구조화)                           │  │
│  │                 lib/logger.ts (Phase 5 신규)                        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  ML Pipeline                                                       │  │
│  │  ┌─────────────────────┐  ┌─────────────────────┐                 │  │
│  │  │ RuleBasedPredictor  │  │ config/ml.config.ts  │                 │  │
│  │  │ (파라미터 외부화)     │  │ (Phase 5 신규)       │                 │  │
│  │  └─────────────────────┘  └─────────────────────┘                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Sprint 1 — 베타 피드백 반영

### 2.1 `/api/health` services.chat 필드 추가 (FR-04)

**현재 상태**: `app/api/health/route.ts`에 `services.vectorStore`, `services.embeddingProvider`, `services.ollama`, `services.mlServer` 필드만 존재.

**변경 설계**:

```typescript
// app/api/health/route.ts — 수정

async function checkChat(): Promise<'ok' | 'degraded' | 'unavailable'> {
  // 사용 가능한 LLM 제공자 확인
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY || !!process.env.OPENAI_CHAT_MODEL;
  const hasOllama = !!process.env.OLLAMA_BASE_URL;

  if (!hasAnthropic && !hasOpenAI && !hasOllama) return 'unavailable';

  // primary가 없고 fallback만 있으면 degraded
  if (!hasAnthropic && (hasOpenAI || hasOllama)) return 'degraded';

  return 'ok';
}

// GET 응답에 추가
return ok({
  status: 'ok',
  timestamp: new Date().toISOString(),
  services: {
    chat: await checkChat(),          // 신규
    vectorStore,
    embeddingProvider,
    ollama: ollamaOk ? 'ok' : 'unavailable',
    mlServer: mlOk ? 'ok' : 'unavailable',
  },
});
```

**응답 예시**:
```json
{
  "status": "ok",
  "timestamp": "2026-03-15T09:00:00.000Z",
  "services": {
    "chat": "ok",
    "vectorStore": "pgvector",
    "embeddingProvider": "openai",
    "ollama": "unavailable",
    "mlServer": "ok"
  }
}
```

---

### 2.2 `docs/05-deploy/troubleshooting.md` 작성 (FR-05)

**파일 경로**: `docs/05-deploy/troubleshooting.md`

**문서 구조**:

```markdown
# Kimchi-Agent Troubleshooting Guide

## 빠른 진단
- /api/health 엔드포인트 확인 체크리스트

## 오류 코드 참조표
| 코드 | 원인 | 해결법 |

## FAQ (최소 10개 항목)
1. "서버가 시작되지 않습니다" — env 변수 확인
2. "Chat 응답이 없습니다" — LLM API 키 확인
3. "문서 업로드가 실패합니다" — 파일 형식/크기 확인
4. "RAG 검색 결과가 없습니다" — 임베딩 제공자 상태 확인
5. "ML 예측이 작동하지 않습니다" — ML 서버 상태 확인
6. "SSE 스트리밍이 끊깁니다" — 프록시 타임아웃 확인
7. "Sentry 에러가 보이지 않습니다" — SENTRY_DSN 확인
8. "메모리 사용량이 계속 증가합니다" — InMemory Store 재시작
9. "Vercel 배포 실패" — 빌드 로그 및 env 확인
10. "음성 인식이 작동하지 않습니다" — 브라우저 호환성 확인

## 로그 분석 가이드
- pino JSON 로그 필터링 방법 (jq 예시)

## 에스컬레이션
- Sentry 알림 → Slack → 담당자
```

---

### 2.3 베타 버그 수정 패턴 (FR-02, 가상 시나리오 3건)

베타 테스트 결과 예상되는 버그 유형과 수정 설계:

#### Bug-01: SSE 스트리밍 타임아웃 (모바일 네트워크)

**증상**: 모바일 환경에서 LLM 응답이 30초 이상 걸릴 때 SSE 연결 종료.
**원인**: Vercel Edge Function 기본 타임아웃 30초.
**수정 설계**:
```typescript
// app/api/chat/route.ts
// SSE keep-alive 핑 이벤트 추가
// 스트리밍 중 15초마다 빈 코멘트(: ping) 전송하여 연결 유지

// lib/ai/streaming.ts 수정
// createSSEStream 내부에 keep-alive 인터벌 추가
const keepAlive = setInterval(() => {
  controller.enqueue(encoder.encode(': ping\n\n'));
}, 15_000);

// 스트림 종료 시 clearInterval(keepAlive)
```

#### Bug-02: QuickQuestions 항목이 공장 현장과 괴리

**증상**: 베타 사용자 피드백 — "실제로 자주 묻는 질문과 다르다".
**수정 설계**:
```typescript
// components/chat/QuickQuestions.tsx
// QUICK_QUESTIONS 배열을 베타 피드백 기반으로 재구성

const QUICK_QUESTIONS = [
  { icon: "thermometer", text: "현재 발효실 온도와 습도는?", category: "환경" },
  { icon: "droplet", text: "오늘 배치 염도 측정 결과는?", category: "품질" },
  { icon: "clock", text: "현재 발효 진행률과 예상 완료 시간은?", category: "생산" },
  { icon: "alert-triangle", text: "현재 이상 감지 알림이 있나요?", category: "안전" },
  { icon: "clipboard-check", text: "오늘 HACCP 체크리스트 항목 알려줘", category: "품질" },
  { icon: "bar-chart", text: "이번 주 생산량 현황은?", category: "생산" },
];

// lucide-react 아이콘으로 통일 (기존 이모지 제거)
```

#### Bug-03: DocumentList 페이지네이션 누락으로 스크롤 성능 저하

**증상**: 업로드 문서 50건 이상 시 문서 목록 페이지가 느려짐.
**수정 설계**:
```typescript
// components/documents/DocumentList.tsx
// 무한 스크롤 또는 페이지네이션 추가

// 초기 로드: 20건
// "더 보기" 버튼 또는 IntersectionObserver 기반 추가 로드
// GET /api/documents?limit=20&offset=0 파라미터 지원
```

---

### 2.4 UX 개선 컴포넌트 목록 (FR-03, FR-06)

| 컴포넌트 | 개선 내용 | 파일 |
|----------|----------|------|
| ChatInput | 전송 중 비활성화 + 로딩 스피너 표시 강화 | `components/chat/ChatInput.tsx` |
| MessageBubble | 긴 메시지 접기/펼치기 (500자 초과 시) | `components/chat/MessageBubble.tsx` |
| Sidebar | 대화 검색 기능 추가 (제목 필터) | `components/layout/Sidebar.tsx` |
| Header | 연결 상태 인디케이터 (online/offline) | `components/layout/Header.tsx` |
| DashboardPanel | 베타 만족도 점수 위젯 (FR-06) | `components/dashboard/DashboardPanel.tsx` |

---

## 3. Sprint 2 — ML 고도화

### 3.1 ML 파라미터 외부화 (FR-07)

**현재 상태**: `lib/ml/rule-based-predictor.ts`에 상수로 하드코딩.

```typescript
// 현재 — 하드코딩된 값
const BASE_TEMP = 20;
const BASE_HOURS = 72;
const ANOMALY = { tempMin: 10, tempMax: 28, ... };
```

**설계 — 외부 설정 파일**:

```typescript
// config/ml.config.ts (신규)

export interface MLConfig {
  fermentation: {
    baseTemp: number;       // 기준 온도 (기본: 20)
    baseHours: number;      // 기준 시간 (기본: 72)
    q10Factor: number;      // Q10 계수 (기본: 2.0)
  };
  anomaly: {
    tempMin: number;
    tempMax: number;
    salinityMin: number;
    salinityMax: number;
    phMin: number;
    phMax: number;
  };
  quality: {
    gradeA: { tempMin: number; tempMax: number; salMin: number; salMax: number; phMin: number; phMax: number };
    gradeB: { tempMin: number; tempMax: number; salMin: number; salMax: number; phMin: number; phMax: number };
  };
  confidence: {
    baseMin: number;        // 기본 최소 신뢰도 (기본: 0.7)
    maxBoost: number;       // 최대 신뢰도 부스트 (기본: 0.25)
    anomalyPenalty: number; // 이상 시 신뢰도 (기본: 0.5)
    threshold: number;      // 경고 표시 임계값 (env: ML_CONFIDENCE_THRESHOLD)
  };
}

// 기본값
const DEFAULT_ML_CONFIG: MLConfig = {
  fermentation: { baseTemp: 20, baseHours: 72, q10Factor: 2.0 },
  anomaly: { tempMin: 10, tempMax: 28, salinityMin: 1.0, salinityMax: 3.5, phMin: 3.5, phMax: 6.0 },
  quality: {
    gradeA: { tempMin: 18, tempMax: 22, salMin: 2.0, salMax: 2.5, phMin: 4.0, phMax: 4.5 },
    gradeB: { tempMin: 16, tempMax: 24, salMin: 1.8, salMax: 2.75, phMin: 3.8, phMax: 4.8 },
  },
  confidence: { baseMin: 0.7, maxBoost: 0.25, anomalyPenalty: 0.5, threshold: 0.6 },
};

// 환경변수 오버라이드 지원
export function loadMLConfig(): MLConfig {
  const config = structuredClone(DEFAULT_ML_CONFIG);

  // env 오버라이드
  const threshold = process.env.ML_CONFIDENCE_THRESHOLD;
  if (threshold) config.confidence.threshold = parseFloat(threshold);

  return config;
}
```

**RuleBasedPredictor 수정**:

```typescript
// lib/ml/rule-based-predictor.ts — 수정

import { loadMLConfig, type MLConfig } from '@/config/ml.config';

export class RuleBasedPredictor implements IPredictor {
  private readonly config: MLConfig;

  constructor(config?: MLConfig) {
    this.config = config ?? loadMLConfig();
  }

  async predictFermentation(sensors: SensorData): Promise<FermentationPrediction> {
    const { fermentation, anomaly, confidence: confConfig } = this.config;

    // Q10 온도 보정: 설정에서 계수 읽기
    const tempFactor = Math.pow(
      fermentation.q10Factor,
      (sensors.temperature - fermentation.baseTemp) / 10
    );
    const effectiveHours = sensors.fermentationHours * tempFactor;
    const fermentationPct = clamp(effectiveHours / fermentation.baseHours, 0, 1);

    // 이상 감지: 설정된 임계값 사용
    const anomalyReasons: string[] = [];
    if (sensors.temperature < anomaly.tempMin || sensors.temperature > anomaly.tempMax)
      anomalyReasons.push(`온도 이상 (${sensors.temperature.toFixed(1)}C)`);
    // ... 나머지 동일 패턴

    const isAnomaly = anomalyReasons.length > 0;
    const confidence = isAnomaly
      ? confConfig.anomalyPenalty
      : clamp(confConfig.baseMin + fermentationPct * confConfig.maxBoost, confConfig.baseMin, 0.95);

    return { fermentationPct, eta, confidence, stage, anomaly: isAnomaly, anomalyReason: ... };
  }
}
```

---

### 3.2 이상 감지 임계값 조정 API (FR-08)

**엔드포인트**: `PATCH /api/ml/thresholds`

```typescript
// app/api/ml/thresholds/route.ts (신규)

import { loadMLConfig, type MLConfig } from '@/config/ml.config';
import { ok, badRequest } from '@/lib/utils/api-response';

// 런타임 임계값 오버라이드 (서버 재시작 시 초기화, 운영 중 미세 조정용)
let runtimeOverrides: Partial<MLConfig['anomaly']> = {};

// PATCH — 임계값 부분 업데이트
export async function PATCH(req: Request): Promise<Response> {
  const body = await req.json();
  const allowed = ['tempMin', 'tempMax', 'salinityMin', 'salinityMax', 'phMin', 'phMax'];

  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      return badRequest(`허용되지 않는 필드: ${key}`);
    }
    if (typeof body[key] !== 'number') {
      return badRequest(`${key}는 숫자여야 합니다.`);
    }
  }

  runtimeOverrides = { ...runtimeOverrides, ...body };
  return ok({ anomaly: { ...loadMLConfig().anomaly, ...runtimeOverrides } });
}

// GET — 현재 적용 중인 임계값 조회
export async function GET(): Promise<Response> {
  const config = loadMLConfig();
  return ok({
    anomaly: { ...config.anomaly, ...runtimeOverrides },
    defaults: config.anomaly,
    overrides: runtimeOverrides,
  });
}
```

---

### 3.3 신뢰도 점수 UI (FR-09)

**신규 컴포넌트**: `components/ml/ConfidenceBar.tsx`

```typescript
// components/ml/ConfidenceBar.tsx (신규)

interface ConfidenceBarProps {
  value: number;            // 0.0 ~ 1.0
  threshold?: number;       // 경고 임계값 (기본 0.6)
  label?: string;           // 표시 라벨
  size?: 'sm' | 'md';
}

// 시각 설계:
// ┌─────────────────────────────────────────┐
// │ 신뢰도  ████████████████░░░░░░  82%     │
// └─────────────────────────────────────────┘
//
// 색상 규칙:
//   >= 0.8: kimchi-green (높은 신뢰도)
//   >= threshold (0.6): amber (보통)
//   < threshold: kimchi-red (낮은 신뢰도 — 경고)
//
// 낮은 신뢰도일 때 툴팁: "신뢰도가 낮습니다. 결과를 참고용으로만 활용하세요."
```

**MLPredictionPanel 수정**:

```typescript
// components/ml/MLPredictionPanel.tsx — 수정
// 기존 FermentationProgressBar 아래에 ConfidenceBar 추가

<FermentationProgressBar ... />
<ConfidenceBar
  value={prediction.confidence}
  label="예측 신뢰도"
  threshold={ML_CONFIDENCE_THRESHOLD}
/>
```

---

### 3.4 예측 이력 저장 및 트렌드 차트 (FR-10)

```typescript
// lib/ml/prediction-history.ts (신규)

interface PredictionRecord {
  id: string;
  timestamp: string;         // ISO 8601
  type: 'fermentation' | 'quality';
  input: Record<string, number>;
  output: FermentationPrediction | QualityPrediction;
}

// 인메모리 링 버퍼 (최근 1000건)
class PredictionHistory {
  private readonly buffer: PredictionRecord[] = [];
  private readonly maxSize = 1000;

  add(record: Omit<PredictionRecord, 'id' | 'timestamp'>): void { ... }
  getRecent(limit?: number): PredictionRecord[] { ... }
  getTrend(type: string, hours: number): PredictionRecord[] { ... }
}

export const predictionHistory = new PredictionHistory();
```

**API 엔드포인트**: `GET /api/ml/history?type=fermentation&hours=24`

**차트**: 기존 `components/dashboard/SensorChart.tsx`와 동일한 Recharts 패턴으로 `components/ml/PredictionTrendChart.tsx` 구현.

---

### 3.5 Sentry 성능 트레이싱 (FR-11)

```typescript
// instrumentation.ts — 수정

init({
  dsn: process.env.SENTRY_DSN,
  // Phase 5: 환경변수로 샘플링 레이트 제어
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  enabled: process.env.NODE_ENV === 'production',
  // ...
});
```

```typescript
// app/api/ml/predict/route.ts — Sentry span 추가

import * as Sentry from '@sentry/nextjs';

export async function POST(req: Request): Promise<Response> {
  return Sentry.withScope(async (scope) => {
    const transaction = Sentry.startSpan({
      op: 'ml.predict',
      name: 'ML Fermentation Prediction',
    }, async (span) => {
      // 기존 예측 로직
      const result = await predictor.predictFermentation(sensors);
      span.setAttribute('ml.confidence', result.confidence);
      span.setAttribute('ml.anomaly', result.anomaly);
      return result;
    });
    // ...
  });
}
```

---

## 4. Sprint 3 — 다국어/접근성

### 4.1 next-intl 도입 구조 (FR-13)

**라이브러리**: `next-intl` (App Router 네이티브 지원)

**디렉토리 구조 변경**:

```
kimchi-agent/
├── messages/                    # 신규 — 번역 파일
│   ├── ko.json                  # 한국어 (기본)
│   └── en.json                  # 영어
├── i18n/                        # 신규 — i18n 설정
│   ├── config.ts                # 로케일 목록, 기본 로케일
│   └── request.ts               # getRequestConfig (서버)
├── middleware.ts                 # 신규 — 로케일 감지 + 리다이렉트
├── app/
│   └── [locale]/                # 신규 — 로케일 동적 라우트
│       ├── layout.tsx           # NextIntlClientProvider 래핑
│       ├── page.tsx             # 기존 page.tsx 이동
│       └── api/                 # API는 로케일 불필요 → 기존 위치 유지
```

**주의**: API 라우트(`app/api/`)는 `[locale]` 아래로 이동하지 않음. 클라이언트 UI만 다국어 적용.

### 4.2 i18n 설정 파일

```typescript
// i18n/config.ts (신규)

export const locales = ['ko', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ko';
```

```typescript
// i18n/request.ts (신규)

import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale } from './config';

export default getRequestConfig(async ({ locale }) => {
  const safeLocale = locales.includes(locale as any) ? locale : defaultLocale;
  return {
    messages: (await import(`../messages/${safeLocale}.json`)).default,
  };
});
```

```typescript
// middleware.ts (신규 — 로케일 감지 + Rate Limiting 통합, Sprint 4와 공유)

import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed', // 기본 로케일(ko)은 URL에 표시 안 함
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'], // API, 정적 파일 제외
};
```

### 4.3 번역 파일 구조 (FR-14)

**네이밍 규칙**: `namespace.component.key`

```json
// messages/ko.json
{
  "common": {
    "newChat": "새 대화",
    "send": "전송",
    "cancel": "취소",
    "loading": "로딩 중...",
    "error": "오류가 발생했습니다"
  },
  "header": {
    "title": "김치공장 AI 도우미",
    "dashboard": "대시보드",
    "chat": "채팅",
    "documents": "문서"
  },
  "sidebar": {
    "conversations": "대화 목록",
    "today": "오늘",
    "yesterday": "어제",
    "searchPlaceholder": "대화 검색..."
  },
  "chat": {
    "placeholder": "김치 제조에 대해 무엇이든 물어보세요...",
    "voiceLabel": "음성 입력",
    "ragSearching": "관련 문서 검색 중...",
    "llmGenerating": "답변 생성 중..."
  },
  "documents": {
    "title": "문서 관리",
    "upload": "파일을 드래그하거나 클릭하여 업로드",
    "supportedFormats": "지원 형식: TXT, CSV, XLSX, PDF",
    "maxSize": "최대 10MB"
  },
  "ml": {
    "confidence": "예측 신뢰도",
    "lowConfidence": "신뢰도가 낮습니다. 결과를 참고용으로만 활용하세요.",
    "fermentationStage": "발효 단계",
    "stages": {
      "early": "초기",
      "mid": "중기",
      "late": "후기",
      "complete": "완료"
    }
  },
  "quickQuestions": {
    "temperature": "현재 발효실 온도와 습도는?",
    "salinity": "오늘 배치 염도 측정 결과는?",
    "progress": "현재 발효 진행률과 예상 완료 시간은?",
    "alert": "현재 이상 감지 알림이 있나요?",
    "haccp": "오늘 HACCP 체크리스트 항목 알려줘",
    "production": "이번 주 생산량 현황은?"
  },
  "accessibility": {
    "skipToContent": "본문으로 건너뛰기",
    "menuOpen": "메뉴 열기",
    "menuClose": "메뉴 닫기"
  }
}
```

```json
// messages/en.json
{
  "common": {
    "newChat": "New Chat",
    "send": "Send",
    "cancel": "Cancel",
    "loading": "Loading...",
    "error": "An error occurred"
  },
  "header": {
    "title": "Kimchi Factory AI Assistant",
    "dashboard": "Dashboard",
    "chat": "Chat",
    "documents": "Documents"
  },
  "sidebar": {
    "conversations": "Conversations",
    "today": "Today",
    "yesterday": "Yesterday",
    "searchPlaceholder": "Search conversations..."
  },
  "chat": {
    "placeholder": "Ask anything about kimchi manufacturing...",
    "voiceLabel": "Voice input",
    "ragSearching": "Searching related documents...",
    "llmGenerating": "Generating response..."
  },
  "documents": {
    "title": "Document Manager",
    "upload": "Drag or click to upload files",
    "supportedFormats": "Supported: TXT, CSV, XLSX, PDF",
    "maxSize": "Max 10MB"
  },
  "ml": {
    "confidence": "Prediction Confidence",
    "lowConfidence": "Low confidence. Use results as reference only.",
    "fermentationStage": "Fermentation Stage",
    "stages": {
      "early": "Early",
      "mid": "Mid",
      "late": "Late",
      "complete": "Complete"
    }
  },
  "quickQuestions": {
    "temperature": "Current fermentation room temp & humidity?",
    "salinity": "Today's batch salinity results?",
    "progress": "Current fermentation progress & ETA?",
    "alert": "Any anomaly alerts right now?",
    "haccp": "Show today's HACCP checklist",
    "production": "This week's production status?"
  },
  "accessibility": {
    "skipToContent": "Skip to content",
    "menuOpen": "Open menu",
    "menuClose": "Close menu"
  }
}
```

### 4.4 언어 전환 UI (FR-15)

**컴포넌트**: `components/layout/LocaleSwitcher.tsx` (신규)

```typescript
// components/layout/LocaleSwitcher.tsx (신규)

'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';

const LOCALE_LABELS: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
};

// Header 우측에 배치 (Logo badge 왼쪽)
// 드롭다운이 아닌 토글 버튼 형태 (2개 언어이므로)
//
// ┌─────────┐
// │ KO | EN │  ← 현재 활성 언어 하이라이트
// └─────────┘

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex items-center border rounded-full overflow-hidden text-xs" role="radiogroup" aria-label="Language">
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          role="radio"
          aria-checked={locale === loc}
          onClick={() => switchLocale(loc)}
          className={clsx(
            'px-2 py-1 transition-colors',
            locale === loc
              ? 'bg-kimchi-red text-white'
              : 'bg-white text-gray-500 hover:bg-gray-100'
          )}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
```

### 4.5 WCAG 2.1 AA 접근성 대응 (FR-16 ~ FR-19)

**감사 도구**: `@axe-core/react` (개발 모드), Lighthouse CI (GitHub Actions)

**수정 대상 컴포넌트 목록**:

| 컴포넌트 | 접근성 이슈 | 수정 내용 |
|----------|-----------|----------|
| `app/[locale]/layout.tsx` | Skip Navigation 누락 | `<a href="#main" className="sr-only focus:not-sr-only">` 추가 |
| `components/chat/ChatInput.tsx` | label 누락 | `aria-label` 또는 연결된 `<label>` 추가 |
| `components/chat/VoiceInput.tsx` | 상태 안내 부재 | `aria-live="polite"` 영역에 "녹음 중" 상태 텍스트 |
| `components/layout/Sidebar.tsx` | 포커스 트랩 미구현 | 모바일 오버레이 시 포커스 트랩 + Esc 닫기 |
| `components/layout/Header.tsx` | 탭 역할 미명시 | `role="tablist"` + `role="tab"` + `aria-selected` |
| `components/layout/BottomNav.tsx` | `role="navigation"` 누락 | `<nav>` 래핑 + `aria-label="주 내비게이션"` |
| `components/ml/FermentationProgressBar.tsx` | 프로그레스 바 접근성 | `role="progressbar"` + `aria-valuenow/min/max` |
| `components/ml/QualityGradeBadge.tsx` | 색상만으로 정보 전달 | 텍스트 라벨 병행 (A/B/C 텍스트 + 아이콘) |
| `components/documents/DocumentUpload.tsx` | 드롭존 키보드 접근 | `onKeyDown` Enter/Space 핸들링 |
| 전체 | 포커스 가시성 부족 | `focus-visible:ring-2 focus-visible:ring-kimchi-red` 글로벌 스타일 |

**고대비 모드 (FR-19)**:

```css
/* globals.css 추가 */
@media (prefers-contrast: high) {
  :root {
    --kimchi-red: #cc0000;
    --kimchi-green: #006600;
    --brand-text-primary: #000000;
    --brand-text-secondary: #333333;
    --kimchi-cream: #ffffff;
    --kimchi-beige-dark: #666666;
  }
}
```

---

## 5. Sprint 4 — 운영 최적화

### 5.1 구조화 로깅 — pino (FR-21)

**신규 파일**: `lib/logger.ts`

```typescript
// lib/logger.ts (신규)

import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
  level: LOG_LEVEL,
  // 브라우저에서 import 방지 (서버 전용)
  browser: { disabled: true },
  // 프로덕션: JSON, 개발: prettyPrint
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    },
  }),
  // 공통 메타데이터
  base: {
    service: 'kimchi-agent',
    env: process.env.NODE_ENV,
  },
  // 타임스탬프 형식
  timestamp: pino.stdTimeFunctions.isoTime,
});

// 하위 로거 팩토리
export function createLogger(module: string) {
  return logger.child({ module });
}
```

**적용 패턴 (기존 console.log/error 교체)**:

```typescript
// app/api/chat/route.ts — 예시

import { createLogger } from '@/lib/logger';
const log = createLogger('api.chat');

// 기존: console.log(`[/api/chat] Using OpenAI model: ${OPENAI_CHAT_MODEL}`);
// 변경:
log.info({ model: OPENAI_CHAT_MODEL }, 'Chat request using OpenAI model');

// 기존: console.error('[/api/chat] Error:', err);
// 변경:
log.error({ err }, 'Chat API error');
```

**교체 대상 파일 목록**:

| 파일 | console 사용 수 |
|------|---------------|
| `app/api/chat/route.ts` | 4 |
| `app/api/documents/upload/route.ts` | 2 |
| `app/api/ml/predict/route.ts` | 1 |
| `app/api/ml/quality/route.ts` | 1 |
| `app/api/health/route.ts` | 0 (신규 추가) |
| `lib/rag/pipeline.ts` | 2 |
| `lib/rag/retriever.ts` | 1 |
| `lib/rag/embedder.ts` | 1 |
| `lib/ml/predictor-factory.ts` | 1 |
| `lib/config/validate-env.ts` | 3 (console.warn/error) |

---

### 5.2 Rate Limiting (FR-24)

**신규 파일**: `lib/middleware/rate-limit.ts`

```typescript
// lib/middleware/rate-limit.ts (신규)

// 서버 사이드 인메모리 슬라이딩 윈도우 Rate Limiter
// 프로덕션에서는 Upstash Redis로 교체 가능

interface RateLimitConfig {
  windowMs: number;       // 윈도우 크기 (밀리초)
  maxRequests: number;    // 윈도우당 최대 요청 수
}

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      windowMs: 60_000,   // 1분
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10),
      ...config,
    };
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // 윈도우 외 요청 제거
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    const remaining = Math.max(0, this.config.maxRequests - entry.timestamps.length);
    const allowed = entry.timestamps.length < this.config.maxRequests;

    if (allowed) {
      entry.timestamps.push(now);
    }

    const resetAt = entry.timestamps.length > 0
      ? entry.timestamps[0] + this.config.windowMs
      : now + this.config.windowMs;

    return { allowed, remaining, resetAt };
  }
}

// 전역 인스턴스 (라우트별)
export const chatLimiter = new RateLimiter({ maxRequests: 20, windowMs: 60_000 });
export const uploadLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });
export const mlLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000 });
```

**라우트 적용 패턴**:

```typescript
// app/api/chat/route.ts — Rate Limit 적용

import { chatLimiter } from '@/lib/middleware/rate-limit';

export async function POST(req: Request): Promise<Response> {
  // IP 추출 (Vercel에서는 x-forwarded-for)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed, remaining, resetAt } = chatLimiter.check(ip);

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // ... 기존 로직
}
```

---

### 5.3 응답 속도 최적화 (FR-20)

**목표**: 첫 토큰 응답 p95 < 2초 (현재 < 3초)

**최적화 포인트**:

| 영역 | 현재 | 최적화 | 예상 개선 |
|------|------|--------|----------|
| RAG 검색 | 매 요청 임베딩 생성 | 쿼리 임베딩 캐시 (동일 질문 30초 TTL) | -200ms |
| 시스템 프롬프트 | 매 요청 재구성 | 센서 데이터 캐시 (10초 TTL) | -100ms |
| 컴포넌트 렌더링 | 매 렌더 전체 재계산 | `React.memo` + `useMemo` 적용 | -50ms |
| 번들 크기 | 전체 로드 | `dynamic()` import (DashboardPanel, MLPredictionPanel) | LCP -300ms |
| 폰트 로드 | Google Fonts 외부 | `next/font/google` 내장 | LCP -200ms |

**React.memo 적용 대상**:

```typescript
// components/chat/MessageBubble.tsx
export default React.memo(MessageBubble);

// components/ml/ConfidenceBar.tsx
export default React.memo(ConfidenceBar);

// components/ml/QualityGradeBadge.tsx
export default React.memo(QualityGradeBadge);
```

**dynamic import 적용**:

```typescript
// app/[locale]/page.tsx
import dynamic from 'next/dynamic';

const DashboardPanel = dynamic(() => import('@/components/dashboard/DashboardPanel'), {
  loading: () => <DashboardSkeleton />,
});

const MLPredictionPanel = dynamic(() => import('@/components/ml/MLPredictionPanel'), {
  loading: () => <div className="animate-pulse h-40 bg-gray-100 rounded-lg" />,
});
```

**next/font 마이그레이션**:

```typescript
// app/[locale]/layout.tsx — Google Fonts 외부 링크 → next/font
import { Noto_Sans_KR } from 'next/font/google';

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
});

// <html> → <html className={notoSansKR.className}>
// <head> 내 Google Fonts <link> 태그 제거
```

---

### 5.4 메모리 프로파일링 (FR-22)

**진단 포인트**:

| 잠재 누수 원인 | 파일 | 대응 |
|-------------|------|------|
| InMemoryVectorStore 무한 증가 | `lib/rag/retriever.ts` | 최대 청크 수 제한 (10,000개) + LRU 정리 |
| PredictionCache 만료 항목 적체 | `lib/ml/prediction-cache.ts` | 주기적 evictExpired 호출 (매 100회 접근 시) |
| conversationStore Map 무한 증가 | `lib/db/conversations-store.ts` | 최대 대화 수 제한 (500개) + 오래된 항목 제거 |
| SSE 스트림 abort 미처리 | `lib/ai/streaming.ts` | AbortSignal 연동, 클라이언트 연결 종료 시 정리 |

**메모리 모니터링 API**:

```typescript
// GET /api/health 확장 — 메모리 정보 포함

return ok({
  status: 'ok',
  timestamp: new Date().toISOString(),
  services: { ... },
  memory: {
    heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  },
});
```

---

## 6. 신규/변경 파일 요약

### 신규 파일

| 파일 | Sprint | 설명 |
|------|--------|------|
| `config/ml.config.ts` | S2 | ML 파라미터 외부 설정 |
| `app/api/ml/thresholds/route.ts` | S2 | 이상 감지 임계값 CRUD API |
| `app/api/ml/history/route.ts` | S2 | 예측 이력 조회 API |
| `components/ml/ConfidenceBar.tsx` | S2 | 신뢰도 점수 시각화 |
| `components/ml/PredictionTrendChart.tsx` | S2 | 예측 이력 트렌드 차트 |
| `lib/ml/prediction-history.ts` | S2 | 예측 이력 인메모리 저장소 |
| `messages/ko.json` | S3 | 한국어 번역 |
| `messages/en.json` | S3 | 영어 번역 |
| `i18n/config.ts` | S3 | i18n 설정 |
| `i18n/request.ts` | S3 | next-intl 서버 설정 |
| `app/[locale]/layout.tsx` | S3 | 로케일별 레이아웃 |
| `app/[locale]/page.tsx` | S3 | 로케일별 메인 페이지 |
| `components/layout/LocaleSwitcher.tsx` | S3 | 언어 전환 토글 |
| `middleware.ts` | S3 | 로케일 감지 미들웨어 |
| `lib/logger.ts` | S4 | pino 구조화 로거 |
| `lib/middleware/rate-limit.ts` | S4 | 인메모리 Rate Limiter |
| `docs/05-deploy/troubleshooting.md` | S1 | 운영 문제 해결 가이드 |

### 수정 파일

| 파일 | Sprint | 변경 내용 |
|------|--------|----------|
| `app/api/health/route.ts` | S1 | `services.chat` 필드 추가, 메모리 정보 추가 |
| `components/chat/QuickQuestions.tsx` | S1 | 질문 항목 갱신, 이모지 → lucide 아이콘 |
| `components/documents/DocumentList.tsx` | S1 | 페이지네이션 추가 |
| `components/chat/ChatInput.tsx` | S1 | 전송 중 UX 개선, aria-label 추가 |
| `components/chat/MessageBubble.tsx` | S1 | 긴 메시지 접기, React.memo |
| `components/layout/Sidebar.tsx` | S1 | 대화 검색, 포커스 트랩 |
| `components/layout/Header.tsx` | S1, S3 | 연결 상태, LocaleSwitcher, ARIA role |
| `lib/ml/rule-based-predictor.ts` | S2 | 설정 외부화 (config/ml.config.ts 사용) |
| `lib/ml/prediction-cache.ts` | S2 | 주기적 eviction 강화 |
| `components/ml/MLPredictionPanel.tsx` | S2 | ConfidenceBar 통합 |
| `app/api/ml/predict/route.ts` | S2 | Sentry span, prediction history 저장 |
| `instrumentation.ts` | S2 | SENTRY_TRACES_SAMPLE_RATE env 지원 |
| `lib/ai/streaming.ts` | S1 | keep-alive ping, abort 처리 |
| `app/api/chat/route.ts` | S4 | pino 로깅, rate limit |
| `app/api/documents/upload/route.ts` | S4 | pino 로깅, rate limit |
| `lib/config/validate-env.ts` | S4 | 신규 env 변수 검증 추가 |
| `globals.css` | S3 | 고대비 모드, 포커스 링 스타일 |
| `app/layout.tsx` | S3, S4 | next/font 마이그레이션 |
| 전체 접근성 대상 컴포넌트 (10개) | S3 | ARIA, 키보드 내비게이션 |
| 전체 API 라우트 (10개) | S4 | console → pino 교체 |

---

## 7. 환경 변수 (Phase 5 추가)

| Variable | Sprint | Default | 설명 |
|----------|--------|---------|------|
| `NEXT_PUBLIC_DEFAULT_LOCALE` | S3 | `ko` | 기본 로케일 |
| `LOG_LEVEL` | S4 | `info` (prod) / `debug` (dev) | pino 로그 레벨 |
| `RATE_LIMIT_MAX` | S4 | `30` | 분당 API 요청 한도 |
| `ML_CONFIDENCE_THRESHOLD` | S2 | `0.6` | ML 신뢰도 경고 임계값 |
| `SENTRY_TRACES_SAMPLE_RATE` | S2 | `0.1` | Sentry 성능 샘플링 (0.0~1.0) |

---

## 8. 타입 추가/변경

```typescript
// types/index.ts 추가

/** ML 이상 감지 임계값 */
export interface AnomalyThresholds {
  tempMin: number;
  tempMax: number;
  salinityMin: number;
  salinityMax: number;
  phMin: number;
  phMax: number;
}

/** 예측 이력 레코드 */
export interface PredictionRecord {
  id: string;
  timestamp: string;
  type: 'fermentation' | 'quality';
  input: Record<string, number>;
  confidence: number;
  result: string; // stage 또는 grade
}

/** Health 응답 확장 */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    chat: 'ok' | 'degraded' | 'unavailable';
    vectorStore: 'pgvector' | 'memory';
    embeddingProvider: string;
    ollama: 'ok' | 'unavailable';
    mlServer: 'ok' | 'unavailable';
  };
  memory?: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}
```

---

## 9. 데이터 흐름 다이어그램

### 9.1 ML 신뢰도 점수 표시 흐름

```
[센서 데이터]
     │
     ▼
[RuleBasedPredictor]
     │  config/ml.config.ts 에서 파라미터 로드
     │
     ├──▶ FermentationPrediction { confidence: 0.82 }
     │
     ├──▶ predictionHistory.add(record)  ── 이력 저장
     │
     ▼
[POST /api/ml/predict 응답]
     │
     ▼
[MLPredictionPanel]
     │
     ├── FermentationProgressBar (기존)
     │
     └── ConfidenceBar
           │  value=0.82
           │  threshold=0.6 (env: ML_CONFIDENCE_THRESHOLD)
           │
           └── 색상: kimchi-green (>= 0.8)
```

### 9.2 다국어 요청 흐름

```
[Browser: /en/chat]
     │
     ▼
[middleware.ts]
     │  next-intl: locale='en' 파싱
     │  Rate Limit 검사 (API 경로 제외)
     ▼
[app/[locale]/layout.tsx]
     │  NextIntlClientProvider messages={en.json}
     ▼
[app/[locale]/page.tsx]
     │  useTranslations('chat') → t('placeholder')
     │  → "Ask anything about kimchi manufacturing..."
     ▼
[ChatWindow]
     │  useTranslations('chat')
     │  placeholder={t('placeholder')}
     ▼
[POST /api/chat]   ← API는 [locale] 밖, 로케일 무관
```

### 9.3 Rate Limiting 흐름

```
[요청]
  │
  ▼
[API Route Handler]
  │
  ├── chatLimiter.check(ip)
  │     ├── allowed=true  → 요청 처리 계속
  │     └── allowed=false → 429 Too Many Requests
  │           Headers:
  │             Retry-After: 45
  │             X-RateLimit-Remaining: 0
  │
  ▼
[정상 응답]
```

---

## 10. 구현 순서 (병렬 작업 분리)

### Sprint 1 (Week 1-2)

```
순서  작업                                    의존성    예상 파일
──────────────────────────────────────────────────────────────────
S1-1  /api/health services.chat 추가          없음     app/api/health/route.ts
S1-2  troubleshooting.md 작성                 없음     docs/05-deploy/troubleshooting.md
S1-3  SSE keep-alive 핑 추가                  없음     lib/ai/streaming.ts
S1-4  QuickQuestions 항목 갱신                 없음     components/chat/QuickQuestions.tsx
S1-5  DocumentList 페이지네이션                없음     components/documents/DocumentList.tsx
S1-6  ChatInput UX 개선                       없음     components/chat/ChatInput.tsx
S1-7  MessageBubble 긴 메시지 접기            없음     components/chat/MessageBubble.tsx
S1-8  Sidebar 대화 검색                       없음     components/layout/Sidebar.tsx
S1-9  Header 연결 상태 인디케이터             없음     components/layout/Header.tsx
```

### Sprint 2 (Week 3-4)

```
순서  작업                                    의존성    예상 파일
──────────────────────────────────────────────────────────────────
S2-1  config/ml.config.ts 생성                없음     config/ml.config.ts
S2-2  RuleBasedPredictor 외부화               S2-1     lib/ml/rule-based-predictor.ts
S2-3  PATCH /api/ml/thresholds 생성           S2-1     app/api/ml/thresholds/route.ts
S2-4  ConfidenceBar 컴포넌트                  없음     components/ml/ConfidenceBar.tsx
S2-5  MLPredictionPanel에 ConfidenceBar 통합  S2-4     components/ml/MLPredictionPanel.tsx
S2-6  prediction-history 저장소               없음     lib/ml/prediction-history.ts
S2-7  GET /api/ml/history 생성               S2-6     app/api/ml/history/route.ts
S2-8  PredictionTrendChart 컴포넌트          S2-7     components/ml/PredictionTrendChart.tsx
S2-9  Sentry 성능 트레이싱 추가              없음     instrumentation.ts, api/ml/predict
```

### Sprint 3 (Week 5-6)

```
순서  작업                                    의존성    예상 파일
──────────────────────────────────────────────────────────────────
S3-1  next-intl 설치 + i18n 설정             없음     i18n/config.ts, i18n/request.ts
S3-2  messages/ko.json, en.json 작성         S3-1     messages/ko.json, messages/en.json
S3-3  middleware.ts 로케일 감지               S3-1     middleware.ts
S3-4  app/[locale]/layout.tsx 생성           S3-1~3   app/[locale]/layout.tsx
S3-5  app/[locale]/page.tsx 마이그레이션     S3-4     app/[locale]/page.tsx
S3-6  LocaleSwitcher 컴포넌트                S3-4     components/layout/LocaleSwitcher.tsx
S3-7  컴포넌트 번역 키 적용 (전체)           S3-2~5   components/**/*.tsx
S3-8  WCAG 접근성 감사 (axe-core 실행)      없음     (감사 결과)
S3-9  접근성 수정 — ARIA/키보드/포커스       S3-8     components/**/*.tsx, globals.css
S3-10 고대비 모드 CSS                        없음     globals.css
```

### Sprint 4 (Week 7-8)

```
순서  작업                                    의존성    예상 파일
──────────────────────────────────────────────────────────────────
S4-1  lib/logger.ts (pino) 생성              없음     lib/logger.ts
S4-2  API 라우트 console → pino 교체         S4-1     app/api/**/*.ts, lib/**/*.ts
S4-3  lib/middleware/rate-limit.ts 생성      없음     lib/middleware/rate-limit.ts
S4-4  API 라우트에 rate limit 적용           S4-3     app/api/chat, upload, ml 등
S4-5  쿼리 임베딩 캐시 추가                  없음     lib/rag/pipeline.ts
S4-6  React.memo + dynamic import 적용      없음     components/**, app/[locale]/page.tsx
S4-7  next/font 마이그레이션                 없음     app/[locale]/layout.tsx
S4-8  메모리 누수 진단 + 수정               없음     lib/rag/retriever.ts, conversations-store
S4-9  /api/health 메모리 정보 추가          없음     app/api/health/route.ts
S4-10 validate-env.ts 신규 env 변수 추가    없음     lib/config/validate-env.ts
```

### 병렬 작업 관계

```
Sprint 1: S1-1~S1-9 (전부 독립 → 최대 병렬)

Sprint 2: S2-1 → S2-2, S2-3 (의존)
          S2-4 → S2-5 (의존)
          S2-6 → S2-7 → S2-8 (순차)
          S2-9 (독립)

Sprint 3: S3-1 → S3-2, S3-3 (의존)
          S3-3, S3-4 → S3-5 → S3-6, S3-7 (순차)
          S3-8 → S3-9 (감사 후 수정)
          S3-10 (독립)

Sprint 4: S4-1 → S4-2 (의존)
          S4-3 → S4-4 (의존)
          S4-5, S4-6, S4-7, S4-8, S4-9, S4-10 (독립)
```

---

## 11. NPM 의존성 추가

| 패키지 | 버전 | Sprint | 용도 |
|--------|------|--------|------|
| `next-intl` | ^4.x | S3 | App Router i18n |
| `pino` | ^9.x | S4 | 구조화 로깅 |
| `pino-pretty` | ^11.x | S4 | 개발 모드 로그 포맷 (devDependencies) |
| `@axe-core/react` | ^4.x | S3 | 접근성 감사 (devDependencies) |

---

## 12. 테스트 전략 요약

| Sprint | 테스트 대상 | 방법 |
|--------|-----------|------|
| S1 | `/api/health` chat 필드 | Jest unit test |
| S1 | SSE keep-alive | Jest + mock stream |
| S2 | ML config 로드 | Jest unit test |
| S2 | PATCH /api/ml/thresholds | Jest API test |
| S2 | ConfidenceBar 렌더링 | Jest + RTL |
| S3 | 로케일 전환 | Playwright E2E |
| S3 | 접근성 | axe-core + Lighthouse CI |
| S4 | Rate Limiter | Jest unit test |
| S4 | pino 로거 출력 | Jest unit test |
| S4 | 응답 속도 | k6 부하 테스트 / Sentry |

**커버리지 목표**: Jest >= 80% (Phase 4 기준 61 tests → Phase 5 목표 80+ tests)

---

## 13. 하위 호환성

1. **API 응답**: `/api/health`에 `services.chat` 필드 추가는 하위 호환 (기존 필드 유지)
2. **ML 파라미터**: `config/ml.config.ts` 기본값이 현재 하드코딩 값과 동일 → 동작 변화 없음
3. **i18n 라우팅**: `localePrefix: 'as-needed'` → 기본 로케일(ko) URL 변화 없음 (`/` = `/ko`)
4. **Rate Limiting**: 기본 30req/min은 일반 사용에 충분 → 기존 사용자 영향 없음
5. **로깅**: pino JSON 출력은 기존 console.log 호출 위치와 동일 → 외부 시스템 통합만 변경

---

## 14. Phase 4 이관 항목 완료 확인

| 항목 | Sprint | 설계 섹션 | 완료 기준 |
|------|--------|----------|----------|
| `/api/health` services.chat 필드 | S1 | 2.1 | API 응답에 `services.chat` 포함 |
| `troubleshooting.md` 독립 파일 | S1 | 2.2 | 파일 존재 + 10개 이상 FAQ |
| Sentry 성능 최적화 | S2 | 3.5 | SENTRY_TRACES_SAMPLE_RATE env 지원 |

---

*Design document created by CTO Team (architect) -- 2026-02-28*
