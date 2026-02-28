// __tests__/api/auth.test.ts — 인증 API 엔드포인트 테스트

jest.mock('@/lib/auth/credentials', () => ({
  validateCredentials: jest.fn(async (email: string, password: string) => {
    if (email === 'admin@test.com' && password === 'correct-password') {
      return { email: 'admin@test.com', passwordHash: 'hash', role: 'admin', name: 'Admin' };
    }
    return null;
  }),
}));

jest.mock('@/lib/auth/jwt', () => ({
  signAccessToken:  jest.fn(async () => 'mock-access-token'),
  signRefreshToken: jest.fn(async () => 'mock-refresh-token'),
  verifyToken: jest.fn(async (token: string) => {
    if (token === 'valid-token') return { sub: 'admin@test.com', role: 'admin', name: 'Admin' };
    throw new Error('Invalid token');
  }),
  refreshTokens: jest.fn(async () => ({
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
  })),
}));

jest.mock('@/lib/auth/audit-logger', () => ({
  logAudit: jest.fn(),
}));

describe('POST /api/auth/login', () => {
  it('올바른 자격증명으로 200 반환 및 쿠키 설정', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'correct-password' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // login 응답: { user: { email, role, name }, accessToken }
    expect(body.user?.email).toBe('admin@test.com');
    expect(body.accessToken).toBeDefined();
  });

  it('잘못된 자격증명으로 401 반환', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'wrong-password' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('이메일 누락 시 400 반환', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'some-password' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  it('로그아웃 시 200 반환 및 쿠키 삭제', async () => {
    const { POST } = await import('@/app/api/auth/logout/route');
    const res = await POST();
    expect(res.status).toBe(200);
    // Set-Cookie 헤더로 쿠키 삭제 확인
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('Max-Age=0');
  });
});

describe('GET /api/auth/me', () => {
  it('유효한 토큰으로 사용자 정보 반환', async () => {
    const { GET } = await import('@/app/api/auth/me/route');
    const req = new Request('http://localhost/api/auth/me', {
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // me 응답: { user: { email, role, name } }
    expect(body.user?.email).toBe('admin@test.com');
  });

  it('토큰 없을 시 401 반환', async () => {
    const { GET } = await import('@/app/api/auth/me/route');
    const req = new Request('http://localhost/api/auth/me');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
