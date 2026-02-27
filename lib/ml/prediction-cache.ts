// ML 예측 결과 캐시 — Map 기반 TTL (기본 30초)
// 센서 값을 정규화하여 노이즈 흡수 후 캐시 키 생성

export class PredictionCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs = 30_000) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.evictExpired();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  // 만료 항목 정리 (메모리 누수 방지)
  evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// 센서 값 소수점 1자리로 정규화 → 노이즈 흡수
export function makeFermentationKey(sensors: {
  temperature: number;
  humidity: number;
  salinity: number;
  ph: number;
  fermentationHours: number;
}): string {
  return [
    sensors.temperature.toFixed(1),
    sensors.humidity.toFixed(1),
    sensors.salinity.toFixed(2),
    sensors.ph.toFixed(2),
    sensors.fermentationHours.toFixed(0),
  ].join('|');
}

export function makeQualityKey(input: {
  temperature: number;
  salinity: number;
  ph: number;
}): string {
  return [
    input.temperature.toFixed(1),
    input.salinity.toFixed(2),
    input.ph.toFixed(2),
  ].join('|');
}
