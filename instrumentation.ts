// Next.js App Router instrumentation — Sentry server/edge 초기화
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { init, getDefaultIntegrations } = await import('@sentry/nextjs');
    init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      enabled: process.env.NODE_ENV === 'production',
      integrations: getDefaultIntegrations({}),
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
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const { init } = await import('@sentry/nextjs');
    init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      enabled: process.env.NODE_ENV === 'production',
      // FR-11c: Edge 런타임 PII 필터 — authorization/cookie 헤더 및 IP 제거
      beforeSend(event) {
        if (event.user) {
          delete event.user.ip_address;
          delete event.user.email;
        }
        if (event.request?.headers) {
          const h = event.request.headers as Record<string, unknown>;
          delete h['authorization'];
          delete h['cookie'];
        }
        return event;
      },
    });
  }
}
