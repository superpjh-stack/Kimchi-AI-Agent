'use client';

import { useMlPrediction } from '@/hooks/useMlPrediction';
import type { SensorData } from '@/lib/process/sensor-client';

const GRADE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  A: { bg: 'bg-kimchi-green/10', text: 'text-kimchi-green', label: '최우수 (A)' },
  B: { bg: 'bg-kimchi-orange/10', text: 'text-kimchi-orange', label: '우수 (B)' },
  C: { bg: 'bg-red-50', text: 'text-red-600', label: '보통 (C)' },
};

const STAGE_LABEL: Record<string, string> = {
  early: '초기 발효',
  mid: '중간 발효',
  late: '후기 발효',
  complete: '발효 완료',
};

interface Props {
  sensors: SensorData | null;
}

export default function MLPredictionWidget({ sensors }: Props) {
  const { fermentation, quality, isLoading, error } = useMlPrediction(sensors);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-base">🤖</span>
        <h3 className="text-sm font-semibold text-gray-700">AI 예측</h3>
        {isLoading && (
          <span className="ml-auto text-xs text-gray-400 animate-pulse">분석 중...</span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {/* 발효 진행률 */}
      {fermentation && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">{STAGE_LABEL[fermentation.stage] ?? fermentation.stage}</span>
            <span className="text-xs font-semibold text-kimchi-red">{fermentation.fermentationPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${fermentation.fermentationPct}%`,
                background: fermentation.fermentationPct >= 100
                  ? '#2A9D8F'
                  : fermentation.fermentationPct >= 60
                  ? '#F77F00'
                  : '#D62828',
              }}
            />
          </div>
          {fermentation.anomaly && (
            <p className="text-xs text-red-600 mt-1">⚠️ {fermentation.anomalyReason}</p>
          )}
        </div>
      )}

      {/* 품질 등급 */}
      {quality && (() => {
        const style = GRADE_STYLE[quality.grade] ?? GRADE_STYLE['C'];
        return (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${style.bg}`}>
            <span className={`text-lg font-bold ${style.text}`}>{quality.grade}</span>
            <div className="min-w-0">
              <p className={`text-xs font-medium ${style.text}`}>{style.label}</p>
              <p className="text-xs text-gray-500 truncate">{quality.rationale}</p>
            </div>
            <span className="ml-auto text-xs text-gray-400">{Math.round(quality.confidence * 100)}%</span>
          </div>
        );
      })()}
    </div>
  );
}
