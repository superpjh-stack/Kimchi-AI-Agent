// POST /api/ml/quality — 품질 등급 예측 (30초 캐시)
import { ok, err } from '@/lib/utils/api-response';
import { getPredictor } from '@/lib/ml/predictor-factory';
import { PredictionCache, makeQualityKey } from '@/lib/ml/prediction-cache';
import type { QualityInput, QualityPrediction } from '@/lib/ml/predictor';

export const runtime = 'nodejs';

const cache = new PredictionCache<QualityPrediction>(30_000);

export async function POST(req: Request): Promise<Response> {
  let body: QualityInput;
  try {
    body = await req.json();
  } catch {
    return err('INVALID_JSON', 'Invalid JSON body', 400);
  }

  if (body.temperature == null || body.salinity == null || body.ph == null) {
    return err('MISSING_FIELDS', 'temperature, salinity, ph 필드가 필요합니다', 400);
  }

  const cacheKey = makeQualityKey(body);
  const cached = cache.get(cacheKey);
  if (cached) {
    return ok({ ...cached, cached: true });
  }

  try {
    const predictor = getPredictor();
    const prediction = await predictor.predictQuality(body);
    cache.set(cacheKey, prediction);
    return ok({ ...prediction, cached: false });
  } catch (e) {
    console.error('[/api/ml/quality]', e);
    return err('PREDICTION_FAILED', '예측 실패', 500);
  }
}
