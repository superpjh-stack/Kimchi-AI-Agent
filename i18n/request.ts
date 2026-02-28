// i18n/request.ts — next-intl v4 서버 측 설정 (getRequestConfig)
// https://next-intl.dev/docs/usage/configuration#i18n-request

import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale은 middleware가 감지한 [locale] 세그먼트 값 (Promise)
  const requested = await requestLocale;

  // 유효하지 않은 로케일이면 기본값 사용
  const locale: Locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
