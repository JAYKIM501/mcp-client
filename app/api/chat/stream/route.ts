import { GoogleGenAI, ApiError, Type } from '@google/genai';
import { NextRequest } from 'next/server';
import { mcpManager, ServerConfig } from '@/lib/mcp-manager';
import { mcpStorage } from '@/lib/mcp-storage';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Supabase 클라이언트 생성 (이미지 업로드용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// 이미지 업로드 함수
async function uploadImageToSupabase(base64Data: string, mimeType: string): Promise<string | null> {
  if (!supabase) {
    console.error('Supabase credentials not found');
    return null;
  }

  try {
    // Base64 헤더 제거 및 정리
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
    const buffer = Buffer.from(base64Content, 'base64');
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${mimeType.split('/')[1] || 'png'}`;

    const { error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Failed to upload image:', error);
    return null;
  }
}

// 서버 ID와 도구 이름을 안전한 함수 이름으로 변환
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

// 해시 함수 (간단한 구현)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// MCP 도구를 Gemini Function Declaration 형식으로 변환
function convertMCPToolToGemini(tool: any, serverId: string, serverIdMap: Map<string, string>) {
  const safeServerId = sanitizeName(serverId);
  const safeToolName = sanitizeName(tool.name);
  
  // 고유 ID 생성 (길이 제한 고려)
  // mcp_{hash(serverId)}_{safeToolName} 형식 사용
  // safeToolName이 너무 길면 잘라서 사용
  const serverHash = simpleHash(serverId);
  const prefix = `mcp_${serverHash}_`;
  const maxToolNameLength = 64 - prefix.length;
  const truncatedToolName = safeToolName.substring(0, maxToolNameLength);
  
  const uniqueKey = `${prefix}${truncatedToolName}`;
  
  // 원래 ID와 이름을 저장 (복원을 위해)
  serverIdMap.set(uniqueKey, JSON.stringify({ serverId, toolName: tool.name }));
  
  return {
    name: uniqueKey,
    description: tool.description || `Tool: ${tool.name}`,
    parameters: tool.inputSchema || {
      type: Type.OBJECT,
      properties: {},
    },
  };
}

// Gemini Function Call 이름에서 서버 ID와 도구 이름 추출
function parseFunctionCallName(name: string, serverIdMap: Map<string, string>): { serverId: string; toolName: string } | null {
  if (serverIdMap.has(name)) {
    try {
      return JSON.parse(serverIdMap.get(name)!);
    } catch (e) {
      console.error('Failed to parse server mapping:', e);
    }
  }
  
  // 맵에 없는 경우 (fallback logic - 이전 호환성)
  const parts = name.split('__');
  if (parts.length >= 2) {
    return {
      serverId: parts[0],
      toolName: parts.slice(1).join('__'),
    };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, useMCPTools = true } = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // 활성화된 서버의 MCP 도구 가져오기
    const functionDeclarations: any[] = [];
    const serverToolMap = new Map<string, ServerConfig>();
    const serverIdMap = new Map<string, string>(); // 안전한 ID -> 원래 ID 매핑
    
    if (useMCPTools) {
      const enabledServers = await mcpStorage.getEnabledServers();
      const connectedServers = mcpManager.getConnectedServers();
      
      // 활성화되고 연결된 서버의 도구 가져오기
      for (const server of connectedServers) {
        if (enabledServers.some(s => s.id === server.id)) {
          try {
            const toolsResult = await mcpManager.listTools(server.id);
            if (toolsResult.tools && toolsResult.tools.length > 0) {
              for (const tool of toolsResult.tools) {
                const geminiTool = convertMCPToolToGemini(tool, server.id, serverIdMap);
                functionDeclarations.push(geminiTool);
                // serverToolMap.set(geminiTool.name, server); // 필요하다면 사용
              }
            }
          } catch (error) {
            console.error(`[Chat API] Failed to get tools from ${server.name}:`, error);
          }
        }
      }
    }

    // 채팅 히스토리 구성
    const contents: any[] = [];
    
    if (history) {
      for (const msg of history) {
        if (msg.role === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: msg.content }],
          });
        } else if (msg.role === 'assistant') {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content || '' }],
          });
        }
      }
    }

    // 현재 메시지 추가
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // MCP 도구가 있을 때 수동 Function Calling 처리
    if (functionDeclarations.length > 0) {
      const encoder = new TextEncoder();
      
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            let currentContents = [...contents];
            let maxIterations = 5; // 무한 루프 방지
            let iteration = 0;
            
            while (iteration < maxIterations) {
              iteration++;
              
              // Gemini 호출
              const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: currentContents,
                config: {
                  tools: [{
                    functionDeclarations,
                  }],
                },
              });

              // Function Call 확인
              if (response.functionCalls && response.functionCalls.length > 0) {
                for (const funcCall of response.functionCalls) {
                  const parsed = parseFunctionCallName(funcCall.name || '', serverIdMap);
                  
                  // Function Call 정보 전송
                  const funcCallData = JSON.stringify({
                    type: 'function_call',
                    functionCall: {
                      name: funcCall.name,
                      args: funcCall.args || {},
                    },
                  });
                  controller.enqueue(encoder.encode(`data: ${funcCallData}\n\n`));

                  // MCP 도구 실행
                  let toolResult: any;
                  try {
                    if (parsed) {
                      toolResult = await mcpManager.callTool(
                        parsed.serverId,
                        parsed.toolName,
                        funcCall.args || {}
                      );

                      // 결과에서 이미지 추출 및 업로드 (Supabase Storage)
                      if (toolResult && !toolResult.isError && toolResult.content) {
                        // content가 배열인 경우 순회
                        if (Array.isArray(toolResult.content)) {
                          for (const item of toolResult.content) {
                            if (item.type === 'image' && item.data) {
                              const mimeType = item.mimeType || 'image/png';
                              const url = await uploadImageToSupabase(item.data, mimeType);
                              if (url) {
                                // 데이터를 URL로 교체하고 타입을 유지하거나 변경할 수 있음
                                // 여기서는 data를 URL로 교체하고 type은 그대로 둠 (클라이언트 뷰어 호환성)
                                // 또는 텍스트로 변환하여 마크다운 이미지 문법을 넣을 수도 있음
                                item.data = url;
                                // item.type = 'image_url'; // 필요 시 변경
                              }
                            } else if (item.type === 'resource' && item.resource && item.resource.blob) {
                               const mimeType = item.resource.mimeType || 'image/png';
                               const url = await uploadImageToSupabase(item.resource.blob, mimeType);
                               if (url) {
                                 // 리소스를 이미지 타입으로 변경하거나 URL 포함
                                 item.type = 'image';
                                 item.data = url;
                                 item.mimeType = mimeType;
                                 delete item.resource;
                               }
                            }
                          }
                        }
                      }

                    } else {
                      toolResult = { error: 'Invalid function name format' };
                    }
                  } catch (error) {
                    toolResult = { 
                      error: error instanceof Error ? error.message : 'Tool execution failed' 
                    };
                  }

                  // Function 결과 전송 (이미지 포함)
                  const funcResultData = JSON.stringify({
                    type: 'function_result',
                    functionCall: {
                      name: funcCall.name,
                      args: funcCall.args || {},
                    },
                    result: toolResult,
                  });
                  controller.enqueue(encoder.encode(`data: ${funcResultData}\n\n`));

                  // 다음 턴을 위해 히스토리에 추가
                  currentContents.push({
                    role: 'model',
                    parts: [{
                      functionCall: {
                        name: funcCall.name,
                        args: funcCall.args || {},
                      },
                    }],
                  });

                  currentContents.push({
                    role: 'user',
                    parts: [{
                      functionResponse: {
                        name: funcCall.name,
                        response: toolResult,
                      },
                    }],
                  });
                }
              } else {
                // Function Call이 없으면 텍스트 응답 전송 후 종료
                const responseText = response.text || '';
                if (responseText) {
                  const data = JSON.stringify({ text: responseText });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
                break;
              }
            }
            
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Response streaming error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Response error occurred';
            const errorData = JSON.stringify({ error: errorMessage });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // MCP 도구 없이 스트리밍 응답
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents,
    });

    // ReadableStream으로 변환 (MCP 도구 없이 스트리밍)
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // 텍스트 콘텐츠 처리
            if (chunk.text) {
              const data = JSON.stringify({ text: chunk.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Streaming error occurred';
          const errorData = JSON.stringify({ error: errorMessage });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    
    if (error instanceof ApiError) {
      return new Response(
        JSON.stringify({ 
          error: error.message,
          status: error.status,
          details: error.details 
        }),
        { 
          status: error.status || 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

