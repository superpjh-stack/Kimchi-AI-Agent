'use client';

import { useMlPrediction } from '@/hooks/useMlPrediction';
import FermentationProgressBar from './FermentationProgressBar';
import QualityGradeBadge from './QualityGradeBadge';
import type { SensorData } from '@/lib/process/sensor-client';

interface Props {
  sensors: SensorData | null;
  refreshInterval?: number;
}

export default function MLPredictionPanel({ sensors, refreshInterval = 30_000 }: Props) {
  const { fermentation, quality, isLoading, error, lastUpdated, refresh } =
    useMlPrediction(sensors, refreshInterval);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🤖</span>
          <h3 className="text-sm font-semibold text-gray-700">ML 예측</h3>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
        >
          {isLoading ? '예측 중...' : '새로고침'}
        </button>
      </div>

      {/* 센서 없음 */}
      {!sensors && (
        <p className="text-xs text-gray-400 text-center py-4">센서 데이터를 불러오는 중...</p>
      )}

      {/* 오류 */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 mb-3">
          {error}
        </div>
      )}

      {/* 발효 예측 */}
      {fermentation && (
        <div className="mb-4">
          <FermentationProgressBar
            pct={fermentation.fermentationPct}
            stage={fermentation.stage}
            confidence={fermentation.confidence}
          />
          <p className="text-xs text-gray-500 mt-1.5">
            예상 완료:{' '}
            <span className="font-medium text-gray-700">
              {new Date(fermentation.eta).toLocaleString('ko-KR', {
                month: 'numeric', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </p>
          {fermentation.anomaly && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex gap-1.5">
              <span>⚠️</span>
              <span>{fermentation.anomalyReason}</span>
            </div>
          )}
        </div>
      )}

      {/* 품질 예측 */}
      {quality && (
        <div className="pt-3 border-t border-gray-100">
          <QualityGradeBadge grade={quality.grade} confidence={quality.confidence} />
          <p className="text-xs text-gray-500 mt-1.5">{quality.rationale}</p>
          {quality.recommendations.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {quality.recommendations.map((r, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                  <span className="text-amber-500 flex-shrink-0">→</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 마지막 업데이트 */}
      {lastUpdated && (
        <p className="text-xs text-gray-300 mt-3 text-right">
          {lastUpdated.toLocaleTimeString('ko-KR')} 업데이트
        </p>
      )}
    </div>
  );
}
