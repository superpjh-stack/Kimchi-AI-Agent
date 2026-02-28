// middleware.ts — next-intl 로케일 감지 + CSP nonce 주입
// API 라우트, 정적 파일, Next.js 내부 경로는 제외

import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

/**
 * S1-5: CSP nonce 생성 + Content-Security-Policy 헤더 주입
 * nonce는 요청마다 새로 생성하여 인라인 스크립트 허용 범위를 최소화한다.
 */
function generateNonce(): string {
  // 16바이트 랜덤 → base64
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

function buildCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';

  const directives: Record<string, string> = {
    'default-src':     "'self'",
    'script-src':      `'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    'style-src':       "'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src':        "'self' https://fonts.gstatic.com",
    'img-src':         "'self' data: blob:",
    'connect-src':     "'self'",
    'frame-ancestors': "'none'",
    'base-uri':        "'self'",
    'form-action':     "'self'",
    'object-src':      "'none'",
    'upgrade-insecure-requests': '',
  };

  return Object.entries(directives)
    .map(([k, v]) => (v ? `${k} ${v}` : k))
    .join('; ');
}

export default function middleware(req: NextRequest) {
  const nonce = generateNonce();
  const csp   = buildCSP(nonce);

  // 1. i18n 처리
  const intlResponse = intlMiddleware(req);
  const response     = intlResponse ?? NextResponse.next();

  // 2. CSP + 보안 헤더 주입
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // nonce를 요청 헤더로 전달 → layout.tsx에서 읽어 <script nonce> 주입
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  // API 라우트, Next.js 내부(_next), 정적 파일(확장자 포함) 제외
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
