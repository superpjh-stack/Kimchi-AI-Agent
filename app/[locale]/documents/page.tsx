'use client';

import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import DocumentUpload from '@/components/documents/DocumentUpload';
import type { KimchiDocument } from '@/types';
import { useState } from 'react';

export default function DocumentsPage() {
  const [uploaded, setUploaded] = useState<KimchiDocument[]>([]);

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
            <h1 className="text-xl font-bold text-gray-900">문서 관리</h1>
            <p className="text-sm text-gray-500">RAG 검색에 사용할 문서를 업로드하세요</p>
          </div>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">문서 업로드</h2>
            <p className="text-xs text-gray-400 mt-0.5">TXT, CSV, PDF, XLSX — 최대 10MB</p>
          </div>
          <DocumentUpload onUploadComplete={(doc) => setUploaded((prev) => [doc, ...prev])} />
        </div>

        {/* Uploaded this session */}
        {uploaded.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">이번 세션 업로드 ({uploaded.length})</h2>
              <p className="text-xs text-gray-400 mt-0.5">서버 재시작 시 초기화됩니다 (Phase 2에서 영구 저장 예정)</p>
            </div>
            <ul className="divide-y divide-gray-50">
              {uploaded.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText size={16} className="text-kimchi-red flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-400">{doc.chunks}개 청크 · {doc.type.toUpperCase()}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
