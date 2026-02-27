'use client';
// E6: 업로드된 문서 목록 + 삭제
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
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">업로드된 문서</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            총 {documents.length}개 · 청크 {vectorStoreSize}개
          </p>
        </div>
        <button
          type="button"
          onClick={fetchDocuments}
          disabled={loading}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
          title="새로고침"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 목록 */}
      {loading && documents.length === 0 ? (
        <div className="text-xs text-gray-400 py-4 text-center">로딩 중...</div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <FileText size={28} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">업로드된 문서가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <FileText size={16} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                <p className="text-xs text-gray-400">
                  {doc.fileType.toUpperCase()} · {formatFileSize(doc.fileSize)} · 청크 {doc.chunks}개 · {formatDate(doc.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(doc)}
                disabled={deletingId === doc.id}
                className="p-1.5 rounded-lg text-gray-300 hover:text-kimchi-red hover:bg-red-50 transition-colors disabled:opacity-40 shrink-0"
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
