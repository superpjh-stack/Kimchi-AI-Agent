// Sentry 서버 설정 — API Route / SSR 에러 추적
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
  // PII 필터 — 요청 헤더/IP 제거
  beforeSend(event) {
    if (event.user) {
      delete event.user.ip_address;
    }
    if (event.request?.headers) {
      const h = event.request.headers as Record<string, unknown>;
      delete h['authorization'];
      delete h['cookie'];
    }
    return event;
  },
});
