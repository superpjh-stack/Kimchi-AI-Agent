// __tests__/lib/security/file-validator.test.ts — 파일 검증 단위 테스트
import { validateUploadedFile, toUint8Array } from '@/lib/security/file-validator';

/** 테스트용 File 생성 헬퍼 */
function makeFile(name: string, type: string, size = 100): File {
  return { name, type, size } as unknown as File;
}

/** Magic bytes를 가진 Uint8Array 생성 */
function pdfBytes(): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
}

function xlsxBytes(): Uint8Array {
  return new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]); // PK (ZIP)
}

function wrongBytes(): Uint8Array {
  return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]); // JPEG
}

const EMPTY_BYTES = new Uint8Array(8);

describe('validateUploadedFile — PDF', () => {
  test('유효한 PDF → valid', async () => {
    const file = makeFile('report.pdf', 'application/pdf');
    const result = await validateUploadedFile(file, pdfBytes());
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe('application/pdf');
  });

  test('PDF 파일에 JPEG magic bytes → 무효', async () => {
    const file = makeFile('fake.pdf', 'application/pdf');
    const result = await validateUploadedFile(file, wrongBytes());
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('허용되지 않는 확장자 → 무효', async () => {
    const file = makeFile('malware.exe', 'application/octet-stream');
    const result = await validateUploadedFile(file, new Uint8Array(8));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Extension not allowed');
  });
});

describe('validateUploadedFile — XLSX', () => {
  test('유효한 XLSX (ZIP magic bytes) → valid', async () => {
    const file = makeFile('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const result = await validateUploadedFile(file, xlsxBytes());
    expect(result.valid).toBe(true);
  });

  test('XLSX에 PDF magic bytes → 무효', async () => {
    const file = makeFile('fake.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const result = await validateUploadedFile(file, pdfBytes());
    expect(result.valid).toBe(false);
  });
});

describe('validateUploadedFile — 텍스트 파일', () => {
  test('TXT 파일 — declared MIME text/plain → valid', async () => {
    const file = makeFile('readme.txt', 'text/plain');
    const result = await validateUploadedFile(file, EMPTY_BYTES);
    expect(result.valid).toBe(true);
  });

  test('CSV 파일 — declared MIME text/csv → valid', async () => {
    const file = makeFile('data.csv', 'text/csv');
    const result = await validateUploadedFile(file, EMPTY_BYTES);
    expect(result.valid).toBe(true);
  });

  test('TXT 파일 — MIME application/json → 무효', async () => {
    const file = makeFile('hack.txt', 'application/json');
    const result = await validateUploadedFile(file, EMPTY_BYTES);
    expect(result.valid).toBe(false);
  });
});

describe('validateUploadedFile — 파일 크기', () => {
  test('10MB 초과 → 무효', async () => {
    const bigFile = makeFile('big.pdf', 'application/pdf', 11 * 1024 * 1024);
    const result = await validateUploadedFile(bigFile, pdfBytes());
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });

  test('정확히 10MB → valid', async () => {
    const exactFile = makeFile('exact.pdf', 'application/pdf', 10 * 1024 * 1024);
    const result = await validateUploadedFile(exactFile, pdfBytes());
    expect(result.valid).toBe(true);
  });
});

describe('toUint8Array', () => {
  test('ArrayBuffer → Uint8Array 변환', () => {
    const ab = new ArrayBuffer(4);
    const view = new DataView(ab);
    view.setUint8(0, 0x25);
    view.setUint8(1, 0x50);

    const result = toUint8Array(ab);
    expect(result[0]).toBe(0x25);
    expect(result[1]).toBe(0x50);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
