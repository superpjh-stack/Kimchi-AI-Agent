// Phase 3: 인메모리 알림 저장소 — Alert.acknowledged 지원

import type { Alert } from './alert-rules';

export interface StoredAlert extends Alert {
  acknowledged: boolean;
  acknowledgedAt: string | null;
}

// In-memory alert store (resets on restart — Phase 3 pgvector 전환 시 영속화)
const alertStore = new Map<string, StoredAlert>();

/** 알림 저장 (checkAlerts 결과를 저장) */
export function storeAlerts(alerts: Alert[]): StoredAlert[] {
  const stored: StoredAlert[] = [];
  for (const alert of alerts) {
    const entry: StoredAlert = {
      ...alert,
      acknowledged: false,
      acknowledgedAt: null,
    };
    alertStore.set(alert.id, entry);
    stored.push(entry);
  }
  return stored;
}

/** ID로 알림 조회 */
export function getAlert(id: string): StoredAlert | undefined {
  return alertStore.get(id);
}

/** 알림 확인 처리 */
export function acknowledgeAlert(id: string, acknowledged: boolean): StoredAlert | undefined {
  const alert = alertStore.get(id);
  if (!alert) return undefined;

  alert.acknowledged = acknowledged;
  alert.acknowledgedAt = acknowledged ? new Date().toISOString() : null;
  alertStore.set(id, alert);
  return alert;
}

/** 모든 알림 조회 (최신순) */
export function getAllAlerts(): StoredAlert[] {
  return [...alertStore.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** 미확인 알림 수 */
export function getUnacknowledgedCount(): number {
  let count = 0;
  for (const alert of alertStore.values()) {
    if (!alert.acknowledged) count++;
  }
  return count;
}
