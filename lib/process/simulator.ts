// D1: 센서 시뮬레이터 — 실제 센서 API 연동 전 개발/테스트용
import type { SensorClient, SensorData, SensorReading } from './sensor-client';

export class SimulatorClient implements SensorClient {
  private readonly batchId: string;
  private readonly batchStartMs: number;
  // 각 지표의 현재 기준값 (느리게 드리프트)
  private tempBase = 20.0;
  private humidBase = 80.0;
  private saltBase = 2.2;
  private phBase = 4.5;
  private readonly history: SensorReading[] = [];

  constructor() {
    const today = new Date().toISOString().slice(0, 10);
    this.batchId = `BATCH-${today}`;
    // 0~60시간 전 무작위 시작 (발효 진행 중 시뮬레이션)
    this.batchStartMs = Date.now() - Math.floor(Math.random() * 60 * 3600_000);

    // Seed data: 10개 초기 이력 (30분 간격, 5시간 전 ~ 30분 전)
    // 발효 진행에 따라 온도↓ 습도↑ 염도 안정 pH↓ 패턴
    const seedBase = [
      { temperature: 22.4, humidity: 74.8, salinity: 2.18, ph: 4.98 },
      { temperature: 21.9, humidity: 75.6, salinity: 2.21, ph: 4.89 },
      { temperature: 21.5, humidity: 76.4, salinity: 2.23, ph: 4.79 },
      { temperature: 21.2, humidity: 77.3, salinity: 2.20, ph: 4.71 },
      { temperature: 20.8, humidity: 78.1, salinity: 2.24, ph: 4.63 },
      { temperature: 20.5, humidity: 79.0, salinity: 2.22, ph: 4.56 },
      { temperature: 20.1, humidity: 79.8, salinity: 2.25, ph: 4.48 },
      { temperature: 19.8, humidity: 80.5, salinity: 2.23, ph: 4.41 },
      { temperature: 19.5, humidity: 81.2, salinity: 2.26, ph: 4.35 },
      { temperature: 19.3, humidity: 81.9, salinity: 2.24, ph: 4.29 },
    ];
    const intervalMs = 30 * 60 * 1000; // 30분
    const seedCount = seedBase.length;
    seedBase.forEach((s, i) => {
      const offsetMs = (seedCount - i) * intervalMs;
      this.history.push({
        temperature: s.temperature,
        humidity:    s.humidity,
        salinity:    s.salinity,
        ph:          s.ph,
        timestamp:   new Date(Date.now() - offsetMs).toISOString(),
      });
    });
    // 기준값을 마지막 seed 값으로 맞춤
    const last = seedBase[seedBase.length - 1];
    this.tempBase  = last.temperature;
    this.humidBase = last.humidity;
    this.saltBase  = last.salinity;
    this.phBase    = last.ph;
  }

  async getCurrentData(): Promise<SensorData> {
    // 기준값을 천천히 드리프트 (±0.1 범위)
    this.tempBase  = this.drift(this.tempBase,  15, 25,  0.05);
    this.humidBase = this.drift(this.humidBase, 65, 90,  0.2);
    this.saltBase  = this.drift(this.saltBase,  1.5, 3.0, 0.02);
    this.phBase    = this.drift(this.phBase,    3.8, 5.5, 0.02);

    const fermentationHours = (Date.now() - this.batchStartMs) / 3_600_000;
    const data: SensorData = {
      batchId: this.batchId,
      temperature:          this.round(this.tempBase  + this.jitter(0.3)),
      humidity:             this.round(this.humidBase + this.jitter(1.0)),
      salinity:             this.round(this.saltBase  + this.jitter(0.05)),
      ph:                   this.round(this.phBase    + this.jitter(0.05)),
      fermentationHours:    this.round(fermentationHours),
      estimatedCompletion:  this.round(Math.max(0, 72 - fermentationHours)),
      timestamp:            new Date().toISOString(),
    };

    // 이력에 추가 (최대 2880개 유지 — 30s 간격 24h)
    this.history.push({
      temperature: data.temperature,
      humidity:    data.humidity,
      salinity:    data.salinity,
      ph:          data.ph,
      timestamp:   data.timestamp,
    });
    if (this.history.length > 2880) this.history.shift();

    return data;
  }

  async getHistory(hours: number): Promise<SensorReading[]> {
    const since = Date.now() - hours * 3_600_000;
    return this.history.filter((r) => new Date(r.timestamp).getTime() >= since);
  }

  private drift(val: number, min: number, max: number, step: number): number {
    const delta = (Math.random() - 0.5) * 2 * step;
    return Math.min(max, Math.max(min, val + delta));
  }

  private jitter(scale: number): number {
    return (Math.random() - 0.5) * 2 * scale;
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
