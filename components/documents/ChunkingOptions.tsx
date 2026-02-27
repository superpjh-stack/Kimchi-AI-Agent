'use client';

import { Info, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import type { ChunkingOptions as ChunkingOptionsType, ChunkingMethod } from '@/types';
import { CHUNKING_STRATEGIES } from '@/lib/rag/chunker';

interface ChunkingOptionsProps {
  fileExtension: string;
  /** 파일 크기(bytes) — 예상 청크 수 계산에 사용 */
  fileSize?: number;
  value: ChunkingOptionsType;
  onChange: (options: ChunkingOptionsType) => void;
}

// ── 전략별 장단점 + 시각화 ──────────────────────────────────
const STRATEGY_META: Record<
  ChunkingMethod,
  { pros: string[]; cons: string[]; visual: string }
> = {
  recursive: {
    pros: ['범용 문서에 최적', '문맥 보존 우수', '오버랩으로 연속성 유지'],
    cons: ['순수 텍스트 전용', '테이블 구조 손상 가능'],
    visual: '┌──────┐  ┌──────┐  ┌──────┐\n│chunk1│  │chunk2│  │chunk3│\n└──┬───┘  └──┬───┘  └──────┘\n   └─overlap─┘',
  },
  fixed: {
    pros: ['균일한 청크 크기', '예측 가능한 청크 수', '빠른 처리'],
    cons: ['문장 중간 절단 가능', '문맥 손실 위험'],
    visual: '┌─────┬─────┬─────┬─────┐\n│ 300 │ 300 │ 300 │ 300 │\n└─────┴─────┴─────┴─────┘',
  },
  paragraph: {
    pros: ['문단 경계 완벽 보존', '자연스러운 의미 단위', '매뉴얼·보고서에 최적'],
    cons: ['문단 크기 불균일', '빈 줄 없는 문서 비효율'],
    visual: '문단1          문단2  문단3\n┌───────────┐  ┌───┐  ┌──────┐\n│ paragraph │  │ p │  │  p3  │\n└───────────┘  └───┘  └──────┘',
  },
  row: {
    pros: ['테이블 구조 완벽 보존', '헤더 자동 포함', 'CSV/XLSX 전용 최적화'],
    cons: ['텍스트 문서에 부적합', '행 수 기반 분할만 지원'],
    visual: '헤더──────────────────────\n┌─────────┬─────────┐\n│ rows1~50│rows51~100│\n│ +header │ +header │\n└─────────┴─────────┘',
  },
  sentence: {
    pros: ['문장 단위 의미 보존', 'FAQ/Q&A에 최적', '오버랩으로 연속성 유지'],
    cons: ['문장 인식 정확도 의존', '한국어 어미 처리 주의'],
    visual: '┌────────┐  ┌────────┐\n│s1 s2 s3│  │s3 s4 s5│  ...\n└────────┘  └────────┘\n   └─ overlap ─┘',
  },
};

// ── 프리셋 ──────────────────────────────────────────────────
type PresetEntry = { label: string; desc: string; values: Partial<ChunkingOptionsType> };

const PRESETS: Record<ChunkingMethod, PresetEntry[]> = {
  recursive: [
    { label: 'S', desc: '짧게 (500자)', values: { chunkSize: 500, chunkOverlap: 50 } },
    { label: 'M', desc: '기본 (1000자)', values: { chunkSize: 1000, chunkOverlap: 200 } },
    { label: 'L', desc: '길게 (2000자)', values: { chunkSize: 2000, chunkOverlap: 400 } },
  ],
  fixed: [
    { label: 'S', desc: '짧게 (300자)', values: { chunkSize: 300, chunkOverlap: 0 } },
    { label: 'M', desc: '기본 (800자)', values: { chunkSize: 800, chunkOverlap: 100 } },
    { label: 'L', desc: '길게 (1500자)', values: { chunkSize: 1500, chunkOverlap: 150 } },
  ],
  paragraph: [
    { label: 'S', desc: '소 (800자)', values: { maxChunkSize: 800 } },
    { label: 'M', desc: '중 (2000자)', values: { maxChunkSize: 2000 } },
    { label: 'L', desc: '대 (4000자)', values: { maxChunkSize: 4000 } },
  ],
  row: [
    { label: 'S', desc: '20행', values: { rowsPerChunk: 20 } },
    { label: 'M', desc: '50행', values: { rowsPerChunk: 50 } },
    { label: 'L', desc: '100행', values: { rowsPerChunk: 100 } },
  ],
  sentence: [
    { label: 'S', desc: '5문장', values: { sentencesPerChunk: 5, sentenceOverlap: 1 } },
    { label: 'M', desc: '10문장', values: { sentencesPerChunk: 10, sentenceOverlap: 2 } },
    { label: 'L', desc: '20문장', values: { sentencesPerChunk: 20, sentenceOverlap: 3 } },
  ],
};

// ── 예상 청크 수 계산 ────────────────────────────────────────
function estimateChunkCount(fileSize: number, options: ChunkingOptionsType): number {
  const charCount = Math.floor(fileSize * 0.9);
  switch (options.method) {
    case 'recursive':
    case 'fixed': {
      const size = options.chunkSize ?? 1000;
      const overlap = options.chunkOverlap ?? 200;
      const step = Math.max(size - overlap, 1);
      return Math.max(1, Math.ceil(charCount / step));
    }
    case 'paragraph': {
      const maxSize = options.maxChunkSize ?? 2000;
      return Math.max(1, Math.ceil((charCount / maxSize) * 1.3));
    }
    case 'row': {
      const rpc = options.rowsPerChunk ?? 50;
      const rows = Math.floor(fileSize / 40);
      return Math.max(1, Math.ceil(rows / rpc));
    }
    case 'sentence': {
      const spc = options.sentencesPerChunk ?? 10;
      const soverlap = options.sentenceOverlap ?? 2;
      const sentences = Math.floor(charCount / 80);
      const step = Math.max(spc - soverlap, 1);
      return Math.max(1, Math.ceil(sentences / step));
    }
  }
}

// ── 슬라이더 + 숫자 입력 ────────────────────────────────────
function ParamSlider({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-brand-text-secondary">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) =>
              onChange(Math.min(max, Math.max(min, Number(e.target.value))))
            }
            className="w-16 text-center border border-kimchi-beige-dark rounded px-1 py-0.5 text-xs focus:outline-none focus:border-kimchi-orange"
          />
          <span className="text-xs text-brand-text-muted w-8">{unit}</span>
        </div>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-kimchi-red bg-kimchi-beige"
          style={{
            background: `linear-gradient(to right, #D62828 ${pct}%, #F5E6CA ${pct}%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-brand-text-muted">
        <span>{min.toLocaleString()}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────
export default function ChunkingOptionsSelector({
  fileExtension,
  fileSize,
  value,
  onChange,
}: ChunkingOptionsProps) {
  const isRecommended = (method: ChunkingMethod) =>
    CHUNKING_STRATEGIES.find((s) => s.method === method)?.recommendedFor.includes(fileExtension) ?? false;

  const handleMethodChange = (method: ChunkingMethod) => {
    const strategy = CHUNKING_STRATEGIES.find((s) => s.method === method);
    onChange({ ...(strategy?.defaults ?? {}), method });
  };

  const applyPreset = (preset: Partial<ChunkingOptionsType>) =>
    onChange({ ...value, ...preset });

  const estimatedChunks =
    fileSize && fileSize > 0 ? estimateChunkCount(fileSize, value) : null;

  const renderParams = (method: ChunkingMethod) => {
    const presets = PRESETS[method] ?? [];
    const meta = STRATEGY_META[method];

    return (
      <div className="mt-2.5 pt-2.5 border-t border-kimchi-beige space-y-3">
        {/* Visual diagram */}
        <pre className="text-[10px] text-brand-text-muted bg-kimchi-cream rounded-md px-2.5 py-2 overflow-x-auto leading-relaxed font-mono">
          {meta.visual}
        </pre>

        {/* Pros & cons */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-kimchi-green">장점</p>
            {meta.pros.map((p, i) => (
              <p key={i} className="text-[10px] text-brand-text-secondary flex gap-1">
                <span className="text-kimchi-green shrink-0">✓</span>{p}
              </p>
            ))}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-kimchi-orange">주의</p>
            {meta.cons.map((c, i) => (
              <p key={i} className="text-[10px] text-brand-text-secondary flex gap-1">
                <span className="text-kimchi-orange shrink-0">!</span>{c}
              </p>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-brand-text-muted w-9 shrink-0">프리셋</span>
          <div className="flex gap-1.5 flex-wrap">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                title={p.desc}
                onClick={() => applyPreset(p.values)}
                className="px-2.5 py-0.5 text-xs border border-kimchi-beige-dark rounded-full hover:border-kimchi-red hover:text-kimchi-red transition-colors"
              >
                {p.label}
                <span className="ml-1 text-[10px] text-brand-text-muted">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 슬라이더 파라미터 */}
        {(method === 'recursive' || method === 'fixed') && (
          <>
            <ParamSlider
              label="청크 크기"
              unit="자"
              value={value.chunkSize ?? 1000}
              min={100}
              max={5000}
              step={100}
              onChange={(v) => onChange({ ...value, chunkSize: v })}
            />
            <ParamSlider
              label="오버랩"
              unit="자"
              value={value.chunkOverlap ?? (method === 'recursive' ? 200 : 100)}
              min={0}
              max={Math.floor((value.chunkSize ?? 1000) / 2)}
              step={50}
              onChange={(v) => onChange({ ...value, chunkOverlap: v })}
            />
          </>
        )}

        {method === 'paragraph' && (
          <ParamSlider
            label="최대 청크 크기"
            unit="자"
            value={value.maxChunkSize ?? 2000}
            min={500}
            max={8000}
            step={100}
            onChange={(v) => onChange({ ...value, maxChunkSize: v })}
          />
        )}

        {method === 'row' && (
          <ParamSlider
            label="청크당 행수"
            unit="행"
            value={value.rowsPerChunk ?? 50}
            min={5}
            max={300}
            step={5}
            onChange={(v) => onChange({ ...value, rowsPerChunk: v })}
          />
        )}

        {method === 'sentence' && (
          <>
            <ParamSlider
              label="청크당 문장수"
              unit="문장"
              value={value.sentencesPerChunk ?? 10}
              min={1}
              max={50}
              step={1}
              onChange={(v) => onChange({ ...value, sentencesPerChunk: v })}
            />
            <ParamSlider
              label="오버랩"
              unit="문장"
              value={value.sentenceOverlap ?? 2}
              min={0}
              max={Math.max(1, Math.floor((value.sentencesPerChunk ?? 10) / 2))}
              step={1}
              onChange={(v) => onChange({ ...value, sentenceOverlap: v })}
            />
          </>
        )}

        {/* 예상 청크 수 */}
        {estimatedChunks !== null && (
          <div className="flex items-center gap-1.5 text-[11px] text-kimchi-green-dark bg-kimchi-green/5 border border-kimchi-green/20 rounded-md px-2.5 py-1.5">
            <Info size={11} className="shrink-0" />
            <span>
              예상 청크 수:{' '}
              <strong>약 {estimatedChunks.toLocaleString()}개</strong>
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-brand-text-primary">청킹 방법 선택</p>

      {CHUNKING_STRATEGIES.map((strategy) => {
        const selected = value.method === strategy.method;
        const recommended = isRecommended(strategy.method);

        return (
          <div
            key={strategy.method}
            className={clsx(
              'border rounded-lg transition-all duration-150',
              selected
                ? 'border-kimchi-red bg-kimchi-red/5'
                : 'border-kimchi-beige-dark bg-white hover:border-kimchi-orange/40'
            )}
          >
            <button
              type="button"
              onClick={() => handleMethodChange(strategy.method)}
              className="w-full text-left px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                    selected ? 'border-kimchi-red bg-kimchi-red' : 'border-kimchi-beige-dark'
                  )}
                >
                  {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span
                  className={clsx(
                    'text-sm font-medium',
                    selected ? 'text-kimchi-red' : 'text-brand-text-primary'
                  )}
                >
                  {strategy.name}
                </span>
                {recommended && (
                  <span className="inline-flex items-center gap-0.5 bg-kimchi-green/10 text-kimchi-green-dark border border-kimchi-green/20 rounded-full px-2 py-0.5 text-[10px] font-medium">
                    <Sparkles size={10} />
                    추천
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-text-secondary mt-1 pl-[22px]">
                {strategy.description}
              </p>
            </button>

            {/* 선택된 전략만 파라미터 표시 */}
            {selected && (
              <div className="px-3 pb-3">{renderParams(strategy.method)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
