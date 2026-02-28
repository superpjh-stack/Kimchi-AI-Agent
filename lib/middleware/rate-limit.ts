// S4-3: 요청 속도 제한 미들웨어 — 슬라이딩 윈도우 알고리즘
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  /** TTL 정리 주기 (ms). 0이면 자동 정리 비활성화. 기본 5분. */
  cleanupIntervalMs?: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly config: Required<RateLimitConfig>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      windowMs: 60_000,
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10),
      cleanupIntervalMs: 5 * 60_000, // FR-07b: 기본 5분마다 만료 항목 정리
      ...config,
    };
    this.startCleanup();
  }

  /** FR-07b: 주기적 TTL 만료 항목 정리 — 메모리 누수 방지 */
  private startCleanup(): void {
    const intervalMs = this.config.cleanupIntervalMs;
    if (intervalMs <= 0) return;

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.config.windowMs;
      for (const [key, entry] of this.store.entries()) {
        // 윈도우 밖 타임스탬프 제거
        entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
        // 타임스탬프가 없으면 엔트리 전체 삭제
        if (entry.timestamps.length === 0) {
          this.store.delete(key);
        }
      }
    }, intervalMs);

    // Node.js에서 setInterval이 프로세스 종료를 막지 않도록 unref
    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  /** 정리 타이머 중지 (테스트 등에서 사용) */
  stopCleanup(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    let entry = this.store.get(key);
    if (!entry) { entry = { timestamps: [] }; this.store.set(key, entry); }
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
    const allowed = entry.timestamps.length < this.config.maxRequests;
    if (allowed) entry.timestamps.push(now);
    const remaining = Math.max(0, this.config.maxRequests - entry.timestamps.length);
    const resetAt = entry.timestamps.length > 0
      ? entry.timestamps[0] + this.config.windowMs
      : now + this.config.windowMs;
    return { allowed, remaining, resetAt };
  }

  /** 현재 저장된 엔트리 수 (테스트/모니터링용) */
  get storeSize(): number {
    return this.store.size;
  }
}

export const chatLimiter          = new RateLimiter({ maxRequests: 20,  windowMs: 60_000 });
export const uploadLimiter        = new RateLimiter({ maxRequests: 10,  windowMs: 60_000 });
export const mlLimiter            = new RateLimiter({ maxRequests: 30,  windowMs: 60_000 });
// FR-07c: 대화 API 전용 Rate Limiter
export const conversationsLimiter = new RateLimiter({ maxRequests: 60,  windowMs: 60_000 });
// FR-07d: SSE 알림 스트림 Rate Limiter (연결 수 제한 별도 처리)
export const alertsLimiter        = new RateLimiter({ maxRequests: 10,  windowMs: 60_000 });
