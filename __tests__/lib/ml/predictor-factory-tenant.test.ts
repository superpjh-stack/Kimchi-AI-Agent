// __tests__/lib/ml/predictor-factory-tenant.test.ts — FR-43 tenant별 ML predictor 테스트
import { createPredictorForTenant } from '@/lib/ml/predictor-factory';
import { tenantStore } from '@/lib/tenant/tenant-store';
import type { SensorData } from '@/lib/process/sensor-client';

describe('createPredictorForTenant (FR-43)', () => {
  beforeEach(() => {
    // 테넌트 생성: 커스텀 ML 임계값
    try {
      tenantStore.create({
        id: 'factory-jeju',
        name: '제주김치공장',
        isActive: true,
        mlConfig: {
          anomaly: { tempMin: 12, tempMax: 26, salinityMin: 1.5, salinityMax: 3.0, phMin: 3.8, phMax: 5.5 },
        },
      });
    } catch {
      // 이미 존재하는 경우 무시
    }
  });

  afterEach(() => {
    try {
      tenantStore.delete('factory-jeju');
    } catch {
      // 없으면 무시
    }
  });

  it('tenant ML 설정이 있으면 해당 임계값으로 predictor를 생성한다', async () => {
    const predictor = createPredictorForTenant('factory-jeju');
    expect(predictor).toBeDefined();

    // 제주 공장: tempMax=26이므로 27도는 이상 감지
    const sensors: SensorData = {
      temperature: 27,
      humidity: 70,
      salinity: 2.0,
      ph: 4.2,
      fermentationHours: 20,
      estimatedCompletion: 52,
      batchId: 'JEJU-001',
      timestamp: new Date().toISOString(),
    };
    const result = await predictor.predictFermentation(sensors);
    expect(result.anomaly).toBe(true);
  });

  it('기본 tenant는 글로벌 설정을 사용한다', async () => {
    const predictor = createPredictorForTenant('default');
    expect(predictor).toBeDefined();

    // 기본: tempMax=28이므로 27도는 정상 범위
    const sensors: SensorData = {
      temperature: 27,
      humidity: 70,
      salinity: 2.0,
      ph: 4.2,
      fermentationHours: 20,
      estimatedCompletion: 52,
      batchId: 'DEFAULT-001',
      timestamp: new Date().toISOString(),
    };
    const result = await predictor.predictFermentation(sensors);
    expect(result.anomaly).toBe(false);
  });

  it('존재하지 않는 tenant ID는 기본값을 사용한다', async () => {
    const predictor = createPredictorForTenant('nonexistent');
    expect(predictor).toBeDefined();
  });
});
