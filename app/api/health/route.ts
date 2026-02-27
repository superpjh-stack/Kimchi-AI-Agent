// GET /api/health — 서비스 헬스체크
import { ok } from '@/lib/utils/api-response';

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

export async function GET(): Promise<Response> {
  const [ollamaOk, mlOk] = await Promise.all([checkOllama(), checkMlServer()]);

  const embeddingProvider = process.env.EMBEDDING_PROVIDER ?? 'auto';
  const vectorStore = process.env.DATABASE_URL ? 'pgvector' : 'memory';

  return ok({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      vectorStore,
      embeddingProvider,
      ollama: ollamaOk ? 'ok' : 'unavailable',
      mlServer: mlOk ? 'ok' : 'unavailable',
    },
  });
}
