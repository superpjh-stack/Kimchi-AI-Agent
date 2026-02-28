// B11: POST /api/documents/upload — 문서 업로드 + RAG 처리
import { ingestDocument } from '@/lib/rag/pipeline';
import { created, err } from '@/lib/utils/api-response';
import { isBkendConfigured, documentsDb } from '@/lib/db/bkend';
import { createLogger } from '@/lib/logger';
import { uploadLimiter } from '@/lib/middleware/rate-limit';
import type { UploadResponse, ChunkingMethod, ChunkingOptions } from '@/types';

const log = createLogger('api.documents.upload');

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_EXTENSIONS = new Set(['.txt', '.csv', '.pdf', '.xlsx']);

function generateDocId(): string {
  return `doc_${crypto.randomUUID()}`;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

/**
 * Extract plain text from an uploaded file.
 * Supports: TXT, CSV (native), PDF (pdf-parse), XLSX (xlsx)
 */
async function extractText(file: File): Promise<string> {
  const ext = getExtension(file.name);

  if (ext === '.txt' || ext === '.csv') {
    return await file.text();
  }

  if (ext === '.pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await pdfParse(buffer);
      return result.text;
    } catch {
      // Fallback: naive text extraction for environments without pdf-parse
      const buffer = await file.arrayBuffer();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const raw = decoder.decode(buffer);
      const textBlocks = raw.match(/[\x20-\x7E\n\r\t\u0080-\uFFFF]{10,}/g) ?? [];
      return textBlocks.join('\n');
    }
  }

  if (ext === '.xlsx') {
    const xlsx = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = xlsx.utils.sheet_to_csv(sheet);
      if (csv.trim()) lines.push(`[시트: ${sheetName}]\n${csv}`);
    }
    return lines.join('\n\n');
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

export async function POST(req: Request): Promise<Response> {
  // S4-4: Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed, remaining: rlRemaining, resetAt } = uploadLimiter.check(ip);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        'X-RateLimit-Remaining': String(rlRemaining),
      },
    });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return err('INVALID_REQUEST', 'Expected multipart/form-data');
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return err('MISSING_FIELD', 'file field is required');
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return err('FILE_TOO_LARGE', `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, 413);
  }

  // Validate file extension
  const ext = getExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return err('UNSUPPORTED_TYPE', `Unsupported file type: ${ext}. Supported: txt, csv, pdf, xlsx`, 415);
  }

  const name = (formData.get('name') as string | null) ?? file.name;
  const docId = generateDocId();

  // Parse chunking options from form data
  const chunkingMethod = (formData.get('chunkingMethod') as ChunkingMethod | null) ?? 'recursive';
  let chunkingOptions: ChunkingOptions | undefined;
  const chunkingOptionsRaw = formData.get('chunkingOptions') as string | null;
  if (chunkingOptionsRaw) {
    try {
      chunkingOptions = JSON.parse(chunkingOptionsRaw) as ChunkingOptions;
    } catch {
      return Response.json({ error: 'Invalid chunkingOptions JSON' }, { status: 400 });
    }
  } else {
    chunkingOptions = { method: chunkingMethod };
  }

  try {
    // Extract text from the file
    const text = await extractText(file);

    if (!text.trim()) {
      return err('EMPTY_FILE', 'File appears to be empty or unreadable', 422);
    }

    // Run RAG ingestion pipeline: chunk → embed → store
    const chunkCount = await ingestDocument(text, docId, name, chunkingOptions);

    const response: UploadResponse = {
      id: docId,
      name,
      type: ext.slice(1), // Remove leading dot
      chunks: chunkCount,
      chunkingMethod: chunkingOptions?.method ?? 'recursive',
      status: 'processed',
      createdAt: new Date().toISOString(),
    };

    // bkend.ai 메타데이터 저장 (설정된 경우)
    if (isBkendConfigured()) {
      try {
        await documentsDb.create({
          id: docId,
          name,
          fileName: file.name,
          fileType: ext.slice(1),
          fileSize: file.size,
          chunks: chunkCount,
          status: 'processed',
        });
      } catch (dbErr) {
        // DB 저장 실패는 업로드 자체를 실패시키지 않음 — 로그만 기록
        log.error({ err: dbErr }, 'bkend.ai 저장 실패');
      }
    }

    return created(response);
  } catch (e) {
    log.error({ err: e }, 'Failed to process document');
    return err('INTERNAL_ERROR', 'Failed to process document', 500);
  }
}
