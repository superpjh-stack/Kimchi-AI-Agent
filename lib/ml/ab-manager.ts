// lib/ml/ab-manager.ts — A/B 실험 관리자 (해시 기반 배분, 싱글턴)
import { createLogger } from '@/lib/logger';
import type { Experiment, Variant, Assignment, ExperimentResult, ExperimentStatus } from './ab-test';

const log = createLogger('ml.ab-manager');

// djb2 해시 — batchId + experimentId 결합으로 0~99 결정론적 값 생성
function hashToPercent(batchId: string, experimentId: string): number {
  const key = `${batchId}:${experimentId}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
    hash = hash >>> 0; // 32-bit unsigned
  }
  return hash % 100;
}

interface ResultAccumulator {
  totalPredictions: number;
  confidenceSum: number;
  anomalyCount: number;
  from: string;
  to: string;
}

export class ExperimentManager {
  private experiments = new Map<string, Experiment>();
  private assignments = new Map<string, Assignment>(); // `${batchId}:${experimentId}`
  private resultStore = new Map<string, ResultAccumulator>(); // `${experimentId}:${variantId}`

  // ── 실험 생성 ───────────────────────────────────────────

  createExperiment(data: Omit<Experiment, 'id' | 'startedAt'>): Experiment {
    const totalTraffic = data.variants.reduce((s, v) => s + v.trafficPercent, 0);
    if (totalTraffic !== 100) {
      throw new Error(`Variant trafficPercent sum must be 100, got ${totalTraffic}`);
    }
    const id = crypto.randomUUID();
    const experiment: Experiment = { ...data, id, startedAt: new Date().toISOString() };
    this.experiments.set(id, experiment);
    log.info({ id, name: data.name, variants: data.variants.length }, 'Experiment created');
    return experiment;
  }

  // ── 배치 ID 기반 variant 할당 (결정론적) ────────────────

  assign(batchId: string, experimentId: string): Assignment {
    const cacheKey = `${batchId}:${experimentId}`;
    const cached = this.assignments.get(cacheKey);
    if (cached) return cached;

    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'active') {
      throw new Error(`Experiment ${experimentId} not found or not active`);
    }

    const pct = hashToPercent(batchId, experimentId);
    let cumulative = 0;
    let selectedVariant: Variant | undefined;

    for (const variant of experiment.variants) {
      cumulative += variant.trafficPercent;
      if (pct < cumulative) {
        selectedVariant = variant;
        break;
      }
    }
    // 부동소수점 오류 안전망 — 마지막 variant 폴백
    if (!selectedVariant) {
      selectedVariant = experiment.variants[experiment.variants.length - 1];
    }

    const assignment: Assignment = {
      experimentId,
      variantId: selectedVariant.id,
      assignedAt: new Date().toISOString(),
    };
    this.assignments.set(cacheKey, assignment);
    return assignment;
  }

  // ── 예측 결과 기록 ────────────────────────────────────

  recordResult(experimentId: string, variantId: string, data: { confidence: number; isAnomaly: boolean }): void {
    const key = `${experimentId}:${variantId}`;
    const now = new Date().toISOString();
    const acc = this.resultStore.get(key) ?? {
      totalPredictions: 0, confidenceSum: 0, anomalyCount: 0, from: now, to: now,
    };
    acc.totalPredictions++;
    acc.confidenceSum += data.confidence;
    if (data.isAnomaly) acc.anomalyCount++;
    acc.to = now;
    this.resultStore.set(key, acc);
  }

  // ── 결과 조회 ─────────────────────────────────────────

  getResults(experimentId: string): ExperimentResult[] {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error(`Experiment ${experimentId} not found`);

    return experiment.variants.map((v) => {
      const key = `${experimentId}:${v.id}`;
      const acc = this.resultStore.get(key);
      if (!acc || acc.totalPredictions === 0) {
        const now = new Date().toISOString();
        return {
          experimentId, variantId: v.id,
          totalPredictions: 0, avgConfidence: 0, anomalyRate: 0,
          period: { from: now, to: now },
        };
      }
      return {
        experimentId,
        variantId: v.id,
        totalPredictions: acc.totalPredictions,
        avgConfidence: Math.round((acc.confidenceSum / acc.totalPredictions) * 1000) / 1000,
        anomalyRate: Math.round((acc.anomalyCount / acc.totalPredictions) * 1000) / 1000,
        period: { from: acc.from, to: acc.to },
      };
    });
  }

  // ── 활성 실험 조회 ────────────────────────────────────

  getActiveExperiment(): Experiment | null {
    for (const exp of this.experiments.values()) {
      if (exp.status === 'active') return exp;
    }
    return null;
  }

  // ── 실험 목록 / 단건 조회 ─────────────────────────────

  listExperiments(): Experiment[] {
    return Array.from(this.experiments.values());
  }

  getExperiment(id: string): Experiment | undefined {
    return this.experiments.get(id);
  }

  // ── 상태 변경 ─────────────────────────────────────────

  updateStatus(id: string, status: ExperimentStatus): Experiment {
    const exp = this.experiments.get(id);
    if (!exp) throw new Error(`Experiment ${id} not found`);
    const updated: Experiment = {
      ...exp,
      status,
      ...(status === 'completed' ? { endedAt: new Date().toISOString() } : {}),
    };
    this.experiments.set(id, updated);
    log.info({ id, status }, 'Experiment status updated');
    return updated;
  }
}

export const experimentManager = new ExperimentManager();
