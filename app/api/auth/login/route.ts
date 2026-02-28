// app/api/auth/login/route.ts — POST /api/auth/login
import { NextResponse } from 'next/server';
import { validateCredentials } from '@/lib/auth/credentials';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { makeTokenCookies } from '@/lib/auth/auth-middleware';
import { logAudit } from '@/lib/auth/audit-logger';
import { sanitizeEmail } from '@/lib/security/input-sanitizer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email    = sanitizeEmail(String(body.email    ?? ''));
    const password = String(body.password ?? '').slice(0, 128);

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await validateCredentials(email, password);
    if (!user) {
      // 브루트포스 방지: 이메일 존재 여부를 노출하지 않는 일관된 에러
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({ sub: user.email, role: user.role, name: user.name }),
      signRefreshToken({ sub: user.email, role: user.role }),
    ]);

    logAudit({
      action: 'login',
      actorEmail: user.email,
      actorRole: user.role,
      resourceType: 'session',
      ip: req.headers.get('x-forwarded-for') ?? undefined,
    });

    const cookies = makeTokenCookies(accessToken, refreshToken);
    const response = NextResponse.json({
      user: { email: user.email, role: user.role, name: user.name ?? null },
      accessToken,
    });
    cookies.forEach((c) => response.headers.append('Set-Cookie', c));
    return response;

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
