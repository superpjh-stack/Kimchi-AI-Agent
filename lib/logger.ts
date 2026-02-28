// S4-1: 구조화 로거 — pino (개발: pino-pretty, 프로덕션: JSON)
import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
  level: LOG_LEVEL,
  browser: { disabled: true },
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    },
  }),
  base: { service: 'kimchi-agent', env: process.env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createLogger(module: string) {
  return logger.child({ module });
}
