// i18n/navigation.ts — next-intl 전용 navigation 유틸리티
// useRouter, usePathname, Link를 이 파일에서 import해야 로케일 전환이 정상 동작

import { createNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from './config';

export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});
