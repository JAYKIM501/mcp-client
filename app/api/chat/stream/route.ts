import { GoogleGenAI, ApiError } from '@google/genai';
import { NextRequest } from 'next/server';
import { mcpManager } from '@/lib/mcp-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

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

    // 채팅 히스토리 구성
    const contents = history?.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })) || [];

    // 현재 메시지 추가
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // MCP 도구 가져오기 (연결된 서버에서)
    const connectedServers = mcpManager.getConnectedServers();
    const tools: any[] = [];
    
    // TODO: MCP 도구를 Gemini Function Calling 형식으로 변환
    // 현재는 기본 구조만 구현
    for (const server of connectedServers) {
      try {
        const toolsList = await mcpManager.listTools(server.id);
        // MCP 도구를 Gemini Function Calling 형식으로 변환하는 로직 추가 필요
        // tools.push(...convertMCPToolsToGeminiFormat(toolsList.tools));
      } catch (error) {
        console.error(`Failed to load tools from ${server.name}:`, error);
      }
    }

    // 스트리밍 응답 생성
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash-001',
      contents,
      // TODO: tools가 있을 때만 전달
      // ...(tools.length > 0 && { tools }),
    });

    // ReadableStream으로 변환
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
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

