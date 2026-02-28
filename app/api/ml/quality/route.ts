// POST /api/ml/quality — 품질 등급 예측 (30초 캐시)
import { ok, err } from '@/lib/utils/api-response';
import { getPredictor, createPredictorForTenant } from '@/lib/ml/predictor-factory';
import { PredictionCache, makeQualityKey } from '@/lib/ml/prediction-cache';
import { extractTenantId, isMultiTenantEnabled } from '@/lib/tenant/tenant-middleware';
import { createLogger } from '@/lib/logger';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';
import type { QualityInput, QualityPrediction } from '@/lib/ml/predictor';

const log = createLogger('api.ml.quality');

export const runtime = 'nodejs';

const cache = new PredictionCache<QualityPrediction>(30_000);

async function qualityHandler(req: AuthRequest): Promise<Response> {
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
    const tenantId = extractTenantId(req);
    const predictor = isMultiTenantEnabled()
      ? createPredictorForTenant(tenantId)
      : getPredictor();
    const prediction = await predictor.predictQuality(body);
    cache.set(cacheKey, prediction);
    return ok({ ...prediction, cached: false });
  } catch (e) {
    log.error({ err: e }, 'Quality prediction failed');
    return err('PREDICTION_FAILED', '예측 실패', 500);
  }
}

export const POST = withAuth(qualityHandler, { permissions: ['ml:read'] });
