'use client';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';
import clsx from 'clsx';

const LOCALE_LABELS: Record<Locale, string> = { ko: '한국어', en: 'English' };

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale } as any);
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
