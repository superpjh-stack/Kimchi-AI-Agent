// lib/ml/rule-based-predictor.ts — Q10 법칙 기반 발효 예측 + 품질 등급
import type { SensorData } from '@/lib/process/sensor-client';
import type { IPredictor, FermentationPrediction, QualityPrediction, QualityInput } from './predictor';
import { loadMLConfig, type MLConfig } from '@/config/ml.config';

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export class RuleBasedPredictor implements IPredictor {
  private readonly config: MLConfig;

  constructor(config?: MLConfig) {
    this.config = config ?? loadMLConfig();
  }

  async predictFermentation(sensors: SensorData): Promise<FermentationPrediction> {
    const { temperature, fermentationHours } = sensors;
    const { baseTemp, baseHours, q10Factor } = this.config.fermentation;
    const { anomalyPenalty, baseMin, maxBoost } = this.config.confidence;
    const ANOMALY = this.config.anomaly;

    // Q10 온도 보정: 온도가 10°C 오를수록 반응속도 q10Factor배
    const tempFactor = Math.pow(q10Factor, (temperature - baseTemp) / 10);
    const effectiveHours = fermentationHours * tempFactor;
    const fermentationPct = clamp(effectiveHours / baseHours, 0, 1);

    // ETA 계산
    const remainingHours = fermentationPct >= 1
      ? 0
      : (baseHours - effectiveHours) / tempFactor;
    const eta = new Date(Date.now() + remainingHours * 3600 * 1000).toISOString();

    // 발효 단계
    let stage: FermentationPrediction['stage'];
    if (fermentationPct >= 1.0)       stage = 'complete';
    else if (fermentationPct >= 0.60) stage = 'late';
    else if (fermentationPct >= 0.25) stage = 'mid';
    else                               stage = 'early';

    // 이상 감지
    const anomalyReasons: string[] = [];
    if (temperature < ANOMALY.tempMin || temperature > ANOMALY.tempMax)
      anomalyReasons.push(`온도 이상 (${temperature.toFixed(1)}°C)`);
    if (sensors.salinity < ANOMALY.salinityMin || sensors.salinity > ANOMALY.salinityMax)
      anomalyReasons.push(`염도 이상 (${sensors.salinity.toFixed(2)}%)`);
    if (sensors.ph < ANOMALY.phMin || sensors.ph > ANOMALY.phMax)
      anomalyReasons.push(`pH 이상 (${sensors.ph.toFixed(2)})`);

    const anomaly = anomalyReasons.length > 0;
    const confidence = anomaly
      ? anomalyPenalty
      : clamp(baseMin + fermentationPct * maxBoost, baseMin, baseMin + maxBoost);

    return {
      fermentationPct,
      eta,
      confidence,
      stage,
      anomaly,
      anomalyReason: anomaly ? anomalyReasons.join(', ') : undefined,
    };
  }

  async predictQuality(input: QualityInput): Promise<QualityPrediction> {
    const { temperature, salinity, ph } = input;
    const GRADE_A = this.config.quality.gradeA;
    const GRADE_B = this.config.quality.gradeB;

    const inA =
      temperature >= GRADE_A.tempMin && temperature <= GRADE_A.tempMax &&
      salinity    >= GRADE_A.salMin  && salinity    <= GRADE_A.salMax  &&
      ph          >= GRADE_A.phMin   && ph          <= GRADE_A.phMax;

    const inB =
      temperature >= GRADE_B.tempMin && temperature <= GRADE_B.tempMax &&
      salinity    >= GRADE_B.salMin  && salinity    <= GRADE_B.salMax  &&
      ph          >= GRADE_B.phMin   && ph          <= GRADE_B.phMax;

    if (inA) {
      return {
        grade: 'A',
        confidence: 0.85,
        rationale: '온도, 염도, pH 모두 최적 범위. 최상급 품질 예상.',
        recommendations: [],
      };
    }

    const recs: string[] = [];
    if (temperature < GRADE_A.tempMin) recs.push('발효실 온도를 18°C 이상으로 높이세요.');
    if (temperature > GRADE_A.tempMax) recs.push('발효실 온도를 22°C 이하로 낮추세요.');
    if (salinity < GRADE_A.salMin)    recs.push('염도를 2.0% 이상으로 조정하세요.');
    if (salinity > GRADE_A.salMax)    recs.push('염도를 2.5% 이하로 줄이세요.');
    if (ph < GRADE_A.phMin)           recs.push('pH가 낮습니다. 발효 시간을 줄이거나 온도를 낮추세요.');
    if (ph > GRADE_A.phMax)           recs.push('pH가 높습니다. 발효 진행을 촉진하세요.');

    if (inB) {
      return {
        grade: 'B',
        confidence: 0.75,
        rationale: '일부 수치가 최적 범위를 벗어남. 양호한 품질이나 개선 여지 있음.',
        recommendations: recs,
      };
    }

    return {
      grade: 'C',
      confidence: 0.65,
      rationale: '복수 지표가 권장 범위 이탈. 즉각적인 공정 점검 필요.',
      recommendations: recs,
    };
  }
}
