# AWS Amplify 배포 가이드 — Kimchi-Agent

Next.js 14 SSR 앱을 AWS Amplify Hosting(Compute)으로 배포하는 단계별 가이드입니다.

---

## 아키텍처 개요

```
GitHub (master) → Amplify CI/CD → CloudFront CDN
                                        │
                                   Lambda (SSR)
                                   ├── Next.js App Router
                                   ├── API Routes (chat, documents, ml)
                                   └── SSE Streaming (alerts)
```

- **빌드**: GitHub push → Amplify 자동 빌드 (`amplify.yml`)
- **서빙**: CloudFront + Lambda@Edge (SSR)
- **환경**: Node.js 20 LTS

---

## 사전 요구사항

- AWS 계정 (AWS CLI 설정 완료: `aws configure`)
- GitHub 리포지토리: `superpjh-stack/Kimchi-AI-Agent`
- 필수 API 키: `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY`

---

## 배포 단계

### 1단계: AWS Amplify 앱 생성

**AWS 콘솔 방식 (권장)**

1. [AWS Amplify 콘솔](https://console.aws.amazon.com/amplify/) 접속
2. **"New app" → "Host web app"** 클릭
3. **GitHub** 선택 → 리포지토리 연결 승인
4. `superpjh-stack/Kimchi-AI-Agent` → branch: `master` 선택
5. Build settings 화면에서 **"Edit" 클릭** → `amplify.yml` 자동 감지 확인
6. **"Save and deploy"** 클릭

**AWS CLI 방식**

```bash
# Amplify 앱 생성
aws amplify create-app \
  --name "kimchi-agent" \
  --repository "https://github.com/superpjh-stack/Kimchi-AI-Agent" \
  --platform WEB_COMPUTE \
  --region ap-northeast-2

# 브랜치 연결 (자동 배포)
aws amplify create-branch \
  --app-id <APP_ID> \
  --branch-name master \
  --framework "Next.js - SSR" \
  --enable-auto-build
```

---

### 2단계: 환경변수 설정

Amplify 콘솔 → 앱 선택 → **Environment variables** 메뉴에서 아래 변수 입력:

#### 필수 (하나 이상)

| 변수명 | 값 | 설명 |
|--------|----|------|
| `OPENAI_API_KEY` | `sk-proj-...` | 임베딩 + Chat (gpt-4o-mini) |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | OpenAI Chat 모델 지정 |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude API (선택, 크레딧 필요) |

#### 권장

| 변수명 | 값 | 설명 |
|--------|----|------|
| `NODE_ENV` | `production` | 프로덕션 모드 |

#### 선택 (데이터 영속성 필요 시)

| 변수명 | 값 | 설명 |
|--------|----|------|
| `DATABASE_URL` | `postgresql://...` | pgvector DB (미설정 시 인메모리) |

> **주의**: `NEXT_PUBLIC_` 접두사 변수는 클라이언트 번들에 포함됩니다.
> `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` 등 민감한 키는 접두사 없이 사용하세요.

**CLI로 환경변수 일괄 설정:**

```bash
aws amplify update-app \
  --app-id <APP_ID> \
  --environment-variables \
    OPENAI_API_KEY=sk-proj-xxx,\
    OPENAI_CHAT_MODEL=gpt-4o-mini,\
    NODE_ENV=production
```

---

### 3단계: 첫 번째 배포 트리거

```bash
# 현재 코드를 Amplify에 배포 트리거
git push origin master
```

또는 Amplify 콘솔 → **"Run build"** 클릭

---

### 4단계: 배포 확인

Amplify 콘솔에서 빌드 로그 확인:

```
✓ Phase: preBuild
  - nvm use 20        ✓
  - npm ci            ✓

✓ Phase: build
  - npm run build     ✓

✓ Deploy: CloudFront 배포
```

배포 완료 후 제공되는 URL 패턴:
```
https://master.<APP_ID>.amplifyapp.com
```

---

### 5단계: 커스텀 도메인 연결 (선택)

1. Amplify 콘솔 → **Domain management** → **"Add domain"**
2. 도메인 입력 (예: `kimchi-agent.com`)
3. SSL 인증서 자동 발급 (ACM)
4. DNS 설정 가이드에 따라 CNAME 레코드 추가

---

## 빌드 설정 (`amplify.yml`) 설명

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm use 20      # Node.js 20 LTS
        - npm ci          # 클린 의존성 설치
    build:
      commands:
        - npm run build   # Next.js SSR 빌드
  artifacts:
    baseDirectory: .next  # SSR 빌드 산출물 디렉토리
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/* # 의존성 캐시
      - .next/cache/**/*  # Next.js 빌드 캐시
```

---

## SSE 스트리밍 관련 주의사항

### Lambda 실행 시간 제한
- AWS Lambda 기본 타임아웃: **30초**
- 채팅 SSE 스트리밍: Claude/OpenAI API 응답 시간에 따라 제한될 수 있음
- 해결책: Amplify 콘솔 → Functions → 타임아웃 설정 증가

### 알림 스트림 (SSE)
- `/api/alerts/stream` — setInterval 기반 폴링, 30초 내 응답 가능
- 프로덕션에서 클라이언트 재연결 로직 정상 동작

---

## 인메모리 스토어 제한

> **주의**: Lambda 서버리스 환경에서 인스턴스가 여러 개 실행될 수 있음.
> 각 Lambda 인스턴스는 별도의 메모리 공간을 가짐.

**증상**: 업로드한 문서가 일부 요청에서만 RAG에 활용됨.

**해결**: `DATABASE_URL` (pgvector/PostgreSQL) 환경변수 설정으로 영속 벡터 DB 사용.

---

## 배포 후 체크리스트

- [ ] `https://master.<ID>.amplifyapp.com` 접속 확인
- [ ] 채팅 전송 및 AI 응답 확인
- [ ] 음성 입력 버튼 (마이크) 동작 확인 — HTTPS 필수
- [ ] 언어 전환 (KO/EN) 확인
- [ ] 문서 업로드 → RAG 검색 확인
- [ ] 대시보드 센서 데이터 확인

---

## 비용 예상

| 트래픽 | 월 예상 비용 |
|--------|-------------|
| 소규모 (공장 내부 5명) | $0 ~ $5 |
| 중규모 (50명) | $5 ~ $30 |
| 무료 티어 | 첫 12개월 1,000 빌드 분/월 무료 |

---

## 트러블슈팅

### 빌드 실패: `nvm: command not found`
```bash
# amplify.yml preBuild에서 nvm 경로 명시
- . $NVM_DIR/nvm.sh && nvm use 20
```

### 빌드 실패: Sentry 소스맵 업로드 오류
- 해결: `SENTRY_AUTH_TOKEN` 환경변수 추가 또는 무시 (`silent: true` 설정됨)

### 런타임 오류: `Cannot find module 'pdf-parse'`
- 해결: `next.config.js`의 `serverComponentsExternalPackages`에 이미 추가됨

### HTTPS에서만 마이크 작동
- Amplify는 기본으로 HTTPS 제공 → 음성 기능 정상 동작
