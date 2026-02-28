'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { Experiment, ExperimentResult } from '@/lib/ml/ab-test';

interface ABTestWidgetProps {
  experimentId?: string;
  pollIntervalMs?: number;
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  paused:    'bg-amber-100 text-amber-700',
  completed: 'bg-gray-100 text-gray-600',
};

export const ABTestWidget = React.memo(function ABTestWidget({
  experimentId,
  pollIntervalMs = 30_000,
}: ABTestWidgetProps) {
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [results, setResults]       = useState<ExperimentResult[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // 활성 실험이 없는 경우 목록에서 첫 번째 active 실험 찾기
    const targetId = experimentId;
    if (!targetId) {
      try {
        const listRes = await fetch('/api/ml/experiments');
        if (!listRes.ok) { setLoading(false); return; }
        const { experiments } = await listRes.json() as { experiments: Experiment[] };
        const active = experiments.find((e) => e.status === 'active') ?? experiments[0] ?? null;
        if (!active) { setExperiment(null); setLoading(false); return; }
        setExperiment(active);
        const resRes = await fetch(`/api/ml/experiments/${active.id}/results`);
        if (resRes.ok) {
          const { results: r } = await resRes.json() as { results: ExperimentResult[] };
          setResults(r);
        }
      } catch {
        setError('데이터 로드 실패');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const [expRes, resRes] = await Promise.all([
        fetch(`/api/ml/experiments/${targetId}`),
        fetch(`/api/ml/experiments/${targetId}/results`),
      ]);
      if (!expRes.ok) { setError('실험을 찾을 수 없습니다'); setLoading(false); return; }
      setExperiment(await expRes.json());
      if (resRes.ok) {
        const { results: r } = await resRes.json() as { results: ExperimentResult[] };
        setResults(r);
      }
    } catch {
      setError('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, pollIntervalMs);
    return () => clearInterval(timer);
  }, [fetchData, pollIntervalMs]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-xs text-gray-400 animate-pulse">ML A/B 실험 로딩 중...</p>
      </div>
    );
  }

  if (error || !experiment) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-base">🧪</span>
          <h3 className="text-sm font-semibold text-gray-700">ML A/B 테스트</h3>
        </div>
        <p className="text-xs text-gray-400">
          {error ?? '진행 중인 실험이 없습니다'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🧪</span>
          <h3 className="text-sm font-semibold text-gray-700">ML A/B 테스트</h3>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[experiment.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {experiment.status}
        </span>
      </div>

      {/* 실험 이름 */}
      <p className="text-xs font-medium text-gray-800 mb-1">{experiment.name}</p>
      {experiment.description && (
        <p className="text-[11px] text-gray-500 mb-3">{experiment.description}</p>
      )}

      {/* Variant별 결과 */}
      <div className="space-y-2.5">
        {experiment.variants.map((variant) => {
          const result = results.find((r) => r.variantId === variant.id);
          const confidence = result ? (result.avgConfidence * 100).toFixed(1) : '—';
          const anomaly    = result ? (result.anomalyRate  * 100).toFixed(1) : '—';
          const total      = result?.totalPredictions ?? 0;

          return (
            <div key={variant.id}>
              {/* Variant 이름 + 트래픽 */}
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[11px] font-medium text-gray-700">{variant.name}</span>
                <span className="text-[10px] text-gray-400">{variant.trafficPercent}%</span>
              </div>
              {/* 트래픽 바 */}
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                <div
                  className="h-1.5 rounded-full bg-indigo-400"
                  style={{ width: `${variant.trafficPercent}%` }}
                  aria-label={`Traffic ${variant.trafficPercent}%`}
                />
              </div>
              {/* 신뢰도 / 이상률 / 예측 수 */}
              <div className="flex gap-3 text-[10px] text-gray-500">
                <span>신뢰도 <span className="font-medium text-gray-700">{confidence}%</span></span>
                <span>이상률 <span className="font-medium text-gray-700">{anomaly}%</span></span>
                <span>예측 <span className="font-medium text-gray-700">{total.toLocaleString()}</span>건</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
