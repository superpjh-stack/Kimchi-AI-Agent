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

      const json = await res.json();
      const doc = (json.data ?? json) as KimchiDocument;
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
              ? 'border-kimchi-red bg-kimchi-red/5'
              : 'border-kimchi-beige-dark hover:border-kimchi-orange hover:bg-kimchi-cream'
          )}
        >
          <div className="text-3xl mb-2">📄</div>
          <Upload size={28} className="mx-auto mb-2 text-brand-text-muted" />
          <p className="text-sm font-medium text-brand-text-secondary mb-1">파일을 드래그하거나 클릭하여 업로드</p>
          <p className="text-xs text-brand-text-muted">지원 형식: {ACCEPTED.join(', ')} · 최대 {MAX_SIZE_MB}MB</p>
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
        <div className="border rounded-xl p-4 bg-white border-kimchi-beige-dark space-y-4">
          <div className="flex items-start gap-3">
            <File size={20} className="text-brand-text-secondary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-text-primary truncate">{selectedFile.name}</p>
              <p className="text-xs text-brand-text-muted">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={reset} className="text-brand-text-muted hover:text-brand-text-secondary">
              <X size={16} />
            </button>
          </div>

          <ChunkingOptionsSelector
            fileExtension={fileExt}
            fileSize={selectedFile.size}
            value={chunkingOptions}
            onChange={setChunkingOptions}
          />

          <button
            onClick={handleUpload}
            className="w-full bg-kimchi-red hover:bg-kimchi-red-dark text-white rounded-lg py-2.5 text-sm font-medium transition-colors shadow-sm"
          >
            업로드 시작 🌶️
          </button>
        </div>
      )}

      {status === 'uploading' && (
        <div className="border rounded-xl p-6 text-center bg-kimchi-orange/5 border-kimchi-orange/20">
          <Loader2 size={28} className="mx-auto mb-2 text-kimchi-orange animate-spin" />
          <p className="text-sm text-kimchi-orange font-medium">{statusMsg}</p>
          <p className="text-xs text-brand-text-muted mt-1">문서를 청킹하고 임베딩 중입니다...</p>
        </div>
      )}

      {status === 'success' && uploadedDoc && (
        <div className="border rounded-xl p-4 bg-kimchi-green/5 border-kimchi-green/20">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-kimchi-green flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-kimchi-green-dark">{uploadedDoc.name}</p>
              <p className="text-xs text-kimchi-green mt-0.5">{statusMsg}</p>
            </div>
            <button onClick={reset} className="text-kimchi-green/60 hover:text-kimchi-green">
              <X size={16} />
            </button>
          </div>
          <button
            onClick={reset}
            className="mt-3 w-full text-xs text-kimchi-green hover:text-kimchi-green-dark underline"
          >
            다른 파일 업로드
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="border rounded-xl p-4 bg-kimchi-red/5 border-kimchi-red/20">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-kimchi-red flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-kimchi-red-dark">업로드 실패</p>
              <p className="text-xs text-kimchi-red mt-0.5">{statusMsg}</p>
            </div>
          </div>
          <button
            onClick={reset}
            className="mt-3 w-full text-xs text-kimchi-red hover:text-kimchi-red-dark underline"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
