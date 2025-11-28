import { supabase } from './supabase';
import type { ChatSession, Message } from './storage';

const OLD_STORAGE_KEY = 'chat-sessions';
const MIGRATION_FLAG_KEY = 'supabase-migration-done';

interface LegacySession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

/**
 * LocalStorage에서 기존 세션 데이터를 읽어옵니다.
 */
export function getLocalStorageSessions(): LegacySession[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(OLD_STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read localStorage sessions:', error);
    return [];
  }
}

/**
 * 마이그레이션이 이미 완료되었는지 확인합니다.
 */
export function isMigrationDone(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
}

/**
 * 마이그레이션 완료 플래그를 설정합니다.
 */
export function setMigrationDone(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}

/**
 * LocalStorage의 모든 채팅 세션을 Supabase로 마이그레이션합니다.
 * @returns 마이그레이션된 세션 수
 */
export async function migrateLocalStorageToSupabase(): Promise<{
  success: boolean;
  migratedCount: number;
  errors: string[];
}> {
  const sessions = getLocalStorageSessions();
  const errors: string[] = [];
  let migratedCount = 0;

  if (sessions.length === 0) {
    return { success: true, migratedCount: 0, errors: [] };
  }

  for (const session of sessions) {
    try {
      // 세션이 이미 존재하는지 확인
      const { data: existing } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', session.id)
        .single();

      if (existing) {
        // 이미 존재하면 스킵
        continue;
      }

      // 세션 삽입
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          id: session.id,
          title: session.title,
          created_at: session.createdAt,
          updated_at: session.updatedAt,
        });

      if (sessionError) {
        errors.push(`세션 ${session.id}: ${sessionError.message}`);
        continue;
      }

      // 메시지 삽입
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
          errors.push(`세션 ${session.id} 메시지: ${messagesError.message}`);
          // 세션은 이미 삽입됨, 계속 진행
        }
      }

      migratedCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '알 수 없는 오류';
      errors.push(`세션 ${session.id}: ${errorMessage}`);
    }
  }

  if (migratedCount > 0 && errors.length === 0) {
    setMigrationDone();
  }

  return {
    success: errors.length === 0,
    migratedCount,
    errors,
  };
}

/**
 * LocalStorage의 채팅 데이터를 삭제합니다.
 * 마이그레이션 완료 후 호출하세요.
 */
export function clearLocalStorageSessions(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OLD_STORAGE_KEY);
}

/**
 * 마이그레이션이 필요한지 확인합니다.
 */
export function needsMigration(): boolean {
  if (typeof window === 'undefined') return false;
  if (isMigrationDone()) return false;

  const sessions = getLocalStorageSessions();
  return sessions.length > 0;
}

/**
 * 마이그레이션 상태를 초기화합니다 (테스트용)
 */
export function resetMigrationFlag(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MIGRATION_FLAG_KEY);
}

