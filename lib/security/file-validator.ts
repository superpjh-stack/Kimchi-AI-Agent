// lib/security/file-validator.ts — Magic bytes 기반 파일 MIME 검증
// MIME 스푸핑 방지: 확장자 위조 공격 차단

export interface FileValidationResult {
  valid: boolean;
  detectedMime?: string;
  error?: string;
}

/** 허용 MIME 타입 → magic bytes (hex prefix) 매핑 */
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  'text/plain': [
    new Uint8Array([0xEF, 0xBB, 0xBF]),  // UTF-8 BOM
    // 텍스트는 별도 Content-Type 검사로 처리 (magic byte 없음)
  ],
  'text/csv': [],  // 텍스트 계열 — extension + content fallback
  'application/pdf': [
    new Uint8Array([0x25, 0x50, 0x44, 0x46]),  // %PDF
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    new Uint8Array([0x50, 0x4B, 0x03, 0x04]),  // PK (ZIP-based OOXML)
    new Uint8Array([0x50, 0x4B, 0x05, 0x06]),  // PK empty ZIP
  ],
  'application/vnd.ms-excel': [
    new Uint8Array([0xD0, 0xCF, 0x11, 0xE0]),  // OLE2 compound doc (XLS)
  ],
};

/** 허용 확장자 → MIME 매핑 */
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  '.txt':  ['text/plain'],
  '.csv':  ['text/csv', 'text/plain'],
  '.pdf':  ['application/pdf'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function startsWith(buffer: Uint8Array, magic: Uint8Array): boolean {
  if (buffer.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false;
  }
  return true;
}

function detectMimeFromBytes(buffer: Uint8Array): string | null {
  for (const [mime, magics] of Object.entries(MAGIC_BYTES)) {
    for (const magic of magics) {
      if (magic.length > 0 && startsWith(buffer, magic)) {
        return mime;
      }
    }
  }
  return null;
}

/**
 * 업로드된 파일의 MIME 타입과 크기를 검증한다.
 *
 * @param file    - File 객체 (Web API)
 * @param buffer  - 파일 raw bytes (첫 8바이트 이상 필요)
 */
export async function validateUploadedFile(
  file: File,
  buffer: Uint8Array
): Promise<FileValidationResult> {
  // 1. 파일 크기 검사
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large: max ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  // 2. 확장자 추출 및 허용 목록 검사
  const ext = ('.' + file.name.split('.').pop()?.toLowerCase()) as string;
  const allowedMimes = ALLOWED_EXTENSIONS[ext];
  if (!allowedMimes) {
    return { valid: false, error: `Extension not allowed: ${ext}` };
  }

  // 3. Magic bytes 검사 (텍스트 계열 제외)
  const detected = detectMimeFromBytes(buffer);

  if (ext === '.txt' || ext === '.csv') {
    // 텍스트 파일은 magic byte로 식별 어려움 → declared MIME만 검사
    const declared = file.type || 'text/plain';
    const isSafe = allowedMimes.some((m) => declared.startsWith(m)) || declared.startsWith('text/');
    if (!isSafe) {
      return { valid: false, detectedMime: declared, error: `MIME mismatch for ${ext}: ${declared}` };
    }
    return { valid: true, detectedMime: declared };
  }

  if (!detected) {
    // magic byte 필수인데 미검출 → 위조 의심
    return {
      valid: false,
      error: `Could not verify file signature for ${ext}`,
    };
  }

  if (!allowedMimes.includes(detected)) {
    return {
      valid: false,
      detectedMime: detected,
      error: `MIME mismatch: declared ${file.type}, detected ${detected}`,
    };
  }

  return { valid: true, detectedMime: detected };
}

/**
 * ArrayBuffer → Uint8Array 변환 헬퍼
 * Next.js API route에서 file.arrayBuffer()로 받은 버퍼를 전달한다.
 */
export function toUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}
