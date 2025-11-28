import { supabase, DbChatSession, DbMessage } from './supabase';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

const CURRENT_SESSION_KEY = 'current-session-id';

// DB -> App 타입 변환
function toAppSession(
  dbSession: DbChatSession,
  messages: DbMessage[]
): ChatSession {
  return {
    id: dbSession.id,
    title: dbSession.title,
    createdAt: dbSession.created_at,
    updatedAt: dbSession.updated_at,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })),
  };
}

// 메시지 내용을 기반으로 제목 생성 (스마트 요약)
function generateTitleFromMessages(messages: Message[]): string {
  if (messages.length === 0) return '새 채팅';

  // 첫 번째 사용자 메시지에서 제목 추출
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (firstUserMessage) {
    let title = firstUserMessage.content
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 마크다운 제거 (간단한 패턴)
    title = title
      .replace(/^#+\s+/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^[-*]\s+/, '');

    if (title.endsWith('?')) {
      title = title.slice(0, -1).trim();
    }

    if (title.length > 50) {
      const sentences = title.split(/[.!?。！？]\s*/);
      if (sentences.length > 0 && sentences[0].length > 0) {
        title = sentences[0].trim();
      } else {
        const words = title.split(/\s+/);
        let truncated = '';
        for (const word of words) {
          if ((truncated + ' ' + word).length <= 45) {
            truncated += (truncated ? ' ' : '') + word;
          } else {
            break;
          }
        }
        title = truncated || title.slice(0, 45);
      }
    }

    if (title.length > 50) {
      title = title.slice(0, 47) + '...';
    }

    return title || '새 채팅';
  }

  // 사용자 메시지가 없으면 첫 번째 AI 응답에서 추출
  const firstAssistantMessage = messages.find((m) => m.role === 'assistant');
  if (firstAssistantMessage) {
    let title = firstAssistantMessage.content
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    title = title
      .replace(/^#+\s+/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/```[\s\S]*?```/g, '');

    const sentences = title.split(/[.!?。！？]\s*/);
    if (sentences.length > 0 && sentences[0].length > 0) {
      title = sentences[0].trim();
    }

    if (title.length > 50) {
      title = title.slice(0, 47) + '...';
    }

    return title || '새 채팅';
  }

  return '새 채팅';
}

export const storage = {
  // 모든 세션 조회
  async getAllSessions(): Promise<ChatSession[]> {
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (sessionsError) {
        console.error('Failed to load sessions:', sessionsError);
        return [];
      }

      if (!sessions || sessions.length === 0) return [];

      // 모든 메시지를 한 번에 조회
      const { data: allMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .in(
          'session_id',
          sessions.map((s) => s.id)
        );

      if (messagesError) {
        console.error('Failed to load messages:', messagesError);
        return sessions.map((s) => toAppSession(s, []));
      }

      // 세션별로 메시지 그룹화
      const messagesBySession = new Map<string, DbMessage[]>();
      (allMessages || []).forEach((m) => {
        const arr = messagesBySession.get(m.session_id) || [];
        arr.push(m);
        messagesBySession.set(m.session_id, arr);
      });

      return sessions.map((s) =>
        toAppSession(s, messagesBySession.get(s.id) || [])
      );
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  },

  // 세션 저장
  async saveSession(session: ChatSession): Promise<void> {
    try {
      // 세션 upsert
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .upsert({
          id: session.id,
          title: session.title,
          created_at: session.createdAt,
          updated_at: session.updatedAt,
        });

      if (sessionError) {
        console.error('Failed to save session:', sessionError);
        return;
      }

      // 기존 메시지 삭제 후 재삽입 (간단한 동기화)
      await supabase.from('messages').delete().eq('session_id', session.id);

      if (session.messages.length > 0) {
        const { error: messagesError } = await supabase.from('messages').insert(
          session.messages.map((m) => ({
            id: m.id,
            session_id: session.id,
            role: m.role,
            content: m.content,
          }))
        );

        if (messagesError) {
          console.error('Failed to save messages:', messagesError);
        }
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  },

  // 세션 조회
  async getSession(id: string): Promise<ChatSession | null> {
    try {
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (sessionError || !session) {
        return null;
      }

      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', id);

      if (messagesError) {
        console.error('Failed to load messages:', messagesError);
        return toAppSession(session, []);
      }

      return toAppSession(session, messages || []);
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  },

  // 세션 삭제
  async deleteSession(id: string): Promise<void> {
    try {
      // CASCADE로 메시지도 자동 삭제됨
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete session:', error);
        return;
      }

      // 현재 세션이 삭제된 경우 초기화
      const currentId = this.getCurrentSessionId();
      if (currentId === id) {
        this.setCurrentSessionId(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  },

  // 현재 세션 ID 조회 (동기 - localStorage 사용)
  getCurrentSessionId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CURRENT_SESSION_KEY);
  },

  // 현재 세션 ID 설정 (동기 - localStorage 사용)
  setCurrentSessionId(id: string | null): void {
    if (typeof window === 'undefined') return;

    if (id) {
      localStorage.setItem(CURRENT_SESSION_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  },

  // 새 세션 생성
  async createSession(title?: string): Promise<ChatSession> {
    const session: ChatSession = {
      id: Date.now().toString(),
      title: title || '새 채팅',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };

    await this.saveSession(session);
    return session;
  },

  // 세션 제목 업데이트
  async updateSessionTitle(id: string, title: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({
          title,
          updated_at: Date.now(),
        })
        .eq('id', id);

      if (error) {
        console.error('Failed to update session title:', error);
      }
    } catch (error) {
      console.error('Failed to update session title:', error);
    }
  },

  // 세션에 메시지 추가
  async addMessage(sessionId: string, message: Message): Promise<void> {
    try {
      // 메시지 삽입
      const { error: msgError } = await supabase.from('messages').insert({
        id: message.id,
        session_id: sessionId,
        role: message.role,
        content: message.content,
      });

      if (msgError) {
        console.error('Failed to add message:', msgError);
        return;
      }

      // 세션 updated_at 갱신
      await supabase
        .from('chat_sessions')
        .update({ updated_at: Date.now() })
        .eq('id', sessionId);

      // 제목 자동 업데이트 (첫 메시지인 경우)
      await this.autoUpdateTitle(sessionId);
    } catch (error) {
      console.error('Failed to add message:', error);
    }
  },

  // 세션 메시지 업데이트 (스트리밍 중 마지막 메시지 업데이트용)
  async updateLastMessage(sessionId: string, content: string): Promise<void> {
    try {
      // 마지막 assistant 메시지 조회
      const { data: messages, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('role', 'assistant')
        .order('id', { ascending: false })
        .limit(1);

      if (fetchError || !messages || messages.length === 0) {
        return;
      }

      const lastMessage = messages[0];

      // 메시지 내용 업데이트
      const { error: updateError } = await supabase
        .from('messages')
        .update({ content })
        .eq('id', lastMessage.id);

      if (updateError) {
        console.error('Failed to update last message:', updateError);
        return;
      }

      // 세션 updated_at 갱신
      await supabase
        .from('chat_sessions')
        .update({ updated_at: Date.now() })
        .eq('id', sessionId);

      // 제목 자동 업데이트
      await this.autoUpdateTitle(sessionId);
    } catch (error) {
      console.error('Failed to update last message:', error);
    }
  },

  // 세션 제목 자동 업데이트 (메시지 변경 시)
  async autoUpdateTitle(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session || session.messages.length === 0) return;

      const newTitle = generateTitleFromMessages(session.messages);
      if (newTitle && newTitle !== '새 채팅' && newTitle !== session.title) {
        await this.updateSessionTitle(sessionId, newTitle);
      }
    } catch (error) {
      console.error('Failed to auto update title:', error);
    }
  },

  // 유틸리티: 제목 생성 함수 노출
  generateTitleFromMessages,
};
