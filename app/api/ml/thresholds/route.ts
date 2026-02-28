// app/api/ml/thresholds/route.ts — 이상 감지 임계값 런타임 재정의

import { loadMLConfig } from '@/config/ml.config';

type AnomalyKey = 'tempMin' | 'tempMax' | 'salinityMin' | 'salinityMax' | 'phMin' | 'phMax';

let runtimeOverrides: Partial<Record<AnomalyKey, number>> = {};

const ALLOWED_KEYS: AnomalyKey[] = [
  'tempMin', 'tempMax', 'salinityMin', 'salinityMax', 'phMin', 'phMax',
];

export async function PATCH(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '유효하지 않은 JSON입니다.' }, { status: 400 });
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.includes(key as AnomalyKey)) {
      return Response.json({ error: `허용되지 않는 필드: ${key}` }, { status: 400 });
    }
    if (typeof body[key] !== 'number') {
      return Response.json({ error: `${key}는 숫자여야 합니다.` }, { status: 400 });
    }
  }

  runtimeOverrides = { ...runtimeOverrides, ...(body as Partial<Record<AnomalyKey, number>>) };
  return Response.json({ anomaly: { ...loadMLConfig().anomaly, ...runtimeOverrides } });
}

export async function GET(): Promise<Response> {
  const config = loadMLConfig();
  return Response.json({
    anomaly: { ...config.anomaly, ...runtimeOverrides },
    defaults: config.anomaly,
    overrides: runtimeOverrides,
  });
}
