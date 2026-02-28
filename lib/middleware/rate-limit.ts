// S4-3: 요청 속도 제한 미들웨어 — 슬라이딩 윈도우 알고리즘
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      windowMs: 60_000,
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10),
      ...config,
    };
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
}

export const chatLimiter = new RateLimiter({ maxRequests: 20, windowMs: 60_000 });
export const uploadLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });
export const mlLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000 });
