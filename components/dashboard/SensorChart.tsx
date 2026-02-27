'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SensorReading } from '@/lib/process/sensor-client';

interface SensorChartProps {
  readings: SensorReading[];
  dataKey: keyof Omit<SensorReading, 'timestamp'>;
  label: string;
  unit: string;
  color: string;
  domain?: [number | 'auto', number | 'auto'];
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// 데이터가 많을 때 간격을 두어 렌더링 최적화
function sample(readings: SensorReading[], maxPoints = 60): SensorReading[] {
  if (readings.length <= maxPoints) return readings;
  const step = Math.ceil(readings.length / maxPoints);
  return readings.filter((_, i) => i % step === 0);
}

export default function SensorChart({
  readings,
  dataKey,
  label,
  unit,
  color,
  domain = ['auto', 'auto'],
}: SensorChartProps) {
  const data = sample(readings).map((r) => ({
    time: formatTime(r.timestamp),
    value: r[dataKey],
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-400">
        데이터 수집 중...
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          interval="preserveStartEnd"
          tickLine={false}
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6 }}
          formatter={(value: number | undefined) => [value != null ? `${value} ${unit}` : '-', label]}
          labelFormatter={(l) => `시각: ${l}`}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
