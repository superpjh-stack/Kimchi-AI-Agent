// __tests__/lib/ai/system-prompt-tenant.test.ts — FR-44 tenant별 시스템 프롬프트 테스트
import { buildSystemPrompt, KIMCHI_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';

describe('buildSystemPrompt with tenantSystemPrompt (FR-44)', () => {
  it('tenantSystemPrompt 미제공 시 기본 프롬프트만 반환한다', () => {
    const result = buildSystemPrompt('RAG context here');
    expect(result).toContain('김치 Agent');
    expect(result).toContain('RAG context here');
    expect(result).not.toContain('공장별 추가 지침');
  });

  it('tenantSystemPrompt 제공 시 프롬프트 앞에 추가된다', () => {
    const tenantPrompt = '이 공장은 제주 특산 귤김치를 전문으로 합니다.';
    const result = buildSystemPrompt('RAG context here', undefined, undefined, tenantPrompt);
    expect(result).toContain('공장별 추가 지침');
    expect(result).toContain('제주 특산 귤김치');
    // tenant 프롬프트가 기본 프롬프트보다 앞에 위치
    const tenantIdx = result.indexOf('공장별 추가 지침');
    const baseIdx = result.indexOf('김치 Agent');
    expect(tenantIdx).toBeLessThan(baseIdx);
  });

  it('빈 tenantSystemPrompt는 무시된다', () => {
    const result = buildSystemPrompt('RAG context', undefined, undefined, '');
    expect(result).not.toContain('공장별 추가 지침');
  });
});
