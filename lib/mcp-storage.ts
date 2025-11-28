import { supabase } from './supabase';
import { ServerConfig } from './mcp-manager';

// Database 타입 정의
export interface DbMCPServer {
  id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'streamable-http';
  command?: string | null;
  args?: string[] | null;
  url?: string | null;
  auth_token?: string | null;
  auth_header?: string | null;
  enabled?: boolean | null;
  created_at: number;
  updated_at: number;
}

// DB -> App 타입 변환
function toAppServer(dbServer: DbMCPServer): ServerConfig {
  return {
    id: dbServer.id,
    name: dbServer.name,
    transport: dbServer.transport,
    ...(dbServer.command && { command: dbServer.command }),
    ...(dbServer.args && dbServer.args.length > 0 && { args: dbServer.args }),
    ...(dbServer.url && { url: dbServer.url }),
    ...(dbServer.auth_token && { authToken: dbServer.auth_token }),
    ...(dbServer.auth_header && { authHeader: dbServer.auth_header }),
  };
}

// App -> DB 타입 변환
function toDbServer(config: ServerConfig): Omit<DbMCPServer, 'created_at' | 'updated_at'> {
  return {
    id: config.id,
    name: config.name,
    transport: config.transport,
    command: config.command || null,
    args: config.args && config.args.length > 0 ? config.args : null,
    url: config.url || null,
    auth_token: config.authToken || null,
    auth_header: config.authHeader || null,
  };
}

export const mcpStorage = {
  // 모든 서버 조회
  async getAllServers(): Promise<ServerConfig[]> {
    try {
      const { data: servers, error } = await supabase
        .from('mcp_servers')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to load MCP servers:', error);
        return [];
      }

      if (!servers || servers.length === 0) return [];

      return servers.map(toAppServer);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      return [];
    }
  },

  // 서버 저장 (upsert)
  async saveServer(config: ServerConfig): Promise<void> {
    try {
      const now = Date.now();
      const dbServer = toDbServer(config);

      // 기존 서버 확인
      const { data: existing } = await supabase
        .from('mcp_servers')
        .select('created_at')
        .eq('id', config.id)
        .single();

      const { error } = await supabase
        .from('mcp_servers')
        .upsert({
          ...dbServer,
          created_at: existing?.created_at || now,
          updated_at: now,
        });

      if (error) {
        console.error('Failed to save MCP server:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          serverId: config.id,
        });
        throw error;
      }
    } catch (error) {
      console.error('Failed to save MCP server:', error);
      throw error;
    }
  },

  // 여러 서버 저장 (전체 교체)
  async saveAllServers(servers: ServerConfig[]): Promise<void> {
    try {
      const now = Date.now();

      // 기존 서버들의 created_at 조회
      const { data: existingServers } = await supabase
        .from('mcp_servers')
        .select('id, created_at');

      const existingMap = new Map(
        (existingServers || []).map((s) => [s.id, s.created_at])
      );

      // 모든 서버 upsert
      const dbServers = servers.map((config) => {
        const dbServer = toDbServer(config);
        return {
          ...dbServer,
          created_at: existingMap.get(config.id) || now,
          updated_at: now,
        };
      });

      const { error } = await supabase.from('mcp_servers').upsert(dbServers);

      if (error) {
        console.error('Failed to save all MCP servers:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          serversCount: servers.length,
        });
        throw error;
      }

      // 삭제된 서버 제거 (DB에 있지만 새 목록에 없는 서버)
      const serverIds = new Set(servers.map((s) => s.id));
      const { data: allDbServers } = await supabase
        .from('mcp_servers')
        .select('id');

      if (allDbServers) {
        const toDelete = allDbServers
          .map((s) => s.id)
          .filter((id) => !serverIds.has(id));

        if (toDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('mcp_servers')
            .delete()
            .in('id', toDelete);

          if (deleteError) {
            console.error('Failed to delete removed MCP servers:', deleteError);
          }
        }
      }
    } catch (error) {
      console.error('Failed to save all MCP servers:', error);
      throw error;
    }
  },

  // 서버 삭제
  async deleteServer(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('mcp_servers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete MCP server:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          serverId: id,
        });
        throw error;
      }
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
      throw error;
    }
  },

  // 서버 조회
  async getServer(id: string): Promise<ServerConfig | null> {
    try {
      const { data: server, error } = await supabase
        .from('mcp_servers')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !server) {
        return null;
      }

      return toAppServer(server);
    } catch (error) {
      console.error('Failed to get MCP server:', error);
      return null;
    }
  },

  // 활성화된 서버만 조회
  async getEnabledServers(): Promise<ServerConfig[]> {
    try {
      const { data: servers, error } = await supabase
        .from('mcp_servers')
        .select('*')
        .eq('enabled', true)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to load enabled MCP servers:', error);
        return [];
      }

      if (!servers || servers.length === 0) return [];

      return servers.map(toAppServer);
    } catch (error) {
      console.error('Failed to load enabled MCP servers:', error);
      return [];
    }
  },

  // 서버 활성화 상태 변경
  async setServerEnabled(id: string, enabled: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('mcp_servers')
        .update({ enabled, updated_at: Date.now() })
        .eq('id', id);

      if (error) {
        console.error('Failed to update server enabled status:', {
          error,
          code: error.code,
          message: error.message,
          serverId: id,
          enabled,
        });
        throw error;
      }
    } catch (error) {
      console.error('Failed to update server enabled status:', error);
      throw error;
    }
  },
};

