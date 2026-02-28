// lib/security/input-sanitizer.ts — 프롬프트 인젝션 및 XSS 입력 정제

/**
 * 프롬프트 인젝션 시도 패턴
 * 공격자가 시스템 프롬프트를 무력화하거나 역할을 바꾸려는 일반 패턴들
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /forget\s+(everything|all|your\s+instructions?)/i,
  /you\s+are\s+now\s+(a\s+)?(?!kimchi|assistant|AI)/i,  // role-switch 시도
  /act\s+as\s+(if\s+you\s+are\s+)?(a\s+)?(?!kimchi|assistant)/i,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/,   // Llama/ChatML injection
  /system\s*:\s*you\s+are/i,
  /###\s*instruction/i,
  /---\s*system\s*---/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,
];

/** XSS 위험 패턴 (채팅 렌더링 경로) */
const XSS_PATTERNS: RegExp[] = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,  // onclick=, onerror= 등
  /data\s*:\s*text\s*\/\s*html/i,
];

export interface SanitizeResult {
  safe: boolean;
  sanitized: string;
  warnings: string[];
}

/**
 * 사용자 채팅 입력을 정제한다.
 *
 * - 프롬프트 인젝션 패턴 탐지 (차단)
 * - XSS 패턴 탐지 (이스케이프)
 * - 길이 제한 적용
 * - 제어문자 제거
 */
export function sanitizeChatInput(input: string): SanitizeResult {
  const warnings: string[] = [];

  // 1. 길이 제한 (8000자)
  let sanitized = input.slice(0, 8000);
  if (input.length > 8000) {
    warnings.push('Input truncated to 8000 characters');
  }

  // 2. 제어문자 제거 (탭·줄바꿈 제외)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 3. 프롬프트 인젝션 탐지
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        safe: false,
        sanitized: '',
        warnings: [`Prompt injection pattern detected: ${pattern.source.slice(0, 40)}`],
      };
    }
  }

  // 4. XSS 패턴 이스케이프 (차단 대신 이스케이프 — 렌더러에서 이미 처리하지만 이중 방어)
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push('Potential XSS pattern escaped');
      sanitized = sanitized
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
      break;
    }
  }

  return { safe: true, sanitized: sanitized.trim(), warnings };
}

/**
 * 파일명을 안전하게 정제한다.
 * Path traversal 방지 및 특수문자 제거
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\:*?"<>|]/g, '_')   // Windows/Unix 위험 문자
    .replace(/\.\./g, '_')            // 경로 순회
    .replace(/^\./, '_')              // 숨김 파일
    .slice(0, 255);                   // 파일명 최대 길이
}

/**
 * 이메일을 기본 형식으로 검증한다 (입력 정제용, 완전한 검증은 아님).
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 254);
}
