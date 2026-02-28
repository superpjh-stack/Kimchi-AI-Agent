# Kimchi-Agent 트러블슈팅 가이드

> 버전: Phase 5 Sprint 1 | 최종 수정: 2026-02-28

---

## 1. 빠른 진단 — /api/health 체크리스트

서버가 실행 중이라면 먼저 헬스 엔드포인트로 전체 상태를 확인합니다.

```bash
curl http://localhost:3000/api/health | jq .
```

응답 예시:
```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-02-28T10:00:00.000Z",
    "services": {
      "chat": "ok",
      "vectorStore": "memory",
      "embeddingProvider": "auto",
      "ollama": "unavailable",
      "mlServer": "unavailable"
    },
    "memory": {
      "heapUsedMB": 120,
      "heapTotalMB": 256,
      "rssMB": 310
    }
  }
}
```

### 체크리스트

| 항목 | 기대값 | 조치 |
|------|--------|------|
| `status` | `"ok"` | 다른 값이면 서버 로그 확인 |
| `services.chat` | `"ok"` | `"degraded"` → OpenAI로 동작 중, `"unavailable"` → API 키 없음 |
| `services.vectorStore` | `"memory"` 또는 `"pgvector"` | `"memory"`는 재시작 시 초기화됨 |
| `services.embeddingProvider` | `"auto"` 또는 설정값 | 임베딩 키 확인 |
| `services.ollama` | `"ok"` 또는 `"unavailable"` | OLLAMA_BASE_URL 환경변수 확인 |
| `services.mlServer` | `"ok"` 또는 `"unavailable"` | ML_SERVER_URL 환경변수 확인 |
| `memory.heapUsedMB` | 300 미만 권장 | 높으면 서버 재시작 고려 |

---

## 2. 오류 코드 참조표

| HTTP 상태 코드 | 오류 코드 | 의미 | 일반적 원인 |
|---------------|-----------|------|-------------|
| 400 | `INVALID_REQUEST` | 요청 형식 오류 | 필수 파라미터 누락 |
| 401 | `UNAUTHORIZED` | 인증 실패 | API 키 없음 또는 만료 |
| 403 | `FORBIDDEN` | 접근 거부 | 잘못된 API 키 |
| 404 | `NOT_FOUND` | 리소스 없음 | 존재하지 않는 대화 ID |
| 413 | `PAYLOAD_TOO_LARGE` | 파일 크기 초과 | 문서 파일 10MB 이상 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 지원하지 않는 파일 형식 | PDF/TXT/CSV/XLSX 외 파일 |
| 429 | `RATE_LIMIT_EXCEEDED` | API 요청 한도 초과 | Anthropic/OpenAI 요금제 확인 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 내부 오류 | 서버 로그 확인 |
| 503 | `SERVICE_UNAVAILABLE` | 서비스 사용 불가 | AI 제공자 서비스 장애 |

---

## 3. FAQ

### Q1. 서버가 시작되지 않아요

**증상**: `npm run dev` 실행 시 오류 발생 또는 응답 없음

**해결 방법**:
1. Node.js 버전 확인: `node -v` (v18 이상 필요)
2. 의존성 재설치: `rm -rf node_modules && npm install`
3. `.env.local` 파일 존재 여부 확인
4. 포트 충돌 확인: `lsof -i :3000` (macOS/Linux) 또는 `netstat -ano | findstr :3000` (Windows)
5. 다른 포트로 시작: `npm run dev -- -p 3001`

---

### Q2. Chat 응답이 전혀 없어요

**증상**: 메시지 전송 후 응답이 없거나 즉시 오류 표시

**해결 방법**:
1. `/api/health` 에서 `services.chat` 확인
2. `.env.local`의 `ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY` 확인
3. API 키 크레딧 잔액 확인 (Anthropic Console / OpenAI Dashboard)
4. `OPENAI_CHAT_MODEL` 환경변수가 설정되면 OpenAI로 전환됨
5. 브라우저 네트워크 탭에서 `/api/chat` 요청 상태 확인

```bash
# API 키 유효성 빠른 테스트 (OpenAI)
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.data[0].id'
```

---

### Q3. 문서 업로드가 실패해요

**증상**: 파일 업로드 시 오류 메시지 또는 업로드 후 목록에 나타나지 않음

**해결 방법**:
1. 지원 파일 형식 확인: TXT, CSV, XLSX, PDF
2. 파일 크기 확인: 10MB 이하 권장
3. 브라우저 콘솔에서 오류 메시지 확인
4. 서버 로그에서 업로드 오류 확인
5. PDF의 경우 `pdf-parse` 패키지가 설치되었는지 확인: `npm list pdf-parse`

```bash
# 업로드 API 직접 테스트
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@test.txt"
```

---

### Q4. RAG 검색 결과가 없어요 (출처가 표시되지 않음)

**증상**: Chat 응답에 출처 정보가 없거나 업로드한 문서 내용을 참고하지 않음

**해결 방법**:
1. 문서 업로드 완료 여부 확인 (`/api/documents` 엔드포인트)
2. `OPENAI_API_KEY` 없으면 mock embedding 사용 → 시맨틱 검색 품질 저하
3. 질문이 문서 내용과 관련성이 낮을 수 있음 (구체적인 키워드 사용)
4. 벡터 스토어는 인메모리 — 서버 재시작 시 초기화됨
5. 청킹 전략 변경 시도: 더 작은 청크 크기(500자) 사용

---

### Q5. ML 예측이 작동하지 않아요

**증상**: ML 서버 관련 기능이 응답하지 않거나 오류 발생

**해결 방법**:
1. `/api/health`에서 `services.mlServer` 확인
2. `ML_SERVER_URL` 환경변수 설정 여부 확인
3. ML 서버가 실행 중인지 확인: `curl $ML_SERVER_URL/health`
4. ML 서버와 Next.js 서버 간 네트워크 연결 확인
5. ML 서버 로그에서 오류 확인

---

### Q6. SSE 스트리밍이 자꾸 끊겨요

**증상**: Chat 응답이 중간에 끊기거나, 응답이 완전하지 않게 표시됨

**해결 방법**:
1. 네트워크 연결 상태 확인 (헤더의 연결 상태 인디케이터)
2. 프록시 또는 로드 밸런서가 SSE 연결을 끊는지 확인
3. Nginx/Apache 설정에 SSE 타임아웃 연장 추가:
   ```nginx
   proxy_read_timeout 300s;
   proxy_buffering off;
   ```
4. 스트리밍 연결은 15초마다 keep-alive ping을 전송함 — 방화벽이 이를 차단하는지 확인
5. 브라우저 개발자 도구 → Network → EventStream 탭에서 이벤트 흐름 확인

---

### Q7. Sentry에 에러가 잡히지 않아요

**증상**: 오류가 발생해도 Sentry 대시보드에 이벤트가 없음

**해결 방법**:
1. `NEXT_PUBLIC_SENTRY_DSN` 환경변수 설정 여부 확인
2. `sentry.client.config.ts` 및 `sentry.server.config.ts` 파일 존재 여부 확인
3. Sentry 프로젝트의 DSN이 올바른지 확인
4. 개발 환경에서는 Sentry가 비활성화될 수 있음 (`NODE_ENV=production` 확인)
5. 수동 테스트: `throw new Error('Sentry test')` 코드를 임시로 추가하여 확인

---

### Q8. 메모리 사용량이 계속 증가해요

**증상**: 시간이 지남에 따라 서버 메모리가 계속 증가, OOM 오류 발생

**해결 방법**:
1. `/api/health`에서 `memory.heapUsedMB` 모니터링
2. 인메모리 벡터 스토어에 대량 문서 업로드 시 메모리 증가는 정상
3. 불필요한 문서 삭제로 벡터 스토어 크기 축소
4. Node.js 메모리 제한 설정: `NODE_OPTIONS=--max-old-space-size=512`
5. Phase 2 이후: bkend.ai/pgvector로 영구 스토리지 전환 고려
6. 서버 정기 재시작 스케줄링 (PM2 cron restart)

---

### Q9. Vercel 배포가 실패해요

**증상**: `vercel deploy` 실패 또는 빌드 오류

**해결 방법**:
1. 로컬에서 먼저 빌드 테스트: `npm run build`
2. TypeScript 타입 에러 확인: `npx tsc --noEmit`
3. Vercel 환경변수 설정 확인 (Vercel Dashboard → Settings → Environment Variables)
4. 필수 환경변수 목록:
   - `ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY`
5. `next.config.ts`에 외부 패키지 설정 확인:
   ```typescript
   serverExternalPackages: ['pdf-parse', 'xlsx']
   ```
6. 빌드 로그에서 구체적인 오류 메시지 확인: `vercel logs`

---

### Q10. 음성 인식이 작동하지 않아요

**증상**: 마이크 버튼이 반응하지 않거나 음성이 텍스트로 변환되지 않음

**해결 방법**:
1. 브라우저 호환성 확인: Chrome 또는 Edge 사용 권장 (Firefox는 Web Speech API 미지원)
2. 마이크 접근 권한 허용 여부 확인 (브라우저 주소창 자물쇠 아이콘)
3. HTTPS 환경 필요 (localhost는 예외적으로 HTTP 허용)
4. 언어 설정 확인: `ko-KR` (한국어) 로 설정되어 있어야 함
5. 브라우저 콘솔에서 `SpeechRecognition` 관련 오류 메시지 확인
6. 다른 탭이나 앱에서 마이크를 사용 중인지 확인

---

## 4. 로그 분석 가이드

### 개발 환경 로그

```bash
# 개발 서버 실행 및 로그 확인
npm run dev 2>&1 | tee dev.log
```

### Pino JSON 로그 파싱 (jq 활용)

프로덕션 환경에서 pino JSON 로그를 사용하는 경우:

```bash
# 에러 레벨 로그만 필터링
cat app.log | jq 'select(.level >= 50)'

# 특정 시간 이후 로그
cat app.log | jq 'select(.time > 1709000000000)'

# Chat API 관련 로그
cat app.log | jq 'select(.msg | contains("chat"))'

# 에러 메시지와 스택 트레이스
cat app.log | jq 'select(.level >= 50) | {time: .time, msg: .msg, err: .err}'

# 응답 시간 상위 10개
cat app.log | jq -s 'sort_by(-.responseTime) | .[:10] | .[] | {url: .req.url, ms: .responseTime}'

# 특정 요청 ID 추적
cat app.log | jq 'select(.reqId == "req-abc123")'
```

### Next.js 서버 로그 위치

| 환경 | 로그 위치 |
|------|-----------|
| 개발 | 터미널 stdout |
| Vercel | Vercel Dashboard → Logs |
| PM2 | `pm2 logs kimchi-agent` |
| Docker | `docker logs <container-id>` |

---

## 5. 에스컬레이션 절차

문제가 해결되지 않을 경우 다음 순서로 에스컬레이션합니다.

### Level 1: 자가 진단 (5분)
1. `/api/health` 엔드포인트 확인
2. 브라우저 콘솔 오류 메시지 확인
3. 서버 터미널 로그 확인
4. 위 FAQ 항목 검토

### Level 2: 환경 점검 (15분)
1. `.env.local` 환경변수 전체 재확인
2. `npm install` 재실행
3. 서버 재시작 (`Ctrl+C` 후 `npm run dev`)
4. 다른 브라우저/시크릿 모드에서 재시도
5. `npm run build`로 빌드 오류 확인

### Level 3: 코드 레벨 디버깅 (30분)
1. 관련 API 라우트 파일 확인 (`app/api/` 디렉토리)
2. `console.log` 또는 `pino` 로그 추가
3. curl로 API 직접 호출하여 격리 테스트
4. git log로 최근 변경사항 확인: `git log --oneline -10`
5. 최근 커밋으로 롤백 후 테스트: `git stash`

### Level 4: 외부 서비스 확인
1. Anthropic API 상태: https://status.anthropic.com
2. OpenAI API 상태: https://status.openai.com
3. Vercel 상태: https://www.vercel-status.com
4. API 사용량 및 크레딧 잔액 확인

### 버그 리포트 작성 시 포함 정보
- OS 및 Node.js 버전
- 재현 단계 (구체적인 입력값 포함)
- `/api/health` 응답 전체
- 브라우저 콘솔 스크린샷
- 서버 터미널 오류 로그
- 최근 git 커밋 해시: `git rev-parse --short HEAD`
