// lib/ml/predictor-factory.ts — getPredictor() 싱글톤 팩토리
import { RuleBasedPredictor } from './rule-based-predictor';
import { createLogger } from '@/lib/logger';
import type { IPredictor } from './predictor';

const log = createLogger('ml.predictor-factory');

let _predictor: IPredictor | null = null;

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
