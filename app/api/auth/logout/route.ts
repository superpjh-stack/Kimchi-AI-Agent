// app/api/auth/logout/route.ts — POST /api/auth/logout
import { NextResponse } from 'next/server';
import { clearTokenCookies } from '@/lib/auth/auth-middleware';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearTokenCookies().forEach((c) => response.headers.append('Set-Cookie', c));
  return response;
}
