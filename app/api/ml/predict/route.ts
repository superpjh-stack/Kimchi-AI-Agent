// POST /api/ml/predict — 발효 완성도 예측 (30초 캐시)
import { ok, err } from '@/lib/utils/api-response';
import { getPredictor } from '@/lib/ml/predictor-factory';
import { PredictionCache, makeFermentationKey } from '@/lib/ml/prediction-cache';
import { predictionHistory } from '@/lib/ml/prediction-history';
import type { SensorData } from '@/lib/process/sensor-client';
import type { FermentationPrediction } from '@/lib/ml/predictor';

export const runtime = 'nodejs';

const cache = new PredictionCache<FermentationPrediction>(30_000);

export async function POST(req: Request): Promise<Response> {
  let body: { batchId?: string; sensors: SensorData };
  try {
    body = await req.json();
  } catch {
    return err('INVALID_JSON', 'Invalid JSON body', 400);
  }

  if (!body.sensors) {
    return err('MISSING_SENSORS', 'sensors 필드가 필요합니다', 400);
  }

  const cacheKey = makeFermentationKey(body.sensors);
  const cached = cache.get(cacheKey);
  if (cached) {
    return ok({ batchId: body.batchId ?? body.sensors.batchId, ...cached, cached: true });
  }

  try {
    const predictor = getPredictor();
    const prediction = await predictor.predictFermentation(body.sensors);
    cache.set(cacheKey, prediction);

    // 예측 이력 저장
    predictionHistory.add({
      type: 'fermentation',
      input: {
        temperature: body.sensors.temperature,
        salinity: body.sensors.salinity,
        ph: body.sensors.ph,
        fermentationHours: body.sensors.fermentationHours,
      },
      confidence: prediction.confidence,
      result: prediction.stage,
    });

    return ok({ batchId: body.batchId ?? body.sensors.batchId, ...prediction, cached: false });
  } catch (e) {
    console.error('[/api/ml/predict]', e);
    return err('PREDICTION_FAILED', '예측 실패', 500);
  }
}
