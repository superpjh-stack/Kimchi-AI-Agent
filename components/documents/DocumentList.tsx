'use client';
// E6: uploaded document list + delete
import { useState, useEffect, useCallback } from 'react';
import { Trash2, FileText, RefreshCw } from 'lucide-react';
import type { KimchiDocument } from '@/types';

interface DocsApiResponse {
  data?: { documents: KimchiDocument[]; vectorStoreSize: number };
  error?: { code: string; message: string };
}

export default function DocumentList() {
  const [documents, setDocuments] = useState<KimchiDocument[]>([]);
  const [vectorStoreSize, setVectorStoreSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      const json: DocsApiResponse = await res.json();
      if (json.data) {
        setDocuments(json.data.documents);
        setVectorStoreSize(json.data.vectorStoreSize);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDelete = async (doc: KimchiDocument) => {
    if (!confirm(`"${doc.name}" 문서를 삭제할까요?\n벡터 데이터도 함께 삭제됩니다.`)) return;
    setDeletingId(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        setVectorStoreSize((prev) => Math.max(0, prev - doc.chunks));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-1.5">
            <span>📋</span> 업로드된 문서
          </h3>
          <p className="text-xs text-brand-text-muted mt-0.5">
            총 {documents.length}개 · 청크 {vectorStoreSize}개
          </p>
        </div>
        <button
          type="button"
          onClick={fetchDocuments}
          disabled={loading}
          className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text-secondary hover:bg-kimchi-beige transition-colors disabled:opacity-40"
          title="새로고침"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* List */}
      {loading && documents.length === 0 ? (
        <div className="text-xs text-brand-text-muted py-4 text-center">로딩 중...</div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm text-brand-text-secondary">업로드된 문서가 없습니다</p>
          <p className="text-xs text-brand-text-muted mt-1">문서를 업로드하면 AI가 참고합니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-kimchi-beige-dark hover:border-kimchi-orange/40 transition-colors"
            >
              <FileText size={16} className="text-kimchi-orange shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-text-primary truncate">{doc.name}</p>
                <p className="text-xs text-brand-text-muted">
                  {(doc.fileType ?? doc.type ?? '').toUpperCase()} · {formatFileSize(doc.fileSize ?? 0)} · 청크 {doc.chunks}개 · {formatDate(doc.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(doc)}
                disabled={deletingId === doc.id}
                className="p-1.5 rounded-lg text-brand-text-muted hover:text-kimchi-red hover:bg-kimchi-red/5 transition-colors disabled:opacity-40 shrink-0"
                title="삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
