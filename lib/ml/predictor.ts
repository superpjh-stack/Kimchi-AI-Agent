// lib/ml/predictor.ts — IPredictor 인터페이스 + 공유 타입
import type { SensorData } from '@/lib/process/sensor-client';

export interface FermentationPrediction {
  fermentationPct: number;     // 0.0–1.0
  eta: string;                 // ISO 8601
  confidence: number;          // 0.0–1.0
  stage: 'early' | 'mid' | 'late' | 'complete';
  anomaly: boolean;
  anomalyReason?: string;
}

export interface QualityPrediction {
  grade: 'A' | 'B' | 'C';
  confidence: number;          // 0.0–1.0
  rationale: string;
  recommendations: string[];
}

export interface QualityInput {
  temperature: number;
  salinity: number;
  ph: number;
}

export interface IPredictor {
  predictFermentation(sensors: SensorData): Promise<FermentationPrediction>;
  predictQuality(input: QualityInput): Promise<QualityPrediction>;
}
