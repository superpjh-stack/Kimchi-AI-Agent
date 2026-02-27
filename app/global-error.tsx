'use client';
// React 렌더링 에러 → Sentry 캡처
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', gap: '1rem' }}>
        <h2>오류가 발생했습니다</h2>
        <button
          onClick={reset}
          style={{ padding: '0.5rem 1.5rem', cursor: 'pointer', borderRadius: '6px', border: '1px solid #ccc' }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
