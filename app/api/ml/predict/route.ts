// POST /api/ml/predict — 발효 완성도 예측 (30초 캐시)
import * as Sentry from '@sentry/nextjs';
import { ok, err } from '@/lib/utils/api-response';
import { getPredictor } from '@/lib/ml/predictor-factory';
import { PredictionCache, makeFermentationKey } from '@/lib/ml/prediction-cache';
import { predictionHistory } from '@/lib/ml/prediction-history';
import { createLogger } from '@/lib/logger';
import { mlLimiter } from '@/lib/middleware/rate-limit';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';
import type { SensorData } from '@/lib/process/sensor-client';
import type { FermentationPrediction } from '@/lib/ml/predictor';

const log = createLogger('api.ml.predict');

export const runtime = 'nodejs';

const cache = new PredictionCache<FermentationPrediction>(30_000);

async function predictHandler(req: AuthRequest): Promise<Response> {
  // S4-4: Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed, remaining: rlRemaining, resetAt } = mlLimiter.check(ip);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        'X-RateLimit-Remaining': String(rlRemaining),
      },
    });
  }

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
    const prediction = await Sentry.startSpan(
      { op: 'ml.predict', name: 'ML Fermentation Prediction' },
      async (span) => {
        const result = await predictor.predictFermentation(body.sensors);
        span.setAttribute('ml.confidence', result.confidence);
        span.setAttribute('ml.anomaly', result.anomaly);
        return result;
      }
    );
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
    log.error({ err: e }, 'Prediction failed');
    return err('PREDICTION_FAILED', '예측 실패', 500);
  }
}

export const POST = withAuth(predictHandler, { permissions: ['ml:read'] });
