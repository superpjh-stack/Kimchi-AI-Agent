// __tests__/api/upload.test.ts — POST /api/documents/upload 엔드포인트 테스트

jest.mock('@/lib/auth/jwt', () => ({
  verifyToken: jest.fn(async (token: string) => {
    if (token === 'valid') return { sub: 'u@t.com', role: 'operator', name: 'User' };
    throw new Error('Invalid');
  }),
  signAccessToken:  jest.fn(async () => 'mock'),
  signRefreshToken: jest.fn(async () => 'mock'),
  refreshTokens:    jest.fn(),
}));

jest.mock('@/lib/rag/pipeline', () => ({
  ingestDocument:     jest.fn(async () => 5),
  retrieveContext:    jest.fn(async () => ({ context: '', sources: [] })),
  removeDocumentFull: jest.fn(async () => undefined),
}));

jest.mock('@/lib/middleware/rate-limit', () => ({
  chatLimiter:          { check: jest.fn(() => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 })) },
  uploadLimiter:        { check: jest.fn(() => ({ allowed: true, remaining: 9,  resetAt: Date.now() + 60000 })) },
  mlLimiter:            { check: jest.fn(() => ({ allowed: true, remaining: 29, resetAt: Date.now() + 60000 })) },
  conversationsLimiter: { check: jest.fn(() => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 })) },
  alertsLimiter:        { check: jest.fn(() => ({ allowed: true, remaining: 9,  resetAt: Date.now() + 60000 })) },
}));

jest.mock('@/lib/auth/audit-logger', () => ({
  logAudit: jest.fn(),
}));

jest.mock('@/lib/db/bkend', () => ({
  isBkendConfigured: jest.fn(() => false),
  documentsDb: {},
}));

const UPLOAD_AUTH = { authorization: 'Bearer valid' };

function makeFormData(filename: string, content: string, type = 'text/plain'): FormData {
  const form = new FormData();
  const blob = new Blob([content], { type });
  form.append('file', blob, filename);
  return form;
}

describe('POST /api/documents/upload', () => {
  it('인증 없이 업로드 시 401 반환', async () => {
    const { POST } = await import('@/app/api/documents/upload/route');
    const form = makeFormData('test.txt', '김치 공장 문서');
    const req = new Request('http://localhost/api/documents/upload', {
      method: 'POST',
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('TXT 파일 업로드 시 201 반환', async () => {
    const { POST } = await import('@/app/api/documents/upload/route');
    const form = makeFormData('kimchi.txt', '배추김치 제조 공정 설명\n발효 온도 섭씨 4도 유지');
    const req = new Request('http://localhost/api/documents/upload', {
      method: 'POST',
      body: form,
      headers: UPLOAD_AUTH,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toBeDefined();
  });

  it('파일 없이 요청 시 400 반환', async () => {
    const { POST } = await import('@/app/api/documents/upload/route');
    const form = new FormData();
    const req = new Request('http://localhost/api/documents/upload', {
      method: 'POST',
      body: form,
      headers: UPLOAD_AUTH,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('Rate limit 초과 시 429 반환', async () => {
    const { uploadLimiter } = await import('@/lib/middleware/rate-limit');
    (uploadLimiter.check as jest.Mock).mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    });
    const { POST } = await import('@/app/api/documents/upload/route');
    const form = makeFormData('test.txt', '내용');
    const req = new Request('http://localhost/api/documents/upload', {
      method: 'POST',
      body: form,
      headers: UPLOAD_AUTH,
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});
