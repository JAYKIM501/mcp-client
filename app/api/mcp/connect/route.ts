import { NextRequest, NextResponse } from 'next/server';
import { mcpManager, ServerConfigSchema } from '@/lib/mcp-manager';

// POST: 서버 연결
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = ServerConfigSchema.parse(body);

    // 이미 연결되어 있는지 실제 연결 상태를 확인
    const connectedServers = mcpManager.getConnectedServers();
    const actuallyConnected = connectedServers.some(s => s.id === config.id);
    
    if (actuallyConnected) {
      console.log('[MCP Connect] Server actually connected:', config.name);
      return NextResponse.json({ 
        success: true, 
        message: 'Already connected',
        alreadyConnected: true 
      });
    }
    
    console.log('[MCP Connect] Server not connected, attempting connection...');

    // 디버깅: 인증 토큰이 있는지 확인
    if (config.authToken) {
      console.log('[MCP Connect] Auth token present:', {
        serverId: config.id,
        serverName: config.name,
        transport: config.transport,
        url: config.url,
        authHeader: config.authHeader || 'Authorization',
        tokenPrefix: config.authToken.substring(0, 10) + '...',
      });
    }

    await mcpManager.connect(config);

    return NextResponse.json({ success: true, message: 'Connected' });
  } catch (error: any) {
    // "already connected" 에러는 성공으로 처리
    if (error.message?.includes('already connected')) {
      console.log('[MCP Connect] Server already connected (from error)');
      return NextResponse.json({ 
        success: true, 
        message: 'Already connected',
        alreadyConnected: true 
      });
    }

    console.error('[MCP Connect] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect' },
      { status: 500 }
    );
  }
}

