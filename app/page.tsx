// app/page.tsx — 미들웨어 스텁 (실제 내용 없음)
//
// next-intl 미들웨어(localePrefix: 'as-needed')가 런타임에 '/'를 '/ko'로
// 내부 rewrite하므로, 실제 서빙은 항상 app/[locale]/page.tsx가 담당합니다.
// 이 파일은 Next.js 라우팅 트리 완성을 위한 최소 스텁입니다.
//
// dynamic = 'force-dynamic': 빌드 시 정적 prerender 건너뜀
// (NextIntlClientProvider 없이 prerender 시 오류 방지)

export const dynamic = 'force-dynamic';

export default function RootPage() {
  return null;
}
