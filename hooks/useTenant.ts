// hooks/useTenant.ts — 클라이언트에서 현재 tenant ID 관리
'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 현재 선택된 tenant ID를 반환하는 훅.
 * TenantSelector에서 tenant-changed 이벤트를 발생시키면 자동 갱신.
 */
export function useTenant() {
  const [tenantId, setTenantId] = useState<string>('default');

  useEffect(() => {
    const saved = localStorage.getItem('x-tenant-id');
    if (saved) setTenantId(saved);

    function handleChange(e: Event) {
      const detail = (e as CustomEvent<{ tenantId: string }>).detail;
      setTenantId(detail.tenantId);
    }

    window.addEventListener('tenant-changed', handleChange);
    return () => window.removeEventListener('tenant-changed', handleChange);
  }, []);

  /** x-tenant-id 헤더를 주입한 headers 객체를 반환 */
  const getTenantHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => ({
      ...extra,
      'x-tenant-id': tenantId,
    }),
    [tenantId]
  );

  return { tenantId, getTenantHeaders };
}
