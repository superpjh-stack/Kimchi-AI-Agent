// B11: POST /api/documents/upload — 문서 업로드 + RAG 처리 (S1 보안 강화)
import { ingestDocument } from '@/lib/rag/pipeline';
import { created, err } from '@/lib/utils/api-response';
import { isBkendConfigured, documentsDb } from '@/lib/db/bkend';
import { createLogger } from '@/lib/logger';
import { uploadLimiter } from '@/lib/middleware/rate-limit';
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';
import { validateUploadedFile, toUint8Array } from '@/lib/security/file-validator';
import { sanitizeFilename } from '@/lib/security/input-sanitizer';
import { logAudit } from '@/lib/auth/audit-logger';
import type { UploadResponse, ChunkingMethod, ChunkingOptions } from '@/types';

const log = createLogger('api.documents.upload');

export const runtime = 'nodejs';

function generateDocId(): string {
  return `doc_${crypto.randomUUID()}`;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

/**
 * Extract plain text from an uploaded file.
 * Supports: TXT, CSV (native), PDF (pdf-parse), XLSX (exceljs — replaces vulnerable xlsx pkg)
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
    // S1: exceljs로 교체 (xlsx 패키지의 Prototype Pollution CVE 해결)
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = Buffer.from(await file.arrayBuffer()) as any;
    await workbook.xlsx.load(buffer);
    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      const rows: string[] = [];
      sheet.eachRow((row) => {
        const cells = (row.values as (string | number | boolean | null | undefined)[])
          .slice(1)  // exceljs row.values는 1-indexed
          .map((v) => (v == null ? '' : String(v)));
        rows.push(cells.join(','));
      });
      if (rows.length) lines.push(`[시트: ${sheet.name}]\n${rows.join('\n')}`);
    });
    return lines.join('\n\n');
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

async function uploadHandler(req: AuthRequest): Promise<Response> {
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

  // S1: Magic bytes 기반 파일 검증 (MIME 스푸핑 방지)
  const rawBuffer = await file.arrayBuffer();
  const uint8 = toUint8Array(rawBuffer);
  const validation = await validateUploadedFile(file, uint8);
  if (!validation.valid) {
    log.warn({ filename: file.name, reason: validation.error }, 'File validation failed');
    return err('INVALID_FILE', validation.error ?? 'File validation failed', 415);
  }

  // S1: 파일명 정제
  const safeName = sanitizeFilename(
    (formData.get('name') as string | null) ?? file.name
  );
  const docId = generateDocId();
  const ext = getExtension(file.name);

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
    // File 재구성 (이미 읽었으므로 Buffer 사용)
    const fileForExtract = new File([rawBuffer], file.name, { type: file.type });
    const text = await extractText(fileForExtract);

    if (!text.trim()) {
      return err('EMPTY_FILE', 'File appears to be empty or unreadable', 422);
    }

    // Run RAG ingestion pipeline: chunk → embed → store
    const chunkCount = await ingestDocument(text, docId, safeName, chunkingOptions);

    const response: UploadResponse = {
      id: docId,
      name: safeName,
      type: ext.slice(1),
      chunks: chunkCount,
      chunkingMethod: chunkingOptions?.method ?? 'recursive',
      status: 'processed',
      createdAt: new Date().toISOString(),
    };

    // S1: 감사 로그
    logAudit({
      action: 'document.upload',
      actorEmail: req.user.sub,
      actorRole: req.user.role,
      resourceType: 'document',
      resourceId: docId,
      metadata: { filename: file.name, size: file.size, chunks: chunkCount },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
    });

    // bkend.ai 메타데이터 저장 (설정된 경우)
    if (isBkendConfigured()) {
      try {
        await documentsDb.create({
          id: docId,
          name: safeName,
          fileName: file.name,
          fileType: ext.slice(1),
          fileSize: file.size,
          chunks: chunkCount,
          status: 'processed',
        });
      } catch (dbErr) {
        log.error({ err: dbErr }, 'bkend.ai 저장 실패');
      }
    }

    return created(response);
  } catch (e) {
    log.error({ err: e }, 'Failed to process document');
    return err('INTERNAL_ERROR', 'Failed to process document', 500);
  }
}

export const POST = withAuth(uploadHandler, { permissions: ['upload:write'] });
