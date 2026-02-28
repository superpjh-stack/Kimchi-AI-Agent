// types/tenant.ts — Multi-tenant 타입 정의

export type TenantId = string; // 'default' | uuid

export interface TenantConfig {
  id: TenantId;
  name: string;              // '제주김치공장', '부산김치공장'
  systemPrompt?: string;     // 공장별 특화 프롬프트 (미설정 시 글로벌 프롬프트 사용)
  mlConfig?: Partial<MLThresholds>;  // 공장별 임계값 (미설정 시 기본값 사용)
  createdAt: string;         // ISO 8601
  isActive: boolean;
}

export interface TenantContext {
  tenantId: TenantId;
  config: TenantConfig;
}

// ML 임계값 타입 (공장별 재정의 가능)
export interface MLThresholds {
  temperatureMin: number;
  temperatureMax: number;
  salinityMin: number;
  salinityMax: number;
  phMin: number;
  phMax: number;
  humidityMin: number;
  humidityMax: number;
}
