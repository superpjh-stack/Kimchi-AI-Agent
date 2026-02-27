'use client';

import clsx from 'clsx';

interface Props {
  pct: number;       // 0.0–1.0
  stage: 'early' | 'mid' | 'late' | 'complete';
  confidence: number;
}

const STAGE_LABELS = { early: '초기', mid: '중기', late: '후기', complete: '완료' };
const STAGE_COLORS = {
  early: 'bg-blue-400',
  mid:   'bg-amber-400',
  late:  'bg-orange-500',
  complete: 'bg-kimchi-green',
};

export default function FermentationProgressBar({ pct, stage, confidence }: Props) {
  const pctDisplay = Math.round(pct * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">발효 진행도</span>
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-xs px-1.5 py-0.5 rounded-full font-medium',
            stage === 'complete'
              ? 'bg-kimchi-green/10 text-kimchi-green'
              : 'bg-amber-50 text-amber-700'
          )}>
            {STAGE_LABELS[stage]}
          </span>
          <span className="text-sm font-bold text-gray-800">{pctDisplay}%</span>
        </div>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', STAGE_COLORS[stage])}
          style={{ width: `${pctDisplay}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-0.5 text-right">
        신뢰도 {Math.round(confidence * 100)}%
      </p>
    </div>
  );
}
