// __tests__/lib/tenant/tenant-middleware.test.ts
import { extractTenantId, isMultiTenantEnabled } from '@/lib/tenant/tenant-middleware';

// 각 테스트마다 모듈을 새로 로드하기 위해 jest.resetModules 사용
beforeEach(() => {
  delete process.env.TENANT_MODE;
  delete process.env.DEFAULT_TENANT_ID;
});

function makeRequest(headers: Record<string, string> = {}): Request {
  const h = new Headers();
  Object.entries(headers).forEach(([k, v]) => h.set(k, v));
  return new Request('http://localhost/api/test', { headers: h });
}

describe('isMultiTenantEnabled', () => {
  it('TENANT_MODE 미설정 시 false를 반환한다', () => {
    expect(isMultiTenantEnabled()).toBe(false);
  });

  it('TENANT_MODE=single 시 false를 반환한다', () => {
    process.env.TENANT_MODE = 'single';
    expect(isMultiTenantEnabled()).toBe(false);
  });

  it('TENANT_MODE=multi 시 true를 반환한다', () => {
    process.env.TENANT_MODE = 'multi';
    expect(isMultiTenantEnabled()).toBe(true);
    delete process.env.TENANT_MODE;
  });
});

describe('extractTenantId', () => {
  it('x-tenant-id 헤더가 없으면 "default"를 반환한다', () => {
    const result = extractTenantId(makeRequest());
    expect(result).toBe('default');
  });

  it('x-tenant-id에 존재하지 않는 테넌트 ID를 지정하면 "default"를 반환한다', () => {
    const result = extractTenantId(makeRequest({ 'x-tenant-id': 'unknown-factory' }));
    expect(result).toBe('default');
  });

  it('x-tenant-id에 "default"를 지정하면 "default"를 반환한다', () => {
    const result = extractTenantId(makeRequest({ 'x-tenant-id': 'default' }));
    expect(result).toBe('default');
  });

  it('DEFAULT_TENANT_ID 환경변수가 없으면 "default"를 반환한다', () => {
    const result = extractTenantId(makeRequest());
    expect(result).toBe('default');
  });
});
