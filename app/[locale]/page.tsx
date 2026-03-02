'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import type { TabId } from '@/components/layout/BottomNav';
import ChatWindow from '@/components/chat/ChatWindow';
import DocumentUpload from '@/components/documents/DocumentUpload';
import DocumentList from '@/components/documents/DocumentList';
import QuestionPanel from '@/components/questions/QuestionPanel';
import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import { useAlerts } from '@/hooks/useAlerts';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import KimchiMascotContainer from '@/components/mascot/KimchiMascotContainer';
import { useMascotAlertBridge } from '@/hooks/useMascotAlertBridge';

// 무거운 패널은 dynamic import로 초기 번들 분리
const DashboardPanel = dynamic(() => import('@/components/dashboard/DashboardPanel'), {
  loading: () => <div className="animate-pulse h-40 bg-gray-100 rounded-lg" />,
  ssr: false,
});

export default function HomePage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<TabId>('dashboard');
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);

  // 비로그인 시 /login 으로 리다이렉트
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // 로딩 중이거나 비인증 상태면 로딩 스피너 표시
  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-kimchi-cream">
        <div className="animate-spin h-8 w-8 border-4 border-kimchi-red border-t-transparent rounded-full" />
      </div>
    );
  }

  const {
    conversations,
    activeId,
    setActiveId,
    deleteConversation,
    refresh: refreshConversations,
  } = useConversations();

  const { messages, isStreaming, chatStatus, sendMessage, clearMessages, loadMessages } = useChat(
    activeId ?? undefined
  );
  const { criticalCount, warningCount } = useAlerts();
  useMascotAlertBridge(criticalCount, warningCount);
  const tts = useTextToSpeech({ lang: 'ko-KR' });

  // 스트리밍 완료 시 대화 목록 갱신 (새 대화가 사이드바에 반영)
  const prevIsStreaming = useRef(false);
  useEffect(() => {
    if (prevIsStreaming.current && !isStreaming) {
      refreshConversations();
    }
    prevIsStreaming.current = isStreaming;
  }, [isStreaming, refreshConversations]);

  const handleNewChat = () => {
    clearMessages();
    setActiveId(null);
    setSidebarOpen(false);
    setBottomTab('chat');
  };

  const handleSelectConversation = async (id: string) => {
    setActiveId(id);
    clearMessages();
    setSidebarOpen(false);
    setBottomTab('chat');

    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json;
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          loadMessages(data.messages);
        }
      }
    } catch {
      // 로드 실패 시 빈 대화로 유지
    }
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
    if (activeId === id) {
      clearMessages();
    }
  };

  const handleSelectQuestion = (question: string) => {
    sendMessage(question);
    // Switch to chat tab on mobile
    setBottomTab('chat');
  };

  const activeConversation = conversations.find((c) => c.id === activeId);
  const headerTitle = activeConversation?.title ?? '새 대화';

  return (
    <div className="flex h-screen overflow-hidden bg-kimchi-cream">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId ?? undefined}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDelete={handleDeleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        criticalAlerts={criticalCount}
        warningAlerts={warningCount}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          title={headerTitle}
          onMenuToggle={() => setSidebarOpen(true)}
          questionPanelOpen={questionPanelOpen}
          onQuestionPanelToggle={() => setQuestionPanelOpen((v) => !v)}
          activeTab={bottomTab}
          onTabChange={setBottomTab}
        />

        {/* Main area + right panel row */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main area — on mobile, add bottom padding for BottomNav */}
          <main id="main-content" className="flex-1 overflow-hidden pb-14 lg:pb-0 min-w-0">
            {bottomTab === 'dashboard' ? (
              <DashboardPanel />
            ) : bottomTab === 'documents' ? (
              <div className="h-full overflow-y-auto">
                <div className="max-w-xl mx-auto px-4 py-6">
                  <h2 className="text-base font-semibold text-brand-text-primary mb-4 flex items-center gap-2">
                    <span>📄</span> 문서 관리
                  </h2>
                  <DocumentUpload />
                  <DocumentList />
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                <ChatWindow
                  messages={messages}
                  isStreaming={isStreaming}
                  chatStatus={chatStatus}
                  onSend={sendMessage}
                  conversationId={activeId ?? undefined}
                  tts={tts}
                />
              </div>
            )}
          </main>

          {/* Question panel: desktop (static in row) + mobile (fixed overlay via CSS) */}
          <QuestionPanel
            isOpen={questionPanelOpen || bottomTab === 'questions'}
            onClose={() => {
              setQuestionPanelOpen(false);
              if (bottomTab === 'questions') setBottomTab('dashboard');
            }}
            onSelectQuestion={handleSelectQuestion}
          />
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav
        activeTab={bottomTab}
        onTabChange={setBottomTab}
        onConversationsOpen={() => setSidebarOpen(true)}
        onQuestionsOpen={() => setBottomTab('questions')}
      />

      {/* 김치군 마스코트 */}
      <KimchiMascotContainer />
    </div>
  );
}
