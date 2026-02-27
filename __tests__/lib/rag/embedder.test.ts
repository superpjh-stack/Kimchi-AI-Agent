// __tests__/lib/rag/embedder.test.ts
// EmbeddingProvider 팩토리 분기 테스트

describe('getEmbedder() factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_URL;
    delete process.env.EMBEDDING_PROVIDER;
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('EMBEDDING_PROVIDER=mock -> MockEmbedder 반환', async () => {
    process.env.EMBEDDING_PROVIDER = 'mock';
    const { getEmbedder } = await import('@/lib/rag/embedder');
    const embedder = getEmbedder();
    expect(embedder.name).toBe('mock');
    expect(embedder.dimension).toBe(1536);
  });

  it('EMBEDDING_PROVIDER=openai + OPENAI_API_KEY -> OpenAIEmbedder 반환', async () => {
    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test-key';
    const { getEmbedder } = await import('@/lib/rag/embedder');
    const embedder = getEmbedder();
    expect(embedder.name).toBe('openai');
    expect(embedder.dimension).toBe(1536);
  });

  it('EMBEDDING_PROVIDER=local + OLLAMA_BASE_URL -> OllamaWithFallback (name=local)', async () => {
    process.env.EMBEDDING_PROVIDER = 'local';
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    // Mock the local embedder to avoid actual Ollama connection
    jest.mock('@/lib/rag/embedder-local', () => ({
      LocalEmbedder: jest.fn().mockImplementation(() => ({
        dimension: 768,
        name: 'local',
        embed: jest.fn().mockResolvedValue(new Array(768).fill(0)),
        embedBatch: jest.fn().mockResolvedValue([]),
      })),
    }));
    const { getEmbedder } = await import('@/lib/rag/embedder');
    const embedder = getEmbedder();
    // Without DATABASE_URL, uses OllamaWithFallback which starts as 'local'
    expect(embedder.name).toBe('local');
  });

  it('자동 감지: OPENAI_API_KEY 있음 -> OpenAIEmbedder', async () => {
    // No EMBEDDING_PROVIDER set, auto-detect
    process.env.OPENAI_API_KEY = 'sk-auto-detect';
    const { getEmbedder } = await import('@/lib/rag/embedder');
    const embedder = getEmbedder();
    expect(embedder.name).toBe('openai');
  });

  it('자동 감지: 키 없음 + Ollama 없음 -> MockEmbedder', async () => {
    // No EMBEDDING_PROVIDER, no OPENAI_API_KEY, no OLLAMA_BASE_URL
    const { getEmbedder } = await import('@/lib/rag/embedder');
    const embedder = getEmbedder();
    expect(embedder.name).toBe('mock');
  });

  it('MockEmbedder embed() -> 1536차원 벡터 반환', async () => {
    process.env.EMBEDDING_PROVIDER = 'mock';
    const { getEmbedder } = await import('@/lib/rag/embedder');
    const embedder = getEmbedder();
    const vector = await embedder.embed('김치 발효');
    expect(vector).toHaveLength(1536);
    // Verify it's normalized (magnitude ~= 1)
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 1);
  });

  it('MockEmbedder embedBatch() -> 각 텍스트별 벡터 반환', async () => {
    process.env.EMBEDDING_PROVIDER = 'mock';
    const { getEmbedder } = await import('@/lib/rag/embedder');
    const embedder = getEmbedder();
    const vectors = await embedder.embedBatch(['김치', '발효', '온도']);
    expect(vectors).toHaveLength(3);
    vectors.forEach((v) => expect(v).toHaveLength(1536));
  });
});
