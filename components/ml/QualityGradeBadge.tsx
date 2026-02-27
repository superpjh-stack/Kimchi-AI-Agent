'use client';

import clsx from 'clsx';

interface Props {
  grade: 'A' | 'B' | 'C';
  confidence: number;
}

const GRADE_STYLES = {
  A: 'bg-kimchi-green/10 text-kimchi-green border-kimchi-green/30',
  B: 'bg-amber-50 text-amber-700 border-amber-200',
  C: 'bg-red-50 text-red-700 border-red-200',
};

const GRADE_LABELS = { A: '최상', B: '양호', C: '주의' };

export default function QualityGradeBadge({ grade, confidence }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">품질 등급</span>
      <span className={clsx(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-sm font-bold',
        GRADE_STYLES[grade]
      )}>
        {grade}등급
        <span className="text-xs font-normal opacity-75">{GRADE_LABELS[grade]}</span>
      </span>
      <span className="text-xs text-gray-400">({Math.round(confidence * 100)}%)</span>
    </div>
  );
}
