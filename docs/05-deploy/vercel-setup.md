# Vercel 배포 가이드

**Kimchi-Agent** Next.js 14 앱을 Vercel에 배포하는 단계별 가이드.

---

## 1. 사전 준비

| 항목 | 설명 |
|------|------|
| GitHub 계정 | 소스 코드가 push된 리포지토리 |
| Vercel 계정 | [vercel.com](https://vercel.com) — GitHub 연동 필요 |
| Supabase 프로젝트 | pgvector 벡터 DB (별도 가이드: [supabase-setup.md](./supabase-setup.md)) |
| API 키 | Anthropic 또는 OpenAI API 키 |

---

## 2. Vercel 프로젝트 생성

### 2.1 Import Repository

1. [vercel.com/new](https://vercel.com/new) 접속
2. **Import Git Repository** 클릭
3. GitHub에서 `Kimchi-AI-Agent` 리포지토리 선택
4. **Framework Preset**: `Next.js` (자동 감지됨)
5. **Root Directory**: `/` (기본값 유지)

### 2.2 Build Settings 확인

| 설정 | 값 |
|------|-----|
| Build Command | `npm run build` (기본값) |
| Output Directory | `.next` (기본값) |
| Install Command | `npm install` (기본값) |
| Node.js Version | `20.x` |

### 2.3 환경변수 입력

**Settings > Environment Variables** 에서 아래 순서로 입력:

```
1. DATABASE_URL          ← Supabase 연결 문자열 (pgvector 의존)
2. ANTHROPIC_API_KEY     ← Claude Chat 기능
3. OPENAI_API_KEY        ← 임베딩 (text-embedding-3-small)
4. OPENAI_CHAT_MODEL     ← (선택) OpenAI Chat 모델로 대체 시
5. EMBEDDING_PROVIDER    ← (선택) openai | local | mock
6. NEXT_PUBLIC_SENTRY_DSN ← (선택) Sentry 클라이언트 DSN
7. SENTRY_DSN            ← (선택) Sentry 서버 DSN
8. SENTRY_AUTH_TOKEN     ← (선택) 소스맵 업로드 토큰
```

> 전체 환경변수 목록: [env-variables.md](./env-variables.md)

### 2.4 Deploy 클릭

모든 환경변수를 입력한 후 **Deploy** 버튼을 클릭합니다. 첫 빌드에 2~3분 소요됩니다.

---

## 3. 배포 후 확인

### 3.1 Health Check

배포 완료 후 브라우저에서 확인:

```
https://<your-app>.vercel.app/api/health
```

정상 응답 예시:

```json
{
  "status": "ok",
  "timestamp": "2026-02-28T12:00:00.000Z",
  "services": {
    "vectorStore": "pgvector",
    "embedding": "openai",
    "chat": "claude-sonnet-4-6"
  }
}
```

### 3.2 주요 기능 확인 체크리스트

- [ ] 메인 페이지 (`/`) 로드 확인
- [ ] `/api/health` 200 OK 반환
- [ ] 채팅 메시지 전송 및 스트리밍 응답 확인
- [ ] 문서 업로드 (TXT, CSV) 후 RAG 검색 확인
- [ ] ML 예측 (`/api/ml/predict`) 정상 응답

---

## 4. Cold Start 워밍업 (Cron)

프로젝트 루트의 `vercel.json`에 Cron Job이 설정되어 있습니다:

```json
{
  "crons": [
    {
      "path": "/api/health",
      "schedule": "*/3 * * * *"
    }
  ]
}
```

- 3분마다 `/api/health` 를 호출하여 서버리스 함수를 warm 상태로 유지
- Cold Start 목표: < 3초 (NFR-P4-01)
- Vercel Hobby 플랜에서도 Cron 사용 가능 (1일 1회 제한 있을 수 있음 -- Pro 플랜 권장)

---

## 5. 커스텀 도메인 설정 (선택)

1. **Settings > Domains** 이동
2. 도메인 입력 (예: `kimchi-agent.example.com`)
3. DNS 레코드 설정:
   - **CNAME**: `cname.vercel-dns.com`
   - 또는 **A 레코드**: Vercel이 안내하는 IP
4. SSL 인증서 자동 발급 확인 (Let's Encrypt)

---

## 6. 재배포

코드를 GitHub `master` 브랜치에 push하면 Vercel이 자동으로 재배포합니다.

수동 재배포가 필요한 경우:
- Vercel 대시보드 > **Deployments** > **Redeploy** 클릭

환경변수 변경 후에는 반드시 재배포가 필요합니다.

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 빌드 실패 `Module not found` | 패키지 미설치 | `package.json` dependencies 확인 후 재배포 |
| `/api/chat` 500 에러 | API 키 미설정 | 환경변수에 `ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY` + `OPENAI_CHAT_MODEL` 확인 |
| pgvector 연결 실패 | `DATABASE_URL` 오류 | Supabase 연결 문자열 확인, SSL 모드 포함 여부 확인 |
| Cold Start > 3초 | Cron 미작동 | `vercel.json` cron 설정 확인, Pro 플랜 업그레이드 검토 |
| 임베딩 차원 불일치 | 임베더 변경 | Supabase에서 `document_chunks` 테이블 DROP 후 문서 재업로드 |
