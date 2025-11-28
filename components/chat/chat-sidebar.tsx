'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, isToday, isYesterday, subDays, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';
import { storage, ChatSession } from '@/lib/storage';
import { PanelLeftClose, PanelLeftOpen, Plus, Trash2, History, MessageSquare, Sparkles, Code, BookOpen, Lightbulb, HelpCircle, Zap, Database, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { loadDemoDataAsync } from '@/lib/demo-data';

interface ChatSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function ChatSidebar({
  currentSessionId,
  onSelectSession,
  onNewChat,
  isCollapsed,
  onToggleCollapse,
}: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['오늘']));
  const [isLoading, setIsLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const allSessions = await storage.getAllSessions();
      setSessions(allSessions.sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    // 주기적으로 새로고침 (다른 탭에서 변경된 경우 대비)
    const interval = setInterval(loadSessions, 3000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  // session-changed 이벤트 리스너
  useEffect(() => {
    const handleSessionChanged = () => {
      loadSessions();
    };

    window.addEventListener('session-changed', handleSessionChanged);
    return () => {
      window.removeEventListener('session-changed', handleSessionChanged);
    };
  }, [loadSessions]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 채팅을 삭제하시겠습니까?')) {
      await storage.deleteSession(id);
      await loadSessions();
      if (currentSessionId === id) {
        onNewChat();
      }
    }
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  };


  // 채팅방 아이콘 선택 함수
  const getChatIcon = (session: ChatSession) => {
    const icons = [MessageSquare, Sparkles, Code, BookOpen, Lightbulb, HelpCircle, Zap];
    
    // 메시지 내용에 따라 아이콘 선택 (선택적)
    if (session.messages.length > 0) {
      const firstMessage = session.messages[0]?.content.toLowerCase() || '';
      if (firstMessage.includes('코드') || firstMessage.includes('프로그래밍') || firstMessage.includes('개발')) {
        return Code;
      }
      if (firstMessage.includes('학습') || firstMessage.includes('공부') || firstMessage.includes('책')) {
        return BookOpen;
      }
      if (firstMessage.includes('아이디어') || firstMessage.includes('생각') || firstMessage.includes('제안')) {
        return Lightbulb;
      }
      if (firstMessage.includes('질문') || firstMessage.includes('도움') || firstMessage.includes('어떻게')) {
        return HelpCircle;
      }
    }
    
    // 세션 ID를 기반으로 아이콘 선택 (일관성 유지)
    // ID에서 숫자 추출 또는 문자열 해시
    let hash = 0;
    for (let i = 0; i < session.id.length; i++) {
      const char = session.id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    const index = Math.abs(hash) % icons.length;
    return icons[index];
  };

  const groupSessions = (sessions: ChatSession[]) => {
    const now = new Date();
    const groups: { label: string; sessions: ChatSession[] }[] = [
      { label: '오늘', sessions: [] },
      { label: '어제', sessions: [] },
      { label: '지난 7일', sessions: [] },
      { label: '지난 30일', sessions: [] },
      { label: '그 이전', sessions: [] },
    ];

    sessions.forEach((session) => {
      const date = new Date(session.updatedAt);
      if (isToday(date)) {
        groups[0].sessions.push(session);
      } else if (isYesterday(date)) {
        groups[1].sessions.push(session);
      } else if (isAfter(date, subDays(now, 7))) {
        groups[2].sessions.push(session);
      } else if (isAfter(date, subDays(now, 30))) {
        groups[3].sessions.push(session);
      } else {
        groups[4].sessions.push(session);
      }
    });

    return groups.filter((g) => g.sessions.length > 0);
  };

  const groupedSessions = groupSessions(sessions);

  if (isCollapsed) {
    return (
      <div className="w-12 border-r border-border bg-background flex flex-col items-center py-2">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="사이드바 펼치기"
        >
          <PanelLeftOpen size={20} />
        </button>
        <button
          onClick={onNewChat}
          className="mt-2 p-2 hover:bg-muted rounded-lg transition-colors"
          title="새 채팅"
        >
          <Plus size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border bg-white dark:bg-gray-900 flex flex-col h-full">
      {/* 헤더 */}
      <div className="p-3 border-b border-border bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={16} />
          <h2 className="font-semibold text-sm">채팅 히스토리</h2>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onNewChat}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="새 채팅"
          >
            <Plus size={16} />
          </button>
          {/* 데모 데이터 로드 버튼 */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const count = await loadDemoDataAsync();
              await loadSessions();
              alert(`${count}개의 데모 채팅이 추가되었습니다.`);
            }}
            className="p-1.5 hover:bg-muted rounded transition-colors text-blue-500"
            title="데모 데이터 로드 (기간별 테스트용)"
          >
            <Database size={16} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="사이드바 접기"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      {/* 세션 목록 */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : groupedSessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <p>채팅 내역이 없습니다</p>
            <button
              onClick={onNewChat}
              className="mt-2 flex items-center gap-1 mx-auto text-primary hover:underline"
            >
              <Plus size={14} />
              새 채팅 시작하기
            </button>
          </div>
        ) : (
          groupedSessions.map((group) => {
            const isExpanded = expandedGroups.has(group.label);
            const isTodayGroup = group.label === '오늘';
            
            return (
              <div key={group.label} className="border-b border-border/50 last:border-b-0">
                {/* 아코디언 헤더 */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors ${
                    isTodayGroup ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-gray-50 dark:bg-gray-900/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-muted-foreground" />
                    ) : (
                      <ChevronRight size={14} className="text-muted-foreground" />
                    )}
                    <span className="text-xs font-semibold text-foreground">
                      {group.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({group.sessions.length})
                    </span>
                  </div>
                </button>
                
                {/* 아코디언 내용 */}
                {isExpanded && (
                  <div className="py-1">
                    {group.sessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => onSelectSession(session.id)}
                        className={`px-3 py-2 mx-2 rounded-lg cursor-pointer group transition-colors ${
                          currentSessionId === session.id
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-muted/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 flex items-start gap-2">
                            <div className="mt-0.5 flex-shrink-0">
                              {(() => {
                                const IconComponent = getChatIcon(session);
                                return (
                                  <IconComponent
                                    size={16}
                                    className={
                                      currentSessionId === session.id
                                        ? 'text-primary'
                                        : 'text-muted-foreground'
                                    }
                                  />
                                );
                              })()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-sm truncate ${
                                  currentSessionId === session.id
                                    ? 'font-medium text-primary'
                                    : 'text-foreground'
                                }`}
                                title={session.title}
                              >
                                {session.title}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(session.updatedAt), 'MM/dd HH:mm', {
                                  locale: ko,
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleDelete(session.id, e)}
                              className="p-1 hover:bg-background rounded text-destructive"
                              title="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
