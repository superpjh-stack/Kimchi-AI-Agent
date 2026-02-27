// __tests__/lib/ml/rule-based-predictor.test.ts
// RuleBasedPredictor: Q10 온도 보정, 발효 단계, 품질 등급, 이상 감지

import { RuleBasedPredictor } from '@/lib/ml/rule-based-predictor';
import type { SensorData } from '@/lib/process/sensor-client';

function makeSensors(overrides: Partial<SensorData> = {}): SensorData {
  return {
    batchId: 'test-batch',
    temperature: 20,
    humidity: 70,
    salinity: 2.2,
    ph: 4.2,
    fermentationHours: 36,
    estimatedCompletion: 36,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('RuleBasedPredictor', () => {
  const predictor = new RuleBasedPredictor();

  // ──────────────────────────────────────────────
  // Q10 온도 보정
  // ──────────────────────────────────────────────

  describe('predictFermentation - Q10 온도 보정', () => {
    it('20 degrees C, 36h -> 50% fermentation (base case)', async () => {
      // tempFactor = 2^((20-20)/10) = 1.0
      // effectiveHours = 36 * 1.0 = 36
      // pct = 36 / 72 = 0.5
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        fermentationHours: 36,
      }));
      expect(result.fermentationPct).toBeCloseTo(0.5, 2);
      expect(result.stage).toBe('mid');
    });

    it('30 degrees C, 36h -> 100% (2x speed, tempFactor=2)', async () => {
      // tempFactor = 2^((30-20)/10) = 2.0
      // effectiveHours = 36 * 2.0 = 72
      // pct = 72 / 72 = 1.0
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 30,
        fermentationHours: 36,
      }));
      expect(result.fermentationPct).toBeCloseTo(1.0, 2);
      expect(result.stage).toBe('complete');
    });

    it('10 degrees C, 36h -> 25% (0.5x speed, tempFactor=0.5)', async () => {
      // tempFactor = 2^((10-20)/10) = 0.5
      // effectiveHours = 36 * 0.5 = 18
      // pct = 18 / 72 = 0.25
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 10,
        fermentationHours: 36,
      }));
      expect(result.fermentationPct).toBeCloseTo(0.25, 2);
      expect(result.stage).toBe('mid');
    });

    it('20 degrees C, 72h -> 100% (exact base hours)', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        fermentationHours: 72,
      }));
      expect(result.fermentationPct).toBeCloseTo(1.0, 2);
      expect(result.stage).toBe('complete');
    });

    it('20 degrees C, 100h -> clamped at 100%', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        fermentationHours: 100,
      }));
      expect(result.fermentationPct).toBe(1.0);
      expect(result.stage).toBe('complete');
    });
  });

  // ──────────────────────────────────────────────
  // 발효 단계 경계값
  // ──────────────────────────────────────────────

  describe('predictFermentation - 단계 경계값', () => {
    it('early stage: pct < 0.25', async () => {
      // 20C, 10h -> effectiveHours=10, pct=10/72 ~= 0.139
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        fermentationHours: 10,
      }));
      expect(result.fermentationPct).toBeLessThan(0.25);
      expect(result.stage).toBe('early');
    });

    it('mid stage: 0.25 <= pct < 0.60', async () => {
      // 20C, 36h -> pct=0.5
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        fermentationHours: 36,
      }));
      expect(result.fermentationPct).toBeGreaterThanOrEqual(0.25);
      expect(result.fermentationPct).toBeLessThan(0.60);
      expect(result.stage).toBe('mid');
    });

    it('late stage: 0.60 <= pct < 1.0', async () => {
      // 20C, 50h -> pct=50/72 ~= 0.694
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        fermentationHours: 50,
      }));
      expect(result.fermentationPct).toBeGreaterThanOrEqual(0.60);
      expect(result.fermentationPct).toBeLessThan(1.0);
      expect(result.stage).toBe('late');
    });

    it('complete stage: pct >= 1.0', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        fermentationHours: 72,
      }));
      expect(result.fermentationPct).toBeGreaterThanOrEqual(1.0);
      expect(result.stage).toBe('complete');
    });
  });

  // ──────────────────────────────────────────────
  // ETA 계산
  // ──────────────────────────────────────────────

  describe('predictFermentation - ETA', () => {
    it('complete -> remainingHours = 0', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        fermentationHours: 72,
      }));
      // ETA should be very close to now
      const etaDate = new Date(result.eta);
      const now = Date.now();
      expect(Math.abs(etaDate.getTime() - now)).toBeLessThan(5000);
    });

    it('returns valid ISO 8601 eta string', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        fermentationHours: 36,
      }));
      expect(() => new Date(result.eta)).not.toThrow();
      expect(new Date(result.eta).toISOString()).toBe(result.eta);
    });
  });

  // ──────────────────────────────────────────────
  // 품질 등급 (A / B / C)
  // ──────────────────────────────────────────────

  describe('predictQuality - 등급 경계값', () => {
    it('최적값 -> 등급 A (temp=20, sal=2.2, ph=4.2)', async () => {
      const result = await predictor.predictQuality({
        temperature: 20,
        salinity: 2.2,
        ph: 4.2,
      });
      expect(result.grade).toBe('A');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.recommendations).toHaveLength(0);
    });

    it('Grade A 경계 최소값 (temp=18, sal=2.0, ph=4.0)', async () => {
      const result = await predictor.predictQuality({
        temperature: 18,
        salinity: 2.0,
        ph: 4.0,
      });
      expect(result.grade).toBe('A');
    });

    it('Grade A 경계 최대값 (temp=22, sal=2.5, ph=4.5)', async () => {
      const result = await predictor.predictQuality({
        temperature: 22,
        salinity: 2.5,
        ph: 4.5,
      });
      expect(result.grade).toBe('A');
    });

    it('온도 17 degrees C (A 범위 미만) -> 등급 B', async () => {
      const result = await predictor.predictQuality({
        temperature: 17,
        salinity: 2.2,
        ph: 4.2,
      });
      expect(result.grade).toBe('B');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('Grade B 경계 (temp=16, sal=1.8, ph=3.8)', async () => {
      const result = await predictor.predictQuality({
        temperature: 16,
        salinity: 1.8,
        ph: 3.8,
      });
      expect(result.grade).toBe('B');
    });

    it('모든 지표 범위 이탈 -> 등급 C (temp=30, sal=3.0, ph=5.5)', async () => {
      const result = await predictor.predictQuality({
        temperature: 30,
        salinity: 3.0,
        ph: 5.5,
      });
      expect(result.grade).toBe('C');
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('극단값 -> 등급 C (temp=35, sal=4.0, ph=2.0)', async () => {
      const result = await predictor.predictQuality({
        temperature: 35,
        salinity: 4.0,
        ph: 2.0,
      });
      expect(result.grade).toBe('C');
    });

    it('등급 C에는 개선 권장사항 포함', async () => {
      const result = await predictor.predictQuality({
        temperature: 30,
        salinity: 3.0,
        ph: 5.5,
      });
      expect(result.rationale).toBeTruthy();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────
  // 이상 감지 (Anomaly Detection)
  // ──────────────────────────────────────────────

  describe('predictFermentation - 이상 감지', () => {
    it('온도 9 degrees C (하한 이탈, < 10) -> anomaly=true', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 9,
      }));
      expect(result.anomaly).toBe(true);
      expect(result.anomalyReason).toMatch(/온도 이상/);
    });

    it('온도 29 degrees C (상한 이탈, > 28) -> anomaly=true', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 29,
      }));
      expect(result.anomaly).toBe(true);
      expect(result.anomalyReason).toMatch(/온도 이상/);
    });

    it('염도 0.5% (하한 이탈, < 1.0) -> anomaly=true', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        salinity: 0.5,
      }));
      expect(result.anomaly).toBe(true);
      expect(result.anomalyReason).toMatch(/염도 이상/);
    });

    it('pH 3.0 (하한 이탈, < 3.5) -> anomaly=true', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        ph: 3.0,
      }));
      expect(result.anomaly).toBe(true);
      expect(result.anomalyReason).toMatch(/pH 이상/);
    });

    it('정상 범위 -> anomaly=false', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        salinity: 2.2,
        ph: 4.2,
      }));
      expect(result.anomaly).toBe(false);
      expect(result.anomalyReason).toBeUndefined();
    });

    it('복수 이상 -> anomalyReason에 모두 포함', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 9,
        salinity: 0.5,
        ph: 3.0,
      }));
      expect(result.anomaly).toBe(true);
      expect(result.anomalyReason).toMatch(/온도 이상/);
      expect(result.anomalyReason).toMatch(/염도 이상/);
      expect(result.anomalyReason).toMatch(/pH 이상/);
    });

    it('이상 감지 시 confidence 감소 (0.5)', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 9,
      }));
      expect(result.confidence).toBe(0.5);
    });

    it('정상 시 confidence >= 0.7', async () => {
      const result = await predictor.predictFermentation(makeSensors({
        temperature: 20,
        salinity: 2.2,
        ph: 4.2,
      }));
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });
});
