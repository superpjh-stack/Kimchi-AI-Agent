// lib/ml/remote-predictor.ts — FastAPI 원격 서버 연동 + 규칙 기반 폴백
import { createLogger } from '@/lib/logger';
import type { SensorData } from '@/lib/process/sensor-client';
import type { IPredictor, FermentationPrediction, QualityPrediction, QualityInput } from './predictor';

const log = createLogger('ml.remote');

const TIMEOUT_MS = 3000;

export class RemoteMLPredictor implements IPredictor {
  constructor(
    private readonly serverUrl: string,
    private readonly fallback: IPredictor
  ) {}

  async predictFermentation(sensors: SensorData): Promise<FermentationPrediction> {
    try {
      const res = await this.post('/predict', sensors);
      return res as FermentationPrediction;
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err }, '[ml] remote predict 실패, 규칙 기반 폴백');
      return this.fallback.predictFermentation(sensors);
    }
  }

  async predictQuality(input: QualityInput): Promise<QualityPrediction> {
    try {
      const res = await this.post('/quality', input);
      return res as QualityPrediction;
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err }, '[ml] remote quality 실패, 규칙 기반 폴백');
      return this.fallback.predictQuality(input);
    }
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${this.serverUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`ML server ${res.status}: ${path}`);
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
