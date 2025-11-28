'use client';

import { MessageSquare, Settings, Download, Upload, X, Menu } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { MCPStatus } from '@/components/mcp/mcp-status';
import { useChatLayout } from './chat-layout-context';

interface ChatHeaderProps {
  messagesLength: number;
  isLoading: boolean;
  onExport: () => void;
  onImport: () => void;
  onCancel: () => void;
}

export function ChatHeader({
  messagesLength,
  isLoading,
  onExport,
  onImport,
  onCancel
}: ChatHeaderProps) {
  const { toggleMobileSidebar } = useChatLayout();

  return (
    <header className="border-b border-border bg-white dark:bg-gray-900 px-3 py-3 sm:px-4 shadow-sm sticky top-0 z-10 mb-safe">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button
            onClick={toggleMobileSidebar}
            className="md:hidden p-2 -ml-2 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
            title="메뉴"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <MessageSquare size={20} className="hidden sm:block text-primary" />
            <h1 className="text-lg sm:text-xl font-semibold truncate">AI 채팅</h1>
          </div>
          
          <Link
            href="/mcp"
            className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-2"
          >
            <Settings size={16} />
            <span className="hidden lg:inline">MCP 관리</span>
          </Link>
          
          <div className="hidden sm:block">
            <MCPStatus />
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-2">
          {/* 모바일에서 MCP 상태 표시 (간소화) */}
          <div className="sm:hidden mr-1">
            <MCPStatus />
          </div>
          
          {messagesLength > 0 && (
            <>
              <button
                onClick={onExport}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                title="내보내기"
              >
                <Download size={18} />
              </button>
              <button
                onClick={onImport}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                title="가져오기"
              >
                <Upload size={18} />
              </button>
            </>
          )}
          
          {isLoading && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
              <span className="hidden sm:inline">취소</span>
            </button>
          )}
          
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

