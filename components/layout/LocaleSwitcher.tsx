'use client';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { locales, defaultLocale, type Locale } from '@/i18n/config';
import clsx from 'clsx';

const LOCALE_LABELS: Record<Locale, string> = { ko: '한국어', en: 'English' };

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale) => {
    // 현재 경로에서 로케일 접두사 제거
    let basePath = pathname;
    for (const loc of locales) {
      if (loc !== defaultLocale && basePath.startsWith(`/${loc}`)) {
        basePath = basePath.slice(`/${loc}`.length) || '/';
        break;
      }
    }
    // 기본 로케일(ko)은 접두사 없음, 그 외는 /{locale} 접두사 사용
    const newPath =
      newLocale === defaultLocale
        ? basePath
        : `/${newLocale}${basePath === '/' ? '' : basePath}`;
    window.location.href = newPath;
  };

  return (
    <div
      className="flex items-center border border-gray-200 rounded-full overflow-hidden text-xs"
      role="radiogroup"
      aria-label="언어 선택"
    >
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          role="radio"
          aria-checked={locale === loc}
          onClick={() => switchLocale(loc)}
          className={clsx(
            'px-3 py-1 transition-colors',
            locale === loc
              ? 'bg-red-600 text-white'
              : 'bg-white text-gray-500 hover:bg-gray-100'
          )}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
