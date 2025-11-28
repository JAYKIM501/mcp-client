'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { ServerConfig } from './mcp-manager';

interface ConnectedServer {
  id: string;
  name: string;
  transport: string;
}

interface MCPContextType {
  connectedServers: ConnectedServer[];
  isLoading: boolean;
  connect: (config: ServerConfig) => Promise<{ success: boolean; error?: string }>;
  disconnect: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
  isConnected: (serverId: string) => boolean;
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

const STORAGE_KEY = 'mcp-servers';

export function MCPProvider({ children }: { children: ReactNode }) {
  const [connectedServers, setConnectedServers] = useState<ConnectedServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp/status');
      if (res.ok) {
        const data = await res.json();
        setConnectedServers(data.servers || []);
      }
    } catch (error) {
      console.error('Failed to refresh MCP status:', error);
    }
  }, []);

  const connect = useCallback(async (config: ServerConfig): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        await refresh();
        return { success: true };
      } else {
        let errorMessage = '연결에 실패했습니다';
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorData.message || `HTTP ${res.status}: ${res.statusText}`;
          
          // "이미 연결됨" 에러는 성공으로 처리
          if (errorMessage.includes('already connected')) {
            await refresh();
            return { success: true };
          }
        } catch {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        console.error('Failed to connect:', errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '네트워크 오류가 발생했습니다';
      console.error('Failed to connect:', error);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const disconnect = useCallback(async (serverId: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/mcp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId }),
      });

      if (res.ok) {
        await refresh();
        return { success: true };
      } else {
        let errorMessage = '연결 해제에 실패했습니다';
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorData.message || `HTTP ${res.status}: ${res.statusText}`;
        } catch {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        console.error('Failed to disconnect:', errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '네트워크 오류가 발생했습니다';
      console.error('Failed to disconnect:', error);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const isConnected = useCallback((serverId: string): boolean => {
    return connectedServers.some((s) => s.id === serverId);
  }, [connectedServers]);

  // 초기 로드 및 주기적 상태 확인
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000); // 5초마다 상태 확인
    return () => clearInterval(interval);
  }, [refresh]);

  // 페이지 포커스 시 상태 새로고침
  useEffect(() => {
    const handleFocus = () => {
      refresh();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh]);

  // 커스텀 이벤트 리스너 (다른 탭/컴포넌트에서 상태 변경 시)
  useEffect(() => {
    const handleMCPChange = () => {
      refresh();
    };

    window.addEventListener('mcp-status-changed', handleMCPChange);
    return () => {
      window.removeEventListener('mcp-status-changed', handleMCPChange);
    };
  }, [refresh]);

  return (
    <MCPContext.Provider
      value={{
        connectedServers,
        isLoading,
        connect,
        disconnect,
        refresh,
        isConnected,
      }}
    >
      {children}
    </MCPContext.Provider>
  );
}

export function useMCP() {
  const context = useContext(MCPContext);
  if (context === undefined) {
    throw new Error('useMCP must be used within a MCPProvider');
  }
  return context;
}

// Supabase에서 서버 설정 가져오기 (비동기)
export async function getStoredServers(): Promise<ServerConfig[]> {
  try {
    const res = await fetch('/api/mcp/servers');
    if (res.ok) {
      const data = await res.json();
      return data.servers || [];
    }
    return [];
  } catch (error) {
    console.error('Failed to load stored servers:', error);
    return [];
  }
}

// Supabase에 서버 설정 저장 (비동기)
export async function saveStoredServers(servers: ServerConfig[]): Promise<void> {
  try {
    const res = await fetch('/api/mcp/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(servers),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save servers');
    }
  } catch (error) {
    console.error('Failed to save stored servers:', error);
    throw error;
  }
}

