// __tests__/lib/tenant/tenant-store.test.ts
import { TenantStore } from '@/lib/tenant/tenant-store';

describe('TenantStore', () => {
  let store: TenantStore;

  beforeEach(() => {
    store = new TenantStore(); // 매 테스트마다 새 인스턴스
  });

  // ── 초기 상태 ──────────────────────────────────

  it('초기화 시 default tenant가 존재한다', () => {
    const def = store.get('default');
    expect(def).toBeDefined();
    expect(def?.id).toBe('default');
    expect(def?.isActive).toBe(true);
  });

  it('exists("default")는 true를 반환한다', () => {
    expect(store.exists('default')).toBe(true);
  });

  it('존재하지 않는 ID는 exists()가 false를 반환한다', () => {
    expect(store.exists('nonexistent')).toBe(false);
  });

  // ── create ─────────────────────────────────────

  it('테넌트를 생성하고 list()에 포함된다', () => {
    store.create({ id: 'factory-a', name: '제주공장', isActive: true });
    const list = store.list();
    expect(list.length).toBe(2); // default + factory-a
    expect(list.some((t) => t.id === 'factory-a')).toBe(true);
  });

  it('중복 ID 생성 시 오류를 던진다', () => {
    expect(() =>
      store.create({ id: 'default', name: '중복', isActive: true })
    ).toThrow();
  });

  it('생성된 테넌트는 createdAt이 자동 설정된다', () => {
    const t = store.create({ id: 'test-t', name: '테스트', isActive: true });
    expect(t.createdAt).toBeDefined();
    expect(new Date(t.createdAt).getTime()).toBeGreaterThan(0);
  });

  // ── update ─────────────────────────────────────

  it('테넌트 이름을 수정할 수 있다', () => {
    store.create({ id: 'factory-b', name: '부산공장', isActive: true });
    const updated = store.update('factory-b', { name: '부산공장(수정)' });
    expect(updated.name).toBe('부산공장(수정)');
  });

  it('존재하지 않는 테넌트 update 시 오류를 던진다', () => {
    expect(() => store.update('ghost', { name: '유령' })).toThrow();
  });

  it('systemPrompt를 업데이트할 수 있다', () => {
    store.create({ id: 'sp-test', name: '공장', isActive: true });
    const updated = store.update('sp-test', { systemPrompt: '전문 프롬프트' });
    expect(updated.systemPrompt).toBe('전문 프롬프트');
  });

  // ── delete ─────────────────────────────────────

  it('테넌트를 삭제하면 exists()가 false가 된다', () => {
    store.create({ id: 'del-me', name: '삭제 대상', isActive: true });
    store.delete('del-me');
    expect(store.exists('del-me')).toBe(false);
  });

  it("'default' 테넌트 삭제 시 오류를 던진다", () => {
    expect(() => store.delete('default')).toThrow();
  });

  it('존재하지 않는 테넌트 삭제 시 오류를 던진다', () => {
    expect(() => store.delete('no-such-tenant')).toThrow();
  });
});
