// __tests__/lib/config/validate-env.test.ts — 환경변수 검증 테스트

describe('validateEnv', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('LLM API 키가 없으면 errors에 오류 추가', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { validateEnv } = await import('@/lib/config/validate-env');
    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('OPENAI_API_KEY만 있으면 valid=true', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test';
    const { validateEnv } = await import('@/lib/config/validate-env');
    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('ANTHROPIC_API_KEY만 있으면 valid=true', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    delete process.env.OPENAI_API_KEY;
    const { validateEnv } = await import('@/lib/config/validate-env');
    const result = validateEnv();
    expect(result.valid).toBe(true);
  });

  it('EMBEDDING_PROVIDER=openai & OPENAI_API_KEY 없으면 error', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.EMBEDDING_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;
    const { validateEnv } = await import('@/lib/config/validate-env');
    const result = validateEnv();
    expect(result.errors.some((e) => e.includes('OPENAI_API_KEY'))).toBe(true);
  });

  it('ML_CONFIDENCE_THRESHOLD 범위 초과 시 warning', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.ML_CONFIDENCE_THRESHOLD = '1.5';
    const { validateEnv } = await import('@/lib/config/validate-env');
    const result = validateEnv();
    expect(result.warnings.some((w) => w.includes('ML_CONFIDENCE_THRESHOLD'))).toBe(true);
  });

  it('잘못된 LOG_LEVEL 값 시 warning', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.LOG_LEVEL = 'verbose';
    const { validateEnv } = await import('@/lib/config/validate-env');
    const result = validateEnv();
    expect(result.warnings.some((w) => w.includes('LOG_LEVEL'))).toBe(true);
  });

  it('DATABASE_URL 형식 오류 시 warning', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.DATABASE_URL = 'mysql://localhost/db';
    const { validateEnv } = await import('@/lib/config/validate-env');
    const result = validateEnv();
    expect(result.warnings.some((w) => w.includes('DATABASE_URL'))).toBe(true);
  });
});
