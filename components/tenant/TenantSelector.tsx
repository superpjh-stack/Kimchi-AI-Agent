'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface TenantInfo {
  id: string;
  name: string;
  isActive: boolean;
}

interface TenantSelectorProps {
  className?: string;
}

/**
 * FR-45: 관리자용 Tenant 선택 드롭다운.
 * /api/admin/tenants에서 목록을 가져오고, 선택 시 x-tenant-id를 localStorage에 저장.
 * 이후 요청에서 useTenant() 훅이 헤더에 자동 주입.
 */
export default function TenantSelector({ className }: TenantSelectorProps) {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [selected, setSelected] = useState<string>('default');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // localStorage에서 이전 선택 복원
  useEffect(() => {
    const saved = localStorage.getItem('x-tenant-id');
    if (saved) setSelected(saved);
  }, []);

  // 테넌트 목록 fetch
  useEffect(() => {
    async function fetchTenants() {
      try {
        const res = await fetch('/api/admin/tenants', {
          headers: { 'x-tenant-id': 'default' },
        });
        if (res.ok) {
          const data = await res.json();
          const list: TenantInfo[] = (data.tenants ?? []).filter(
            (t: TenantInfo) => t.isActive
          );
          setTenants(list);
        }
      } catch {
        // 인증 필요 등 실패 시 기본값 유지
        setTenants([{ id: 'default', name: '기본 공장', isActive: true }]);
      } finally {
        setLoading(false);
      }
    }
    fetchTenants();
  }, []);

  function handleSelect(tenantId: string) {
    setSelected(tenantId);
    localStorage.setItem('x-tenant-id', tenantId);
    setOpen(false);
    // 브라우저 전체에 tenant 변경 이벤트 발생
    window.dispatchEvent(new CustomEvent('tenant-changed', { detail: { tenantId } }));
  }

  const selectedTenant = tenants.find((t) => t.id === selected);
  const displayName = selectedTenant?.name ?? '기본 공장';

  if (loading || tenants.length <= 1) {
    // 단일 테넌트면 선택기 숨김
    return null;
  }

  return (
    <div ref={dropdownRef} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border',
          open
            ? 'bg-kimchi-green/10 text-kimchi-green border-kimchi-green/30'
            : 'bg-white text-brand-text-secondary border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`공장 선택: ${displayName}`}
      >
        <Building2 size={14} />
        <span className="max-w-[100px] truncate">{displayName}</span>
        <ChevronDown
          size={12}
          className={clsx('transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="공장 목록"
          className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
        >
          {tenants.map((tenant) => (
            <li key={tenant.id} role="option" aria-selected={selected === tenant.id}>
              <button
                type="button"
                onClick={() => handleSelect(tenant.id)}
                className={clsx(
                  'w-full text-left px-3 py-2 text-xs transition-colors',
                  selected === tenant.id
                    ? 'bg-kimchi-red/10 text-kimchi-red font-medium'
                    : 'text-brand-text-secondary hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-2">
                  <Building2 size={12} />
                  <span className="truncate">{tenant.name}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
