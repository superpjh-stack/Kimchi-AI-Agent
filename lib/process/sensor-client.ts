// D2: 센서 클라이언트 인터페이스 + 팩토리
// PROCESS_DATA_MODE=simulator → SimulatorClient (기본)
// PROCESS_DATA_MODE=api       → HttpSensorClient (실제 센서)

// ──────────────────────────────────────────────
// 공유 타입 (types/index.ts와 중복 방지 — 여기서 export)
// ──────────────────────────────────────────────

export interface SensorData {
  batchId: string;
  temperature: number;         // 섭씨
  humidity: number;            // %
  salinity: number;            // %
  ph: number;
  fermentationHours: number;   // 경과 시간 (h)
  estimatedCompletion: number; // 완료까지 남은 시간 (h)
  timestamp: string;           // ISO 8601
}

export interface SensorReading {
  temperature: number;
  humidity: number;
  salinity: number;
  ph: number;
  timestamp: string;
}

export interface SensorClient {
  getCurrentData(): Promise<SensorData>;
  getHistory(hours: number): Promise<SensorReading[]>;
}

// ──────────────────────────────────────────────
// HTTP 센서 클라이언트 (실제 센서 게이트웨이 연동)
// ──────────────────────────────────────────────

class HttpSensorClient implements SensorClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  private async fetch<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'X-API-Key': this.apiKey },
      next: { revalidate: 0 }, // 항상 최신 데이터
    });
    if (!res.ok) throw new Error(`Sensor API ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }

  getCurrentData(): Promise<SensorData> {
    return this.fetch<SensorData>('/current');
  }

  getHistory(hours: number): Promise<SensorReading[]> {
    return this.fetch<SensorReading[]>(`/history?hours=${hours}`);
  }
}

// ──────────────────────────────────────────────
// 팩토리 (싱글턴 캐시)
// ──────────────────────────────────────────────

let _client: SensorClient | null = null;

export function createSensorClient(): SensorClient {
  if (_client) return _client;

  if (process.env.PROCESS_DATA_MODE === 'api') {
    const url = process.env.PROCESS_DATA_API_URL;
    const key = process.env.PROCESS_DATA_API_KEY ?? '';
    if (!url) throw new Error('PROCESS_DATA_API_URL 환경변수가 필요합니다.');
    _client = new HttpSensorClient(url, key);
  } else {
    // 기본: simulator
    const { SimulatorClient } = require('./simulator') as { SimulatorClient: new () => SensorClient };
    _client = new SimulatorClient();
  }

  return _client;
}
