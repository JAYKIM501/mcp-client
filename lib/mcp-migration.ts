import { mcpStorage } from './mcp-storage';
import { ServerConfig } from './mcp-manager';

const STORAGE_KEY = 'mcp-servers';

/**
 * localStorage에서 MCP 서버 설정을 가져옵니다.
 */
function getLocalStorageServers(): ServerConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * localStorage의 서버 설정을 Supabase로 마이그레이션합니다.
 * 마이그레이션 후 localStorage는 삭제하지 않습니다 (백업용).
 */
export async function migrateLocalStorageToSupabase(): Promise<void> {
  try {
    // Supabase에서 기존 서버 확인
    const existingServers = await mcpStorage.getAllServers();
    
    // 이미 Supabase에 서버가 있으면 마이그레이션하지 않음
    if (existingServers.length > 0) {
      console.log('[MCP Migration] Servers already exist in Supabase, skipping migration');
      return;
    }

    // localStorage에서 서버 가져오기
    const localServers = getLocalStorageServers();
    
    if (localServers.length === 0) {
      console.log('[MCP Migration] No servers in localStorage, skipping migration');
      return;
    }

    // Supabase에 저장
    await mcpStorage.saveAllServers(localServers);
    console.log(`[MCP Migration] Migrated ${localServers.length} servers from localStorage to Supabase`);
  } catch (error) {
    console.error('[MCP Migration] Failed to migrate servers:', error);
    // 마이그레이션 실패해도 앱은 계속 동작하도록 에러를 던지지 않음
  }
}

