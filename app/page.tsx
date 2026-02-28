'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
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

// S4-6: 무거운 패널은 dynamic import로 초기 번들 분리
const DashboardPanel = dynamic(() => import('@/components/dashboard/DashboardPanel'), {
  loading: () => <div className="animate-pulse h-40 bg-gray-100 rounded-lg" />,
  ssr: false,
});
// MLPredictionPanel: 향후 독립 탭/뷰에서 사용 예정 (dynamic import 등록 완료)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MLPredictionPanel = dynamic(() => import('@/components/ml/MLPredictionPanel'), {
  loading: () => <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />,
  ssr: false,
});

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<TabId>('dashboard');
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);

  const {
    conversations,
    activeId,
    setActiveId,
    refresh: refreshConversations,
  } = useConversations();

  const { messages, isStreaming, chatStatus, sendMessage, clearMessages } = useChat(
    activeId ?? undefined
  );
  const { criticalCount, warningCount } = useAlerts();
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

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    clearMessages();
    setSidebarOpen(false);
    setBottomTab('chat');
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
          <main className="flex-1 overflow-hidden pb-14 lg:pb-0 min-w-0">
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
    </div>
  );
}
