'use client';

import { useProcessData } from '@/hooks/useProcessData';
import { useSensorHistory } from '@/hooks/useSensorHistory';
import ProcessStatusPanel from '@/components/process/ProcessStatusPanel';
import MLPredictionWidget from './MLPredictionWidget';
import SensorChart from './SensorChart';
import { ABTestWidget } from '@/components/ml/ABTestWidget';

const CHARTS = [
  {
    key: 'temperature' as const,
    label: '온도',
    unit: '°C',
    color: '#D62828',
    domain: [10, 30] as [number, number],
  },
  {
    key: 'humidity' as const,
    label: '습도',
    unit: '%',
    color: '#2A9D8F',
    domain: [60, 95] as [number, number],
  },
  {
    key: 'salinity' as const,
    label: '염도',
    unit: '%',
    color: '#F77F00',
    domain: [1, 4] as [number, number],
  },
  {
    key: 'ph' as const,
    label: 'pH',
    unit: '',
    color: '#6366f1',
    domain: [3, 7] as [number, number],
  },
];

export default function DashboardPanel() {
  const { data: sensors } = useProcessData();
  const { readings, loading: histLoading } = useSensorHistory(1);

  return (
    <div className="h-full overflow-y-auto bg-kimchi-cream">
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {/* 상단: 공정 현황 + AI 예측 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProcessStatusPanel />
          <MLPredictionWidget sensors={sensors} />
        </div>

        {/* ML A/B 테스트 위젯 (Sprint 3) */}
        <ABTestWidget />

        {/* 베타 만족도 위젯 (FR-06) */}
        <div className="bg-white rounded-lg border border-brand-border p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-base">⭐</span>
            <h3 className="text-sm font-semibold text-brand-text-secondary">베타 피드백</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-brand-text-muted">현재 만족도</span>
            <div className="flex items-center gap-0.5" aria-label="만족도 4점 (5점 만점)">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={star <= 4 ? 'text-amber-400 text-lg' : 'text-brand-border text-lg'}
                  aria-hidden="true"
                >
                  ★
                </span>
              ))}
            </div>
            <span className="text-xs font-medium text-brand-text-secondary">4.0 / 5.0</span>
          </div>
        </div>

        {/* 하단: 센서 시계열 차트 4개 */}
        <div className="bg-white rounded-lg border border-brand-border p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-base">📈</span>
            <h3 className="text-sm font-semibold text-brand-text-secondary">센서 이력 (최근 1시간)</h3>
            {histLoading && (
              <span className="ml-auto text-xs text-brand-text-muted animate-pulse">로딩 중...</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CHARTS.map(({ key, label, unit, color, domain }) => (
              <div key={key}>
                <p className="text-xs font-medium text-brand-text-muted mb-1">
                  {label}
                  {unit ? ` (${unit})` : ''}
                </p>
                <div className="h-32">
                  <SensorChart
                    readings={readings}
                    dataKey={key}
                    label={label}
                    unit={unit}
                    color={color}
                    domain={domain}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
