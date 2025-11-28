import { mcpManager } from './mcp-manager';

// MCP 도구 타입 정의
interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: unknown[];
      items?: {
        type: string;
      };
      properties?: Record<string, unknown>;
    }>;
    required?: string[];
  };
}

// Gemini Function Calling 형식의 도구 정의
export interface GeminiFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: unknown[];
    }>;
    required?: string[];
  };
}

// MCP 도구를 Gemini Function Calling 형식으로 변환
export function convertMCPToolToGemini(
  tool: MCPTool,
  serverId: string,
  serverName: string
): GeminiFunction {
  const properties: Record<string, {
    type: string;
    description?: string;
    enum?: unknown[];
    items?: {
      type: string;
    };
    properties?: Record<string, unknown>;
  }> = {};
  const required: string[] = [];

  // MCP 도구의 inputSchema를 Gemini 형식으로 변환
  if (tool.inputSchema?.properties) {
    for (const [key, value] of Object.entries(tool.inputSchema.properties)) {
      const prop: {
        type: string;
        description?: string;
        enum?: unknown[];
        items?: {
          type: string;
        };
        properties?: Record<string, unknown>;
      } = {
        type: 'string', // 기본값, 아래에서 덮어씌워짐
        description: value.description || '',
      };

      // 타입 변환
      if (value.type === 'string') {
        prop.type = 'string';
      } else if (value.type === 'number' || value.type === 'integer') {
        prop.type = 'number';
      } else if (value.type === 'boolean') {
        prop.type = 'boolean';
      } else if (value.type === 'array') {
        prop.type = 'array';
        if (value.items) {
          prop.items = { type: value.items.type || 'string' };
        }
      } else if (value.type === 'object') {
        prop.type = 'object';
        if (value.properties) {
          prop.properties = value.properties;
        }
      } else {
        prop.type = 'string'; // 기본값
      }

      // enum 처리
      if (value.enum) {
        prop.enum = value.enum;
      }

      properties[key] = prop;

      // required 필드 확인
      if (tool.inputSchema.required?.includes(key)) {
        required.push(key);
      }
    }
  }

  // 서버 정보를 포함한 고유한 이름 생성
  const uniqueName = `${serverId}_${tool.name}`;

  return {
    name: uniqueName,
    description: `${tool.description || tool.name} (서버: ${serverName})`,
    parameters: {
      type: 'object',
      properties: {
        ...properties,
        // 내부적으로 사용할 서버 ID와 도구 이름 추가
        _mcp_server_id: {
          type: 'string',
          description: 'MCP 서버 ID (내부 사용)',
        },
        _mcp_tool_name: {
          type: 'string',
          description: 'MCP 도구 이름 (내부 사용)',
        },
      },
      required: required.length > 0 ? required : undefined,
    },
  };
}

// 연결된 모든 서버의 도구를 Gemini 형식으로 변환
export async function getAllMCPToolsAsGemini(
  enabledServerIds?: Set<string>
): Promise<GeminiFunction[]> {
  const tools: GeminiFunction[] = [];
  const connectedServers = mcpManager.getConnectedServers();

  for (const server of connectedServers) {
    // 활성화된 서버만 필터링 (enabledServerIds가 제공된 경우)
    if (enabledServerIds && !enabledServerIds.has(server.id)) {
      continue;
    }

    try {
      const toolsList = await mcpManager.listTools(server.id);
      if (toolsList.tools) {
        for (const tool of toolsList.tools) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const geminiTool = convertMCPToolToGemini(tool as any, server.id, server.name);
          tools.push(geminiTool);
        }
      }
    } catch (error) {
      console.error(`Failed to load tools from ${server.name}:`, error);
    }
  }

  return tools;
}

// Gemini Function Calling 결과를 MCP 도구 호출로 변환
interface GeminiFunctionCall {
  name: string;
  args?: Record<string, unknown>;
}

export function parseGeminiFunctionCall(
  functionCall: GeminiFunctionCall
): { serverId: string; toolName: string; args: Record<string, unknown> } | null {
  const functionName = functionCall.name;
  
  // 함수 이름에서 서버 ID와 도구 이름 추출
  // 형식: {serverId}_{toolName}
  const parts = functionName.split('_');
  if (parts.length < 2) {
    return null;
  }

  // 마지막 부분이 도구 이름, 나머지가 서버 ID
  const toolName = parts[parts.length - 1];
  const serverId = parts.slice(0, -1).join('_');

  // 인자에서 내부 필드 제거
  const args = { ...functionCall.args };
  delete args._mcp_server_id;
  delete args._mcp_tool_name;

  return {
    serverId,
    toolName,
    args,
  };
}

