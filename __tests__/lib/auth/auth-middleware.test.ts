// __tests__/lib/auth/auth-middleware.test.ts
import type { JWTPayload } from '@/lib/auth/jwt';

// lib/auth/jwt 전체 모킹 (getSecret 우회)
jest.mock('@/lib/auth/jwt', () => ({
  verifyToken: jest.fn(async (token: string): Promise<JWTPayload> => {
    if (token === 'valid-token') return { sub: 'user@test.com', role: 'operator', name: 'Test User' };
    if (token === 'admin-token') return { sub: 'admin@test.com', role: 'admin', name: 'Admin' };
    throw new Error('Invalid or expired token');
  }),
  signAccessToken: jest.fn(async () => 'mock-access'),
  signRefreshToken: jest.fn(async () => 'mock-refresh'),
  refreshTokens: jest.fn(),
}));

// rbac는 실제 구현 사용
import { withAuth } from '@/lib/auth/auth-middleware';

function makeRequest(opts: { authorization?: string; cookie?: string } = {}): Request {
  const headers = new Headers();
  if (opts.authorization) headers.set('authorization', opts.authorization);
  if (opts.cookie) headers.set('cookie', opts.cookie);
  return new Request('http://localhost/api/test', { headers });
}

describe('withAuth', () => {
  it('Authorization Bearer 토큰으로 인증 성공 → 200', async () => {
    const handler = jest.fn(async () => Response.json({ ok: true }));
    const wrapped = withAuth(handler);
    const res = await wrapped(makeRequest({ authorization: 'Bearer valid-token' }));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('쿠키 access_token으로 인증 성공 → 200', async () => {
    const handler = jest.fn(async () => Response.json({ ok: true }));
    const wrapped = withAuth(handler);
    const res = await wrapped(makeRequest({ cookie: 'access_token=valid-token' }));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('토큰 없으면 401', async () => {
    const handler = jest.fn(async () => Response.json({ ok: true }));
    const wrapped = withAuth(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('잘못된 토큰 → 401', async () => {
    const handler = jest.fn(async () => Response.json({ ok: true }));
    const wrapped = withAuth(handler);
    const res = await wrapped(makeRequest({ authorization: 'Bearer bad-token' }));
    expect(res.status).toBe(401);
  });

  it('권한 부족(operator → ml:admin) → 403', async () => {
    const handler = jest.fn(async () => Response.json({ ok: true }));
    const wrapped = withAuth(handler, { permissions: ['ml:admin'] });
    const res = await wrapped(makeRequest({ authorization: 'Bearer valid-token' }));
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('admin 토큰으로 ml:admin 권한 → 200', async () => {
    const handler = jest.fn(async () => Response.json({ ok: true }));
    const wrapped = withAuth(handler, { permissions: ['ml:admin'] });
    const res = await wrapped(makeRequest({ authorization: 'Bearer admin-token' }));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('handler에 req.user가 주입된다', async () => {
    let capturedUser: JWTPayload | undefined;
    const handler = jest.fn(async (req: Request & { user: JWTPayload }) => {
      capturedUser = req.user;
      return Response.json({ ok: true });
    });
    const wrapped = withAuth(handler);
    await wrapped(makeRequest({ authorization: 'Bearer valid-token' }));
    expect(capturedUser?.sub).toBe('user@test.com');
    expect(capturedUser?.role).toBe('operator');
  });

  it('chat:write 권한은 operator가 통과한다', async () => {
    const handler = jest.fn(async () => Response.json({ ok: true }));
    const wrapped = withAuth(handler, { permissions: ['chat:write'] });
    const res = await wrapped(makeRequest({ authorization: 'Bearer valid-token' }));
    expect(res.status).toBe(200);
  });
});
