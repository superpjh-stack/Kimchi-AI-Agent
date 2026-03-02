// middleware.ts — next-intl 로케일 감지 + 보안 헤더 + 인증 가드
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

// 개발 전용 인증 우회 (NODE_ENV=production에서는 절대 활성화 불가)
const DEV_BYPASS =
  process.env.NODE_ENV !== 'production' &&
  process.env.DEV_AUTH_BYPASS === 'true';

/** 인증 체크를 건너뛰는 경로 패턴 (/login, /api/auth/*, /api/health) */
function isPublicPath(pathname: string): boolean {
  // /login 또는 /{locale}/login
  if (pathname === '/login' || /^\/[a-z]{2}\/login$/.test(pathname)) return true;
  // API 인증 경로 + health (matcher에서 api 제외하지만 안전장치)
  if (pathname.startsWith('/api/auth/') || pathname === '/api/health') return true;
  return false;
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. i18n 처리
  const intlResponse = intlMiddleware(req);
  const response     = intlResponse ?? NextResponse.next();

  // 2. 보안 헤더 주입 (CSP는 next.config.js에서 관리)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 3. 인증 가드 — 비로그인 시 /login 으로 리다이렉트
  if (!DEV_BYPASS && !isPublicPath(pathname)) {
    const token = req.cookies.get('access_token')?.value;
    if (!token) {
      // 현재 로케일 감지 (URL에서 추출, 없으면 기본 로케일)
      const localeMatch = pathname.match(/^\/([a-z]{2})\//);
      const locale = localeMatch?.[1] ?? defaultLocale;
      const loginUrl = new URL(
        locale === defaultLocale ? '/login' : `/${locale}/login`,
        req.url
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  // API 라우트, Next.js 내부(_next), 정적 파일(확장자 포함) 제외
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
