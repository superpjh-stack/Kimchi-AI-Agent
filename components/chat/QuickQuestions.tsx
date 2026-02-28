'use client';

import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import {
  Thermometer,
  Droplets,
  Clock,
  AlertTriangle,
  ClipboardCheck,
  BarChart2,
  type LucideIcon,
} from 'lucide-react';

interface QuickQuestionsProps {
  onSelect: (question: string) => void;
}

interface QuickQuestionDef {
  Icon: LucideIcon;
  key: 'temperature' | 'salinity' | 'progress' | 'alert' | 'haccp' | 'production';
  category: string;
}

const QUICK_QUESTION_DEFS: QuickQuestionDef[] = [
  { Icon: Thermometer, key: 'temperature', category: '환경' },
  { Icon: Droplets, key: 'salinity', category: '품질' },
  { Icon: Clock, key: 'progress', category: '생산' },
  { Icon: AlertTriangle, key: 'alert', category: '안전' },
  { Icon: ClipboardCheck, key: 'haccp', category: '품질' },
  { Icon: BarChart2, key: 'production', category: '생산' },
];

const CATEGORY_COLORS: Record<string, string> = {
  '환경': 'bg-blue-50 text-blue-600 border-blue-100',
  '품질': 'bg-kimchi-green/10 text-kimchi-green border-kimchi-green/20',
  '생산': 'bg-purple-50 text-purple-600 border-purple-100',
  '안전': 'bg-kimchi-red/10 text-kimchi-red border-kimchi-red/20',
};

export default function QuickQuestions({ onSelect }: QuickQuestionsProps) {
  const t = useTranslations('quickQuestions');

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <p className="text-sm text-brand-text-secondary text-center mb-3 font-medium">
        자주 묻는 질문
      </p>

      {/* Mobile: horizontal scroll / Tablet+: grid */}
      <div className="flex overflow-x-auto gap-2 pb-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-x-visible md:pb-0 -webkit-overflow-scrolling-touch">
        {QUICK_QUESTION_DEFS.map((q) => {
          const text = t(q.key);
          return (
            <button
              key={q.key}
              type="button"
              onClick={() => onSelect(text)}
              className={clsx(
                'quick-question-card',
                'flex items-start gap-3 p-3 rounded-xl border text-left',
                'bg-white border-kimchi-beige-dark hover:border-kimchi-red hover:bg-kimchi-red/5',
                'transition-all duration-150 group',
                'shrink-0 min-w-[200px] md:min-w-0 md:shrink'
              )}
            >
              <q.Icon size={20} className="shrink-0 mt-0.5 text-brand-text-muted group-hover:text-kimchi-red transition-colors" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-brand-text-primary group-hover:text-kimchi-red leading-snug">
                  {text}
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
          );
        })}
      </div>
    </div>
  );
}
