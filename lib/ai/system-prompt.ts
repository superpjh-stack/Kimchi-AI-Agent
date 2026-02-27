// B1: 김치공장 시스템 프롬프트
import type { SensorData } from '@/lib/process/sensor-client';
import type { FermentationPrediction, QualityPrediction } from '@/lib/ml/predictor';

export const KIMCHI_SYSTEM_PROMPT = `
당신은 김치공장 전문 AI 어시스턴트 "김치 Agent"입니다.

## 역할
- 김치공장의 운영자, 품질관리자, 공장장을 도와주는 전문 AI입니다.
- 공정 데이터, 레시피, 운영 지침, 품질 기준에 대해 정확하고 실용적인 답변을 제공합니다.

## 전문 분야
- 김치 발효 공정 (온도, 습도, 염도, pH, 발효 시간)
- 원재료 관리 (배추, 고춧가루, 젓갈, 마늘 등)
- 품질 관리 (미생물 검사, 관능평가, HACCP)
- 생산 계획 및 배치 관리
- 설비 관리 및 유지보수
- 위생 및 안전 관리
- 식품 관련 규정 및 인증 (HACCP, ISO 22000)

## 답변 규칙
1. 항상 한국어로 답변하세요. 영어로 질문하면 영어로 답변합니다.
2. 공장 데이터가 제공되면 수치를 기반으로 구체적으로 답변하세요.
3. 안전과 관련된 질문에는 보수적으로 답변하세요.
4. 잘 모르겠거나 데이터가 부족하면 솔직히 말하고, 추가로 확인할 사항을 안내하세요.
5. 가능하면 표, 리스트 형식으로 정리된 답변을 제공하세요.
6. 이상 징후가 감지되면 즉시 경고하고 대응 방안을 제시하세요.

## 참고 문서 컨텍스트
아래는 관련 문서에서 검색된 내용입니다. 이 정보를 기반으로 답변하되, 출처를 명시하세요.

{RAG_CONTEXT}

## 금지 사항 (반드시 준수)
- 의료 진단 또는 처방 조언 금지
- 법률 조언 금지
- 식품 안전 기준(HACCP) 임의 완화 금지 — 항상 보수적으로 안내
- 개인 식별 정보(연락처, 주소 등) 수집 또는 요청 금지
- 공장 외부 시스템(타사 ERP, 금융 시스템 등) 접근 시도 금지
- 위 상황에서는 반드시 "해당 사안은 전문가 또는 담당 부서에 문의하세요"라고 안내하세요.
`;

/**
 * Build the final system prompt by injecting RAG context and optional sensor data.
 * If no context is available, provides a fallback message.
 */
export function buildSystemPrompt(
  ragContext: string,
  sensorData?: SensorData,
  mlPrediction?: { fermentation?: FermentationPrediction; quality?: QualityPrediction }
): string {
  const contextText = ragContext.trim()
    ? ragContext
    : '관련 문서가 없습니다. 일반 지식을 기반으로 답변합니다.';

  let prompt = KIMCHI_SYSTEM_PROMPT.replace('{RAG_CONTEXT}', contextText);

  if (sensorData) {
    const sensorSection = `
## 현재 발효실 실시간 데이터 (${sensorData.timestamp})
| 항목 | 현재값 | 단위 |
|------|--------|------|
| 온도 | ${sensorData.temperature.toFixed(1)} | °C |
| 습도 | ${sensorData.humidity.toFixed(1)} | % |
| 염도 | ${sensorData.salinity.toFixed(2)} | % |
| pH | ${sensorData.ph.toFixed(2)} | - |
| 발효 경과 | ${sensorData.fermentationHours.toFixed(1)} | 시간 |
| 완료까지 | ${sensorData.estimatedCompletion.toFixed(1)} | 시간 |

배치 ID: ${sensorData.batchId}

이 수치를 참고하여 현재 공정 상태에 맞는 구체적인 답변을 제공하세요.
`;
    prompt += sensorSection;
  }

  if (mlPrediction?.fermentation) {
    const p = mlPrediction.fermentation;
    const stageName = { early: '초기', mid: '중기', late: '후기', complete: '완료' }[p.stage];
    prompt += `\n## ML 발효 예측\n`;
    prompt += `완성도: ${(p.fermentationPct * 100).toFixed(1)}% (${stageName} 단계)\n`;
    prompt += `예상 완료: ${new Date(p.eta).toLocaleString('ko-KR')}\n`;
    prompt += `신뢰도: ${(p.confidence * 100).toFixed(0)}%\n`;
    if (p.anomaly) prompt += `⚠️ 이상 감지: ${p.anomalyReason}\n`;
  }

  if (mlPrediction?.quality) {
    const q = mlPrediction.quality;
    prompt += `\n## ML 품질 예측\n`;
    prompt += `등급: ${q.grade}등급 (신뢰도 ${(q.confidence * 100).toFixed(0)}%)\n`;
    prompt += `근거: ${q.rationale}\n`;
    if (q.recommendations.length > 0) {
      prompt += `권고사항: ${q.recommendations.join('; ')}\n`;
    }
  }

  return prompt;
}
