'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageBubble } from '@/components/chat/message-bubble';
import { ChatLayout } from '@/components/chat/chat-layout';
import { storage, Message, FunctionResult } from '@/lib/storage';
import {
  needsMigration,
  migrateLocalStorageToSupabase,
} from '@/lib/migration';
import {
  X,
  Download,
  Upload,
  MessageSquare,
  Settings,
  Send,
  Sparkles,
  Keyboard,
  RefreshCw,
  Zap,
  ZapOff,
} from 'lucide-react';
import { useMCP } from '@/lib/mcp-context';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { MCPStatus } from '@/components/mcp/mcp-status';
import { ChatHeader } from '@/components/chat/chat-header';
import Link from 'next/link';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [useMCPTools, setUseMCPTools] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { connectedServers } = useMCP();

  // 현재 세션 로드
  useEffect(() => {
    const loadSession = async () => {
      // 마이그레이션 필요 여부 확인
      if (needsMigration()) {
        setShowMigrationBanner(true);
      }

      const sessionId = storage.getCurrentSessionId();
      if (sessionId) {
        const session = await storage.getSession(sessionId);
        if (session) {
          setCurrentSessionId(sessionId);
          setMessages(session.messages);
        }
      }
    };

    loadSession();
  }, []);

  // 메시지 변경 시 스토리지에 저장
  const saveMessages = useCallback(async () => {
    if (currentSessionId && messages.length > 0) {
      const session = await storage.getSession(currentSessionId);
      if (session) {
        session.messages = messages;
        session.updatedAt = Date.now();
        await storage.saveSession(session);
        await storage.autoUpdateTitle(currentSessionId);
      }
    }
  }, [currentSessionId, messages]);

  useEffect(() => {
    saveMessages();
  }, [saveMessages]);

  // 메시지가 추가될 때마다 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 세션 변경 감지 (사이드바에서 다른 세션 선택 시)
  useEffect(() => {
    const handleStorageChange = async () => {
      const sessionId = storage.getCurrentSessionId();
      if (sessionId !== currentSessionId) {
        const session = await storage.getSession(sessionId || '');
        if (session) {
          setCurrentSessionId(sessionId);
          setMessages(session.messages);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('session-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('session-changed', handleStorageChange);
    };
  }, [currentSessionId]);

  // 새 채팅 생성 시 입력창에 포커스
  useEffect(() => {
    const handleNewChatCreated = () => {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    };

    window.addEventListener('new-chat-created', handleNewChatCreated);
    return () => {
      window.removeEventListener('new-chat-created', handleNewChatCreated);
    };
  }, []);

  // 세션이 변경되고 메시지가 비어있을 때도 포커스 (다른 세션에서 새 채팅으로 전환 시)
  useEffect(() => {
    if (currentSessionId && messages.length === 0) {
      // 약간의 지연을 두어 DOM이 완전히 렌더링된 후 포커스
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentSessionId, messages.length]);

  const handleMigration = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateLocalStorageToSupabase();
      if (result.success) {
        alert(`${result.migratedCount}개의 채팅이 Supabase로 마이그레이션되었습니다.`);
        setShowMigrationBanner(false);
        window.dispatchEvent(new Event('session-changed'));
      } else {
        alert(
          `마이그레이션 완료: ${result.migratedCount}개 성공\n오류: ${result.errors.join('\n')}`
        );
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Migration failed:', error);
      }
      alert('마이그레이션 중 오류가 발생했습니다.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }

    // 세션이 없으면 새로 생성
    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession = await storage.createSession();
      sessionId = newSession.id;
      setCurrentSessionId(sessionId);
      storage.setCurrentSessionId(sessionId);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    await storage.addMessage(sessionId, userMessage);
    setInput('');

    // AbortController 생성
    const controller = new AbortController();
    setAbortController(controller);
    setIsLoading(true);

    try {
      const history = newMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          history,
          useMCPTools: useMCPTools && connectedServers.length > 0,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || 'Failed to get response');
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        functionCalls: [],
        functionResults: [],
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      await storage.addMessage(sessionId, assistantMessage);

      let buffer = '';
      let fullContent = '';
      interface FunctionCall {
        name: string;
        args: Record<string, unknown>;
      }
      const functionCalls: FunctionCall[] = [];
      const functionResults: FunctionResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              
              // Function Calling 처리
              if (parsed.type === 'function_call') {
                functionCalls.push(parsed.functionCall);
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.functionCalls = [...functionCalls];
                  }
                  return updated;
                });
              }
              
              // Function 결과 처리
              if (parsed.type === 'function_result') {
                functionResults.push({
                  name: parsed.functionCall.name,
                  response: parsed.result,
                });
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.functionResults = [...functionResults];
                  }
                  return updated;
                });
              }
              
              // Function 오류 처리
              if (parsed.type === 'function_error') {
                functionResults.push({
                  name: parsed.functionCall.name,
                  response: null,
                  error: parsed.error,
                });
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.functionResults = [...functionResults];
                  }
                  return updated;
                });
              }
              
              // 텍스트 콘텐츠 처리
              if (parsed.text) {
                fullContent += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.content = fullContent;
                    lastMsg.functionCalls = functionCalls.length > 0 ? functionCalls : undefined;
                    lastMsg.functionResults = functionResults.length > 0 ? functionResults : undefined;
                  }
                  return updated;
                });
                await storage.updateLastMessage(sessionId, fullContent);
              }
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Failed to parse SSE data:', error);
              }
            }
          }
        }
      }
      
      // 최종 메시지 저장 (Function Calling 정보 포함)
      const finalMessage = {
        ...assistantMessage,
        content: fullContent,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        functionResults: functionResults.length > 0 ? functionResults : undefined,
      };
      const session = await storage.getSession(sessionId);
      if (session) {
        const messageIndex = session.messages.findIndex((m) => m.id === assistantMessage.id);
        if (messageIndex >= 0) {
          session.messages[messageIndex] = finalMessage;
          await storage.saveSession(session);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 취소된 경우 메시지 제거
        setMessages((prev) => prev.slice(0, -1));
        const session = await storage.getSession(sessionId);
        if (session && session.messages.length > 0) {
          session.messages = session.messages.slice(0, -1);
          await storage.saveSession(session);
        }
        return;
      }

      if (process.env.NODE_ENV === 'development') {
        console.error('Error:', error);
      }
      const errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `오류: ${errorMessage}\n\n환경 변수 GEMINI_API_KEY가 설정되어 있는지 확인해주세요.`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setAbortController(null);
      // AI 응답 완료 후 입력창에 자동 포커스
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleCancel = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  }, [abortController]);

  const handleExport = async () => {
    if (!currentSessionId || messages.length === 0) {
      alert('내보낼 채팅이 없습니다.');
      return;
    }

    const session = await storage.getSession(currentSessionId);
    if (!session) return;

    // JSON 형식으로 내보내기
    const data = {
      title: session.title,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.updatedAt).toISOString(),
      messages: session.messages,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title || 'chat'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.messages || !Array.isArray(data.messages)) {
          throw new Error('Invalid file format');
        }

        const newSession = await storage.createSession(data.title || '가져온 채팅');
        newSession.messages = data.messages;
        newSession.createdAt = data.createdAt
          ? new Date(data.createdAt).getTime()
          : Date.now();
        newSession.updatedAt = data.updatedAt
          ? new Date(data.updatedAt).getTime()
          : Date.now();

        await storage.saveSession(newSession);
        setCurrentSessionId(newSession.id);
        storage.setCurrentSessionId(newSession.id);
        setMessages(newSession.messages);
        window.dispatchEvent(new Event('session-changed'));

        alert('채팅을 성공적으로 가져왔습니다.');
      } catch (error) {
        alert('파일을 읽는 중 오류가 발생했습니다.');
        if (process.env.NODE_ENV === 'development') {
          console.error(error);
        }
      }
    };
    fileInput.click();
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Esc: 스트리밍 취소
      if (e.key === 'Escape' && isLoading) {
        handleCancel();
      }
      // Ctrl+N: 새 채팅
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        const newSession = await storage.createSession();
        setCurrentSessionId(newSession.id);
        storage.setCurrentSessionId(newSession.id);
        setMessages([]);
        window.dispatchEvent(new Event('session-changed'));
        // 입력창에 포커스
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, handleCancel]);

  return (
    <ChatLayout>
      <div className="flex flex-col h-full bg-background">
        {/* 마이그레이션 배너 */}
        {showMigrationBanner && (
          <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 px-4 py-3">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <RefreshCw size={16} />
                <span className="text-sm">
                  기존 LocalStorage 데이터를 Supabase로 마이그레이션할 수 있습니다.
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleMigration}
                  disabled={isMigrating}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isMigrating ? '마이그레이션 중...' : '마이그레이션'}
                </button>
                <button
                  onClick={() => setShowMigrationBanner(false)}
                  className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  나중에
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 헤더 */}
        <ChatHeader
          messagesLength={messages.length}
          isLoading={isLoading}
          onExport={handleExport}
          onImport={handleImport}
          onCancel={handleCancel}
        />

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-4 py-6 chat-pattern-bg pb-safe">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground mt-20">
                <div className="flex justify-center mb-4">
                  <Sparkles size={48} className="text-primary/50" />
                </div>
                <p className="text-lg mb-2 font-medium">안녕하세요! 무엇을 도와드릴까요?</p>
                <p className="text-sm mb-4">메시지를 입력하고 전송 버튼을 눌러주세요.</p>
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Keyboard size={14} />
                    <span>Ctrl+N (새 채팅)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <X size={14} />
                    <span>Esc (취소)</span>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  images={message.images}
                  functionCalls={message.functionCalls}
                  functionResults={message.functionResults}
                />
              ))
            )}
            {isLoading && messages.length > 0 && (
              <div className="flex justify-start">
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 rounded-lg px-4 py-2">
                  <span className="animate-pulse">입력 중...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 입력 영역 */}
        <footer className="border-t border-border bg-white dark:bg-gray-900 px-4 py-4 shadow-lg relative z-20">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            {/* MCP 도구 토글 및 상태 표시 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseMCPTools(!useMCPTools)}
                  disabled={connectedServers.length === 0}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    useMCPTools && connectedServers.length > 0
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                  } ${connectedServers.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                  title={connectedServers.length === 0 ? 'MCP 서버에 연결하세요' : useMCPTools ? 'MCP 도구 비활성화' : 'MCP 도구 활성화'}
                >
                  {useMCPTools && connectedServers.length > 0 ? (
                    <>
                      <Zap size={12} className="text-yellow-500" />
                      <span>MCP 도구 ON</span>
                    </>
                  ) : (
                    <>
                      <ZapOff size={12} />
                      <span>MCP 도구 OFF</span>
                    </>
                  )}
                </button>
                {connectedServers.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    ({connectedServers.length}개 서버 연결됨)
                  </span>
                )}
                {connectedServers.length === 0 && (
                  <Link
                    href="/mcp"
                    className="text-[10px] text-violet-500 hover:underline"
                  >
                    서버 연결하기
                  </Link>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={useMCPTools && connectedServers.length > 0 ? "MCP 도구를 사용하여 질문하세요..." : "메시지를 입력하세요..."}
                disabled={isLoading}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2 shadow-sm"
              >
                <Send size={18} />
                전송
              </button>
            </div>
          </form>
        </footer>
      </div>
    </ChatLayout>
  );
}
