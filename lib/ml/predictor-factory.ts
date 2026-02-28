// lib/ml/predictor-factory.ts — getPredictor() + createPredictor() (A/B 지원) + tenant 분리
import { RuleBasedPredictor } from './rule-based-predictor';
import { experimentManager } from './ab-manager';
import { loadMLConfigForTenant } from '@/config/ml.config';
import { tenantStore } from '@/lib/tenant/tenant-store';
import { createLogger } from '@/lib/logger';
import type { IPredictor } from './predictor';
import type { TenantId } from '@/types/tenant';

const log = createLogger('ml.predictor-factory');

let _predictor: IPredictor | null = null;

/** 싱글턴 — 기본 predictor (A/B 분기 없음) */
export function getPredictor(): IPredictor {
  if (_predictor) return _predictor;

  const ruleBased = new RuleBasedPredictor();

  if (process.env.ML_SERVER_URL) {
    const { RemoteMLPredictor } = require('./remote-predictor') as typeof import('./remote-predictor');
    _predictor = new RemoteMLPredictor(process.env.ML_SERVER_URL, ruleBased);
    log.info({ url: process.env.ML_SERVER_URL }, 'ML provider=remote');
  } else {
    _predictor = ruleBased;
    log.info('ML provider=rule-based');
  }

  return _predictor;
}

/** 요청별 predictor — A/B 실험 활성화 시 variant에 따라 분기 */
export function createPredictor(options?: { batchId?: string }): IPredictor {
  const experiment = experimentManager.getActiveExperiment();

  if (experiment && options?.batchId) {
    try {
      const assignment = experimentManager.assign(options.batchId, experiment.id);
      const variant    = experiment.variants.find((v) => v.id === assignment.variantId);

      if (variant?.predictorType === 'remote_ml' && process.env.ML_SERVER_URL) {
        const { RemoteMLPredictor } = require('./remote-predictor') as typeof import('./remote-predictor');
        log.info({ variantId: variant.id, type: 'remote_ml' }, 'A/B: remote_ml variant');
        return new RemoteMLPredictor(process.env.ML_SERVER_URL, new RuleBasedPredictor());
      }
      if (variant?.predictorType === 'enhanced_rule') {
        log.info({ variantId: variant.id, type: 'enhanced_rule' }, 'A/B: enhanced_rule variant');
        return new RuleBasedPredictor();
      }
      // 'rule_based' — 기본 predictor 반환
    } catch (err) {
      log.warn({ err }, 'A/B assignment failed — falling back to default');
    }
  }

  return getPredictor();
}

/** Tenant별 ML 설정이 적용된 predictor 생성 (FR-43) */
export function createPredictorForTenant(tenantId: TenantId): IPredictor {
  const tenant = tenantStore.get(tenantId);
  const mlConfig = loadMLConfigForTenant(tenant?.mlConfig);
  log.info({ tenantId, hasOverride: !!tenant?.mlConfig }, 'Creating tenant predictor');
  return new RuleBasedPredictor(mlConfig);
}
