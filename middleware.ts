// middleware.ts — next-intl 로케일 감지 + 보안 헤더 주입
// API 라우트, 정적 파일, Next.js 내부 경로는 제외
// NOTE: CSP는 next.config.js headers()에서 관리 (nonce 기반 CSP는
//       Next.js 자체 인라인 스크립트와 충돌하여 hydration 오류 유발)

import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export default function middleware(req: NextRequest) {
  // 1. i18n 처리
  const intlResponse = intlMiddleware(req);
  const response     = intlResponse ?? NextResponse.next();

  // 2. 보안 헤더 주입 (CSP는 next.config.js에서 관리)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  // API 라우트, Next.js 내부(_next), 정적 파일(확장자 포함) 제외
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
