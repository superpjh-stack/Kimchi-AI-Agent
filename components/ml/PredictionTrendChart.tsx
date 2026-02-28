'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PredictionRecord } from '@/lib/ml/prediction-history';

interface Props {
  type?: 'fermentation' | 'quality';
  hours?: number;
}

interface ChartPoint {
  time: string;
  confidence: number;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function PredictionTrendChart({ type = 'fermentation', hours = 24 }: Props) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/ml/history?type=${type}&hours=${hours}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: { records: PredictionRecord[]; count: number } = await res.json();
        if (!cancelled) {
          const points: ChartPoint[] = json.records
            .slice()
            .reverse()
            .map((r) => ({
              time: formatTime(r.timestamp),
              confidence: Math.round(r.confidence * 100),
            }));
          setData(points);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '데이터 로드 실패');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [type, hours]);

  const label = type === 'fermentation' ? '발효 예측' : '품질 예측';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-400">
        데이터 로드 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-red-400">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-400">
        {label} 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <p className="text-xs text-gray-500 mb-1">{label} 신뢰도 트렌드 (최근 {hours}h)</p>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            interval="preserveStartEnd"
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            unit="%"
          />
          <Tooltip
            contentStyle={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6 }}
            formatter={(value: number | undefined) => [
              value != null ? `${value}%` : '-',
              '신뢰도',
            ]}
            labelFormatter={(l) => `시각: ${l}`}
          />
          <Line
            type="monotone"
            dataKey="confidence"
            stroke="#22c55e"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
