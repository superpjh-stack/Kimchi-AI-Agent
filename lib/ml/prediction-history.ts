// lib/ml/prediction-history.ts — 예측 결과 인메모리 이력 저장소

interface PredictionRecord {
  id: string;
  timestamp: string;
  type: 'fermentation' | 'quality';
  input: Record<string, number>;
  confidence: number;
  result: string;
}

class PredictionHistory {
  private readonly buffer: PredictionRecord[] = [];
  private readonly maxSize = 1000;

  add(record: Omit<PredictionRecord, 'id' | 'timestamp'>): void {
    const full: PredictionRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...record,
    };
    this.buffer.push(full);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getRecent(limit = 100): PredictionRecord[] {
    return this.buffer.slice(-limit).reverse();
  }

  getTrend(type: string, hours: number): PredictionRecord[] {
    const cutoff = Date.now() - hours * 3600_000;
    return this.buffer
      .filter((r) => r.type === type && new Date(r.timestamp).getTime() > cutoff)
      .slice(-200);
  }
}

export const predictionHistory = new PredictionHistory();
export type { PredictionRecord };
