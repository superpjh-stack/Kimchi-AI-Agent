'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import ChatWindow from '@/components/chat/ChatWindow';
import DocumentUpload from '@/components/documents/DocumentUpload';
import DocumentList from '@/components/documents/DocumentList';
import ProcessStatusPanel from '@/components/process/ProcessStatusPanel';
import QuestionPanel from '@/components/questions/QuestionPanel';
import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import { useAlerts } from '@/hooks/useAlerts';

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<'chat' | 'conversations' | 'documents' | 'questions'>('chat');
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);

  const {
    conversations,
    activeId,
    setActiveId,
  } = useConversations();

  const { messages, isStreaming, sendMessage, clearMessages } = useChat(
    activeId ?? undefined
  );
  const { criticalCount, warningCount } = useAlerts();

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
    <div className="flex h-screen overflow-hidden bg-gray-50">
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
        />

        {/* Main area + right panel row */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main area — on mobile, add bottom padding for BottomNav */}
          <main className="flex-1 overflow-hidden pb-14 lg:pb-0 min-w-0">
            {bottomTab === 'documents' ? (
              <div className="h-full overflow-y-auto">
                <div className="max-w-xl mx-auto px-4 py-6">
                  <h2 className="text-base font-semibold text-gray-800 mb-4">문서 관리</h2>
                  <DocumentUpload />
                  <DocumentList />
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                <ProcessStatusPanel />
                <div className="flex-1 overflow-hidden">
                  <ChatWindow
                    messages={messages}
                    isStreaming={isStreaming}
                    onSend={sendMessage}
                    conversationId={activeId ?? undefined}
                  />
                </div>
              </div>
            )}
          </main>

          {/* Question panel: desktop (static in row) + mobile (fixed overlay via CSS) */}
          <QuestionPanel
            isOpen={questionPanelOpen || bottomTab === 'questions'}
            onClose={() => {
              setQuestionPanelOpen(false);
              if (bottomTab === 'questions') setBottomTab('chat');
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
