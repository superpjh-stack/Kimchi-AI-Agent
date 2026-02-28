// app/api/ml/thresholds/route.ts — 이상 감지 임계값 런타임 재정의

import { loadMLConfig } from '@/config/ml.config';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';
import { logAudit } from '@/lib/auth/audit-logger';

type AnomalyKey = 'tempMin' | 'tempMax' | 'salinityMin' | 'salinityMax' | 'phMin' | 'phMax';

let runtimeOverrides: Partial<Record<AnomalyKey, number>> = {};

const ALLOWED_KEYS: AnomalyKey[] = [
  'tempMin', 'tempMax', 'salinityMin', 'salinityMax', 'phMin', 'phMax',
];

async function patchThresholds(req: AuthRequest): Promise<Response> {
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

  logAudit({
    action: 'ml.thresholds.update',
    actorEmail: req.user.sub,
    actorRole: req.user.role,
    resourceType: 'ml-config',
    metadata: { overrides: body },
    ip: req.headers.get('x-forwarded-for') ?? undefined,
  });

  return Response.json({ anomaly: { ...loadMLConfig().anomaly, ...runtimeOverrides } });
}

async function getThresholds(_req: AuthRequest): Promise<Response> {
  const config = loadMLConfig();
  return Response.json({
    anomaly: { ...config.anomaly, ...runtimeOverrides },
    defaults: config.anomaly,
    overrides: runtimeOverrides,
  });
}

export const PATCH = withAuth(patchThresholds, { permissions: ['ml:admin'] });
export const GET   = withAuth(getThresholds,   { permissions: ['ml:read'] });
