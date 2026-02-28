// __tests__/api/conversations.test.ts
jest.mock('@/lib/auth/jwt', () => ({
  verifyToken: jest.fn(async (token: string) => {
    if (token === 'valid') return { sub: 'u@t.com', role: 'operator', name: 'User' };
    throw new Error('Invalid');
  }),
  signAccessToken:  jest.fn(async () => 'mock'),
  signRefreshToken: jest.fn(async () => 'mock'),
  refreshTokens:    jest.fn(),
}));

const AUTH = { authorization: 'Bearer valid' };

// 응답 형식: ok() → { data: {...}, meta?: {...} }

describe('GET /api/conversations', () => {
  it('conversations 목록을 반환한다 (200)', async () => {
    const { GET } = await import('@/app/api/conversations/route');
    const res = await GET(new Request('http://localhost/api/conversations'));
    expect(res.status).toBe(200);
    const body = await res.json();
    // ok() 래퍼: { data: { conversations: [...] }, meta: {...} }
    expect(Array.isArray(body.data?.conversations)).toBe(true);
  });

  it('?limit 파라미터를 처리한다', async () => {
    const { GET } = await import('@/app/api/conversations/route');
    const res = await GET(new Request('http://localhost/api/conversations?limit=5'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta?.limit).toBe(5);
  });
});

describe('POST /api/conversations', () => {

  it('인증 성공 시 201 반환', async () => {
    const { POST } = await import('@/app/api/conversations/route');
    const req = new Request('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ firstMessage: '첫 메시지입니다' }),
      headers: { 'content-type': 'application/json', ...AUTH },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    // created() → ok(data, _, 201) → { data: conversation }
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
  });

  it('빈 body도 201로 대화를 생성한다', async () => {
    const { POST } = await import('@/app/api/conversations/route');
    const req = new Request('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json', ...AUTH },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

describe('DELETE /api/conversations/[id]', () => {
  it('인증 없으면 401', async () => {
    const { DELETE } = await import('@/app/api/conversations/[id]/route');
    const req = new Request('http://localhost/api/conversations/some-id', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: 'some-id' } });
    expect(res.status).toBe(401);
  });

  it('존재하지 않는 대화 삭제 시 404', async () => {
    const { DELETE } = await import('@/app/api/conversations/[id]/route');
    const req = new Request('http://localhost/api/conversations/nonexistent', {
      method: 'DELETE',
      headers: AUTH,
    });
    const res = await DELETE(req, { params: { id: 'nonexistent' } });
    expect(res.status).toBe(404);
  });
});
