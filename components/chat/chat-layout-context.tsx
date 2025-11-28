'use client';

import { createContext, useContext, useState } from 'react';

interface ChatLayoutContextType {
  isMobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

const ChatLayoutContext = createContext<ChatLayoutContextType | undefined>(undefined);

export function ChatLayoutProvider({ children }: { children: React.ReactNode }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = () => setIsMobileSidebarOpen((prev) => !prev);
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);

  return (
    <ChatLayoutContext.Provider value={{ isMobileSidebarOpen, toggleMobileSidebar, closeMobileSidebar }}>
      {children}
    </ChatLayoutContext.Provider>
  );
}

export const useChatLayout = () => {
  const context = useContext(ChatLayoutContext);
  if (!context) {
    throw new Error('useChatLayout must be used within ChatLayoutProvider');
  }
  return context;
};

