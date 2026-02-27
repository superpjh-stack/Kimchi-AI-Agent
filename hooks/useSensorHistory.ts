'use client';
// E2: 센서 이력 폴링 훅
import { useState, useEffect, useCallback } from 'react';
import type { SensorReading } from '@/lib/process/sensor-client';

interface ApiResponse<T> {
  data?: T;
  error?: { code: string; message: string };
}

interface HistoryData {
  hours: number;
  count: number;
  readings: SensorReading[];
}

export function useSensorHistory(hours = 1, pollInterval = 30_000) {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/process-data/history?hours=${hours}`);
      const json: ApiResponse<HistoryData> = await res.json();
      if (json.data) {
        setReadings(json.data.readings);
        setError(null);
      } else {
        setError(json.error?.message ?? '이력 조회 실패');
      }
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      await fetchHistory();
    };

    run();
    const id = setInterval(run, pollInterval);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [fetchHistory, pollInterval]);

  return { readings, loading, error, refresh: fetchHistory };
}
