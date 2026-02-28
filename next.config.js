// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withSentryConfig } = require('@sentry/nextjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // AWS Lambda(Amplify Compute) 환경에서 네이티브 모듈 번들링 제외
    // pdf-parse, xlsx, pg: 바이너리/네이티브 의존성 포함
    // pino/thread-stream: Worker Thread 경로 문제 방지
    serverComponentsExternalPackages: ['pdf-parse', 'xlsx', 'pg', 'pino', 'thread-stream'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none';",
          },
          {
            key: 'Permissions-Policy',
            // microphone=(self) — 같은 출처(앱 자체)의 마이크 사용 허용 (Web Speech API 필요)
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(withNextIntl(nextConfig), {
  // 소스맵 업로드 (프로덕션 배포 시 SENTRY_AUTH_TOKEN 필요)
  silent: true,
  hideSourceMaps: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
