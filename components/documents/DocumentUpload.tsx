'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, File, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import type { KimchiDocument, ChunkingOptions } from '@/types';
import ChunkingOptionsSelector from './ChunkingOptions';
import { CHUNKING_STRATEGIES } from '@/lib/rag/chunker';

interface DocumentUploadProps {
  onUploadComplete?: (doc: KimchiDocument) => void;
}

type UploadStatus = 'idle' | 'fileSelected' | 'uploading' | 'success' | 'error';

const ACCEPTED = ['.txt', '.csv', '.pdf', '.xlsx'];
const MAX_SIZE_MB = 10;

function getDefaultChunkingOptions(ext: string): ChunkingOptions {
  // Find the strategy that recommends this extension
  const recommended = CHUNKING_STRATEGIES.find((s) =>
    s.recommendedFor.includes(ext)
  );
  if (recommended) {
    return { ...recommended.defaults, method: recommended.method };
  }
  // Default to recursive
  return { method: 'recursive', chunkSize: 1000, chunkOverlap: 200 };
}

export default function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [uploadedDoc, setUploadedDoc] = useState<KimchiDocument | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [chunkingOptions, setChunkingOptions] = useState<ChunkingOptions>({
    method: 'recursive',
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setStatus('error');
      setStatusMsg(`지원하지 않는 형식입니다. (지원: ${ACCEPTED.join(', ')})`);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setStatus('error');
      setStatusMsg(`파일 크기가 너무 큽니다. (최대 ${MAX_SIZE_MB}MB)`);
      return;
    }

    setSelectedFile(file);
    setChunkingOptions(getDefaultChunkingOptions(ext));
    setStatus('fileSelected');
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setStatus('uploading');
    setStatusMsg('업로드 중...');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', selectedFile.name);
    formData.append('chunkingMethod', chunkingOptions.method);
    formData.append('chunkingOptions', JSON.stringify(chunkingOptions));

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `업로드 실패 (${res.status})`);
      }

      const doc = await res.json() as KimchiDocument;
      setUploadedDoc(doc);
      setStatus('success');
      setStatusMsg(`${doc.chunks}개 청크로 처리 완료`);
      onUploadComplete?.(doc);
    } catch (err) {
      setStatus('error');
      setStatusMsg(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  }, [selectedFile, chunkingOptions, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const reset = () => {
    setStatus('idle');
    setStatusMsg('');
    setUploadedDoc(null);
    setSelectedFile(null);
    setChunkingOptions({ method: 'recursive', chunkSize: 1000, chunkOverlap: 200 });
    if (inputRef.current) inputRef.current.value = '';
  };

  const fileExt = selectedFile
    ? '.' + selectedFile.name.split('.').pop()?.toLowerCase()
    : '';

  return (
    <div className="p-4">
      {status === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
            isDragging
              ? 'border-kimchi-red bg-red-50'
              : 'border-gray-300 hover:border-kimchi-red hover:bg-red-50'
          )}
        >
          <Upload size={32} className="mx-auto mb-3 text-gray-400" />
          <p className="text-sm font-medium text-gray-600 mb-1">파일을 드래그하거나 클릭하여 업로드</p>
          <p className="text-xs text-gray-400">지원 형식: {ACCEPTED.join(', ')} · 최대 {MAX_SIZE_MB}MB</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
          />
        </div>
      )}

      {status === 'fileSelected' && selectedFile && (
        <div className="border rounded-xl p-4 bg-white border-gray-200 space-y-4">
          <div className="flex items-start gap-3">
            <File size={20} className="text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={reset} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <ChunkingOptionsSelector
            fileExtension={fileExt}
            value={chunkingOptions}
            onChange={setChunkingOptions}
          />

          <button
            onClick={handleUpload}
            className="w-full bg-kimchi-red hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            업로드
          </button>
        </div>
      )}

      {status === 'uploading' && (
        <div className="border rounded-xl p-6 text-center bg-blue-50 border-blue-200">
          <Loader2 size={28} className="mx-auto mb-2 text-blue-500 animate-spin" />
          <p className="text-sm text-blue-700">{statusMsg}</p>
          <p className="text-xs text-blue-400 mt-1">문서를 청킹하고 임베딩 중입니다...</p>
        </div>
      )}

      {status === 'success' && uploadedDoc && (
        <div className="border rounded-xl p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800">{uploadedDoc.name}</p>
              <p className="text-xs text-green-600 mt-0.5">{statusMsg}</p>
            </div>
            <button onClick={reset} className="text-green-400 hover:text-green-600">
              <X size={16} />
            </button>
          </div>
          <button
            onClick={reset}
            className="mt-3 w-full text-xs text-green-600 hover:text-green-800 underline"
          >
            다른 파일 업로드
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="border rounded-xl p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">업로드 실패</p>
              <p className="text-xs text-red-600 mt-0.5">{statusMsg}</p>
            </div>
          </div>
          <button
            onClick={reset}
            className="mt-3 w-full text-xs text-red-500 hover:text-red-700 underline"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
