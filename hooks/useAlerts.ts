'use client';
// E2: 알림 SSE 수신 훅
import { useState, useEffect } from 'react';
import type { Alert } from '@/lib/process/alert-rules';

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/alerts/stream');

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'alerts') {
          setAlerts(payload.alerts);
        } else if (payload.type === 'heartbeat') {
          setAlerts([]);
        }
      } catch {
        // JSON 파싱 실패 무시
      }
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  const acknowledgeAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledged: true }),
    });
  };

  return { alerts, criticalCount, warningCount, connected, acknowledgeAlert };
}
