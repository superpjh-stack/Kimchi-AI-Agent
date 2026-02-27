'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import type { ChunkingOptions as ChunkingOptionsType, ChunkingMethod } from '@/types';
import { CHUNKING_STRATEGIES } from '@/lib/rag/chunker';

interface ChunkingOptionsProps {
  fileExtension: string;
  value: ChunkingOptionsType;
  onChange: (options: ChunkingOptionsType) => void;
}

export default function ChunkingOptionsSelector({ fileExtension, value, onChange }: ChunkingOptionsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isRecommended = (method: ChunkingMethod) => {
    const strategy = CHUNKING_STRATEGIES.find((s) => s.method === method);
    return strategy?.recommendedFor.includes(fileExtension) ?? false;
  };

  const handleMethodChange = (method: ChunkingMethod) => {
    const strategy = CHUNKING_STRATEGIES.find((s) => s.method === method);
    const defaults = strategy?.defaults ?? {};
    onChange({ ...defaults, method });
  };

  const renderAdvancedFields = () => {
    switch (value.method) {
      case 'recursive':
      case 'fixed':
        return (
          <>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-20">청크 크기</span>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={value.chunkSize ?? 1000}
                onChange={(e) => onChange({ ...value, chunkSize: Number(e.target.value) })}
                className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-kimchi-red"
              />
              <span>자</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-20">오버랩</span>
              <input
                type="number"
                min={0}
                max={2000}
                step={50}
                value={value.chunkOverlap ?? (value.method === 'recursive' ? 200 : 100)}
                onChange={(e) => onChange({ ...value, chunkOverlap: Number(e.target.value) })}
                className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-kimchi-red"
              />
              <span>자</span>
            </label>
          </>
        );
      case 'paragraph':
        return (
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-20">최대 크기</span>
            <input
              type="number"
              min={500}
              max={10000}
              step={100}
              value={value.maxChunkSize ?? 2000}
              onChange={(e) => onChange({ ...value, maxChunkSize: Number(e.target.value) })}
              className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-kimchi-red"
            />
            <span>자</span>
          </label>
        );
      case 'row':
        return (
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-20">청크당 행수</span>
            <input
              type="number"
              min={5}
              max={500}
              step={5}
              value={value.rowsPerChunk ?? 50}
              onChange={(e) => onChange({ ...value, rowsPerChunk: Number(e.target.value) })}
              className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-kimchi-red"
            />
            <span>행</span>
          </label>
        );
      case 'sentence':
        return (
          <>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-20">청크당 문장</span>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={value.sentencesPerChunk ?? 10}
                onChange={(e) => onChange({ ...value, sentencesPerChunk: Number(e.target.value) })}
                className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-kimchi-red"
              />
              <span>문장</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-20">오버랩</span>
              <input
                type="number"
                min={0}
                max={20}
                step={1}
                value={value.sentenceOverlap ?? 2}
                onChange={(e) => onChange({ ...value, sentenceOverlap: Number(e.target.value) })}
                className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-kimchi-red"
              />
              <span>문장</span>
            </label>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 mb-2">청킹 방법 선택</p>

      {CHUNKING_STRATEGIES.map((strategy) => {
        const selected = value.method === strategy.method;
        const recommended = isRecommended(strategy.method);

        return (
          <button
            key={strategy.method}
            type="button"
            onClick={() => handleMethodChange(strategy.method)}
            className={clsx(
              'w-full text-left border rounded-lg px-3 py-2.5 transition-all duration-150',
              selected
                ? 'border-kimchi-red bg-red-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0',
                  selected ? 'border-kimchi-red bg-kimchi-red' : 'border-gray-300'
                )}
              >
                {selected && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}
              </div>
              <span className={clsx('text-sm font-medium', selected ? 'text-kimchi-red' : 'text-gray-700')}>
                {strategy.name}
              </span>
              {recommended && (
                <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 text-[10px] font-medium">
                  <Sparkles size={10} />
                  추천
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1 ml-5.5 pl-[22px]">{strategy.description}</p>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mt-2"
      >
        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        고급 설정
      </button>

      {showAdvanced && (
        <div className="space-y-2 pl-1 pt-1 border-t border-gray-100">
          {renderAdvancedFields()}
        </div>
      )}
    </div>
  );
}
