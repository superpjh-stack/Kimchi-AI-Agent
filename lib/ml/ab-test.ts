// lib/ml/ab-test.ts — ML A/B 테스트 타입 정의

export type ExperimentStatus = 'active' | 'paused' | 'completed';
export type VariantType = 'rule_based' | 'remote_ml' | 'enhanced_rule';

export interface Variant {
  id: string;                           // 'control' | 'treatment_a' | 'treatment_b'
  name: string;
  predictorType: VariantType;
  predictorConfig?: Record<string, unknown>;
  trafficPercent: number;               // 0-100, 합계 = 100
}

export interface Experiment {
  id: string;                           // nanoid-style UUID
  name: string;
  description?: string;
  status: ExperimentStatus;
  variants: Variant[];
  startedAt: string;                    // ISO 8601
  endedAt?: string;
  createdBy: string;                    // actor email
}

export interface Assignment {
  experimentId: string;
  variantId: string;
  assignedAt: string;
}

export interface ExperimentResult {
  experimentId: string;
  variantId: string;
  totalPredictions: number;
  avgConfidence: number;
  anomalyRate: number;
  period: { from: string; to: string };
}
