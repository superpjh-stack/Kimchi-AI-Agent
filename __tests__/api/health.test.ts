// __tests__/api/health.test.ts
jest.mock('@/lib/auth/jwt', () => ({
  verifyToken: jest.fn(async (token: string) => {
    if (token === 'valid') return { sub: 'u@t.com', role: 'operator', name: 'Operator' };
    throw new Error('Invalid');
  }),
  signAccessToken:  jest.fn(async () => 'mock'),
  signRefreshToken: jest.fn(async () => 'mock'),
  refreshTokens:    jest.fn(),
}));

describe('GET /api/health', () => {
  it('인증 없으면 401을 반환한다', async () => {
    const { GET } = await import('@/app/api/health/route');
    const res = await GET(new Request('http://localhost/api/health'));
    expect(res.status).toBe(401);
  });

  it('유효한 토큰으로 200과 status:ok를 반환한다', async () => {
    const { GET } = await import('@/app/api/health/route');
    const req = new Request('http://localhost/api/health', {
      headers: { authorization: 'Bearer valid' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // ok(data) → { data: { status: 'ok', ... } }
    expect(body.data?.status).toBe('ok');
  });

  it('잘못된 토큰으로 401을 반환한다', async () => {
    const { GET } = await import('@/app/api/health/route');
    const res = await GET(new Request('http://localhost/api/health', {
      headers: { authorization: 'Bearer bad-token' },
    }));
    expect(res.status).toBe(401);
  });
});
