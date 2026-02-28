// app/api/auth/refresh/route.ts — POST /api/auth/refresh
import { NextResponse } from 'next/server';
import { refreshTokens } from '@/lib/auth/jwt';
import { makeTokenCookies } from '@/lib/auth/auth-middleware';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // refresh_token은 Path=/api/auth/refresh 쿠키로만 전달됨
    const cookie = req.headers.get('cookie') ?? '';
    const match  = cookie.match(/(?:^|;\s*)refresh_token=([^;]+)/);
    const token  = match ? match[1] : null;

    if (!token) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    }

    const { accessToken, refreshToken } = await refreshTokens(token);
    const cookies = makeTokenCookies(accessToken, refreshToken);

    const response = NextResponse.json({ ok: true, accessToken });
    cookies.forEach((c) => response.headers.append('Set-Cookie', c));
    return response;

  } catch {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }
}
