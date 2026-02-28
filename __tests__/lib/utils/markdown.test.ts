// __tests__/lib/utils/markdown.test.ts — 마크다운 유틸리티 테스트

import { stripMarkdown, truncate, generateTitle } from '@/lib/utils/markdown';

describe('stripMarkdown', () => {
  it('헤딩 기호(#)를 제거한다', () => {
    expect(stripMarkdown('# 제목')).toBe('제목');
    expect(stripMarkdown('## 두 번째 제목')).toBe('두 번째 제목');
  });

  it('볼드(**) 구문을 제거하고 텍스트만 남긴다', () => {
    expect(stripMarkdown('**굵은 글씨**')).toBe('굵은 글씨');
  });

  it('이탤릭(*) 구문을 제거한다', () => {
    expect(stripMarkdown('*이탤릭*')).toBe('이탤릭');
  });

  it('인라인 코드(``) 구문을 제거한다', () => {
    expect(stripMarkdown('`코드`')).toBe('코드');
  });

  it('코드 블록(```) 백틱을 제거한다', () => {
    const text = '설명\n```js\nconst x = 1;\n```\n끝';
    const result = stripMarkdown(text);
    // 백틱이 제거되어야 함
    expect(result).not.toContain('```');
  });

  it('마크다운 링크에서 표시 텍스트만 남긴다', () => {
    expect(stripMarkdown('[클릭하세요](https://example.com)')).toBe('클릭하세요');
  });

  it('빈 문자열은 빈 문자열을 반환한다', () => {
    expect(stripMarkdown('')).toBe('');
  });

  it('마크다운 없는 평문은 그대로 반환한다', () => {
    expect(stripMarkdown('평범한 텍스트')).toBe('평범한 텍스트');
  });
});

describe('truncate', () => {
  it('maxLength 이하는 그대로 반환한다', () => {
    expect(truncate('안녕', 10)).toBe('안녕');
  });

  it('maxLength 초과 시 말줄임표로 자른다', () => {
    const result = truncate('12345678901', 10);
    expect(result.length).toBe(10);
    expect(result.endsWith('…')).toBe(true);
  });

  it('정확히 maxLength와 같은 길이는 그대로 반환한다', () => {
    expect(truncate('1234567890', 10)).toBe('1234567890');
  });
});

describe('generateTitle', () => {
  it('첫 메시지에서 제목을 생성한다', () => {
    const title = generateTitle('## 김치 발효 온도는 얼마가 적당한가요?');
    expect(title).not.toContain('#');
    expect(title.length).toBeLessThanOrEqual(50);
  });

  it('50자 초과 시 잘린다', () => {
    const longMessage = '아'.repeat(100);
    const title = generateTitle(longMessage);
    expect(title.length).toBeLessThanOrEqual(50);
  });

  it('마크다운이 포함된 메시지에서 순수 텍스트 제목 생성', () => {
    const title = generateTitle('**중요**: `온도` 설정 방법을 알려주세요.');
    expect(title).not.toContain('**');
    expect(title).not.toContain('`');
  });
});
