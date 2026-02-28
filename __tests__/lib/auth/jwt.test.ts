// __tests__/lib/auth/jwt.test.ts — JWT 모듈 단위 테스트 (jose 모킹)
// jose는 ESM-only이므로 모킹으로 로직 검증

// jose 모킹 (ESM 호환성 문제 우회)
jest.mock('jose', () => {
  class MockSignJWT {
    private claims: Record<string, unknown> = {};
    constructor(claims: Record<string, unknown>) { this.claims = claims; }
    setProtectedHeader() { return this; }
    setSubject(sub: string) { this.claims.sub = sub; return this; }
    setIssuedAt() { this.claims.iat = Math.floor(Date.now() / 1000); return this; }
    setExpirationTime(exp: string) { this.claims.exp = exp; return this; }
    async sign(_secret: Uint8Array) {
      // 간단한 mock JWT: base64(header).base64(claims).signature
      const header = Buffer.from('{"alg":"HS256"}').toString('base64url');
      const payload = Buffer.from(JSON.stringify(this.claims)).toString('base64url');
      return `${header}.${payload}.mock-signature`;
    }
  }

  const jwtVerify = jest.fn(async (token: string, _secret: Uint8Array) => {
    if (token === 'invalid.token.here' || !token.includes('.')) {
      throw new Error('JWTInvalid');
    }
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('JWTMalformed');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.type === 'access' || !payload.type) {
      // access token — no type field or normal payload
    }
    return { payload };
  });

  return { SignJWT: MockSignJWT, jwtVerify };
});

import { signAccessToken, signRefreshToken, verifyToken, refreshTokens } from '@/lib/auth/jwt';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-minimum-32-bytes!!';
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

describe('signAccessToken', () => {
  test('토큰 반환 — 3 파트 JWT 형식', async () => {
    const token = await signAccessToken({ sub: 'admin@test.com', role: 'admin', name: '관리자' });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  test('sub/role/name 포함', async () => {
    const token = await signAccessToken({ sub: 'user@test.com', role: 'operator', name: '운영자' });
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload.sub).toBe('user@test.com');
    expect(payload.role).toBe('operator');
    expect(payload.name).toBe('운영자');
  });

  test('viewer 역할', async () => {
    const token = await signAccessToken({ sub: 'viewer@test.com', role: 'viewer' });
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload.role).toBe('viewer');
  });
});

describe('signRefreshToken', () => {
  test('refresh 토큰 생성 — type=refresh 포함', async () => {
    const token = await signRefreshToken({ sub: 'admin@test.com', role: 'admin' });
    expect(typeof token).toBe('string');
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload.type).toBe('refresh');
  });
});

describe('verifyToken', () => {
  test('유효한 mock 토큰 검증', async () => {
    const token = await signAccessToken({ sub: 'user@test.com', role: 'viewer' });
    const payload = await verifyToken(token);
    expect(payload.sub).toBe('user@test.com');
    expect(payload.role).toBe('viewer');
  });

  test('위조 토큰 → 오류', async () => {
    await expect(verifyToken('invalid.token.here')).rejects.toThrow();
  });
});

describe('refreshTokens', () => {
  test('refresh 토큰 → 새 access/refresh 발급', async () => {
    const refresh = await signRefreshToken({ sub: 'user@test.com', role: 'viewer' });
    const result = await refreshTokens(refresh);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');

    const parts = result.accessToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload.sub).toBe('user@test.com');
    expect(payload.role).toBe('viewer');
  });

  test('access 토큰을 refresh로 사용 → type 불일치로 오류', async () => {
    // access 토큰은 type 필드 없음 → refreshTokens에서 오류
    const access = await signAccessToken({ sub: 'user@test.com', role: 'viewer' });

    // jose.jwtVerify mock: type이 없으면 'refresh' 체크 실패
    const { jwtVerify } = await import('jose');
    (jwtVerify as jest.Mock).mockImplementationOnce(async (token: string) => {
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return { payload };  // type 없는 payload 반환
    });

    await expect(refreshTokens(access)).rejects.toThrow('Invalid refresh token');
  });
});
