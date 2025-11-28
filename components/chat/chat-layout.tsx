'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChatSidebar } from './chat-sidebar';
import { storage } from '@/lib/storage';

interface ChatLayoutProps {
  children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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
      <ChatSidebar
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
