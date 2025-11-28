import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

// 서버 설정 스키마
export const ServerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  transport: z.enum(['stdio', 'sse', 'streamable-http']),
  // STDIO 설정
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  // HTTP 설정
  url: z.string().url().optional(),
  // 인증 설정
  authToken: z.string().optional(),
  authHeader: z.string().optional(), // 기본값: 'Authorization'
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

interface ServerConnection {
  config: ServerConfig;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;
  connected: boolean;
}

// Node.js global 객체에 MCP 연결 저장 (핫 리로딩에도 연결 유지)
const globalForMCP = globalThis as typeof globalThis & {
  mcpConnections?: Map<string, ServerConnection>;
};

class MCPManager {
  private static instance: MCPManager;
  private connections: Map<string, ServerConnection>;

  private constructor() {
    // global 객체에서 기존 연결 가져오기 (핫 리로딩 대응)
    if (!globalForMCP.mcpConnections) {
      globalForMCP.mcpConnections = new Map();
    }
    this.connections = globalForMCP.mcpConnections;
    console.log('[MCP Manager] Initialized with', this.connections.size, 'existing connections');
  }

  static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  async connect(config: ServerConfig): Promise<void> {
    if (this.connections.has(config.id)) {
      const existing = this.connections.get(config.id)!;
      if (existing.connected) {
        throw new Error(`Server ${config.name} is already connected`);
      }
      // 기존 연결 정리
      await this.disconnect(config.id);
    }

    const client = new Client({
      name: 'mcp-client-app',
      version: '1.0.0',
    });

    // 인증 헤더 준비
    const needsAuth = config.authToken && (config.transport === 'sse' || config.transport === 'streamable-http');
    const authHeaderName = config.authHeader || 'Authorization';
    const authValue = config.authToken && config.authToken.startsWith('Bearer ') 
      ? config.authToken 
      : config.authToken 
      ? `Bearer ${config.authToken}`
      : undefined;
    
    const requestInit: RequestInit | undefined = needsAuth && authValue
      ? {
          headers: {
            [authHeaderName]: authValue,
          },
        }
      : undefined;

    let transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;

    try {
      switch (config.transport) {
        case 'stdio':
          if (!config.command) {
            throw new Error('Command is required for STDIO transport');
          }
          transport = new StdioClientTransport({
            command: config.command,
            args: config.args || [],
          });
          break;

        case 'sse':
          if (!config.url) {
            throw new Error('URL is required for SSE transport');
          }
          transport = new SSEClientTransport(new URL(config.url), {
            requestInit,
            eventSourceInit: requestInit ? {
              headers: requestInit.headers as Record<string, string>,
            } : undefined,
          });
          break;

        case 'streamable-http':
          if (!config.url) {
            throw new Error('URL is required for Streamable HTTP transport');
          }
          try {
            transport = new StreamableHTTPClientTransport(new URL(config.url), {
              requestInit,
            });
          } catch (error) {
            // Streamable HTTP 실패 시 SSE로 폴백
            console.warn('Streamable HTTP failed, falling back to SSE');
            transport = new SSEClientTransport(new URL(config.url), {
              requestInit,
              eventSourceInit: requestInit ? {
                headers: requestInit.headers as Record<string, string>,
              } : undefined,
            });
          }
          break;

        default:
          throw new Error(`Unsupported transport type: ${config.transport}`);
      }

      try {
        console.log('[MCP Manager] Attempting to connect:', {
          serverId: config.id,
          transport: config.transport,
          url: config.url,
          hasAuth: !!config.authToken,
          authHeader: authHeaderName,
        });
        await client.connect(transport);
        console.log('[MCP Manager] ✓ Connected successfully');
      } catch (error: any) {
        console.error('[MCP Manager] ✗ Connection failed:', {
          error: error?.message,
          stack: error?.stack,
          name: error?.name,
        });
        throw error;
      }

      const connection: ServerConnection = {
        config,
        client,
        transport,
        connected: true,
      };

      this.connections.set(config.id, connection);
    } catch (error) {
      // 연결 실패 시 정리
      try {
        await client.close();
      } catch {}
      throw error;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    try {
      if (connection.connected) {
        await connection.client.close();
      }
    } catch (error) {
      console.error(`Error disconnecting server ${serverId}:`, error);
    } finally {
      this.connections.delete(serverId);
    }
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map((id) =>
      this.disconnect(id)
    );
    await Promise.all(promises);
  }

  getConnection(serverId: string): ServerConnection | undefined {
    return this.connections.get(serverId);
  }

  // MCP Client 객체 가져오기 (mcpToTool에서 사용)
  getClient(serverId: string): Client | undefined {
    const connection = this.connections.get(serverId);
    return connection?.connected ? connection.client : undefined;
  }

  // 연결된 모든 Client 객체 가져오기 (mcpToTool에서 사용)
  getConnectedClients(): Client[] {
    return Array.from(this.connections.values())
      .filter((conn) => conn.connected)
      .map((conn) => conn.client);
  }

  getConnectedServers(): ServerConfig[] {
    return Array.from(this.connections.values())
      .filter((conn) => conn.connected)
      .map((conn) => conn.config);
  }

  isConnected(serverId: string): boolean {
    return this.connections.get(serverId)?.connected || false;
  }

  async listTools(serverId: string) {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return await connection.client.listTools();
  }

  async callTool(serverId: string, name: string, args: Record<string, any>) {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return await connection.client.callTool({ name, arguments: args });
  }

  async listResources(serverId: string) {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return await connection.client.listResources();
  }

  async readResource(serverId: string, uri: string) {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return await connection.client.readResource({ uri });
  }

  async listPrompts(serverId: string) {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return await connection.client.listPrompts();
  }

  async getPrompt(serverId: string, name: string, args?: Record<string, any>) {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return await connection.client.getPrompt({
      name,
      arguments: args || {},
    });
  }
}

export const mcpManager = MCPManager.getInstance();

