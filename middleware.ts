// middleware.ts — next-intl 로케일 감지 + 리다이렉트
// API 라우트, 정적 파일, Next.js 내부 경로는 제외

import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  // 기본 로케일(ko)은 URL에 접두사를 표시하지 않음
  // / → ko, /en → en
  localePrefix: 'as-needed',
});

export const config = {
  // API 라우트, Next.js 내부(_next), 정적 파일(확장자 포함) 제외
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
