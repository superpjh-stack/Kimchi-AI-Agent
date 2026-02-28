// GET /api/health — 서비스 헬스체크
import { ok } from '@/lib/utils/api-response';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function checkOllama(): Promise<boolean> {
  const base = process.env.OLLAMA_BASE_URL ?? process.env.OLLAMA_URL;
  if (!base) return false;
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkMlServer(): Promise<boolean> {
  const url = process.env.ML_SERVER_URL;
  if (!url) return false;
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkChat(): Promise<'ok' | 'degraded' | 'unavailable'> {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY || !!process.env.OPENAI_CHAT_MODEL;
  const hasOllama = !!process.env.OLLAMA_BASE_URL;
  if (!hasAnthropic && !hasOpenAI && !hasOllama) return 'unavailable';
  if (!hasAnthropic && (hasOpenAI || hasOllama)) return 'degraded';
  return 'ok';
}

async function healthHandler(_req: AuthRequest): Promise<Response> {
  const [ollamaOk, mlOk, chatStatus] = await Promise.all([
    checkOllama(),
    checkMlServer(),
    checkChat(),
  ]);

  const embeddingProvider = process.env.EMBEDDING_PROVIDER ?? 'auto';
  const vectorStore = process.env.DATABASE_URL ? 'pgvector' : 'memory';

  const mem = process.memoryUsage();

  return ok({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      chat: chatStatus,
      vectorStore,
      embeddingProvider,
      ollama: ollamaOk ? 'ok' : 'unavailable',
      mlServer: mlOk ? 'ok' : 'unavailable',
    },
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
  });
}

export const GET = withAuth(healthHandler, { permissions: ['health:read'] });

// 로드밸런서용 공개 헬스체크 엔드포인트 — /api/health/ping 별도 (추후 추가)

