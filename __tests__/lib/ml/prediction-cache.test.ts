// __tests__/lib/ml/prediction-cache.test.ts
// PredictionCache: TTL, evict, key helpers

import {
  PredictionCache,
  makeFermentationKey,
  makeQualityKey,
} from '@/lib/ml/prediction-cache';

// ──────────────────────────────────────────────
// PredictionCache - TTL 동작
// ──────────────────────────────────────────────

describe('PredictionCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('set 후 get → 값 반환', () => {
    const cache = new PredictionCache<string>(1000);
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('존재하지 않는 키 → undefined', () => {
    const cache = new PredictionCache<string>(1000);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('TTL 만료 후 get → undefined', () => {
    const cache = new PredictionCache<string>(1000); // 1초 TTL
    cache.set('key1', 'value1');
    jest.advanceTimersByTime(1001); // TTL 초과
    expect(cache.get('key1')).toBeUndefined();
  });

  it('TTL 이내 get → 값 반환', () => {
    const cache = new PredictionCache<string>(5000);
    cache.set('key1', 'alive');
    jest.advanceTimersByTime(4999);
    expect(cache.get('key1')).toBe('alive');
  });

  it('size: 항목 수 반환', () => {
    const cache = new PredictionCache<number>(1000);
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
  });

  it('evictExpired: 만료 항목 삭제', () => {
    const cache = new PredictionCache<number>(500);
    cache.set('old', 1);
    jest.advanceTimersByTime(600);
    cache.set('new', 2); // set 내부에서 evictExpired 호출됨
    // 'old'는 만료되어 삭제, 'new'만 존재
    expect(cache.get('old')).toBeUndefined();
    expect(cache.get('new')).toBe(2);
  });

  it('동일 키 덮어쓰기 → 새 값 반환', () => {
    const cache = new PredictionCache<string>(5000);
    cache.set('key', 'first');
    cache.set('key', 'second');
    expect(cache.get('key')).toBe('second');
  });

  it('generic 타입 — 객체 저장/반환', () => {
    type Prediction = { grade: string; confidence: number };
    const cache = new PredictionCache<Prediction>(5000);
    const val: Prediction = { grade: 'A', confidence: 0.95 };
    cache.set('pred1', val);
    expect(cache.get('pred1')).toEqual(val);
  });
});

// ──────────────────────────────────────────────
// makeFermentationKey
// ──────────────────────────────────────────────

describe('makeFermentationKey', () => {
  const base = {
    temperature: 20.123,
    humidity: 65.456,
    salinity: 2.234,
    ph: 4.256,
    fermentationHours: 36.7,
  };

  it('소수점 노이즈 흡수 — 같은 키 반환', () => {
    // temperature 20.14 / 20.11 → toFixed(1) = "20.1" 동일
    // humidity 65.44 / 65.43 → toFixed(1) = "65.4" 동일
    const a = { ...base, temperature: 20.14, humidity: 65.44 };
    const b = { ...base, temperature: 20.11, humidity: 65.43 };
    expect(makeFermentationKey(a)).toBe(makeFermentationKey(b));
  });

  it('pipe-separated 형식 반환', () => {
    const key = makeFermentationKey(base);
    expect(key.split('|')).toHaveLength(5);
  });

  it('온도 차이(0.1) → 다른 키', () => {
    const a = { ...base, temperature: 20.0 };
    const b = { ...base, temperature: 20.1 };
    expect(makeFermentationKey(a)).not.toBe(makeFermentationKey(b));
  });

  it('발효 시간 정수 반올림', () => {
    const a = { ...base, fermentationHours: 36.4 };
    const b = { ...base, fermentationHours: 36.6 };
    const keyA = makeFermentationKey(a).split('|')[4];
    const keyB = makeFermentationKey(b).split('|')[4];
    expect(keyA).toBe('36');
    expect(keyB).toBe('37');
  });
});

// ──────────────────────────────────────────────
// makeQualityKey
// ──────────────────────────────────────────────

describe('makeQualityKey', () => {
  it('pipe-separated 형식 반환 (3개)', () => {
    const key = makeQualityKey({ temperature: 20, salinity: 2.2, ph: 4.2 });
    expect(key.split('|')).toHaveLength(3);
  });

  it('동일 값 → 동일 키', () => {
    // salinity 2.201 / 2.202 → toFixed(2) = "2.20" 동일
    // ph 4.201 / 4.202 → toFixed(2) = "4.20" 동일
    const a = { temperature: 20.04, salinity: 2.201, ph: 4.201 };
    const b = { temperature: 20.04, salinity: 2.202, ph: 4.202 };
    expect(makeQualityKey(a)).toBe(makeQualityKey(b));
  });

  it('온도 차이 0.1 → 다른 키', () => {
    const a = { temperature: 20.0, salinity: 2.2, ph: 4.2 };
    const b = { temperature: 20.1, salinity: 2.2, ph: 4.2 };
    expect(makeQualityKey(a)).not.toBe(makeQualityKey(b));
  });
});
