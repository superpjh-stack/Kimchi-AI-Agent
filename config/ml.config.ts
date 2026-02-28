// config/ml.config.ts — ML 예측 파라미터 중앙 설정

export interface MLConfig {
  fermentation: {
    baseTemp: number;
    baseHours: number;
    q10Factor: number;
  };
  anomaly: {
    tempMin: number;
    tempMax: number;
    salinityMin: number;
    salinityMax: number;
    phMin: number;
    phMax: number;
  };
  quality: {
    gradeA: { tempMin: number; tempMax: number; salMin: number; salMax: number; phMin: number; phMax: number };
    gradeB: { tempMin: number; tempMax: number; salMin: number; salMax: number; phMin: number; phMax: number };
  };
  confidence: {
    baseMin: number;
    maxBoost: number;
    anomalyPenalty: number;
    threshold: number;
  };
}

const DEFAULT_ML_CONFIG: MLConfig = {
  fermentation: { baseTemp: 20, baseHours: 72, q10Factor: 2.0 },
  anomaly: { tempMin: 10, tempMax: 28, salinityMin: 1.0, salinityMax: 3.5, phMin: 3.5, phMax: 6.0 },
  quality: {
    gradeA: { tempMin: 18, tempMax: 22, salMin: 2.0, salMax: 2.5, phMin: 4.0, phMax: 4.5 },
    gradeB: { tempMin: 16, tempMax: 24, salMin: 1.8, salMax: 2.75, phMin: 3.8, phMax: 4.8 },
  },
  confidence: { baseMin: 0.7, maxBoost: 0.25, anomalyPenalty: 0.5, threshold: 0.6 },
};

export function loadMLConfig(): MLConfig {
  const config = structuredClone(DEFAULT_ML_CONFIG);
  const threshold = process.env.ML_CONFIDENCE_THRESHOLD;
  if (threshold) config.confidence.threshold = parseFloat(threshold);
  return config;
}
