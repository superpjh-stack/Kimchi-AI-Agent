'use client';
// E1: 센서 데이터 폴링 훅
import { useState, useEffect } from 'react';
import type { SensorData } from '@/lib/process/sensor-client';

interface ApiResponse<T> {
  data?: T;
  error?: { code: string; message: string };
}

export function useProcessData(pollInterval = 30000) {
  const [data, setData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/process-data');
        const json: ApiResponse<SensorData> = await res.json();
        if (!mounted) return;
        if (json.data) {
          setData(json.data);
          setError(null);
        } else {
          setError(json.error?.message ?? '센서 데이터 조회 실패');
        }
      } catch {
        if (mounted) setError('네트워크 오류');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, pollInterval);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [pollInterval]);

  return { data, loading, error };
}
