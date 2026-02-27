'use client';
// E4: 발효실 공정 현황 패널
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

  // 발효 진행률
  const totalHours = data ? data.fermentationHours + data.estimatedCompletion : 0;
  const progressPct = totalHours > 0 ? Math.min(100, (data!.fermentationHours / totalHours) * 100) : 0;

  const panelBorder = hasCritical
    ? 'border-red-200 bg-red-50/30'
    : hasWarning
    ? 'border-yellow-200 bg-yellow-50/30'
    : 'border-gray-200 bg-white';

  return (
    <div className={`border-b ${panelBorder} transition-colors`}>
      {/* 헤더 (항상 표시) */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className={hasCritical ? 'text-kimchi-red animate-pulse' : hasWarning ? 'text-yellow-500' : 'text-kimchi-green'} />
          <span className="text-xs font-semibold text-gray-700">
            공정 현황
            {data && (
              <span className="ml-1.5 font-normal text-gray-400">{data.batchId}</span>
            )}
          </span>
          {hasCritical && (
            <span className="text-xs font-bold text-kimchi-red animate-pulse">⚠ 위험</span>
          )}
          {!hasCritical && hasWarning && (
            <span className="text-xs font-semibold text-yellow-600">⚠ 경고</span>
          )}
        </div>
        {collapsed ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
      </button>

      {/* 본문 */}
      {!collapsed && (
        <div className="px-4 pb-3">
          {loading && (
            <p className="text-xs text-gray-400 py-2">센서 데이터 로딩 중...</p>
          )}
          {error && (
            <p className="text-xs text-red-500 py-2">{error}</p>
          )}
          {data && !loading && (
            <>
              {/* 센서 카드 2×2 그리드 */}
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

              {/* 발효 진행률 */}
              <div className="mt-1.5">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>발효 {Math.round(data.fermentationHours)}h 경과</span>
                  <span>완료까지 ~{Math.round(data.estimatedCompletion)}h</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-kimchi-green rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-right text-xs text-gray-400 mt-0.5">{Math.round(progressPct)}%</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
