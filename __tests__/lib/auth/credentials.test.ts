// __tests__/lib/auth/credentials.test.ts — validateCredentials 테스트

// bcryptjs 모킹 — 실제 해시 없이 테스트
jest.mock('bcryptjs', () => ({
  compare: jest.fn(async (plain: string, hash: string) => {
    // 테스트용: hash가 plain + '-hashed' 형식이면 true
    return hash === `${plain}-hashed`;
  }),
}));

describe('validateCredentials', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('AUTH_USERS 미설정 시 null 반환', async () => {
    delete process.env.AUTH_USERS;
    const { validateCredentials } = await import('@/lib/auth/credentials');
    const result = await validateCredentials('user@test.com', 'password');
    expect(result).toBeNull();
  });

  it('일치하는 사용자와 올바른 비밀번호로 UserRecord 반환', async () => {
    process.env.AUTH_USERS = JSON.stringify([
      { email: 'admin@test.com', passwordHash: 'correct-hashed', role: 'admin', name: 'Admin' },
    ]);
    const { validateCredentials } = await import('@/lib/auth/credentials');
    const result = await validateCredentials('admin@test.com', 'correct');
    expect(result).not.toBeNull();
    expect(result?.email).toBe('admin@test.com');
    expect(result?.role).toBe('admin');
  });

  it('잘못된 비밀번호로 null 반환', async () => {
    process.env.AUTH_USERS = JSON.stringify([
      { email: 'admin@test.com', passwordHash: 'correct-hashed', role: 'admin' },
    ]);
    const { validateCredentials } = await import('@/lib/auth/credentials');
    const result = await validateCredentials('admin@test.com', 'wrong');
    expect(result).toBeNull();
  });

  it('이메일 대소문자 무시', async () => {
    process.env.AUTH_USERS = JSON.stringify([
      { email: 'Admin@Test.com', passwordHash: 'pw-hashed', role: 'operator' },
    ]);
    const { validateCredentials } = await import('@/lib/auth/credentials');
    const result = await validateCredentials('admin@test.com', 'pw');
    expect(result).not.toBeNull();
  });

  it('존재하지 않는 이메일로 null 반환', async () => {
    process.env.AUTH_USERS = JSON.stringify([
      { email: 'other@test.com', passwordHash: 'pw-hashed', role: 'viewer' },
    ]);
    const { validateCredentials } = await import('@/lib/auth/credentials');
    const result = await validateCredentials('notfound@test.com', 'pw');
    expect(result).toBeNull();
  });

  it('AUTH_USERS 잘못된 JSON이면 null 반환', async () => {
    process.env.AUTH_USERS = 'not-valid-json';
    const { validateCredentials } = await import('@/lib/auth/credentials');
    const result = await validateCredentials('user@test.com', 'pw');
    expect(result).toBeNull();
  });
});
