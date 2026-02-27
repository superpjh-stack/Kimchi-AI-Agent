// 시작 시 환경변수 유효성 검사 모듈
// Next.js 서버 컴포넌트/라우트에서 필요 시 호출

interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateEnv(): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 필수: 최소 하나의 LLM API 키
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    errors.push('ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 중 하나는 필수입니다.');
  }

  // EMBEDDING_PROVIDER별 의존성 확인
  const embeddingProvider = process.env.EMBEDDING_PROVIDER;
  if (embeddingProvider === 'openai' && !process.env.OPENAI_API_KEY) {
    errors.push('EMBEDDING_PROVIDER=openai 설정 시 OPENAI_API_KEY가 필요합니다.');
  }
  if (embeddingProvider === 'local') {
    if (!process.env.OLLAMA_BASE_URL && !process.env.OLLAMA_URL) {
      warnings.push('EMBEDDING_PROVIDER=local 설정 시 OLLAMA_BASE_URL 권장.');
    }
  }

  // DATABASE_URL 형식 확인
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    warnings.push('DATABASE_URL이 postgresql:// 또는 postgres://로 시작하지 않습니다.');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// 개발 환경에서만 경고 출력
export function warnEnvIssues(): void {
  if (process.env.NODE_ENV === 'production') return;
  const result = validateEnv();
  for (const warn of result.warnings) {
    console.warn(`[env] ⚠️  ${warn}`);
  }
  for (const error of result.errors) {
    console.error(`[env] ❌ ${error}`);
  }
}
