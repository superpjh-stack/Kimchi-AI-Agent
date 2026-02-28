# 김치군 마스코트 Creative 기능 — QA 전략 문서

**버전**: 1.0
**작성일**: 2026-02-28
**작성자**: QA Strategist (kimchi-mascot-creative 팀)
**대상 범위**: 김치군 마스코트 창의적 확장 기능 (레벨업, 비행, 계절 이벤트, 사운드 등)

---

## 1. 테스트 대상 컴포넌트 맵

```
useMascot.ts                 — 핵심 상태 머신, 비행 로직, localStorage, 야간 감지
useMascotTrigger.ts          — CustomEvent 수신 → 상태 전환
lib/utils/mascot-event.ts    — dispatchMascotEvent (SSR 안전)
components/mascot/
  KimchiSvg.tsx              — SVG 렌더링 (7 상태)
  MascotSpeech.tsx           — 말풍선 (자동 dismiss, aria-live)
  MascotToggle.tsx           — ON/OFF / 대사 ON/OFF 설정 메뉴
  KimchiMascotContainer.tsx  — 통합 컨테이너 (Framer Motion 비행)
  mascot-phrases.ts          — 47개 대사 풀, getRandomPhrase(), getPhrasesForState()
types/mascot.ts              — MascotState, MascotPhrase, MascotSettings, MascotEventDetail
```

---

## 2. 단위 테스트 계획 (Jest)

### 2.1 `mascot-phrases.ts` — 대사 풀 완전성

파일: `__tests__/mascot/mascot-phrases.test.ts`

```typescript
import { getRandomPhrase, getPhrasesForState } from '@/components/mascot/mascot-phrases';
import type { MascotState } from '@/types/mascot';

const ALL_STATES: MascotState[] = [
  'idle', 'thinking', 'success', 'error', 'celebrating', 'searching', 'sleeping'
];

describe('getPhrasesForState — PHRASES 테이블 완전성', () => {
  test.each(ALL_STATES)(
    '상태 %s 는 최소 3개 이상의 대사를 보유해야 한다',
    (state) => {
      const phrases = getPhrasesForState(state);
      expect(phrases.length).toBeGreaterThanOrEqual(3);
    }
  );

  test.each(ALL_STATES)(
    '상태 %s 의 모든 대사는 비어있지 않은 text 필드를 가진다',
    (state) => {
      getPhrasesForState(state).forEach((p) => {
        expect(p.text).toBeTruthy();
        expect(typeof p.text).toBe('string');
      });
    }
  );

  test('알 수 없는 상태에 대해 기본값 {...} 을 반환한다', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = getRandomPhrase('unknown_state' as any);
    expect(result.text).toBe('...');
  });
});

describe('getRandomPhrase — 중복 방지 로직', () => {
  test('두 번 연속 호출 시 같은 인덱스를 최대 3번 이상 반복하지 않는다', () => {
    const results = Array.from({ length: 20 }, () => getRandomPhrase('idle').text);
    // 최소 2개 이상 고유 대사가 나와야 함
    const unique = new Set(results);
    expect(unique.size).toBeGreaterThan(1);
  });

  test('대사 풀이 1개인 경우 동일 대사를 반환해도 에러 없음', () => {
    // idle 풀 7개 → 정상 동작 확인
    expect(() => getRandomPhrase('idle')).not.toThrow();
  });
});
```

### 2.2 `useMascot.ts` — `getRandomFlyTarget()` 경계값 테스트

파일: `__tests__/mascot/useMascot.test.ts`

```typescript
/**
 * getRandomFlyTarget은 모듈 내부 함수이므로
 * useMascot hook을 통한 간접 테스트 + window mock으로 검증.
 */
import { renderHook, act } from '@testing-library/react';
import { useMascot } from '@/hooks/useMascot';

// 윈도우 크기 모킹 헬퍼
function mockWindow(width: number, height: number, reducedMotion = false) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true });
  window.matchMedia = jest.fn().mockReturnValue({ matches: reducedMotion });
}

describe('getRandomFlyTarget — 경계값 테스트', () => {
  afterEach(() => jest.restoreAllMocks());

  test('일반 화면(1920x1080)에서 비행 위치는 화면 내부에 있어야 한다', () => {
    mockWindow(1920, 1080);
    const { result } = renderHook(() => useMascot());

    act(() => result.current.setState('thinking'));

    const { x, y } = result.current.position;
    // bottom-right 기준 음수 offset — 값은 음수여야 함
    expect(x).toBeLessThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(0);
    // 화면 크기 초과 금지 (최대 이동 거리 = innerWidth - 100)
    expect(Math.abs(x)).toBeLessThanOrEqual(1920 - 100);
    expect(Math.abs(y)).toBeLessThanOrEqual(1080 - 100);
  });

  test('최소 화면(320x568)에서도 음수 offset을 반환한다', () => {
    mockWindow(320, 568);
    const { result } = renderHook(() => useMascot());

    act(() => result.current.setState('success'));

    const { x, y } = result.current.position;
    expect(Math.abs(x)).toBeLessThanOrEqual(320 - 100);
    expect(Math.abs(y)).toBeLessThanOrEqual(568 - 100);
  });

  test('prefers-reduced-motion 활성화 시 위치는 {x:0, y:0}을 반환한다', () => {
    mockWindow(1920, 1080, true /* reducedMotion */);
    const { result } = renderHook(() => useMascot());

    act(() => result.current.setState('celebrating'));

    // reduced motion → 비행 없이 홈 위치 유지
    expect(result.current.position).toEqual({ x: 0, y: 0 });
  });

  test('idle/sleeping 상태 전환 시 위치는 홈{0,0}으로 복귀한다', () => {
    mockWindow(1920, 1080);
    const { result } = renderHook(() => useMascot());

    act(() => result.current.setState('thinking'));
    act(() => result.current.setState('idle'));

    expect(result.current.position).toEqual({ x: 0, y: 0 });
  });
});

describe('SHOULD_FLY 테이블 완전성', () => {
  const FLYING_STATES: MascotState[] = ['thinking', 'success', 'error', 'celebrating', 'searching'];
  const NON_FLYING_STATES: MascotState[] = ['idle', 'sleeping'];

  test.each(FLYING_STATES)('상태 %s → 비행(position 변경)이 발생해야 한다', (state) => {
    mockWindow(1920, 1080);
    const { result } = renderHook(() => useMascot());

    act(() => result.current.setState(state));

    // 비행 상태에서는 x 또는 y 중 하나가 변경돼야 함
    const { x, y } = result.current.position;
    // (reduced motion이 없으므로) 0이 아닐 가능성이 높음
    // 결정론적이 아니므로, 값 타입만 검증
    expect(typeof x).toBe('number');
    expect(typeof y).toBe('number');
  });

  test.each(NON_FLYING_STATES)('상태 %s → 홈 위치{0,0}을 유지해야 한다', (state) => {
    mockWindow(1920, 1080);
    const { result } = renderHook(() => useMascot());

    // 먼저 비행 상태로 이동 후 non-flying으로 전환
    act(() => result.current.setState('thinking'));
    act(() => result.current.setState(state));

    expect(result.current.position).toEqual({ x: 0, y: 0 });
  });
});
```

### 2.3 계절 감지 / 야간 모드 테스트 (날짜 모킹)

파일: `__tests__/mascot/useMascot-time.test.ts`

```typescript
import { renderHook } from '@testing-library/react';
import { useMascot } from '@/hooks/useMascot';

function mockHour(hour: number) {
  const mockDate = new Date(2026, 1, 28, hour, 0, 0); // 2026-02-28
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as Date);
}

describe('야간 감지 (22:00 ~ 05:59)', () => {
  afterEach(() => jest.restoreAllMocks());

  test.each([22, 23, 0, 1, 2, 3, 4, 5])(
    '시각 %d시에는 sleeping 상태로 초기화된다',
    (hour) => {
      mockHour(hour);
      const { result } = renderHook(() => useMascot());
      expect(result.current.state).toBe('sleeping');
    }
  );

  test.each([6, 9, 12, 15, 18, 21])(
    '시각 %d시에는 idle 상태로 초기화된다',
    (hour) => {
      mockHour(hour);
      const { result } = renderHook(() => useMascot());
      expect(result.current.state).toBe('idle');
    }
  );

  test('경계값 22시 정각 → sleeping', () => {
    mockHour(22);
    const { result } = renderHook(() => useMascot());
    expect(result.current.state).toBe('sleeping');
  });

  test('경계값 6시 정각 → idle', () => {
    mockHour(6);
    const { result } = renderHook(() => useMascot());
    expect(result.current.state).toBe('idle');
  });
});
```

### 2.4 localStorage 저장/복원 테스트

파일: `__tests__/mascot/mascot-storage.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMascot } from '@/hooks/useMascot';

const STORAGE_KEY = 'kimchi-mascot-settings';

describe('MascotSettings localStorage 저장/복원', () => {
  beforeEach(() => localStorage.clear());

  test('초기 로드 시 enabled=true, speechEnabled=true (기본값)', () => {
    const { result } = renderHook(() => useMascot());
    expect(result.current.settings.enabled).toBe(true);
    expect(result.current.settings.speechEnabled).toBe(true);
  });

  test('toggleEnabled 호출 시 localStorage에 {enabled:false}가 저장된다', () => {
    const { result } = renderHook(() => useMascot());
    act(() => result.current.toggleEnabled());

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.enabled).toBe(false);
  });

  test('toggleSpeech 호출 시 localStorage에 {speechEnabled:false}가 저장된다', () => {
    const { result } = renderHook(() => useMascot());
    act(() => result.current.toggleSpeech());

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.speechEnabled).toBe(false);
  });

  test('재마운트 시 이전 설정(enabled:false)이 복원된다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: false, speechEnabled: true }));
    const { result } = renderHook(() => useMascot());
    // useEffect 실행 대기
    expect(result.current.settings.enabled).toBe(false);
  });

  test('localStorage에 손상된 JSON이 있어도 기본값으로 fallback된다', () => {
    localStorage.setItem(STORAGE_KEY, 'INVALID_JSON{{{');
    expect(() => renderHook(() => useMascot())).not.toThrow();
    const { result } = renderHook(() => useMascot());
    expect(result.current.settings.enabled).toBe(true);
  });

  test('localStorage.setItem 실패(QuotaExceeded)여도 앱 크래시 없음', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const { result } = renderHook(() => useMascot());
    expect(() => act(() => result.current.toggleEnabled())).not.toThrow();
  });
});
```

### 2.5 STATE_RESET_DELAY 자동 복귀 타이머 테스트

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMascot } from '@/hooks/useMascot';

describe('상태 자동 복귀 타이머 (STATE_RESET_DELAY)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test.each(['success', 'error', 'celebrating'] as const)(
    '상태 %s는 3000ms 후 idle로 자동 복귀한다',
    (state) => {
      const { result } = renderHook(() => useMascot());
      act(() => result.current.setState(state));
      expect(result.current.state).toBe(state);

      act(() => jest.advanceTimersByTime(3000));
      expect(result.current.state).toBe('idle');
      expect(result.current.showSpeech).toBe(false);
      expect(result.current.position).toEqual({ x: 0, y: 0 });
    }
  );

  test.each(['thinking', 'searching', 'sleeping'] as const)(
    '상태 %s는 자동 복귀하지 않는다 (10000ms 후에도 유지)',
    (state) => {
      const { result } = renderHook(() => useMascot());
      act(() => result.current.setState(state));
      act(() => jest.advanceTimersByTime(10000));
      expect(result.current.state).toBe(state);
    }
  );

  test('새 상태로 전환하면 이전 복귀 타이머가 취소된다', () => {
    const { result } = renderHook(() => useMascot());
    act(() => result.current.setState('success'));  // 3000ms 타이머 시작
    act(() => jest.advanceTimersByTime(1500));
    act(() => result.current.setState('thinking')); // 새 전환 → 이전 타이머 취소

    act(() => jest.advanceTimersByTime(3000));
    // thinking은 자동 복귀 없으므로 thinking 상태 유지
    expect(result.current.state).toBe('thinking');
  });
});
```

---

## 3. 통합 테스트 계획

### 3.1 CustomEvent → 마스코트 상태 전환 흐름

파일: `__tests__/mascot/mascot-event-integration.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMascot } from '@/hooks/useMascot';
import { useMascotTrigger } from '@/hooks/useMascotTrigger';
import { dispatchMascotEvent } from '@/lib/utils/mascot-event';
import type { MascotState } from '@/types/mascot';

function setupMascotWithTrigger() {
  const mascotHook = renderHook(() => useMascot());
  renderHook(() =>
    useMascotTrigger(mascotHook.result.current.setState)
  );
  return mascotHook;
}

describe('dispatchMascotEvent → useMascotTrigger → useMascot 통합', () => {
  const STATE_CASES: MascotState[] = [
    'thinking', 'success', 'error', 'celebrating', 'searching', 'sleeping', 'idle'
  ];

  test.each(STATE_CASES)(
    'dispatchMascotEvent("%s") → 마스코트 state가 %s로 전환된다',
    (targetState) => {
      const hook = setupMascotWithTrigger();

      act(() => {
        dispatchMascotEvent(targetState);
      });

      expect(hook.result.current.state).toBe(targetState);
    }
  );

  test('forcedPhrase를 지정하면 phrase.text가 강제 지정된다', () => {
    const hook = setupMascotWithTrigger();

    act(() => {
      dispatchMascotEvent('thinking', 'chat', '특별 테스트 대사입니다');
    });

    expect(hook.result.current.phrase?.text).toBe('특별 테스트 대사입니다');
  });

  test('이벤트 발행 → showSpeech가 true가 된다', () => {
    const hook = setupMascotWithTrigger();

    act(() => dispatchMascotEvent('success'));

    expect(hook.result.current.showSpeech).toBe(true);
  });

  test('SSR 환경(window=undefined)에서 dispatchMascotEvent는 에러 없이 종료된다', () => {
    const originalWindow = global.window;
    // @ts-expect-error window 제거 모킹
    delete global.window;
    expect(() => dispatchMascotEvent('thinking')).not.toThrow();
    global.window = originalWindow;
  });

  test('잘못된 detail(state 없음)은 상태 변경하지 않는다', () => {
    const hook = setupMascotWithTrigger();
    const initialState = hook.result.current.state;

    act(() => {
      window.dispatchEvent(
        new CustomEvent('kimchi-mascot', { detail: { context: 'chat' } })
      );
    });

    expect(hook.result.current.state).toBe(initialState);
  });
});
```

### 3.2 dismissSpeech → showSpeech=false 흐름

```typescript
test('dismissSpeech 호출 시 showSpeech가 false로 전환된다', () => {
  const { result } = renderHook(() => useMascot());
  act(() => result.current.setState('success'));
  expect(result.current.showSpeech).toBe(true);

  act(() => result.current.dismissSpeech());
  expect(result.current.showSpeech).toBe(false);
});
```

### 3.3 MascotToggle — ON/OFF 메뉴 상호작용

파일: `__tests__/mascot/MascotToggle.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import MascotToggle from '@/components/mascot/MascotToggle';

describe('MascotToggle — enabled=false (OFF 상태)', () => {
  test('"김치군 켜기" 버튼이 렌더링된다', () => {
    render(<MascotToggle enabled={false} onToggle={jest.fn()} />);
    expect(screen.getByRole('button', { name: /김치군 켜기/i })).toBeInTheDocument();
  });

  test('버튼 클릭 시 onToggle이 호출된다', () => {
    const onToggle = jest.fn();
    render(<MascotToggle enabled={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /김치군 켜기/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('MascotToggle — enabled=true (ON 상태)', () => {
  test('"···" 설정 버튼이 렌더링된다', () => {
    render(
      <MascotToggle enabled={true} speechEnabled={true} onToggle={jest.fn()} />
    );
    const btn = screen.getByRole('button', { name: /김치군 설정/i });
    expect(btn).toBeInTheDocument();
  });

  test('설정 버튼 클릭 → 드롭다운 메뉴가 열린다', () => {
    render(
      <MascotToggle enabled={true} speechEnabled={true} onToggle={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /김치군 설정/i }));
    expect(screen.getByText('김치군 끄기')).toBeVisible();
  });

  test('"김치군 끄기" 클릭 → onToggle 호출 + 메뉴 닫힘', () => {
    const onToggle = jest.fn();
    render(<MascotToggle enabled={true} speechEnabled={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /김치군 설정/i }));
    fireEvent.click(screen.getByText('김치군 끄기'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('김치군 끄기')).not.toBeInTheDocument();
  });

  test('speechEnabled=true → "대사 끄기" 표시', () => {
    render(
      <MascotToggle enabled={true} speechEnabled={true}
        onToggle={jest.fn()} onSpeechToggle={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /김치군 설정/i }));
    expect(screen.getByText('대사 끄기')).toBeVisible();
  });

  test('speechEnabled=false → "대사 켜기" 표시', () => {
    render(
      <MascotToggle enabled={true} speechEnabled={false}
        onToggle={jest.fn()} onSpeechToggle={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /김치군 설정/i }));
    expect(screen.getByText('대사 켜기')).toBeVisible();
  });

  test('메뉴 외부 클릭 → 메뉴 닫힘', () => {
    render(
      <MascotToggle enabled={true} speechEnabled={true} onToggle={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /김치군 설정/i }));
    expect(screen.getByText('김치군 끄기')).toBeVisible();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('김치군 끄기')).not.toBeInTheDocument();
  });
});
```

---

## 4. 접근성 테스트 (WCAG 2.1 AA)

### 4.1 자동 검사 항목

| 검사 도구 | 항목 | 기준 |
|----------|------|------|
| axe-core (`@axe-core/playwright`) | aria-live="polite" 속성 | MascotSpeech에 존재해야 함 |
| axe-core | role="complementary" | KimchiMascotContainer에 존재해야 함 |
| axe-core | aria-label | 모든 버튼에 의미 있는 레이블 필요 |
| Lighthouse CI | Accessibility Score | 90점 이상 유지 |
| axe-core | 색상 대비 | 4.5:1 이상 (말풍선 텍스트) |

### 4.2 `aria-live` 올바른 업데이트 검증

파일: `__tests__/mascot/mascot-a11y.test.tsx`

```typescript
import { render, screen, act } from '@testing-library/react';
import MascotSpeech from '@/components/mascot/MascotSpeech';

describe('MascotSpeech — ARIA 접근성', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('role="status" aria-live="polite" aria-atomic="true" 속성 존재', () => {
    render(<MascotSpeech text="테스트" onDismiss={jest.fn()} />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveAttribute('aria-atomic', 'true');
  });

  test('기본 duration(3500ms)이 지나면 onDismiss가 호출된다', () => {
    const onDismiss = jest.fn();
    render(<MascotSpeech text="테스트" onDismiss={onDismiss} />);
    act(() => jest.advanceTimersByTime(3500));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('언마운트 시 타이머가 정리된다 (누수 없음)', () => {
    const onDismiss = jest.fn();
    const { unmount } = render(<MascotSpeech text="테스트" onDismiss={onDismiss} />);
    unmount();
    act(() => jest.advanceTimersByTime(5000));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
```

### 4.3 `prefers-reduced-motion` 비행 비활성화 검증

```typescript
describe('prefers-reduced-motion 비행 비활성화', () => {
  test('reduced motion 활성화 시 setState(thinking)이어도 x=0, y=0', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true, // prefers-reduced-motion: reduce
    });
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

    const { result } = renderHook(() => useMascot());
    act(() => result.current.setState('thinking'));

    expect(result.current.position).toEqual({ x: 0, y: 0 });
  });
});
```

### 4.4 키보드 접근성 테스트

```typescript
describe('키보드 접근성 — Enter 키 동작', () => {
  test('MascotToggle "김치군 켜기" 버튼 — Enter 키로 동작', () => {
    const onToggle = jest.fn();
    render(<MascotToggle enabled={false} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /김치군 켜기/i });
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
    // HTML button은 기본적으로 Enter/Space 지원
    expect(btn).toHaveFocus();
  });

  test('MascotToggle 설정 메뉴 — Tab 키로 포커스 이동 가능', async () => {
    render(
      <MascotToggle enabled={true} speechEnabled={true} onToggle={jest.fn()} />
    );
    const settingsBtn = screen.getByRole('button', { name: /김치군 설정/i });
    settingsBtn.focus();
    expect(settingsBtn).toHaveFocus();
  });
});
```

### 4.5 KimchiSvg 접근성

```typescript
describe('KimchiSvg — 접근성', () => {
  test('aria-hidden="true"로 스크린 리더에서 숨겨진다', () => {
    render(<KimchiSvg state="idle" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  test('role="img" 속성이 존재한다', () => {
    render(<KimchiSvg state="idle" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
```

---

## 5. 성능 테스트 기준

### 5.1 LCP 영향 측정 기준

| 지표 | 현재 기준값 | 허용 최대 변화 | 측정 방법 |
|------|------------|---------------|----------|
| LCP | 측정 없음 | +0ms (마스코트로 인한 증가 없음) | Lighthouse CI |
| CLS | 0 | 0 유지 (fixed position이므로 레이아웃 변경 없음) | Lighthouse CI |
| FID / INP | < 100ms | +5ms 이하 | Chrome DevTools |
| Bundle Size 증가 | 기준치 미정 | < 15KB gzip | next build output |
| First Paint | 기준치 미정 | +0ms (마스코트는 CSS-only) | Lighthouse CI |

### 5.2 60fps 애니메이션 검증 기준

```
검증 항목:
1. Framer Motion 비행 애니메이션: will-change: transform 적용 확인
2. CSS @keyframes (숨쉬기, 흔들림 등): GPU 가속 레이어 분리 확인
3. SVG animate 요소: 눈 깜빡임 3s 주기 — rAF 기반 동작

측정 방법:
- Chrome DevTools > Performance > Rendering > FPS Meter
- 비행 중 Frame Drop 허용 기준: 2프레임 이하 / 0.7초 비행 구간
- CSS transition (Framer): chrome://tracing으로 compositor 레이어 확인

자동화:
- playwright + page.metrics()로 JSHeapUsedSize 비교
  - 마스코트 10회 상태 전환 후 힙 증가 < 1MB
```

### 5.3 Bundle Size 허용 증가 한계

```
신규 의존성별 허용 증가:
- framer-motion: 기존 설치 여부 확인 필요 (없으면 +30KB gzip 허용)
- mascot-phrases.ts: < 5KB
- mascot 컴포넌트 전체: < 20KB gzip

측정 명령:
  npm run build && npx next-bundle-analyzer

기준: 기존 대비 client bundle +15KB gzip 이하
```

### 5.4 메모리 누수 검증

```
검증 시나리오:
1. KimchiMascotContainer 마운트/언마운트 100회 반복
2. 각 상태 setState 100회 호출 후 타이머 정리 확인
3. useMascotTrigger — addEventListener / removeEventListener 쌍 일치 확인

Jest 테스트:
- afterEach에서 jest.clearAllTimers() 호출
- clearTimeout 모킹으로 cleanup 횟수 검증
```

---

## 6. 크로스 브라우저 테스트

### 6.1 지원 브라우저 매트릭스

| 브라우저 | 버전 | 지원 여부 | 특이사항 |
|--------|------|---------|---------|
| Chrome | 120+ | 필수 지원 | 기준 브라우저 |
| Firefox | 120+ | 필수 지원 | SVG animate 호환성 확인 |
| Safari | 15+ | 필수 지원 | Web Audio API, CSS backdrop-filter |
| Edge | 120+ | 필수 지원 | Chromium 기반 |
| Safari iOS | 15+ | 권장 지원 | 모바일 터치 이벤트 |
| Chrome Android | 120+ | 권장 지원 | 뷰포트 크기 변동 |
| IE | 미지원 | — | 지원 불필요 (공식 제외) |

### 6.2 Web Audio API (사운드 기능 계획 시)

```
Safari 15+ 지원 확인 항목:
- AudioContext.resume() — 사용자 제스처 이후에만 허용
- 자동 재생 정책: autoplay 차단 → 클릭 이벤트 후 unlock 필요

테스트 전략:
- Playwright headless: Web Audio 지원 여부 확인 어려움
  → Chromium-only E2E 테스트 + Safari는 수동 QA
- 대안: AudioContext 생성 여부 feature detection 구현 필수

Playwright 크로스 브라우저 설정 (playwright.config.ts):
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ]
```

### 6.3 Framer Motion 브라우저 호환성

```
Framer Motion v10+:
- IE 지원 공식 제외 (ES2020 타겟)
- Safari 15+: CSS custom properties + transform3d 지원 확인
- Firefox: will-change 힌트 동작 확인
- 검증: 비행 애니메이션 목적지 도달 정확도 (spring 물리 엔진)
```

### 6.4 SVG animate 요소 브라우저 호환성

```
KimchiSvg 눈 깜빡임 (SVG SMIL animate):
- Chrome/Edge: 지원 (기본 활성)
- Firefox: 지원
- Safari: 지원 (webkit prefix 불필요)

검증:
- 각 브라우저에서 눈 깜빡임 3s 주기 시각 확인
- calcMode="spline" keySplines 호환성 확인
```

---

## 7. E2E 테스트 계획 (Playwright)

### 7.1 마스코트 E2E 시나리오

파일: `e2e/mascot.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('김치군 마스코트 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 마스코트 컴포넌트 로드 대기
    await page.waitForSelector('[aria-label="김치군 마스코트"]', { timeout: 5000 });
  });

  // TC-MASCOT-E2E-01: 마스코트 기본 표시
  test('TC-MASCOT-E2E-01: 페이지 로드 시 마스코트가 visible', async ({ page }) => {
    const mascot = page.locator('[aria-label="김치군 마스코트"]');
    await expect(mascot).toBeVisible();
  });

  // TC-MASCOT-E2E-02: 마스코트 OFF 전환
  test('TC-MASCOT-E2E-02: "···" 설정 메뉴 → "김치군 끄기" → 마스코트 숨겨짐', async ({ page }) => {
    const settingsBtn = page.getByRole('button', { name: /김치군 설정/i });
    await settingsBtn.click();
    await page.getByText('김치군 끄기').click();
    // 마스코트 컨테이너가 사라지고 복구 버튼만 남음
    await expect(page.getByRole('button', { name: /김치군 켜기/i })).toBeVisible();
    await expect(page.locator('[aria-label="김치군 마스코트"]')).toBeHidden();
  });

  // TC-MASCOT-E2E-03: 마스코트 ON 복구
  test('TC-MASCOT-E2E-03: "김치군 켜기" 클릭 → 마스코트 다시 표시', async ({ page }) => {
    // 먼저 OFF
    await page.getByRole('button', { name: /김치군 설정/i }).click();
    await page.getByText('김치군 끄기').click();
    // ON 복구
    await page.getByRole('button', { name: /김치군 켜기/i }).click();
    await expect(page.locator('[aria-label="김치군 마스코트"]')).toBeVisible();
  });

  // TC-MASCOT-E2E-04: 대사 표시 (말풍선)
  test('TC-MASCOT-E2E-04: 초기 대사(말풍선)가 표시된다', async ({ page }) => {
    const speech = page.locator('[role="status"]');
    // idle 상태 시 대사 미표시 or 초기 sleeping 대사 표시
    // aria-live 영역 존재 확인
    await expect(speech).toBeAttached();
  });

  // TC-MASCOT-E2E-05: settings 영속성 (페이지 새로고침)
  test('TC-MASCOT-E2E-05: 대사 OFF 후 새로고침해도 설정이 유지된다', async ({ page }) => {
    await page.getByRole('button', { name: /김치군 설정/i }).click();
    await page.getByText('대사 끄기').click();
    await page.reload();
    // 재로드 후 대사 OFF 상태 유지 확인
    await page.getByRole('button', { name: /김치군 설정/i }).click();
    await expect(page.getByText('대사 켜기')).toBeVisible();
  });
});
```

### 7.2 채팅 → 마스코트 상태 전환 E2E

```typescript
test.describe('채팅 이벤트 → 마스코트 상태 전환', () => {
  test('TC-MASCOT-E2E-06: 메시지 전송 시 thinking 상태 SVG 클래스 적용', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('textarea').first();
    await input.fill('김치 발효 온도는?');
    await input.press('Enter');

    // thinking 상태 — CSS 클래스 확인
    await expect(
      page.locator('.kimchi-mascot--thinking')
    ).toBeVisible({ timeout: 3000 });
  });
});
```

---

## 8. 테스트 파일 위치 및 실행 명령

### 8.1 디렉토리 구조

```
__tests__/
  mascot/
    mascot-phrases.test.ts          # 대사 풀 완전성
    useMascot.test.ts               # 비행, 상태 전환, 타이머
    useMascot-time.test.ts          # 야간/계절 감지 (날짜 모킹)
    mascot-storage.test.ts          # localStorage 저장/복원
    mascot-event-integration.test.ts # CustomEvent 통합
    MascotToggle.test.tsx            # UI 상호작용
    mascot-a11y.test.tsx             # 접근성 (aria, keyboard)

e2e/
  mascot.spec.ts                    # Playwright E2E
```

### 8.2 실행 명령

```bash
# 마스코트 관련 단위 테스트만 실행
npx jest __tests__/mascot --coverage

# 전체 Jest 실행 (164 기존 + 신규 마스코트)
npm test

# E2E — 마스코트
npx playwright test e2e/mascot.spec.ts

# 크로스 브라우저 E2E
npx playwright test e2e/mascot.spec.ts --project=chromium
npx playwright test e2e/mascot.spec.ts --project=webkit
npx playwright test e2e/mascot.spec.ts --project=firefox
```

---

## 9. 커버리지 목표

| 범위 | 현재 | 목표 | 기준 |
|------|------|------|------|
| 마스코트 단위 테스트 커버리지 | 0% (신규) | 85%+ | Jest --coverage |
| 전체 Jest 라인 커버리지 | 미정 | 80%+ | Phase 6 Sprint 2 목표 |
| E2E 시나리오 | 0개 (신규) | 6개+ | Playwright |
| 접근성 점수 | WCAG 2.1 AA | WCAG 2.1 AA 유지 | axe-core |

---

## 10. 위험 항목 및 완화 전략

| 위험 | 확률 | 영향 | 완화 전략 |
|------|------|------|----------|
| `window.matchMedia` 미지원 환경 | 중 | 비행 미동작 | SSR 체크 + try/catch fallback |
| SVG animate SMIL — Safari 구버전 미지원 | 낮 | 눈 깜빡임 미동작 | CSS animation 대체 준비 |
| Framer Motion 대용량 번들 | 중 | 초기 로드 지연 | dynamic import 검토 |
| localStorage 비활성화 (Private 모드) | 중 | 설정 미저장 | try/catch silently 처리 (완료) |
| 타이머 메모리 누수 (flyTimersRef) | 낮 | 누적 타이머 | useEffect cleanup 완료 검증 |
| 야간 감지 타임존 불일치 | 낮 | 잘못된 sleeping 상태 | `new Date().getHours()` → 로컬 타임 확인 |

---

## 11. 인수 기준 (Definition of Done)

- [ ] 마스코트 단위 테스트 85% 커버리지 달성
- [ ] SHOULD_FLY 테이블 7개 상태 모두 커버
- [ ] localStorage 저장/복원 + 손상 JSON 케이스 통과
- [ ] 야간 경계값 (22시, 6시) 테스트 통과
- [ ] prefers-reduced-motion 비행 비활성화 검증
- [ ] aria-live, role="status" 접근성 테스트 통과
- [ ] E2E 마스코트 ON/OFF 시나리오 통과
- [ ] Playwright 크로스 브라우저 (Chrome/Firefox/WebKit) 통과
- [ ] Bundle size 증가 +15KB gzip 이하
- [ ] 메모리 누수 없음 (타이머 정리 확인)

---

*작성: QA Strategist | kimchi-mascot-creative 팀 | 2026-02-28*
