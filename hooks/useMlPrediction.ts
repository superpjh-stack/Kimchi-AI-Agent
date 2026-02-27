'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SensorData } from '@/lib/process/sensor-client';
import type { FermentationPrediction, QualityPrediction } from '@/lib/ml/predictor';

interface MlPredictionState {
  fermentation: FermentationPrediction | null;
  quality: QualityPrediction | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useMlPrediction(sensors: SensorData | null, refreshInterval = 30_000) {
  const [state, setState] = useState<MlPredictionState>({
    fermentation: null,
    quality: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
  });

  const fetchPredictions = useCallback(async () => {
    if (!sensors) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const [ferRes, qualRes] = await Promise.all([
        fetch('/api/ml/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId: sensors.batchId, sensors }),
        }),
        fetch('/api/ml/quality', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            temperature: sensors.temperature,
            salinity: sensors.salinity,
            ph: sensors.ph,
          }),
        }),
      ]);

      const ferJson = await ferRes.json();
      const qualJson = await qualRes.json();

      setState({
        fermentation: ferJson.data ?? ferJson,
        quality: qualJson.data ?? qualJson,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: e instanceof Error ? e.message : '예측 실패',
      }));
    }
  }, [sensors]);

  useEffect(() => {
    fetchPredictions();
    const timer = setInterval(fetchPredictions, refreshInterval);
    return () => clearInterval(timer);
  }, [fetchPredictions, refreshInterval]);

  return { ...state, refresh: fetchPredictions };
}
