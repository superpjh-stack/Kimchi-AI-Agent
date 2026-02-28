// lib/auth/auth-middleware.ts — API 라우트 인증 미들웨어 (HOF 패턴)
import { NextResponse } from 'next/server';
import { verifyToken, type JWTPayload } from './jwt';
import { requirePermission, ForbiddenError } from './rbac';

// 개발 전용 인증 우회 — NODE_ENV=production에서는 절대 활성화 불가
const DEV_BYPASS =
  process.env.NODE_ENV !== 'production' &&
  process.env.DEV_AUTH_BYPASS === 'true';

const DEV_USER: JWTPayload = {
  sub: 'dev@kimchi-factory.local',
  role: 'admin',
  name: 'Dev Admin',
};

export interface AuthRequest extends Request {
  user: JWTPayload;
}

type Permission =
  | 'chat:read' | 'chat:write'
  | 'upload:write'
  | 'conversations:read' | 'conversations:write' | 'conversations:delete'
  | 'ml:read' | 'ml:admin'
  | 'rag:debug'
  | 'health:read'
  | 'alerts:read'
  | 'admin:tenants';

interface WithAuthOptions {
  permissions?: Permission[];
}

export function withAuth(
  handler: (req: AuthRequest, ...args: unknown[]) => Promise<Response>,
  options: WithAuthOptions = {}
) {
  return async (req: Request, ...args: unknown[]): Promise<Response> => {
    try {
      // 개발 모드 우회 (DEV_AUTH_BYPASS=true + non-production 에서만 동작)
      if (DEV_BYPASS) {
        const authReq = Object.assign(req, { user: DEV_USER }) as AuthRequest;
        return handler(authReq, ...args);
      }

      // 1. 토큰 추출 (Authorization 헤더 우선, 쿠키 폴백)
      let token: string | null = null;

      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      } else {
        const cookie = req.headers.get('cookie') ?? '';
        const match = cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
        token = match ? match[1] : null;
      }

      if (!token) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // 2. 토큰 검증
      const user = await verifyToken(token);

      // 3. 권한 체크
      if (options.permissions) {
        for (const perm of options.permissions) {
          requirePermission(user.role, perm as Parameters<typeof requirePermission>[1]);
        }
      }

      // 4. user 주입 후 핸들러 실행
      const authReq = Object.assign(req, { user }) as AuthRequest;
      return handler(authReq, ...args);

    } catch (err) {
      if (err instanceof ForbiddenError) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // JWT 검증 실패 (만료, 서명 불일치 등)
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
  };
}

/** 쿠키 헤더 생성 헬퍼 */
export function makeTokenCookies(accessToken: string, refreshToken: string): string[] {
  const secure  = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const sameSite = `; SameSite=Strict`;
  return [
    `access_token=${accessToken}; HttpOnly${secure}${sameSite}; Max-Age=3600; Path=/`,
    `refresh_token=${refreshToken}; HttpOnly${secure}${sameSite}; Max-Age=604800; Path=/api/auth/refresh`,
  ];
}

export function clearTokenCookies(): string[] {
  return [
    'access_token=; HttpOnly; Max-Age=0; Path=/',
    'refresh_token=; HttpOnly; Max-Age=0; Path=/api/auth/refresh',
  ];
}
