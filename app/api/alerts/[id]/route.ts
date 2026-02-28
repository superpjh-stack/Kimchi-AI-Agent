// Phase 3: PATCH /api/alerts/:id — 알림 확인(acknowledged) 처리

import { NextRequest } from 'next/server';
import { ok, err } from '@/lib/utils/api-response';
import { acknowledgeAlert, getAlert } from '@/lib/process/alert-store';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

async function patchAlert(
  request: AuthRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return err('INVALID_ID', '유효하지 않은 알림 ID입니다.', 400);
  }

  const alert = getAlert(id);
  if (!alert) {
    return err('NOT_FOUND', '알림을 찾을 수 없습니다.', 404);
  }

  try {
    const body = (await request.json()) as { acknowledged?: boolean };

    if (typeof body.acknowledged !== 'boolean') {
      return err('INVALID_BODY', 'acknowledged 필드(boolean)가 필요합니다.', 400);
    }

    const updated = acknowledgeAlert(id, body.acknowledged);
    if (!updated) {
      return err('NOT_FOUND', '알림을 찾을 수 없습니다.', 404);
    }

    return ok(updated);
  } catch {
    return err('INVALID_JSON', '잘못된 JSON 형식입니다.', 400);
  }
}

// NextRequest 호환: withAuth는 Request 기반이므로 래핑
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuth(
    (authReq) => patchAlert(authReq as AuthRequest, ctx),
    { permissions: ['alerts:read'] }
  )(req);
}
