// D3: 임계값 기반 알림 규칙 엔진
import type { SensorData } from './sensor-client';

export type AlertType = 'temperature' | 'humidity' | 'salinity' | 'ph';
export type AlertSeverity = 'warning' | 'critical';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: { min: number; max: number };
  batchId: string;
  createdAt: string;
}

interface AlertRule {
  type: AlertType;
  field: keyof Pick<SensorData, 'temperature' | 'humidity' | 'salinity' | 'ph'>;
  min: number;
  max: number;
  warningBuffer: number; // 임계값 내측 경고 구간
  label: string;
  unit: string;
}

function getThresholds(): AlertRule[] {
  return [
    {
      type: 'temperature',
      field: 'temperature',
      min: parseFloat(process.env.ALERT_TEMP_MIN ?? '15'),
      max: parseFloat(process.env.ALERT_TEMP_MAX ?? '25'),
      warningBuffer: 2,
      label: '온도',
      unit: '°C',
    },
    {
      type: 'humidity',
      field: 'humidity',
      min: parseFloat(process.env.ALERT_HUMIDITY_MIN ?? '70'),
      max: parseFloat(process.env.ALERT_HUMIDITY_MAX ?? '90'),
      warningBuffer: 3,
      label: '습도',
      unit: '%',
    },
    {
      type: 'salinity',
      field: 'salinity',
      min: parseFloat(process.env.ALERT_SALINITY_MIN ?? '1.5'),
      max: parseFloat(process.env.ALERT_SALINITY_MAX ?? '3.0'),
      warningBuffer: 0.2,
      label: '염도',
      unit: '%',
    },
    {
      type: 'ph',
      field: 'ph',
      min: parseFloat(process.env.ALERT_PH_MIN ?? '4.0'),
      max: parseFloat(process.env.ALERT_PH_MAX ?? '5.5'),
      warningBuffer: 0.2,
      label: 'pH',
      unit: '',
    },
  ];
}

export function checkAlerts(data: SensorData): Alert[] {
  const alerts: Alert[] = [];

  for (const rule of getThresholds()) {
    const value = data[rule.field];
    let severity: AlertSeverity | null = null;

    if (value < rule.min || value > rule.max) {
      severity = 'critical';
    } else if (
      value < rule.min + rule.warningBuffer ||
      value > rule.max - rule.warningBuffer
    ) {
      severity = 'warning';
    }

    if (!severity) continue;

    const direction = value < rule.min ? '낮음' : '높음';
    const emoji = severity === 'critical' ? '🚨' : '⚠️';

    alerts.push({
      id: crypto.randomUUID(),
      type: rule.type,
      severity,
      message: `${emoji} ${rule.label} ${severity === 'critical' ? '위험' : '경고'}: 현재 ${value}${rule.unit} (${direction}, 정상 범위 ${rule.min}~${rule.max}${rule.unit})`,
      value,
      threshold: { min: rule.min, max: rule.max },
      batchId: data.batchId,
      createdAt: new Date().toISOString(),
    });
  }

  return alerts;
}

/** 알림을 채팅 메시지 텍스트로 변환 */
export function alertsToMessage(alerts: Alert[]): string {
  if (alerts.length === 0) return '';
  const lines = alerts.map((a) => `- ${a.message}`);
  return `## 공정 이상 감지\n\n${lines.join('\n')}\n\n즉시 확인이 필요합니다.`;
}
