// lib/auth/jwt.ts — JWT sign/verify (jose, Edge Runtime 호환)
import { SignJWT, jwtVerify } from 'jose';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface JWTPayload {
  sub: string;       // 사용자 이메일
  role: UserRole;
  name?: string;
  iat?: number;
  exp?: number;
}

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return new TextEncoder().encode(secret);
};

const ACCESS_TTL  = parseInt(process.env.JWT_ACCESS_TTL  ?? '3600',   10); // 1h
const REFRESH_TTL = parseInt(process.env.JWT_REFRESH_TTL ?? '604800', 10); // 7d

export async function signAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(getSecret());
}

export async function signRefreshToken(payload: Pick<JWTPayload, 'sub' | 'role'>): Promise<string> {
  return new SignJWT({ role: payload.role, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    sub: payload.sub as string,
    role: payload.role as UserRole,
    name: payload.name as string | undefined,
  };
}

export async function refreshTokens(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const { payload } = await jwtVerify(refreshToken, getSecret());
  if (payload.type !== 'refresh') throw new Error('Invalid refresh token');
  const sub  = payload.sub as string;
  const role = payload.role as UserRole;
  const name = payload.name as string | undefined;
  return {
    accessToken:  await signAccessToken({ sub, role, name }),
    refreshToken: await signRefreshToken({ sub, role }),
  };
}
