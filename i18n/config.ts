// i18n/config.ts — 로케일 목록 및 기본 로케일 설정

export const locales = ['ko', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ko';
