// __tests__/lib/ml/ab-manager.test.ts
import { ExperimentManager } from '@/lib/ml/ab-manager';

const VARIANTS_50_50 = [
  { id: 'control', name: 'Control (Rule-Based)', predictorType: 'rule_based' as const, trafficPercent: 50 },
  { id: 'treatment', name: 'Treatment (Remote ML)', predictorType: 'remote_ml' as const, trafficPercent: 50 },
];
const VARIANTS_70_30 = [
  { id: 'control', name: 'Control', predictorType: 'rule_based' as const, trafficPercent: 70 },
  { id: 'treatment', name: 'Treatment', predictorType: 'enhanced_rule' as const, trafficPercent: 30 },
];

describe('ExperimentManager', () => {
  let manager: ExperimentManager;

  beforeEach(() => {
    manager = new ExperimentManager();
  });

  // ── createExperiment ───────────────────────────────────

  describe('createExperiment', () => {
    it('실험을 생성하고 id와 startedAt을 자동 설정한다', () => {
      const exp = manager.createExperiment({
        name: 'Test Experiment',
        status: 'active',
        variants: VARIANTS_50_50,
        createdBy: 'admin@test.com',
      });
      expect(exp.id).toBeDefined();
      expect(exp.startedAt).toBeDefined();
      expect(exp.name).toBe('Test Experiment');
      expect(exp.status).toBe('active');
    });

    it('variants trafficPercent 합계가 100이 아니면 오류를 던진다', () => {
      expect(() =>
        manager.createExperiment({
          name: 'Bad Experiment',
          status: 'active',
          variants: [
            { id: 'a', name: 'A', predictorType: 'rule_based', trafficPercent: 60 },
            { id: 'b', name: 'B', predictorType: 'rule_based', trafficPercent: 60 },
          ],
          createdBy: 'admin@test.com',
        })
      ).toThrow();
    });

    it('listExperiments()에 생성된 실험이 포함된다', () => {
      manager.createExperiment({ name: 'E1', status: 'active', variants: VARIANTS_50_50, createdBy: 'a@b.com' });
      manager.createExperiment({ name: 'E2', status: 'paused', variants: VARIANTS_70_30, createdBy: 'a@b.com' });
      expect(manager.listExperiments()).toHaveLength(2);
    });
  });

  // ── assign ─────────────────────────────────────────────

  describe('assign', () => {
    it('같은 batchId와 experimentId는 항상 같은 variantId를 반환한다 (결정론적)', () => {
      const exp = manager.createExperiment({ name: 'E', status: 'active', variants: VARIANTS_50_50, createdBy: 'a@b.com' });
      const a1 = manager.assign('batch-001', exp.id);
      const a2 = manager.assign('batch-001', exp.id);
      expect(a1.variantId).toBe(a2.variantId);
    });

    it('다른 batchId는 다른 variant를 받을 수 있다', () => {
      const exp = manager.createExperiment({ name: 'E', status: 'active', variants: VARIANTS_50_50, createdBy: 'a@b.com' });
      const assignments = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const a = manager.assign(`batch-${i}`, exp.id);
        assignments.add(a.variantId);
      }
      // 50/50 분리이므로 100개 중 두 variant가 모두 나타나야 함
      expect(assignments.size).toBeGreaterThan(1);
    });

    it('비활성 실험에 대해 assign을 호출하면 오류를 던진다', () => {
      const exp = manager.createExperiment({ name: 'E', status: 'paused', variants: VARIANTS_50_50, createdBy: 'a@b.com' });
      expect(() => manager.assign('batch-001', exp.id)).toThrow();
    });

    it('존재하지 않는 실험 ID에 대해 오류를 던진다', () => {
      expect(() => manager.assign('batch-001', 'nonexistent-id')).toThrow();
    });
  });

  // ── recordResult / getResults ──────────────────────────

  describe('recordResult / getResults', () => {
    it('결과를 기록하면 getResults()에 반영된다', () => {
      const exp = manager.createExperiment({ name: 'E', status: 'active', variants: VARIANTS_50_50, createdBy: 'a@b.com' });
      manager.recordResult(exp.id, 'control', { confidence: 0.9, isAnomaly: false });
      manager.recordResult(exp.id, 'control', { confidence: 0.8, isAnomaly: true });

      const results = manager.getResults(exp.id);
      const controlResult = results.find((r) => r.variantId === 'control')!;
      expect(controlResult.totalPredictions).toBe(2);
      expect(controlResult.avgConfidence).toBeCloseTo(0.85, 2);
      expect(controlResult.anomalyRate).toBeCloseTo(0.5, 2);
    });

    it('예측 기록이 없는 variant는 0 값으로 반환된다', () => {
      const exp = manager.createExperiment({ name: 'E', status: 'active', variants: VARIANTS_50_50, createdBy: 'a@b.com' });
      const results = manager.getResults(exp.id);
      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect(r.totalPredictions).toBe(0);
        expect(r.avgConfidence).toBe(0);
      });
    });

    it('존재하지 않는 실험 ID로 getResults 호출 시 오류를 던진다', () => {
      expect(() => manager.getResults('nonexistent')).toThrow();
    });
  });

  // ── getActiveExperiment ────────────────────────────────

  describe('getActiveExperiment', () => {
    it('활성 실험이 없으면 null을 반환한다', () => {
      expect(manager.getActiveExperiment()).toBeNull();
    });

    it('active 상태 실험을 반환한다', () => {
      const exp = manager.createExperiment({ name: 'E', status: 'active', variants: VARIANTS_50_50, createdBy: 'a@b.com' });
      expect(manager.getActiveExperiment()?.id).toBe(exp.id);
    });

    it('paused 실험은 반환하지 않는다', () => {
      manager.createExperiment({ name: 'E', status: 'paused', variants: VARIANTS_50_50, createdBy: 'a@b.com' });
      expect(manager.getActiveExperiment()).toBeNull();
    });
  });

  // ── updateStatus ───────────────────────────────────────

  describe('updateStatus', () => {
    it('실험 상태를 completed로 변경하면 endedAt이 설정된다', () => {
      const exp = manager.createExperiment({ name: 'E', status: 'active', variants: VARIANTS_50_50, createdBy: 'a@b.com' });
      const updated = manager.updateStatus(exp.id, 'completed');
      expect(updated.status).toBe('completed');
      expect(updated.endedAt).toBeDefined();
    });

    it('존재하지 않는 ID로 updateStatus 호출 시 오류를 던진다', () => {
      expect(() => manager.updateStatus('nonexistent', 'paused')).toThrow();
    });
  });
});
