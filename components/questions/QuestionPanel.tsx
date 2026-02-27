'use client';

import { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface QuestionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuestion: (question: string) => void;
}

const CATEGORIES = [
  {
    id: 'process',
    label: '공정 상태',
    emoji: '🌡️',
    color: 'text-blue-600',
    activeBg: 'bg-blue-100',
    border: 'border-blue-200',
    questions: [
      '지금 발효실 온도 몇 도야?',
      '현재 발효실 습도는 얼마야?',
      '염도 센서 정상이야?',
      '배양 pH 지금 어떻게 돼?',
      '발효 진행률 몇 퍼센트야?',
      '이번 배치 시작한 지 얼마나 됐어?',
      '온도 트렌드 지난 1시간 어때?',
      '현재 공정 전체 상태 요약해줘',
      '발효실 센서 모두 정상이야?',
      '지금 가장 주의할 공정 수치가 뭐야?',
    ],
  },
  {
    id: 'alerts',
    label: '이상 대응',
    emoji: '🚨',
    color: 'text-red-600',
    activeBg: 'bg-red-100',
    border: 'border-red-200',
    questions: [
      '지금 경보 있어?',
      '현재 경고 상태인 항목 알려줘',
      '최근 발생한 알림 목록 보여줘',
      '온도 이상 발생 시 조치 방법은?',
      '습도 경보 기준이 뭐야?',
      '염도 이상이면 어떻게 해야 해?',
      'pH 이탈 시 즉각 조치 순서 알려줘',
      '경보 무시하면 어떤 위험이 있어?',
      '이상 발생 시 담당자 연락처는?',
      '지금 긴급 대응이 필요한 상황이야?',
    ],
  },
  {
    id: 'fermentation',
    label: '발효 지식',
    emoji: '🥬',
    color: 'text-green-700',
    activeBg: 'bg-green-100',
    border: 'border-green-200',
    questions: [
      '최적 발효 온도 범위가 어떻게 돼?',
      '김치 발효 원리를 간단히 설명해줘',
      '유산균이 발효에 어떤 역할을 해?',
      '발효 속도에 영향을 주는 요인이 뭐야?',
      '겨울철 발효 관리 포인트가 뭐야?',
      '과발효가 되면 어떻게 돼?',
      '온도와 발효 속도 관계 알려줘',
      '염도가 발효에 미치는 영향은?',
      '발효 완료 판단 기준이 뭐야?',
      '최적 pH 범위는 어떻게 돼?',
    ],
  },
  {
    id: 'quality',
    label: '품질/HACCP',
    emoji: '✅',
    color: 'text-purple-600',
    activeBg: 'bg-purple-100',
    border: 'border-purple-200',
    questions: [
      '오늘 품질 체크 항목 알려줘',
      'HACCP 중요관리점(CCP)이 뭐야?',
      '일일 위생 점검 순서 알려줘',
      '품질 이탈 시 보고 절차는?',
      '이물질 발견 시 대응 방법은?',
      '작업자 위생 기준이 뭐야?',
      '소비기한 설정 기준이 어떻게 돼?',
      '미생물 검사 주기는 어떻게 돼?',
      '클레임 처리 절차 알려줘',
      '오늘 HACCP 기록 완료했어?',
    ],
  },
  {
    id: 'documents',
    label: '문서 검색',
    emoji: '📄',
    color: 'text-orange-600',
    activeBg: 'bg-orange-100',
    border: 'border-orange-200',
    questions: [
      '발효 공정 가이드에서 온도 관련 내용 찾아줘',
      'HACCP 문서에서 CCP 기준 알려줘',
      '긴급 상황 대응 매뉴얼 찾아줘',
      '품질 기준서에서 pH 규격 알려줘',
      '설비 점검 체크리스트 보여줘',
      '신규 직원 교육 자료 있어?',
      '원재료 검수 기준 문서 찾아줘',
      '세척 소독 절차서 내용 알려줘',
      '제품별 발효 레시피 찾아줘',
      '작년 품질 이슈 사례 있어?',
    ],
  },
  {
    id: 'production',
    label: '생산 운영',
    emoji: '🏭',
    color: 'text-gray-700',
    activeBg: 'bg-gray-100',
    border: 'border-gray-300',
    questions: [
      '이번 배치 언제 완료돼?',
      '오늘 생산 계획 알려줘',
      '현재 가동 중인 발효실은 몇 개야?',
      '다음 배치 준비 상태는?',
      '이번 주 생산 목표 달성률은?',
      '재고 현황 알려줘',
      '라인별 생산 효율 어때?',
      '설비 예방 점검 일정은?',
      '오늘 출하 예정 물량은?',
      '인력 배치 현황 어떻게 돼?',
    ],
  },
];

export default function QuestionPanel({
  isOpen,
  onClose,
  onSelectQuestion,
}: QuestionPanelProps) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);

  const currentCategory = CATEGORIES.find((c) => c.id === activeCategory) ?? CATEGORIES[0];

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className="lg:hidden fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Panel — desktop: static in flex row | mobile: fixed overlay from right */}
      <div
        className={clsx(
          'flex flex-col bg-white border-l border-gray-200',
          /* Mobile: fixed overlay */
          'fixed inset-y-0 right-0 z-50 w-80',
          /* Desktop: static panel in layout flow */
          'lg:static lg:z-auto lg:w-72 xl:w-80 lg:shrink-0',
        )}
        role="complementary"
        aria-label="질문 목록"
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <span className="text-sm font-semibold text-gray-800">질문 목록</span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Category tabs — horizontal scroll */}
        <div className="flex gap-1 px-2 py-2 overflow-x-auto shrink-0 border-b border-gray-100 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                activeCategory === cat.id
                  ? `${cat.activeBg} ${cat.color} border ${cat.border}`
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Question list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="space-y-1">
            {currentCategory.questions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectQuestion(q);
                  onClose();
                }}
                className={clsx(
                  'w-full flex items-start gap-2 px-3 py-2.5 rounded-lg text-left',
                  'text-xs text-gray-700 leading-snug',
                  'hover:bg-gray-50 active:bg-gray-100 transition-colors',
                  'border border-transparent hover:border-gray-200'
                )}
              >
                <span className={clsx('mt-0.5 shrink-0', currentCategory.color)}>
                  <ChevronRight size={12} />
                </span>
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-gray-100 shrink-0">
          <p className="text-xs text-gray-400 text-center">질문을 클릭하면 채팅으로 전송됩니다</p>
        </div>
      </div>
    </>
  );
}
