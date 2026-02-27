// lib/ml/predictor-factory.ts — getPredictor() 싱글톤 팩토리
import { RuleBasedPredictor } from './rule-based-predictor';
import type { IPredictor } from './predictor';

let _predictor: IPredictor | null = null;

export function getPredictor(): IPredictor {
  if (_predictor) return _predictor;

  const ruleBased = new RuleBasedPredictor();

  if (process.env.ML_SERVER_URL) {
    const { RemoteMLPredictor } = require('./remote-predictor') as typeof import('./remote-predictor');
    _predictor = new RemoteMLPredictor(process.env.ML_SERVER_URL, ruleBased);
    console.log(`[ml] provider=remote (${process.env.ML_SERVER_URL})`);
  } else {
    _predictor = ruleBased;
    console.log('[ml] provider=rule-based');
  }

  return _predictor;
}
