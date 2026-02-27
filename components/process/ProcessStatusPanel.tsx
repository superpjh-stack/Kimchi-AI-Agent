'use client';
// E4: fermentation process status panel
import { useState } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import SensorCard from './SensorCard';
import type { SensorStatus } from './SensorCard';
import { useProcessData } from '@/hooks/useProcessData';
import { useAlerts } from '@/hooks/useAlerts';
import type { AlertType } from '@/lib/process/alert-rules';

function getStatus(type: AlertType, alerts: { type: AlertType; severity: 'warning' | 'critical' }[]): SensorStatus {
  const alert = alerts.find((a) => a.type === type);
  if (!alert) return 'normal';
  return alert.severity;
}

export default function ProcessStatusPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const { data, loading, error } = useProcessData(30_000);
  const { alerts } = useAlerts();

  const hasCritical = alerts.some((a) => a.severity === 'critical');
  const hasWarning  = alerts.some((a) => a.severity === 'warning');

  // fermentation progress
  const totalHours = data ? data.fermentationHours + data.estimatedCompletion : 0;
  const progressPct = totalHours > 0 ? Math.min(100, (data!.fermentationHours / totalHours) * 100) : 0;

  const panelBorder = hasCritical
    ? 'border-kimchi-red/20 bg-kimchi-red/5'
    : hasWarning
    ? 'border-kimchi-orange/20 bg-kimchi-orange/5'
    : 'border-kimchi-beige bg-white';

  return (
    <div className={`border-b ${panelBorder} transition-colors`}>
      {/* Header (always visible) */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className={hasCritical ? 'text-kimchi-red animate-pulse' : hasWarning ? 'text-kimchi-orange' : 'text-kimchi-green'} />
          <span className="text-xs font-semibold text-brand-text-primary">
            🏭 공정 현황
            {data && (
              <span className="ml-1.5 font-normal text-brand-text-muted">{data.batchId}</span>
            )}
          </span>
          {hasCritical && (
            <span className="text-xs font-bold text-kimchi-red animate-pulse">⚠ 위험</span>
          )}
          {!hasCritical && hasWarning && (
            <span className="text-xs font-semibold text-kimchi-orange">⚠ 경고</span>
          )}
        </div>
        {collapsed ? <ChevronDown size={14} className="text-brand-text-muted" /> : <ChevronUp size={14} className="text-brand-text-muted" />}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-3">
          {loading && (
            <p className="text-xs text-brand-text-muted py-2">센서 데이터 로딩 중...</p>
          )}
          {error && (
            <p className="text-xs text-kimchi-red py-2">{error}</p>
          )}
          {data && !loading && (
            <>
              {/* Sensor cards 2x2 grid */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <SensorCard
                  icon="🌡️"
                  label="온도"
                  value={data.temperature.toFixed(1)}
                  unit="°C"
                  status={getStatus('temperature', alerts)}
                />
                <SensorCard
                  icon="💧"
                  label="습도"
                  value={data.humidity.toFixed(1)}
                  unit="%"
                  status={getStatus('humidity', alerts)}
                />
                <SensorCard
                  icon="🧂"
                  label="염도"
                  value={data.salinity.toFixed(2)}
                  unit="%"
                  status={getStatus('salinity', alerts)}
                />
                <SensorCard
                  icon="🧪"
                  label="pH"
                  value={data.ph.toFixed(2)}
                  unit=""
                  status={getStatus('ph', alerts)}
                />
              </div>

              {/* Fermentation progress */}
              <div className="mt-1.5">
                <div className="flex justify-between text-xs text-brand-text-secondary mb-1">
                  <span>발효 {Math.round(data.fermentationHours)}h 경과</span>
                  <span>완료까지 ~{Math.round(data.estimatedCompletion)}h</span>
                </div>
                <div className="w-full h-1.5 bg-kimchi-beige rounded-full overflow-hidden">
                  <div
                    className="h-full bg-kimchi-green rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-right text-xs text-brand-text-muted mt-0.5">{Math.round(progressPct)}%</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
