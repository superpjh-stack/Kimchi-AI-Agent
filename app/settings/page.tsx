'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle, Info } from 'lucide-react';

const MODEL = 'claude-sonnet-4-6';

interface SettingRowProps {
  label: string;
  value: string;
  description?: string;
  status?: 'ok' | 'warn' | 'none';
}

function SettingRow({ label, value, description, status }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {status === 'ok' && <CheckCircle size={15} className="text-green-500" />}
        {status === 'warn' && <XCircle size={15} className="text-amber-400" />}
        <span className="text-sm text-gray-600 font-mono">{value}</span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const hasAnthropicKey = true; // 서버 사이드 — 클라이언트에서는 존재 여부만 표시
  const hasOpenAIKey = false;   // OPENAI_API_KEY 미설정 시 mock embedding 사용

  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">설정</h1>
            <p className="text-sm text-gray-500">시스템 구성 및 환경 정보</p>
          </div>
        </div>

        {/* AI 모델 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-4">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">AI 모델</h2>
          </div>
          <div className="px-5 divide-y divide-gray-50">
            <SettingRow
              label="Claude 모델"
              value={MODEL}
              description="채팅 응답 생성에 사용"
              status="ok"
            />
            <SettingRow
              label="최대 토큰"
              value="2,048"
              description="응답당 최대 생성 토큰 수"
            />
            <SettingRow
              label="히스토리 제한"
              value="최근 20개"
              description="컨텍스트에 포함되는 이전 메시지 수"
            />
          </div>
        </div>

        {/* RAG 설정 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-4">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">RAG 파이프라인</h2>
          </div>
          <div className="px-5 divide-y divide-gray-50">
            <SettingRow
              label="임베딩 모델"
              value={hasOpenAIKey ? 'text-embedding-3-small' : 'Mock (랜덤)'}
              description={hasOpenAIKey ? 'OpenAI 시맨틱 임베딩' : 'OPENAI_API_KEY 미설정 — 검색 품질 낮음'}
              status={hasOpenAIKey ? 'ok' : 'warn'}
            />
            <SettingRow
              label="청크 크기"
              value="1,000자"
              description="오버랩 200자"
            />
            <SettingRow
              label="유사도 임계값"
              value="0.7"
              description="이 값 미만의 청크는 검색 결과에서 제외"
            />
            <SettingRow
              label="Top-K"
              value="5"
              description="검색 결과로 사용하는 최대 청크 수"
            />
          </div>
        </div>

        {/* 환경 변수 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-4">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">환경 변수</h2>
          </div>
          <div className="px-5 divide-y divide-gray-50">
            <SettingRow
              label="ANTHROPIC_API_KEY"
              value={hasAnthropicKey ? '설정됨' : '미설정'}
              description="필수 — Claude API 호출"
              status={hasAnthropicKey ? 'ok' : 'warn'}
            />
            <SettingRow
              label="OPENAI_API_KEY"
              value={hasOpenAIKey ? '설정됨' : '미설정'}
              description="선택 — 없으면 mock embedding 사용"
              status={hasOpenAIKey ? 'ok' : 'warn'}
            />
          </div>
        </div>

        {/* Phase 2 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex gap-3">
          <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-700">Phase 2 예정</p>
            <p className="text-xs text-blue-500 mt-1">
              대화 및 문서의 영구 저장, 공정 센서 API 연동, bkend.ai 연결이 다음 단계에서 구현됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
