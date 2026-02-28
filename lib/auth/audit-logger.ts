// lib/auth/audit-logger.ts — 중요 작업 감사 로깅
import { createLogger } from '@/lib/logger';

const auditLog = createLogger('audit');

export interface AuditEvent {
  action: string;
  actorEmail: string;
  actorRole: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export function logAudit(event: AuditEvent): void {
  auditLog.info(
    { ...event, type: 'audit', timestamp: new Date().toISOString() },
    `AUDIT: ${event.action} by ${event.actorEmail}`
  );
}
