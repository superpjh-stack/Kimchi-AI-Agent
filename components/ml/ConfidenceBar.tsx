'use client';
import React from 'react';

interface ConfidenceBarProps {
  value: number;       // 0.0 ~ 1.0
  threshold?: number;  // 기본 0.6
  label?: string;
  size?: 'sm' | 'md';
}

export default React.memo(function ConfidenceBar({
  value,
  threshold = 0.6,
  label = '예측 신뢰도',
  size = 'md',
}: ConfidenceBarProps) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.8 ? 'bg-green-500' : value >= threshold ? 'bg-amber-500' : 'bg-red-500';
  const isLow = value < threshold;

  return (
    <div className={size === 'sm' ? 'text-xs' : 'text-sm'}>
      <div className="flex justify-between mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={isLow ? 'text-red-500 font-semibold' : 'text-gray-700'}>{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 bg-gray-200 rounded-full overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isLow && (
        <p className="mt-1 text-xs text-red-500">
          신뢰도가 낮습니다. 결과를 참고용으로만 활용하세요.
        </p>
      )}
    </div>
  );
});
