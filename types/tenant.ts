// types/tenant.ts — Multi-tenant 타입 정의
import type { MLConfig } from '@/config/ml.config';

export type TenantId = string; // 'default' | uuid

export interface TenantConfig {
  id: TenantId;
  name: string;              // '제주김치공장', '부산김치공장'
  systemPrompt?: string;     // 공장별 특화 프롬프트 (미설정 시 글로벌 프롬프트 사용)
  mlConfig?: Partial<MLConfig>;  // 공장별 ML 설정 오버라이드 (미설정 시 기본값 사용)
  createdAt: string;         // ISO 8601
  isActive: boolean;
}

export interface TenantContext {
  tenantId: TenantId;
  config: TenantConfig;
}
