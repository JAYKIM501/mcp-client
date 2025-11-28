'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChatSidebar } from './chat-sidebar';
import { storage } from '@/lib/storage';
import { ChatLayoutProvider, useChatLayout } from './chat-layout-context';

interface ChatLayoutProps {
  children: React.ReactNode;
}

function ChatLayoutContent({ children }: ChatLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { isMobileSidebarOpen, closeMobileSidebar } = useChatLayout();

  useEffect(() => {
    const initialize = async () => {
      // 사이드바 접힘 상태 복원
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved === 'true') {
        setIsCollapsed(true);
      }

      // 현재 세션 ID 복원
      const sessionId = storage.getCurrentSessionId();
      if (sessionId) {
        const session = await storage.getSession(sessionId);
        if (session) {
          setCurrentSessionId(sessionId);
        }
      }
    };

    initialize();
  }, []);

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    storage.setCurrentSessionId(sessionId);
    window.dispatchEvent(new Event('session-changed'));
  };

  const handleNewChat = useCallback(async () => {
    const newSession = await storage.createSession();
    setCurrentSessionId(newSession.id);
    storage.setCurrentSessionId(newSession.id);
    window.dispatchEvent(new Event('session-changed'));
    // 새 채팅 생성 이벤트 발생 (입력창 포커스용)
    window.dispatchEvent(new CustomEvent('new-chat-created'));
  }, []);

  return (
    <div className="flex h-screen">
      {/* 데스크탑 사이드바 */}
      <ChatSidebar
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        className="hidden md:flex"
      />

      {/* 모바일 사이드바 (오버레이) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={closeMobileSidebar}
          />
          <ChatSidebar
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            isCollapsed={false}
            onToggleCollapse={() => {}}
            className="relative z-10 w-[85%] max-w-[320px] h-full shadow-2xl animate-in slide-in-from-left duration-200"
            isMobile={true}
            onCloseMobile={closeMobileSidebar}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}

export function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <ChatLayoutProvider>
      <ChatLayoutContent>{children}</ChatLayoutContent>
    </ChatLayoutProvider>
  );
}
