'use client';

import clsx from 'clsx';

interface QuickQuestionsProps {
  onSelect: (question: string) => void;
}

const QUICK_QUESTIONS = [
  { icon: '🌡️', text: '지금 공정 상태 전체적으로 어때?', category: '공정' },
  { icon: '⚠️', text: '현재 이상 경보 있어? 조치 방법 알려줘', category: '안전' },
  { icon: '⏱️', text: '발효 완료까지 얼마나 남았어?', category: '생산' },
  { icon: '🧂', text: '염도가 범위를 벗어나면 어떻게 해야 해?', category: '품질' },
  { icon: '📋', text: 'HACCP 체크리스트 오늘 항목 알려줘', category: '위생' },
  { icon: '🔬', text: '현재 pH 수치로 발효 단계 평가해줘', category: '공정' },
];

const CATEGORY_COLORS: Record<string, string> = {
  '공정': 'bg-kimchi-orange/10 text-kimchi-orange border-kimchi-orange/20',
  '품질': 'bg-kimchi-green/10 text-kimchi-green border-kimchi-green/20',
  '생산': 'bg-purple-50 text-purple-600 border-purple-100',
  '안전': 'bg-kimchi-red/10 text-kimchi-red border-kimchi-red/20',
  '위생': 'bg-blue-50 text-blue-600 border-blue-100',
};

export default function QuickQuestions({ onSelect }: QuickQuestionsProps) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <p className="text-sm text-brand-text-secondary text-center mb-3 font-medium">
        자주 묻는 질문 🍚
      </p>

      {/* Mobile: horizontal scroll / Tablet+: grid */}
      <div className="flex overflow-x-auto gap-2 pb-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-x-visible md:pb-0 -webkit-overflow-scrolling-touch">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q.text}
            type="button"
            onClick={() => onSelect(q.text)}
            className={clsx(
              'quick-question-card',
              'flex items-start gap-3 p-3 rounded-xl border text-left',
              'bg-white border-kimchi-beige-dark hover:border-kimchi-red hover:bg-kimchi-red/5',
              'transition-all duration-150 group',
              'shrink-0 min-w-[200px] md:min-w-0 md:shrink'
            )}
          >
            <span className="text-xl shrink-0 mt-0.5">{q.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-brand-text-primary group-hover:text-kimchi-red leading-snug">
                {q.text}
              </p>
              <span
                className={clsx(
                  'inline-block mt-1 text-xs px-1.5 py-0.5 rounded border font-medium',
                  CATEGORY_COLORS[q.category] ?? 'bg-kimchi-beige text-brand-text-secondary border-kimchi-beige-dark'
                )}
              >
                {q.category}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
