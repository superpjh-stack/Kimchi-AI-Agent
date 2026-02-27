import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '김치 Agent — 김치공장 AI 어시스턴트',
  description: '김치공장 전용 AI 어시스턴트. 발효 공정, 품질 관리, 생산 계획을 도와드립니다.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
